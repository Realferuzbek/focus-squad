// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC = [
  // public routes
  '/', '/signin',
  // public APIs
  '/api/telegram/webhook', '/api/cron/leaderboard',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow specific public paths
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Protect everything else under /dashboard, /admin and /api/* that needs auth
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
