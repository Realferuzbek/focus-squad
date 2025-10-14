import { NextResponse } from 'next/server';
import { adminStorage, pickPath } from '@/lib/storage';
import { z } from 'zod';
import { requireUser } from '@/lib/auth'; // you already have this pattern
import { isDmParticipant } from '@/lib/community/admin/server'; // Phase 1 helper that checks membership

const Body = z.object({
  threadId: z.string().uuid(),
  kind: z.enum(['image', 'video', 'audio', 'file']),
  filename: z.string().min(1),
  mime: z.string().min(1),
  bytes: z.number().int().positive(),
});

const LIMITS = {
  image: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  file: 20 * 1024 * 1024,
} as const;

export async function POST(req: Request) {
  const user = await requireUser(); // throws 401 if not auth
  const body = Body.parse(await req.json());
  const { threadId, kind, filename, mime, bytes } = body;

  if (bytes > LIMITS[kind]) {
    return NextResponse.json({ error: `File too large for ${kind}` }, { status: 413 });
  }

  const ok = await isDmParticipant(threadId, user.id);
  if (!ok) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const path = pickPath(threadId, filename);

  // Client uploads directly to Storage with this token (no CORS required)
  const { data, error } = await adminStorage.from('dm-uploads').createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 });
  }

  return NextResponse.json({ path, token: data.token, expiresIn: data.expiresIn });
}
