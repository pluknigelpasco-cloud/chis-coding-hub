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
  const isCodeQuery = /^[A-Z][0-9]/.test(q.toUpperCase()) || /^[A-Z][0-9]{2,}/.test(q.toUpperCase());

  const results: any[] = [];

  async function searchTable(table: 'icd10_db' | 'rvs_db', recordType: 'ICD' | 'RVS') {
    if (type !== 'ALL' && type !== recordType) return;

    let query = supabase.from(table).select('*');

    if (isCodeQuery) {
      // Exact or prefix match on code first
      query = query.ilike('code', `${q.toUpperCase()}%`);
    } else {
      // Full-text keyword search on description
      query = query.textSearch('description', q.split(/\s+/).join(' & '), {
        type: 'websearch',
        config: 'english',
      });
    }

    const { data, error } = await query.limit(limit);
    if (error || !data) return;

    data.forEach((row: any) => {
      results.push({
        code: row.code,
        description: row.description,
        case_rate: row.case_rate,
        hospital_fee: row.hospital_fee,
        professional_fee: row.professional_fee,
        type: recordType,
      });
    });
  }

  await Promise.all([
    searchTable('icd10_db', 'ICD'),
    searchTable('rvs_db', 'RVS'),
  ]);

  // Sort: exact code matches first
  results.sort((a, b) => {
    const aExact = a.code.toUpperCase() === q.toUpperCase() ? -1 : 0;
    const bExact = b.code.toUpperCase() === q.toUpperCase() ? -1 : 0;
    return aExact - bExact;
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
