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
  const terms = rawQ
    .split(/[,+&/|]|\s+\band\b\s+/i)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // If no delimiter was found, also check if 2 codes are separated by space (e.g. "P03.4 99460")
  let searchTokens = terms;
  if (terms.length === 1 && /\s+/.test(terms[0])) {
    const spaceTokens = terms[0].split(/\s+/).filter(w => /^[A-Z0-9.]{2,}$/i.test(w));
    if (spaceTokens.length >= 2) {
      searchTokens = spaceTokens;
    }
  }

  async function searchForTerm(searchTerm: string) {
    async function searchTable(table: 'icd10_db' | 'rvs_db', recordType: 'ICD' | 'RVS') {
      if (type !== 'ALL' && type !== recordType) return;

      const query = supabase
        .from(table)
        .select('*')
        .or(`code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(limit);

      const { data, error } = await query;
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
            matchedQuery: searchTerm,
          });
        }
      });
    }

    await Promise.all([
      searchTable('icd10_db', 'ICD'),
      searchTable('rvs_db', 'RVS'),
    ]);
  }

  // Execute search for all terms
  for (const term of searchTokens) {
    await searchForTerm(term);
  }

  // Sort exact matches per search token first
  const upperTokens = searchTokens.map(t => t.toUpperCase());
  results.sort((a, b) => {
    const aCode = a.code.toUpperCase();
    const bCode = b.code.toUpperCase();
    const aExact = upperTokens.includes(aCode);
    const bExact = upperTokens.includes(bCode);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

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
