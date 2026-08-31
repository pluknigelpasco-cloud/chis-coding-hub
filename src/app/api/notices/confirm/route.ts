import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { NoticePdfRow } from '@/lib/types';
import { formatDateIso } from '@/lib/calculations';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role === 'VIEWER') {
      return NextResponse.json({ ok: false, error: 'Viewer accounts cannot import notices.' }, { status: 403 });
    }

    const { type, filename, rows, controlNumbers } = (await req.json()) as {
      type: 'RTH' | 'DENIED';
      filename: string;
      rows: NoticePdfRow[];
      controlNumbers: string;
    };

    if (!rows || !rows.length) {
      return NextResponse.json({ ok: false, error: 'No rows selected for import.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const table = type === 'RTH' ? 'rth_notices' : 'denied_notices';

    // Insert payload
    const insertPayload = rows.map(r => {
      const baseObj = {
        notice_row_no: r.noticeRowNo,
        series_number: r.seriesNumber,
        member_category: r.memberCategory,
        patient_name: r.patientName,
        admitted_date: formatDateIso(r.admitted) || null,
        discharged_date: formatDateIso(r.discharged) || null,
        claim_amount: r.claimAmount,
        total_charges: r.totalCharges,
        deficiency: r.deficiency,
        claim_received_date: formatDateIso(r.claimReceived) || null,
        notice_date: formatDateIso(r.noticeDate) || null,
        expiry_date: formatDateIso(r.deadline) || null,
        control_number: r.controlNumber,
        remarks: `Imported PDF | ${r.controlNumber || 'Notice'} | Released ${r.noticeDate || ''}`,
      };

      if (type === 'RTH') {
        return {
          ...baseObj,
          retrieved: false,
          refiled: false,
        };
      }
      return {
        ...baseObj,
        retrieved: false,
      };
    });

    const { error: insertErr } = await supabase.from(table).upsert(insertPayload, {
      onConflict: 'series_number,expiry_date',
    });

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // Log import
    await supabase.from('import_logs').insert({
      username: payload.name,
      notice_type: type,
      original_filename: filename || 'NOTICE.pdf',
      control_numbers: controlNumbers || '',
      extracted_rows: rows.length,
      imported_rows: rows.length,
      duplicate_rows: 0,
    });

    // Log audit
    await supabase.from('audit_logs').insert({
      username: payload.name,
      action: 'IMPORT_NOTICE_PDF',
      module: type,
      source_ref: controlNumbers || filename,
      details: {
        filename,
        importedCount: rows.length,
      },
    });

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      message: `${rows.length} ${type} notice claim(s) successfully imported.`,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Import error' }, { status: 500 });
  }
}
