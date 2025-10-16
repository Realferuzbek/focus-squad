import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminStorage, pickLivePath } from "@/lib/storage";

const Body = z.object({
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

  const { kind, filename, mime, bytes } = Body.parse(await req.json());

  if (!ALLOWED_MIME[kind].test(mime)) {
    return NextResponse.json({ error: "Mime type not allowed" }, { status: 400 });
  }

  if (bytes > LIMITS[kind]) {
    return NextResponse.json(
      { error: `File too large for ${kind}` },
      { status: 413 },
    );
  }

  const path = pickLivePath(filename);
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
