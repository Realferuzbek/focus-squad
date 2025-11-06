import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/live/admin";
import { getAdminStorage, pickLiveAssetPath } from "@/lib/storage";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type BodyPayload = {
  filename?: string;
  mime?: string;
  bytes?: number;
};

export function createSignUploadHandler(kind: "avatar" | "wallpaper") {
  return async function POST(req: Request) {
    const session = await auth();

    try {
      await requireAdmin(session);
    } catch (error: any) {
      const status = typeof error?.status === "number" ? error.status : 403;
      return NextResponse.json({ error: "Forbidden" }, { status });
    }

    let body: BodyPayload;
    try {
      body = (await req.json()) as BodyPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const filename = typeof body.filename === "string" && body.filename.trim().length
      ? body.filename.trim()
      : `${kind}.webp`;
    const mime = typeof body.mime === "string" ? body.mime : "";
    const bytes = typeof body.bytes === "number" && Number.isFinite(body.bytes) ? body.bytes : 0;

    if (!ACCEPTED_IMAGE_TYPES.has(mime)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, or WEBP images are allowed." },
        { status: 415 },
      );
    }

    if (bytes <= 0) {
      return NextResponse.json({ error: "Invalid file size." }, { status: 400 });
    }

    if (bytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Images must be 3 MB or smaller." },
        { status: 413 },
      );
    }

    const storage = getAdminStorage();
    const path = pickLiveAssetPath(filename, kind);
    const { data, error } = await storage
      .from("live_assets")
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to sign upload" },
        { status: 500 },
      );
    }

    const publicUrl = storage
      .from("live_assets")
      .getPublicUrl(path)
      .data?.publicUrl;

    return NextResponse.json({
      path,
      token: data.token,
      publicUrl,
    });
  };
}
