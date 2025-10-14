import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminStorage, pickPath } from "@/lib/storage";
import {
  ensureParticipant,
  isDmAdmin,
  isThreadParticipant,
} from "@/lib/adminchat/server";

const Body = z.object({
  threadId: z.string().uuid(),
  kind: z.enum(["image", "video", "audio", "file"]),
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

const ALLOWED_MIME = {
  image: /^image\//,
  video: /^video\//,
  audio: /^audio\//,
  file: /.*/,
} as const;

export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = Body.parse(await req.json());
  const { threadId, kind, filename, mime, bytes } = body;

  if (!ALLOWED_MIME[kind].test(mime)) {
    return NextResponse.json({ error: "Mime type not allowed" }, { status: 400 });
  }

  if (bytes > LIMITS[kind]) {
    return NextResponse.json(
      { error: `File too large for ${kind}` },
      { status: 413 },
    );
  }

  const admin = isDmAdmin(me);
  const participant = await isThreadParticipant(threadId, me.id);
  if (!participant) {
    if (!admin) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    await ensureParticipant(threadId, me.id, "dm_admin");
  }

  const path = pickPath(threadId, filename);
  const { data, error } = await adminStorage
    .from("dm-uploads")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to sign upload" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    path,
    token: data.token,
    expiresIn: 60,
  });
}
