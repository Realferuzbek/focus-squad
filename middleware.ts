// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Exact public paths
const PUBLIC_EXACT = ['/', '/signin'];

// Public prefixes (must remain open)
const PUBLIC_PREFIXES = [
  '/api/auth',               // NextAuth callbacks
  '/api/telegram/webhook',   // your webhook
  '/api/cron/leaderboard'    // your cron endpoint
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow exact public routes or any allowed prefix
  if (PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect everything else
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// keep static/image exclusions
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
