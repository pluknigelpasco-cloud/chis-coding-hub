import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { parseNoticePdfBuffer } from '@/lib/pdf-parser';
import { formatDateIso } from '@/lib/calculations';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role === 'VIEWER') {
      return NextResponse.json({ ok: false, error: 'Viewer accounts cannot upload notices.' }, { status: 403 });
    }

    const formData = await req.formData();
    const noticeType = (String(formData.get('noticeType') || 'RTH').toUpperCase()) as 'RTH' | 'DENIED';
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'Please choose a PhilHealth PDF notice.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'PDF file is too large (max 15MB).' }, { status: 400 });
    }

    const parsed = await parseNoticePdfBuffer(buffer, noticeType);

    // Query existing series numbers to identify duplicates
    const supabase = getSupabaseAdmin();
    const table = noticeType === 'RTH' ? 'rth_notices' : 'denied_notices';
    const { data: existingRows } = await supabase.from(table).select('series_number, expiry_date');

    const existingKeySet = new Set<string>();
    existingRows?.forEach(r => {
      const exp = formatDateIso(r.expiry_date);
      existingKeySet.add(`${r.series_number}|${exp}`);
    });

    let duplicateCount = 0;
    const enrichedRows = parsed.rows.map((r, i) => {
      const exp = formatDateIso(r.deadline);
      const isDup = existingKeySet.has(`${r.seriesNumber}|${exp}`);
      if (isDup) duplicateCount++;
      return {
        ...r,
        index: i,
        duplicate: isDup,
        selected: !isDup,
      };
    });

    return NextResponse.json({
      ok: true,
      type: noticeType,
      filename: file.name,
      notices: parsed.notices,
      warnings: parsed.warnings,
      rows: enrichedRows,
      duplicateCount,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error processing notice PDF' }, { status: 500 });
  }
}
