import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken, sha256Text } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = verifyToken(token);
      const tokenHash = sha256Text(token);
      const supabase = getSupabaseAdmin();
      await supabase.from('app_sessions').delete().eq('token_hash', tokenHash);

      if (payload) {
        await supabase.from('audit_logs').insert({
          username: payload.name,
          action: 'LOGOUT',
          module: 'SYSTEM'
        });
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete('cph_tm_token');
    return response;
  } catch (err: any) {
    return NextResponse.json({ ok: true });
  }
}
