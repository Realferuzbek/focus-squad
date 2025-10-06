import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();

  // create a 16-char short token (valid ~10 min via table rule)
  const code = crypto.randomBytes(8).toString('hex');

  // store (upsert) short-lived code
  await sb.from('link_tokens').insert({ token: code, email }).select().single();

  const url = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`;
  return NextResponse.json({ url, code });
}
