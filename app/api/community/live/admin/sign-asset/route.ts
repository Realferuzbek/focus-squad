"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/live/admin";
import { adminStorage, pickLiveAssetPath } from "@/lib/storage";

const Body = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  bytes: z.number().int().positive(),
  variant: z.enum(["avatar", "wallpaper"]),
});

const LIMITS = {
  avatar: 2 * 1024 * 1024,
  wallpaper: 4 * 1024 * 1024,
} as const;

export async function POST(req: Request) {
  const session = await auth();
  try {
    await requireAdmin(session);
  } catch (error: any) {
    const status = error?.status ?? 403;
    return NextResponse.json({ error: "Forbidden" }, { status });
  }

  const { filename, mime, bytes, variant } = Body.parse(await req.json());

  if (bytes > LIMITS[variant]) {
    return NextResponse.json(
      { error: "File too large. Please upload a smaller image." },
      { status: 413 },
    );
  }

  if (!mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported." },
      { status: 415 },
    );
  }

  const path = pickLiveAssetPath(filename, variant);
  const { data, error } = await adminStorage
    .from("live_assets")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to sign upload" },
      { status: 500 },
    );
  }

  const publicUrl = adminStorage
    .from("live_assets")
    .getPublicUrl(path)
    .data?.publicUrl;

  return NextResponse.json({
    path,
    token: data.token,
    publicUrl,
    expiresIn: 60,
  });
}
