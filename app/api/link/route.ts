// app/api/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

function readSessionJWT(req: NextRequest): string | null {
  // prod cookie first, then dev
  return (
    req.cookies.get('__Secure-next-auth.session-token')?.value ??
    req.cookies.get('next-auth.session-token')?.value ??
    null
  );
}

export async function GET(req: NextRequest) {
  const sess = readSessionJWT(req);
  if (!sess || !process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'no-session' }, { status: 401 });
  }

  // Try verified first, then fall back to decode (in case NextAuth signs a different sub)
  let email: string | null = null;
  try {
    email = (jwt.verify(sess, process.env.NEXTAUTH_SECRET) as any)?.email ?? null;
  } catch {
    email = (jwt.decode(sess) as any)?.email ?? null;
  }
  if (!email) return NextResponse.json({ error: 'no-email' }, { status: 401 });

  const bot = process.env.TELEGRAM_BOT_USERNAME!;
  const token = jwt.sign({ email }, process.env.NEXTAUTH_SECRET, { expiresIn: '10m' });
  const url = `https://t.me/${bot}?start=${encodeURIComponent(token)}`;

  // If caller accepts JSON, return it; otherwise redirect (useful to hit in browser)
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ url });
  }
  return NextResponse.redirect(url, { status: 302 });
}
