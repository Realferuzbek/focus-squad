import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminStorage } from "@/lib/storage";
import {
  fetchThreadById,
  isDmAdmin,
  isThreadParticipant,
} from "@/lib/adminchat/server";

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
  if (!path.startsWith("dm-uploads/")) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const match = /^dm-uploads\/([^/]+)\//.exec(path);
  if (!match) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const threadId = match[1];
  const admin = isDmAdmin(me);
  const participant = await isThreadParticipant(threadId, me.id);

  if (!participant) {
    if (!admin) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const thread = await fetchThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
  }

  const { data, error } = await adminStorage
    .from("dm-uploads")
    .createSignedUrl(path, ttl);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: ttl });
}
