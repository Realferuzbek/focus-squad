// app/api/me/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;

  if (!email) return NextResponse.json({ linked: false }, { status: 200 });

  const { data } = await supabaseAdmin()
    .from('users')
    .select('telegram_user_id')
    .eq('email', email)
    .maybeSingle();

  return NextResponse.json({ linked: !!data?.telegram_user_id });
}
