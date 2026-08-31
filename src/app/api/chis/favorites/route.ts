import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('username', session.u)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data || [] });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { code, type, description, case_rate, hospital_fee, professional_fee } = body;
  if (!code || !type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('favorites').insert({
    username: session.u,
    code, type, description, case_rate, hospital_fee, professional_fee,
  });

  if (error && error.code === '23505') {
    return NextResponse.json({ message: 'Already in favorites.' });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Added to favorites.' });
}

export async function DELETE(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('favorites')
    .delete()
    .eq('username', session.u)
    .eq('code', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Removed from favorites.' });
}
