import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { AICodingResult, AICodingCandidate } from '@/lib/types';

const CAUSAL_CONNECTORS = [
  'SECONDARY TO', 'DUE TO', 'CAUSED BY', 'AS A RESULT OF',
  'COMPLICATED BY', 'ASSOCIATED WITH',
];

const SPECIFIC_CONTEXT_WORDS = [
  'NEONATAL', 'NEWBORN', 'CONGENITAL', 'PREGNANCY', 'MATERNAL',
  'OBSTETRIC', 'DELIVERY', 'POSTPARTUM', 'PUERPERAL', 'ABORTION',
  'TRAUMATIC', 'OCCUPATIONAL', 'DRUG INDUCED', 'POISONING',
  'AMOEBIC', 'TUBERCULOUS', 'SYPHILITIC', 'RENOVASCULAR', 'MALIGNANT',
  'SECONDARY HYPERTENSION'
];

let cachedICDRecords: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function normalizeCHISAIText(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^A-Z0-9.+, ]/g, ' ')
    .replace(/\b(?:FINAL|DIAGNOSIS|DIAGNOSES|DX|THE|A|AN|OF)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeCHISAI(value: string): string[] {
  const stop: Record<string, boolean> = {
    WITH: true, WITHOUT: true, THE: true, AND: true, FOR: true,
    FROM: true, OTHER: true, OTHERS: true, UNSPECIFIED: true,
    SPECIFIED: true, DISEASE: true, DISORDER: true, CONDITION: true,
    NOS: true, NEC: true, SITE: true, NOT: true, DUE: true, TO: true
  };
  return normalizeCHISAIText(value).split(' ').filter(token => token.length >= 2 && !stop[token]);
}

function detectConnector(text: string): string | null {
  const upper = text.toUpperCase();
  for (const conn of CAUSAL_CONNECTORS) {
    if (upper.includes(conn)) return conn;
  }
  return null;
}

function expandAbbreviations(text: string, abbrevMap: Map<string, string>): string {
  return text.split(/\b/).map(word => {
    const upper = word.toUpperCase();
    return abbrevMap.get(upper) || word;
  }).join(' ').replace(/\s+/g, ' ').trim();
}

async function getOrFetchAllICD(supabase: any): Promise<any[]> {
  const now = Date.now();
  if (cachedICDRecords && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedICDRecords;
  }

  const all: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('icd10_db')
      .select('code, description, case_rate, hospital_fee, professional_fee')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  cachedICDRecords = all;
  lastCacheTime = now;
  return all;
}

function rankCHISAICandidates(diagnosis: string, records: any[], indexRules: any[]): any[] {
  const query = normalizeCHISAIText(diagnosis);
  const queryTokens = tokenizeCHISAI(query);
  const indexed: Record<string, { score: number; note: string }> = {};

  (indexRules || []).forEach(rule => {
    const patternTokens = tokenizeCHISAI(rule.pattern || rule.diagnosis_pattern);
    const patternMatched = patternTokens.length && patternTokens.every((token: string) => queryTokens.includes(token));
    const qualifierList = String(rule.qualifiers || '').split('|').map((q: string) => normalizeCHISAIText(q)).filter(Boolean);
    const qualifierMatched = !qualifierList.length || qualifierList.some((qualifier: string) => query.includes(qualifier));
    if (patternMatched && qualifierMatched) {
      const targetCode = (rule.code || rule.preferred_code || '').toUpperCase();
      indexed[targetCode] = {
        score: Math.min(100, Number(rule.weight) || 95),
        note: rule.note || rule.coding_note || 'Official diagnosis index pattern matched.'
      };
    }
  });

  return records.map(record => {
    const description = normalizeCHISAIText(record.description);
    const descriptionTokens = tokenizeCHISAI(description);
    const descriptionSet = new Set(descriptionTokens);
    const matchedTokens = queryTokens.filter(token => descriptionSet.has(token));

    const precision = queryTokens.length ? matchedTokens.length / queryTokens.length : 0;
    const recall = descriptionTokens.length ? matchedTokens.length / descriptionTokens.length : 0;
    const tokenScore = precision && recall ? (2 * precision * recall / (precision + recall)) * 60 : 0;
    let score = tokenScore;
    const codeUpper = record.code.toUpperCase();
    const indexedMatch = indexed[codeUpper];

    if (query === description) score += 50;
    else if (description.startsWith(query)) score += 40;
    else if (description.includes(query)) score += 30;
    else if (query.includes(description) && description.length >= 6) score += 20;

    // Direct code query bonus
    if (codeUpper === query) score += 100;
    else if (codeUpper.startsWith(query)) score += 40;

    // Special clinical qualifier penalty if user query does NOT specify it
    for (const ctx of SPECIFIC_CONTEXT_WORDS) {
      if (description.includes(ctx) && !query.includes(ctx)) {
        score -= 30;
      }
    }

    // Essential / Primary / Unspecified preference for general terms
    if (query === 'HYPERTENSION' && codeUpper === 'I10') score += 40;
    if ((query === 'UTI' || query === 'URINARY TRACT INFECTION') && codeUpper === 'N39.0') score += 40;

    if (indexedMatch) score = Math.max(score, indexedMatch.score);

    return {
      record,
      score: Math.min(100, Math.max(0, Math.round(score))),
      matchedTerms: matchedTokens.slice(0, 8),
      indexRuleMatched: Boolean(indexedMatch),
      note: indexedMatch ? indexedMatch.note : undefined,
    };
  })
  .filter(item => item.score >= 15)
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.record.code).localeCompare(String(b.record.code));
  });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const diagnosisText: string = body.diagnosisText || '';
  const facilityType: string = body.facilityType || 'level2';

  if (!diagnosisText.trim()) {
    return NextResponse.json({ error: 'Enter at least one diagnosis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Load abbreviations
  const { data: abbrevData } = await supabase.from('abbreviations').select('abbreviation, meaning');
  const abbrevMap = new Map<string, string>();
  
  // Built-in standard clinical abbreviations fallback
  const builtInAbbrevs: Record<string, string> = {
    'UTI': 'URINARY TRACT INFECTION',
    'URTI': 'UPPER RESPIRATORY TRACT INFECTION',
    'CAP': 'COMMUNITY ACQUIRED PNEUMONIA',
    'PCAP': 'PEDIATRIC COMMUNITY ACQUIRED PNEUMONIA',
    'HAP': 'HOSPITAL ACQUIRED PNEUMONIA',
    'HTN': 'HYPERTENSION',
    'DM': 'DIABETES MELLITUS',
    'DM2': 'TYPE 2 DIABETES MELLITUS',
    'T2DM': 'TYPE 2 DIABETES MELLITUS',
    'CKD': 'CHRONIC KIDNEY DISEASE',
    'AKI': 'ACUTE KIDNEY INJURY',
    'CVA': 'CEREBROVASCULAR ACCIDENT',
    'CHF': 'CONGESTIVE HEART FAILURE',
    'AMI': 'ACUTE MYOCARDIAL INFARCTION',
    'ARF': 'ACUTE RESPIRATORY FAILURE',
    'AGE': 'ACUTE GASTROENTERITIS',
    'AP': 'ACUTE APPENDICITIS',
    'NSD': 'NORMAL SPONTANEOUS DELIVERY',
    'CS': 'CESAREAN SECTION',
  };
  Object.keys(builtInAbbrevs).forEach(k => abbrevMap.set(k, builtInAbbrevs[k]));
  (abbrevData || []).forEach((r: any) => abbrevMap.set(r.abbreviation.toUpperCase(), r.meaning));

  // Load diagnosis index rules
  const { data: indexRules } = await supabase.from('diagnosis_index').select('*');

  // Load all 4,640+ ICD records
  const icdRecords = await getOrFetchAllICD(supabase);

  // Parse lines
  const lines = diagnosisText
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  const statements = lines.map(line => ({
    text: line.replace(/^\d+[.)]\s*/, '').trim(),
  }));

  const results: AICodingResult['results'] = [];
  const combinations: AICodingResult['combinations'] = [];

  for (const stmt of statements) {
    const expandedText = expandAbbreviations(stmt.text, abbrevMap);
    const connector = detectConnector(stmt.text);

    if (connector) {
      combinations.push({
        originalStatement: stmt.text,
        relation: connector,
        sequencingNote: `"${connector}" establishes a causal / clinical relationship. Confirm the principal condition chiefly responsible for admission according to PhilHealth billing rules.`,
        claimRule: 'Separate valid diagnoses are not automatically two payable case rates. Verify principal condition and current allowed second case-rate rules.',
      });
    }

    const ranked = rankCHISAICandidates(expandedText, icdRecords, indexRules || []).slice(0, 3);

    if (!ranked.length || ranked[0].score < 20) {
      results.push({
        diagnosis: stmt.text,
        diagnosisType: 'PRINCIPAL CANDIDATE',
        status: 'NO_RELIABLE_MATCH',
        candidates: [],
        message: 'No reliable code candidate found in the validated local ICD-10 database.',
      });
      continue;
    }

    const candidates: AICodingCandidate[] = ranked.map((r, idx) => ({
      code: r.record.code,
      description: r.record.description,
      caseRate: Number(r.record.case_rate) || 0,
      hospitalFee: Number(r.record.hospital_fee) || 0,
      professionalFee: Number(r.record.professional_fee) || 0,
      confidence: (r.score >= 70 ? 'HIGH' : (r.score >= 45 ? 'MEDIUM' : 'LOW')) as 'HIGH' | 'MEDIUM' | 'LOW',
      score: r.score,
      note: r.note,
    }));

    results.push({
      diagnosis: stmt.text,
      diagnosisType: 'PRINCIPAL CANDIDATE',
      status: candidates[0].confidence === 'LOW' ? 'NEEDS_CLARIFICATION' : 'CANDIDATES_FOUND',
      candidates,
    });
  }

  const response: AICodingResult = {
    success: true,
    version: '3.2.0',
    facilityType,
    disclaimer:
      'AI-assisted suggestion only. The trained coder and authorized clinical/PhilHealth staff must verify the final code, principal diagnosis, documentation, facility eligibility, and claim order.',
    statementsReviewed: statements.length,
    conditionsDetected: results.length,
    combinations,
    results,
  };

  return NextResponse.json(response);
}
