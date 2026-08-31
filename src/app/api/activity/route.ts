import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { AuditLogItem } from '@/lib/types';
import { formatDate } from '@/lib/calculations';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);

    if (payload.role !== 'ADMIN') {
      query = query.eq('username', payload.name);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const items: AuditLogItem[] = (data || []).map(r => ({
      id: r.id,
      timestamp: new Date(r.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      username: r.username,
      action: r.action,
      module: r.module,
      source_ref: r.source_ref,
      details: r.details,
    }));

    return NextResponse.json({ ok: true, activity: items });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error fetching activity' }, { status: 500 });
  }
}
