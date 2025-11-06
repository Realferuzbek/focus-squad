import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAdminStorage } from "@/lib/storage";

const Body = z.object({
  path: z.string(),
  ttl: z.number().int().min(60).max(86400).default(3600),
});

export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path, ttl } = Body.parse(await req.json());
  if (!path.startsWith("live-uploads/")) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const storage = getAdminStorage();

  const { data, error } = await storage
    .from("dm-uploads")
    .createSignedUrl(path, ttl);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to sign URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: ttl });
}
