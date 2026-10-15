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

    const { id, module, noticeType } = await req.json();
    if (!id || !['RTH', 'DENIED', 'MONITORING'].includes(module)) {
      return NextResponse.json({ ok: false, error: 'Only RTH, Denied, and Monitoring notice records can be deleted.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let table: 'rth_notices' | 'denied_notices' = 'rth_notices';

    if (module === 'RTH') {
      table = 'rth_notices';
    } else if (module === 'DENIED') {
      table = 'denied_notices';
    } else if (module === 'MONITORING') {
      if (noticeType === 'DENIED') {
        table = 'denied_notices';
      } else if (noticeType === 'RTH') {
        table = 'rth_notices';
      } else {
        const { data: rCheck } = await supabase.from('rth_notices').select('id').eq('id', id).maybeSingle();
        table = rCheck ? 'rth_notices' : 'denied_notices';
      }
    }

    const { data: record } = await supabase.from(table).select('series_number, patient_name').eq('id', id).single();
    if (!record) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });

    await supabase.from(table).delete().eq('id', id);

    // Also clean up from MONITORING_STATUS_MAP if present
    try {
      const { data: statusRow } = await supabase.from('app_settings').select('value').eq('key', 'MONITORING_STATUS_MAP').maybeSingle();
      if (statusRow?.value) {
        const map = typeof statusRow.value === 'string' ? JSON.parse(statusRow.value) : statusRow.value;
        if (map[id]) {
          delete map[id];
          await supabase.from('app_settings').update({ value: JSON.stringify(map) }).eq('key', 'MONITORING_STATUS_MAP');
        }
      }
    } catch (e) {}

    await supabase.from('audit_logs').insert({
      username: payload.name,
      action: 'DELETE_NOTICE_RECORD',
      module: module,
      source_ref: record.series_number,
      details: { patient: record.patient_name, permanentDelete: true }
    });

    return NextResponse.json({
      ok: true,
      message: `Record for ${record.patient_name} (${record.series_number}) was permanently deleted.`
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Delete error' }, { status: 500 });
  }
}
