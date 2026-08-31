import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken, sha256Text } from '@/lib/auth';
import { AppUser } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const tokenHash = sha256Text(token);

    // Verify session in database
    const { data: session } = await supabase
      .from('app_sessions')
      .select('expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    // Touch last_seen
    await supabase
      .from('app_sessions')
      .update({ last_seen: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    // Get fresh user data
    const { data: user, error: userErr } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', payload.u)
      .single();

    if (userErr || !user || !user.active) {
      return NextResponse.json({ ok: false, error: 'Account inactive or not found' }, { status: 401 });
    }

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

    // Get active transmitters
    const { data: transmitters } = await supabase
      .from('app_users')
      .select('id, username, full_name')
      .eq('active', true)
      .in('role', ['ADMIN', 'STAFF'])
      .order('full_name', { ascending: true });

    return NextResponse.json({
      ok: true,
      user: appUser,
      transmitters: transmitters?.map(t => ({
        userId: t.id,
        username: t.username,
        fullName: t.full_name
      })) || [],
      generatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Unauthorized' }, { status: 401 });
  }
}
