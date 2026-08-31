import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Administrator access required to permanently delete records.' }, { status: 403 });
    }

    const { id, module } = await req.json();
    if (!id || !['RTH', 'DENIED'].includes(module)) {
      return NextResponse.json({ ok: false, error: 'Only RTH and Denied records can be deleted.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const table = module === 'RTH' ? 'rth_notices' : 'denied_notices';

    const { data: record } = await supabase.from(table).select('series_number, patient_name').eq('id', id).single();
    if (!record) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });

    await supabase.from(table).delete().eq('id', id);

    await supabase.from('audit_logs').insert({
      username: payload.name,
      action: 'DELETE_NOTICE_RECORD',
      module: module,
      source_ref: record.series_number,
      details: { patient: record.patient_name, permanentDelete: true }
    });

    return NextResponse.json({
      ok: true,
      message: `${module} record for ${record.patient_name} (${record.series_number}) was permanently deleted.`
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Delete error' }, { status: 500 });
  }
}
