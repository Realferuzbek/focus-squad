import { NextResponse } from 'next/server';
import { adminStorage } from '@/lib/storage';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { canViewThreadForFile } from '@/lib/community/admin/server'; // ensures user can view thread for this file

const Body = z.object({ path: z.string(), ttl: z.number().int().min(60).max(86400).default(3600) });

export async function POST(req: Request) {
  const user = await requireUser();
  const { path, ttl } = Body.parse(await req.json());

  if (!path.startsWith('dm-uploads/')) return NextResponse.json({ error: 'Bad path' }, { status: 400 });

  const ok = await canViewThreadForFile(user.id, path);
  if (!ok) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const { data, error } = await adminStorage.from('dm-uploads').createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl, expiresIn: ttl });
}
