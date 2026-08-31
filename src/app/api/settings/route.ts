import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { AppSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/calculations';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase.from('app_settings').select('*');

    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    rows?.forEach(r => {
      if (r.key in settings) {
        (settings as any)[r.key] = isNaN(Number(r.value)) ? r.value : Number(r.value);
      }
    });

    return NextResponse.json({ ok: true, settings });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error fetching settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Administrator access required.' }, { status: 403 });
    }

    const updates = await req.json();
    const supabase = getSupabaseAdmin();

    const allowedNumeric = [
      'CRITICAL_DAYS',
      'WARNING_DAYS',
      'RTH_DEADLINE_DAYS',
      'INPATIENT_DEADLINE_DAYS',
      'HD_DEADLINE_DAYS',
      'EXPIRED_QUEUE_DAYS',
      'SESSION_HOURS',
      'DAILY_ALERT_HOUR',
    ];

    const entries: { key: string; value: string }[] = [];
    Object.keys(updates).forEach(k => {
      if (allowedNumeric.includes(k)) {
        const num = Number(updates[k]);
        if (!isNaN(num) && num >= 0) {
          entries.push({ key: k, value: String(num) });
        }
      } else if (['ALERT_RECIPIENTS', 'WEB_APP_URL'].includes(k)) {
        entries.push({ key: k, value: String(updates[k] || '').trim() });
      }
    });

    if (entries.length) {
      await supabase.from('app_settings').upsert(entries);
      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_SETTINGS',
        module: 'ACCOUNT',
        details: { keys: entries.map(e => e.key) },
      });
    }

    return NextResponse.json({ ok: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error updating settings' }, { status: 500 });
  }
}
