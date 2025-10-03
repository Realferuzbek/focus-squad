// app/api/link/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // short 22-char base64url token (well below Telegram’s 64 char limit)
  const token = crypto.randomBytes(16).toString('base64url');

  const sb = supabaseAdmin();
  await sb.from('link_tokens').insert({ token, email });

  const deepLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
  return NextResponse.json({ ok: true, deepLink });
}
