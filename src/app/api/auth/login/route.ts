import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { hashPassword, newSalt, safeEquals, signToken, sha256Text } from '@/lib/auth';
import { AppUser } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (!cleanUser || !cleanPass) {
      return NextResponse.json({ ok: false, error: 'Username and password are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', cleanUser)
      .maybeSingle();

    // Auto-seed default admin if no admin exists
    if ((!user || error) && cleanUser === 'admin') {
      const salt = newSalt();
      const pwdHash = hashPassword('Admin!Balamban2026', salt);
      const { data: newUser, error: insertErr } = await supabase
        .from('app_users')
        .insert({
          username: 'admin',
          full_name: 'System Administrator',
          role: 'ADMIN',
          password_hash: pwdHash,
          salt: salt,
          active: true,
          must_change_password: true,
        })
        .select()
        .single();

      if (!insertErr && newUser) {
        user = newUser;
      }
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Invalid username or password.' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ ok: false, error: 'This account is deactivated. Contact administrator.' }, { status: 403 });
    }

    const now = new Date();
    if (user.locked_until && new Date(user.locked_until).getTime() > now.getTime()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - now.getTime()) / 60000);
      return NextResponse.json({
        ok: false,
        error: `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`
      }, { status: 423 });
    }

    const computedHash = hashPassword(cleanPass, user.salt);
    if (!safeEquals(computedHash, user.password_hash)) {
      const attempts = (user.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60000).toISOString() : null;
      await supabase
        .from('app_users')
        .update({
          failed_attempts: attempts >= 5 ? 0 : attempts,
          locked_until: lockedUntil,
          updated_at: now.toISOString()
        })
        .eq('id', user.id);

      return NextResponse.json({
        ok: false,
        error: attempts >= 5
          ? 'Account locked for 15 minutes after repeated failed attempts.'
          : `Invalid username or password. ${5 - attempts} attempt(s) remaining.`
      }, { status: 401 });
    }

    // Login successful
    await supabase
      .from('app_users')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_login: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', user.id);

    // Fetch session duration setting
    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'SESSION_HOURS')
      .maybeSingle();

    const sessionHours = Math.max(1, Number(settingRow?.value) || 24);
    const expiresAt = new Date(now.getTime() + sessionHours * 3600000);

    const token = signToken({
      u: user.id,
      name: user.username,
      role: user.role,
      e: expiresAt.getTime(),
      n: Math.random().toString(36).substring(2)
    });

    const tokenHash = sha256Text(token);

    await supabase.from('app_sessions').upsert({
      token_hash: tokenHash,
      user_id: user.id,
      username: user.username,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_seen: now.toISOString()
    });

    await supabase.from('audit_logs').insert({
      username: user.username,
      action: 'LOGIN',
      module: 'SYSTEM',
      details: { role: user.role }
    });

    const appUser: AppUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      active: user.active,
      mustChangePassword: user.must_change_password,
      profilePhoto: user.profile_photo,
      lastLogin: user.last_login
    };

    const response = NextResponse.json({ ok: true, token, user: appUser });
    response.cookies.set('cph_tm_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionHours * 3600
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Login error' }, { status: 500 });
  }
}
