import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken, hashPassword, newSalt } from '@/lib/auth';
import { AppUser } from '@/lib/types';
import { formatDate } from '@/lib/calculations';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Administrator access required.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const list: AppUser[] = (users || []).map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      active: u.active,
      failedAttempts: u.failed_attempts || 0,
      lockedUntil: u.locked_until ? formatDate(u.locked_until) : null,
      mustChangePassword: u.must_change_password,
      createdAt: formatDate(u.created_at),
      lastLogin: u.last_login ? formatDate(u.last_login) : null,
    }));

    return NextResponse.json({ ok: true, users: list });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error fetching users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Administrator access required.' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action || 'create';
    const supabase = getSupabaseAdmin();

    if (action === 'create') {
      const username = String(body.username || '').trim().toLowerCase();
      const fullName = String(body.fullName || '').trim();
      const role = String(body.role || 'STAFF').toUpperCase();
      const password = String(body.password || '');

      if (!username || !fullName || !password) {
        return NextResponse.json({ ok: false, error: 'Username, Full Name, and Password are required.' }, { status: 400 });
      }

      const { data: existing } = await supabase.from('app_users').select('id').eq('username', username).single();
      if (existing) {
        return NextResponse.json({ ok: false, error: 'Username already exists.' }, { status: 400 });
      }

      const salt = newSalt();
      const pwdHash = hashPassword(password, salt);

      await supabase.from('app_users').insert({
        username,
        full_name: fullName,
        role: ['ADMIN', 'STAFF', 'VIEWER'].includes(role) ? role : 'STAFF',
        password_hash: pwdHash,
        salt,
        active: true,
        must_change_password: body.mustChangePassword !== false,
      });

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'CREATE_USER',
        module: 'ACCOUNT',
        source_ref: username,
        details: { role },
      });

      return NextResponse.json({ ok: true, message: `User account @${username} created.` });
    } else if (action === 'toggle_active') {
      const { userId, active } = body;
      if (userId === payload.u && active === false) {
        return NextResponse.json({ ok: false, error: 'You cannot deactivate your own account.' }, { status: 400 });
      }

      await supabase.from('app_users').update({ active: Boolean(active), updated_at: new Date().toISOString() }).eq('id', userId);
      return NextResponse.json({ ok: true, message: `Account status updated.` });
    } else if (action === 'unlock') {
      const { userId } = body;
      await supabase.from('app_users').update({ failed_attempts: 0, locked_until: null }).eq('id', userId);
      return NextResponse.json({ ok: true, message: 'Account unlocked.' });
    } else if (action === 'reset_password') {
      const { userId, password } = body;
      if (!password || password.length < 8) {
        return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
      }

      const salt = newSalt();
      const pwdHash = hashPassword(password, salt);
      await supabase.from('app_users').update({
        password_hash: pwdHash,
        salt,
        must_change_password: true,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);

      return NextResponse.json({ ok: true, message: 'Password reset. User must change it upon next login.' });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error managing user' }, { status: 500 });
  }
}
