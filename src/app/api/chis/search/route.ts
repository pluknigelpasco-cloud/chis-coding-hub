import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'ALL'; // ICD, RVS, ALL
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  if (!q) return NextResponse.json({ results: [] });

  const supabase = getSupabaseAdmin();
  const results: any[] = [];

  async function searchTable(table: 'icd10_db' | 'rvs_db', recordType: 'ICD' | 'RVS') {
    if (type !== 'ALL' && type !== recordType) return;

    // Search both code and description using ilike for flexible partial matching
    const query = supabase
      .from(table)
      .select('*')
      .or(`code.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(limit);

    const { data, error } = await query;
    if (error || !data) return;

    data.forEach((row: any) => {
      results.push({
        code: row.code,
        description: row.description,
        case_rate: Number(row.case_rate) || 0,
        hospital_fee: Number(row.hospital_fee) || 0,
        professional_fee: Number(row.professional_fee) || 0,
        effectivity_date: row.effectivity_date || 'April 30, 2026 onwards',
        type: recordType,
      });
    });
  }

  await Promise.all([
    searchTable('icd10_db', 'ICD'),
    searchTable('rvs_db', 'RVS'),
  ]);

  // Sort: exact code matches first, then prefix matches, then alphabetical
  const qUpper = q.toUpperCase();
  results.sort((a, b) => {
    const aCode = a.code.toUpperCase();
    const bCode = b.code.toUpperCase();
    if (aCode === qUpper) return -1;
    if (bCode === qUpper) return 1;
    if (aCode.startsWith(qUpper) && !bCode.startsWith(qUpper)) return -1;
    if (!aCode.startsWith(qUpper) && bCode.startsWith(qUpper)) return 1;
    return aCode.localeCompare(bCode);
  });

  // Log search to history (fire-and-forget)
  if (q.length > 1) {
    supabase.from('search_history').insert({
      username: session.u,
      keyword: q,
    }).then(() => {});
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
