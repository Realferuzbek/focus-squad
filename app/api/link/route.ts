// app/api/link/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = jwt.sign({ email }, process.env.NEXTAUTH_SECRET!, { expiresIn: '1h' });
  const bot = process.env.TELEGRAM_BOT_USERNAME!;
  const url = `https://t.me/${bot}?start=${token}`;
  return NextResponse.json({ url });
}
