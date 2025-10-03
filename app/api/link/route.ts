// app/api/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getToken } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // read the logged-in user from the NextAuth JWT
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const email = token?.email as string | undefined;
  if (!email) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // short 22-char token (under Telegram's 64-char /start limit)
  const short = crypto.randomBytes(16).toString('base64url');

  // store one-time token -> email
  const sb = supabaseAdmin();
  await sb.from('link_tokens').insert({ token: short, email });

  // deep link to your bot
  const bot = process.env.TELEGRAM_BOT_USERNAME!; // e.g. Studywithferuzbek_bot (no @)
  const deepLink = `https://t.me/${bot}?start=${short}`;

  return NextResponse.json({ ok: true, deepLink });
}

