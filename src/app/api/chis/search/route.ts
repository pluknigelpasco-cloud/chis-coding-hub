import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { fetchLiveCRS } from '@/lib/crs-parser';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawQ = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'ALL'; // ICD, RVS, ALL
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  if (!rawQ || rawQ.length < 2) return NextResponse.json({ results: [] });

  const supabase = getSupabaseAdmin();
  const results: any[] = [];
  const seenCodes = new Set<string>();

  // Split multiple search terms if user entered e.g. "P03.4, 99460" or "P03.4 + 99460"
  const rawTerms = rawQ
    .split(/[,+&/|]|\s+\band\b\s+/i)
    .map(t => t.trim())
    .filter(t => t.length >= 2);

  let searchTokens = rawTerms;
  if (rawTerms.length === 1 && /\s+/.test(rawTerms[0])) {
    const spaceTokens = rawTerms[0].split(/\s+/).filter(w => /^[A-Z0-9.]{2,}$/i.test(w));
    if (spaceTokens.length >= 2) {
      searchTokens = spaceTokens;
    }
  }

  // Track which tokens found at least 1 local match
  const tokenMatchedCount = new Map<string, number>();
  searchTokens.forEach(t => tokenMatchedCount.set(t.toUpperCase(), 0));

  // 1. First search EXACT code matches for each token so they appear at the very top
  for (const token of searchTokens) {
    const cleanToken = token.replace(/[^A-Z0-9.]/gi, '');
    if (!cleanToken || cleanToken.length < 2) continue;

    // Check exact in ICD
    const { data: icdExact } = await supabase
      .from('icd10_db')
      .select('*')
      .ilike('code', cleanToken)
      .limit(1);

    if (icdExact && icdExact.length > 0) {
      const row = icdExact[0];
      const key = `ICD-${row.code}`;
      if (!seenCodes.has(key)) {
        seenCodes.add(key);
        tokenMatchedCount.set(token.toUpperCase(), (tokenMatchedCount.get(token.toUpperCase()) || 0) + 1);
        results.push({
          code: row.code,
          description: row.description,
          case_rate: Number(row.case_rate) || 0,
          hospital_fee: Number(row.hospital_fee) || 0,
          professional_fee: Number(row.professional_fee) || 0,
          effectivity_date: row.effectivity_date || null,
          type: 'ICD',
          isExactMatch: true,
          matchedToken: cleanToken.toUpperCase(),
        });
      }
    }

    // Check exact in RVS
    const { data: rvsExact } = await supabase
      .from('rvs_db')
      .select('*')
      .ilike('code', cleanToken)
      .limit(1);

    if (rvsExact && rvsExact.length > 0) {
      const row = rvsExact[0];
      const key = `RVS-${row.code}`;
      if (!seenCodes.has(key)) {
        seenCodes.add(key);
        tokenMatchedCount.set(token.toUpperCase(), (tokenMatchedCount.get(token.toUpperCase()) || 0) + 1);
        results.push({
          code: row.code,
          description: row.description,
          case_rate: Number(row.case_rate) || 0,
          hospital_fee: Number(row.hospital_fee) || 0,
          professional_fee: Number(row.professional_fee) || 0,
          effectivity_date: row.effectivity_date || null,
          type: 'RVS',
          isExactMatch: true,
          matchedToken: cleanToken.toUpperCase(),
        });
      }
    }
  }

  // 2. Then search prefix / partial / description matches
  for (const token of searchTokens) {
    if (token.length < 2) continue;

    async function searchTable(table: 'icd10_db' | 'rvs_db', recordType: 'ICD' | 'RVS') {
      if (type !== 'ALL' && type !== recordType) return;

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .or(`code.ilike.%${token}%,description.ilike.%${token}%`)
        .limit(15);

      if (error || !data) return;

      data.forEach((row: any) => {
        const key = `${recordType}-${row.code}`;
        if (!seenCodes.has(key)) {
          seenCodes.add(key);
          tokenMatchedCount.set(token.toUpperCase(), (tokenMatchedCount.get(token.toUpperCase()) || 0) + 1);
          results.push({
            code: row.code,
            description: row.description,
            case_rate: Number(row.case_rate) || 0,
            hospital_fee: Number(row.hospital_fee) || 0,
            professional_fee: Number(row.professional_fee) || 0,
            effectivity_date: row.effectivity_date || null,
            type: recordType,
            isExactMatch: false,
            matchedToken: token.toUpperCase(),
          });
        }
      });
    }

    await Promise.all([
      searchTable('icd10_db', 'ICD'),
      searchTable('rvs_db', 'RVS'),
    ]);
  }

  // 3. AUTOMATIC REAL-TIME PHILHEALTH CRS FALLBACK & SYNC
  // If any search token had 0 matches in local database, fetch directly from live PhilHealth CRS server!
  for (const token of searchTokens) {
    const matchedCount = tokenMatchedCount.get(token.toUpperCase()) || 0;
    if (matchedCount === 0 && token.length >= 2) {
      try {
        const liveRecords = await fetchLiveCRS(token);
        if (liveRecords && liveRecords.length > 0) {
          // Group by unique code and pick the current/latest active rate
          const codeMap = new Map<string, any>();
          liveRecords.forEach(r => {
            const existing = codeMap.get(r.code);
            if (!existing || r.isCurrent) {
              codeMap.set(r.code, r);
            }
          });

          for (const liveRec of Array.from(codeMap.values())) {
            const isICD = /^[A-Z]\d{2}/i.test(liveRec.code);
            const recordType: 'ICD' | 'RVS' = isICD ? 'ICD' : 'RVS';
            const key = `${recordType}-${liveRec.code}`;

            if (!seenCodes.has(key)) {
              seenCodes.add(key);
              results.push({
                code: liveRec.code,
                description: liveRec.description,
                case_rate: liveRec.firstCaseRate.caseRate,
                hospital_fee: liveRec.firstCaseRate.hospitalFee,
                professional_fee: liveRec.firstCaseRate.professionalFee,
                effectivity_date: liveRec.effectivity,
                type: recordType,
                isExactMatch: liveRec.code.toUpperCase() === token.toUpperCase(),
                matchedToken: token.toUpperCase(),
                source: 'LIVE_CRS',
              });

              // Asynchronously upsert to Supabase database so future searches are instant
              supabase
                .from(isICD ? 'icd10_db' : 'rvs_db')
                .upsert(
                  {
                    code: liveRec.code,
                    description: liveRec.description,
                    case_rate: liveRec.firstCaseRate.caseRate,
                    hospital_fee: liveRec.firstCaseRate.hospitalFee,
                    professional_fee: liveRec.firstCaseRate.professionalFee,
                    effectivity_date: liveRec.effectivity,
                  },
                  { onConflict: 'code' }
                )
                .then(() => {});
            }
          }
        }
      } catch (err: any) {
        console.warn(`Auto-CRS fallback error for "${token}":`, err.message);
      }
    }
  }

  // Sort: Exact matches first, in order of searchTokens!
  const upperTokens = searchTokens.map(t => t.toUpperCase());
  results.sort((a, b) => {
    const aCode = a.code.toUpperCase();
    const bCode = b.code.toUpperCase();

    const aExactIdx = upperTokens.findIndex(t => aCode === t);
    const bExactIdx = upperTokens.findIndex(t => bCode === t);

    // If both are exact matches, maintain query token order!
    if (aExactIdx !== -1 && bExactIdx !== -1) return aExactIdx - bExactIdx;
    if (aExactIdx !== -1) return -1;
    if (bExactIdx !== -1) return 1;

    // Prefix matches next
    const aPrefix = upperTokens.some(t => aCode.startsWith(t));
    const bPrefix = upperTokens.some(t => bCode.startsWith(t));
    if (aPrefix && !bPrefix) return -1;
    if (!aPrefix && bPrefix) return 1;

    return aCode.localeCompare(bCode);
  });

  // Log search to history (fire-and-forget)
  if (rawQ.length > 1) {
    supabase.from('search_history').insert({
      username: session.u,
      keyword: rawQ,
    }).then(() => {});
  }

  return NextResponse.json({
    results: results.slice(0, limit),
    isMultiSearch: searchTokens.length > 1,
    searchedTerms: searchTokens,
  });
}
