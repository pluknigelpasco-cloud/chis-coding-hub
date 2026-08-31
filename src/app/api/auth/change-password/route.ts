import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken, hashPassword, newSalt, safeEquals } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'New password must be at least 8 characters long.' }, { status: 400 });
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return NextResponse.json({ ok: false, error: 'New password must contain both letters and numbers.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase.from('app_users').select('*').eq('id', payload.u).single();
    if (!user) return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });

    const currentHash = hashPassword(String(currentPassword || ''), user.salt);
    if (!safeEquals(currentHash, user.password_hash)) {
      return NextResponse.json({ ok: false, error: 'Current password is incorrect.' }, { status: 400 });
    }

    const salt = newSalt();
    const newHash = hashPassword(newPassword, salt);
    await supabase.from('app_users').update({
      password_hash: newHash,
      salt: salt,
      must_change_password: false,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);

    await supabase.from('audit_logs').insert({
      username: user.username,
      action: 'CHANGE_PASSWORD',
      module: 'ACCOUNT',
      source_ref: user.username
    });

    return NextResponse.json({ ok: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error updating password.' }, { status: 500 });
  }
}
