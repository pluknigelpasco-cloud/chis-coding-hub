import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { AICodingResult, AICodingCandidate } from '@/lib/types';

// Built-in Obstetric & Clinical Semantic Knowledge Map
const CLINICAL_KNOWLEDGE_BASE: Array<{
  patterns: RegExp[];
  candidates: Array<{
    code: string;
    description: string;
    type: 'ICD' | 'RVS';
    category: string;
    note: string;
    defaultCaseRate?: number;
    defaultHCI?: number;
    defaultPF?: number;
  }>;
}> = [
  // 1. Normal Spontaneous Delivery / Cephalic Delivery / NSVD
  {
    patterns: [/\b(NSVD|NSD|CEPHALIC DELIVER(ED)?|NORMAL (SPONTANEOUS )?DELIVERY|SPONTANEOUS VERTEX)\b/i],
    candidates: [
      {
        code: 'O80',
        description: 'ENCOUNTER FOR FULL-TERM NORMAL DELIVERY; SINGLE SPONTANEOUS DELIVERY',
        type: 'ICD',
        category: 'Primary Maternal Code',
        note: 'Primary code for normal full-term delivery without major operative intervention.',
        defaultCaseRate: 0,
      },
      {
        code: 'NSD01',
        description: 'ROUTINE OBSTETRIC CARE (NORMAL SPONTANEOUS DELIVERY PACKAGE)',
        type: 'RVS',
        category: 'PhilHealth Benefit Package',
        note: 'PhilHealth standard package for vaginal delivery in accredited facilities.',
        defaultCaseRate: 29000,
        defaultHCI: 17400,
        defaultPF: 11600,
      }
    ]
  },
  // 2. Outcome of Delivery (Live Birth / Single Live Baby)
  {
    patterns: [/\b(LIVE BABY|BABY GIRL|BABY BOY|SINGLE LIVE|LIVEBORN|BORN ALIVE|AGA|BW \d+G?)\b/i],
    candidates: [
      {
        code: 'Z37.0',
        description: 'SINGLE LIVE BIRTH (OUTCOME OF DELIVERY)',
        type: 'ICD',
        category: 'Outcome of Delivery Code',
        note: 'Mandatory secondary code on maternal record indicating single liveborn infant.',
      },
      {
        code: 'Z38.00',
        description: 'SINGLE LIVEBORN INFANT, BORN IN HOSPITAL, DELIVERED VAGINALLY',
        type: 'ICD',
        category: 'Newborn Encounter Code',
        note: 'Newborn record primary admission code for healthy infant born in hospital.',
      },
      {
        code: '99460',
        description: 'EXPANDED NEWBORN CARE PACKAGE (ENCP)',
        type: 'RVS',
        category: 'Newborn Benefit Package',
        note: 'Includes newborn screening, hearing test, eye prophylaxis, and vitamin K.',
        defaultCaseRate: 5752.50,
        defaultHCI: 4774.50,
        defaultPF: 978.00,
      }
    ]
  },
  // 3. First Degree Perineal Laceration / Repair
  {
    patterns: [/\b(1ST DEGREE|FIRST DEGREE|1 DEGREE)\s*(PERINEAL\s*)?(LACERATION|TEAR|REPAIR)\b/i, /\b(REPAIR OF (1ST|FIRST) DEGREE)\b/i],
    candidates: [
      {
        code: 'O70.0',
        description: 'FIRST DEGREE PERINEAL LACERATION DURING DELIVERY',
        type: 'ICD',
        category: 'Maternal Complication Code',
        note: 'Perineal laceration, rupture or tear involving fourchette, hymen, labia, skin, vagina or vulva.',
      },
      {
        code: '59300',
        description: 'EPISIOTOMY OR PERINEAL LACERATION REPAIR',
        type: 'RVS',
        category: 'Procedure Code',
        note: 'Routine repair is typically bundled in the NSD01 package.',
      }
    ]
  },
  // 4. Second Degree Perineal Laceration / Repair
  {
    patterns: [/\b(2ND DEGREE|SECOND DEGREE|2 DEGREE)\s*(PERINEAL\s*)?(LACERATION|TEAR|REPAIR)\b/i],
    candidates: [
      {
        code: 'O70.1',
        description: 'SECOND DEGREE PERINEAL LACERATION DURING DELIVERY',
        type: 'ICD',
        category: 'Maternal Complication Code',
        note: 'Involves pelvic floor and perineal muscles (excluding anal sphincter).',
      }
    ]
  },
  // 5. Cesarean Section Delivery
  {
    patterns: [/\b(CESAREAN|CAESAREAN|C[\s-]?SECTION|LTCS|PRIMARY CS|REPEAT CS)\b/i],
    candidates: [
      {
        code: 'O82',
        description: 'SINGLE DELIVERY BY CAESAREAN SECTION',
        type: 'ICD',
        category: 'Primary Maternal Code',
        note: 'Encounter for delivery by cesarean section.',
      },
      {
        code: '59514',
        description: 'CESAREAN SECTION DELIVERY (LOW TRANSVERSE)',
        type: 'RVS',
        category: 'PhilHealth Benefit Package',
        note: 'Cesarean section delivery package rate.',
        defaultCaseRate: 38000,
      }
    ]
  },
  // 6. Urinary Tract Infection
  {
    patterns: [/\b(URINARY TRACT INFECTION|UTI|CYSTITIS)\b/i],
    candidates: [
      {
        code: 'N39.0',
        description: 'URINARY TRACT INFECTION, SITE NOT SPECIFIED',
        type: 'ICD',
        category: 'Principal Diagnosis',
        note: 'Standard code for acute or unspecified urinary tract infection.',
        defaultCaseRate: 14625,
      }
    ]
  },
  // 7. Hypertension
  {
    patterns: [/\b(HYPERTENSION|ESSENTIAL HYPERTENSION|PRIMARY HYPERTENSION|HTN)\b/i],
    candidates: [
      {
        code: 'I10',
        description: 'ESSENTIAL (PRIMARY) HYPERTENSION; ARTERIAL HYPERTENSION; HIGH BLOOD PRESSURE',
        type: 'ICD',
        category: 'Principal / Comorbidity',
        note: 'Standard code for essential hypertension.',
        defaultCaseRate: 12480,
      }
    ]
  },
  // 8. Community Acquired Pneumonia
  {
    patterns: [/\b(COMMUNITY ACQUIRED PNEUMONIA|CAP|PNEUMONIA)\b/i],
    candidates: [
      {
        code: 'J18.92',
        description: 'COMMUNITY-ACQUIRED PNEUMONIA III (CAP, MODERATE RISK)',
        type: 'ICD',
        category: 'Principal Diagnosis',
        note: 'PhilHealth CAP moderate risk case rate package.',
        defaultCaseRate: 29250,
      },
      {
        code: 'J18.93',
        description: 'COMMUNITY-ACQUIRED PNEUMONIA IV (CAP, HIGH RISK)',
        type: 'ICD',
        category: 'Principal Diagnosis',
        note: 'PhilHealth CAP high risk case rate package.',
        defaultCaseRate: 90100,
      }
    ]
  }
];

let cachedICDRecords: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getOrFetchAllDatabase(supabase: any) {
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

  // Also fetch RVS database for packages
  const { data: rvsData } = await supabase.from('rvs_db').select('code, description, case_rate, hospital_fee, professional_fee').limit(5000);
  if (rvsData) all.push(...rvsData);

  cachedICDRecords = all;
  lastCacheTime = now;
  return all;
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const rawDiagnosisText: string = body.diagnosisText || '';
  const facilityType: string = body.facilityType || 'level2';
  const customCommand: string = (body.customCommand || '').trim();

  if (!rawDiagnosisText.trim()) {
    return NextResponse.json({ error: 'Enter at least one diagnosis statement.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const dbRecords = await getOrFetchAllDatabase(supabase);
  const recordMap = new Map<string, any>();
  dbRecords.forEach(r => recordMap.set(r.code.toUpperCase(), r));

  // Strip command phrases from input lines
  const cleanLines = rawDiagnosisText
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l && !/^(APPROPRIATE\s*(LIST\s*OF\s*)?(ICD|RVS|CODES)?|LIST\s*OF\s*ICD|WHAT\s*IS\s*THE\s*CODE)/i.test(l));

  const results: AICodingResult['results'] = [];
  const processedCodes = new Set<string>();

  // 1. Clinical Concept Extraction from Knowledge Base
  const fullText = cleanLines.join(' ');

  CLINICAL_KNOWLEDGE_BASE.forEach(rule => {
    const isMatched = rule.patterns.some(p => p.test(fullText));
    if (isMatched) {
      const candidates: AICodingCandidate[] = [];

      rule.candidates.forEach(c => {
        if (processedCodes.has(c.code)) return;
        processedCodes.add(c.code);

        const dbMatch = recordMap.get(c.code.toUpperCase());
        const caseRate = dbMatch ? Number(dbMatch.case_rate) || 0 : (c.defaultCaseRate || 0);
        const hospitalFee = dbMatch ? Number(dbMatch.hospital_fee) || 0 : (c.defaultHCI || (caseRate * 0.6));
        const professionalFee = dbMatch ? Number(dbMatch.professional_fee) || 0 : (c.defaultPF || (caseRate * 0.4));

        candidates.push({
          code: c.code,
          description: dbMatch ? dbMatch.description : c.description,
          caseRate,
          hospitalFee,
          professionalFee,
          confidence: 'HIGH',
          score: 95,
          note: `${c.category}: ${c.note}`,
        });
      });

      if (candidates.length > 0) {
        results.push({
          diagnosis: rule.candidates[0].category.toUpperCase(),
          diagnosisType: rule.candidates[0].category.toUpperCase(),
          status: 'CANDIDATES_FOUND',
          candidates,
        });
      }
    }
  });

  // 2. Line-by-line fallback for any other general conditions
  for (const line of cleanLines) {
    const isAlreadyCovered = results.some(r => r.candidates.some(c => line.toUpperCase().includes(c.code) || fullText.toUpperCase().includes(c.code)));
    if (results.length > 0 && isAlreadyCovered) continue;

    // Search in DB
    const searchTerms = line.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
    const matches = dbRecords.filter(r => {
      const desc = r.description.toUpperCase();
      return searchTerms.length && searchTerms.every(t => desc.includes(t));
    }).slice(0, 3);

    if (matches.length > 0) {
      const candidates: AICodingCandidate[] = matches.map(m => ({
        code: m.code,
        description: m.description,
        caseRate: Number(m.case_rate) || 0,
        hospitalFee: Number(m.hospital_fee) || 0,
        professionalFee: Number(m.professional_fee) || 0,
        confidence: 'HIGH',
        score: 85,
        note: 'Matched from validated local PhilHealth CHIS database.',
      }));

      results.push({
        diagnosis: line,
        diagnosisType: 'CLINICAL CONDITION',
        status: 'CANDIDATES_FOUND',
        candidates,
      });
    }
  }

  // If still empty, provide graceful guidance
  if (results.length === 0) {
    results.push({
      diagnosis: rawDiagnosisText,
      diagnosisType: 'CLINICAL INQUIRY',
      status: 'NO_RELIABLE_MATCH',
      candidates: [],
      message: 'No direct ICD-10/RVS matches found. Try entering standard clinical diagnosis terms (e.g. "Normal Delivery", "Hypertension", "CAP", "UTI").',
    });
  }

  const response: AICodingResult = {
    success: true,
    version: '3.2.0-AI',
    facilityType,
    disclaimer:
      'AI Clinical Diagnostic Suggestion. Trained hospital coders and billing section officers must verify the principal diagnosis, delivery outcome, documentation, and claim ordering according to PhilHealth Circular guidelines.',
    statementsReviewed: cleanLines.length,
    conditionsDetected: results.length,
    combinations: [],
    results,
  };

  return NextResponse.json(response);
}
