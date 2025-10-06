// app/api/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const email = jwt?.email as string | undefined;
  if (!email) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const code = crypto.randomBytes(8).toString('hex'); // 16-char hex
  await supabaseAdmin().from('link_tokens').insert({ token: code, email });

  const bot = process.env.TELEGRAM_BOT_USERNAME!.replace(/^@/, '');
  const url = `https://t.me/${bot}?start=${code}`;

  return NextResponse.json({ url, code });
}
