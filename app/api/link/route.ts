// app/api/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sess = await getToken({ req, secureCookie: true });
  const email = sess?.email as string | undefined;

  if (!email || !process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'no-session' }, { status: 401 });
  }

  const bot = process.env.TELEGRAM_BOT_USERNAME!;
  const token = jwt.sign({ email }, process.env.NEXTAUTH_SECRET, { expiresIn: '10m' });
  const url = `https://t.me/${bot}?start=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
