import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveCRS } from '@/lib/crs-parser';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = (searchParams.get('code') || searchParams.get('q') || '').trim();

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  try {
    const records = await fetchLiveCRS(code);

    // If records found from PhilHealth live CRS, update the local Supabase cache in the background
    if (records.length > 0) {
      const currentRecord = records.find(r => r.isCurrent) || records[0];
      const isICD = /^[A-Z]/i.test(currentRecord.code);
      const table = isICD ? 'icd10_db' : 'rvs_db';
      const supabase = getSupabaseAdmin();

      if (currentRecord.firstCaseRate.applicable && currentRecord.firstCaseRate.caseRate > 0) {
        supabase
          .from(table)
          .update({
            case_rate: currentRecord.firstCaseRate.caseRate,
            hospital_fee: currentRecord.firstCaseRate.hospitalFee,
            professional_fee: currentRecord.firstCaseRate.professionalFee,
            updated_at: new Date().toISOString(),
          })
          .eq('code', currentRecord.code)
          .then(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      query: code,
      records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
