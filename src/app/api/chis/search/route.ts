import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawQ = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'ALL'; // ICD, RVS, ALL
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  if (!rawQ) return NextResponse.json({ results: [] });

  const supabase = getSupabaseAdmin();
  const results: any[] = [];
  const seenCodes = new Set<string>();

  // Split multiple search terms if user entered e.g. "P03.4, 99460" or "P03.4 + 99460" or "P03.4 and 99460"
  const rawTerms = rawQ
    .split(/[,+&/|]|\s+\band\b\s+/i)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  let searchTokens = rawTerms;
  if (rawTerms.length === 1 && /\s+/.test(rawTerms[0])) {
    const spaceTokens = rawTerms[0].split(/\s+/).filter(w => /^[A-Z0-9.]{2,}$/i.test(w));
    if (spaceTokens.length >= 2) {
      searchTokens = spaceTokens;
    }
  }

  // 1. First search exact code matches for each token so they are guaranteed to appear first
  for (const token of searchTokens) {
    const cleanToken = token.replace(/[^A-Z0-9.]/gi, '');
    if (!cleanToken) continue;

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
    async function searchTable(table: 'icd10_db' | 'rvs_db', recordType: 'ICD' | 'RVS') {
      if (type !== 'ALL' && type !== recordType) return;

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .or(`code.ilike.%${token}%,description.ilike.%${token}%`)
        .limit(20);

      if (error || !data) return;

      data.forEach((row: any) => {
        const key = `${recordType}-${row.code}`;
        if (!seenCodes.has(key)) {
          seenCodes.add(key);
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

  // Sort: Exact matches first, in order of searchTokens!
  const upperTokens = searchTokens.map(t => t.toUpperCase());
  results.sort((a, b) => {
    const aCode = a.code.toUpperCase();
    const bCode = b.code.toUpperCase();

    const aTokenIdx = upperTokens.findIndex(t => aCode === t);
    const bTokenIdx = upperTokens.findIndex(t => bCode === t);

    // If both are exact matches, maintain token query order!
    if (aTokenIdx !== -1 && bTokenIdx !== -1) return aTokenIdx - bTokenIdx;
    if (aTokenIdx !== -1) return -1;
    if (bTokenIdx !== -1) return 1;

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
