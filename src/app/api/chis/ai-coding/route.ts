import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { AICodingResult } from '@/lib/types';

const CAUSAL_CONNECTORS = [
  'SECONDARY TO', 'DUE TO', 'CAUSED BY', 'AS A RESULT OF',
  'COMPLICATED BY', 'ASSOCIATED WITH',
];

function normalizeText(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeText(text: string): string[] {
  return normalizeText(text).split(' ').filter(Boolean);
}

function expandAbbreviations(text: string, abbrevMap: Map<string, string>): string {
  return text.split(/\b/).map(word => {
    const upper = word.toUpperCase();
    return abbrevMap.get(upper) || word;
  }).join('');
}

function scoreCandidate(tokens: string[], record: { code: string; description: string }): number {
  const descTokens = tokenizeText(record.description);
  const codeUpper = record.code.toUpperCase();
  let score = 0;

  tokens.forEach(t => {
    if (codeUpper.startsWith(t)) score += 20;
    if (codeUpper === t) score += 50;
    const descMatch = descTokens.filter(d => d.startsWith(t) || t.startsWith(d)).length;
    score += descMatch * 5;
  });

  // Bonus: description length penalty for very generic descriptions
  if (descTokens.length < 3) score -= 10;
  return score;
}

function detectConnector(text: string): string | null {
  const upper = text.toUpperCase();
  for (const conn of CAUSAL_CONNECTORS) {
    if (upper.includes(conn)) return conn;
  }
  return null;
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
  (abbrevData || []).forEach(r => abbrevMap.set(r.abbreviation.toUpperCase(), r.meaning));

  // Load all ICD records for candidate matching (cached in Supabase; for large DBs, limit 2000)
  const { data: icdData } = await supabase
    .from('icd10_db')
    .select('code, description, case_rate, hospital_fee, professional_fee')
    .limit(3000);

  const icdRecords = icdData || [];

  // Parse statements line by line
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
    const tokens = tokenizeText(expandedText).filter(t => t.length >= 3);
    const connector = detectConnector(expandedText);

    if (connector) {
      combinations.push({
        originalStatement: stmt.text,
        relation: connector,
        sequencingNote: `"${connector}" implies a causal relationship. Identify the principal condition according to PhilHealth billing guidelines.`,
        claimRule: 'Separate valid diagnoses are not automatically two payable case rates. Verify principal condition and current allowed second case-rate rules.',
      });
    }

    // Score each ICD record against the tokens
    const scored = icdRecords
      .map(r => ({ ...r, score: scoreCandidate(tokens, r) }))
      .filter(r => r.score > 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!scored.length) {
      results.push({
        diagnosis: stmt.text,
        diagnosisType: 'PRINCIPAL CANDIDATE',
        status: 'NO_RELIABLE_MATCH',
        candidates: [],
        message: 'No reliable code candidate found in the validated local ICD-10 database.',
      });
      continue;
    }

    const candidates = scored.map((r, idx) => ({
      code: r.code,
      description: r.description,
      caseRate: r.case_rate,
      hospitalFee: r.hospital_fee,
      professionalFee: r.professional_fee,
      confidence: idx === 0 && r.score >= 60 ? 'HIGH' as const : idx === 0 ? 'MEDIUM' as const : 'LOW' as const,
      score: r.score,
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
