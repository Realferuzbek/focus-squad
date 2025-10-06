// app/api/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!session?.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const sb = supabaseAdmin();

  // generate short, url-safe token (<= 64 chars)
  const code = crypto.randomBytes(24).toString('base64url'); // ~32 chars

  // store it (10min TTL via generated column)
  await sb.from('link_tokens').insert({ token: code, email: session.email });

  const bot = process.env.TELEGRAM_BOT_USERNAME!;
  const url = `https://t.me/${bot}?start=${code}`;
  return NextResponse.json({ url });
}
