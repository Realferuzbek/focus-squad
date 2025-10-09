// app/api/telegram/webhook/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TG_API = (method: string, token: string) => `https://api.telegram.org/bot${token}/${method}`;
const TG_FILE = (path: string, token: string) => `https://api.telegram.org/file/bot${token}/${path}`;

const baseAppUrl =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function b64url(i: Buffer | string) {
  return (i instanceof Buffer ? i : Buffer.from(i))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function validPayload(token: string) {
  // token format: "<uid>.<ts>.<sig>"
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uidStr, tsStr, sig] = parts;
  const secret = process.env.NEXTAUTH_SECRET!;
  const sigCheck = b64url(createHmac("sha256", secret).update(`${uidStr}.${tsStr}`).digest());
  if (sig !== sigCheck) return null;
  const ts = parseInt(tsStr, 10);
  if (!ts || Math.abs(Math.floor(Date.now() / 1000) - ts) > 60 * 60 * 6) {
    // valid for 6 hours
    return null;
  }
  return { uid: uidStr };
}

async function fetchAvatar(telegramUserId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  try {
    // get user photos
    const photosRes = await fetch(TG_API("getUserProfilePhotos", token), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: telegramUserId, limit: 1 }),
    });
    const photos = await photosRes.json();
    const first = photos?.result?.photos?.[0]?.[0];
    if (!first) return null;

    const fileRes = await fetch(TG_API("getFile", token), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: first.file_id }),
    });
    const file = await fileRes.json();
    const filePath = file?.result?.file_path;
    if (!filePath) return null;

    const imgRes = await fetch(TG_FILE(filePath, token));
    const buff = Buffer.from(await imgRes.arrayBuffer());

    const sb = supabaseAdmin();
    // Ensure bucket 'avatars' exists manually once in Supabase UI
    const fileName = `tg/${telegramUserId}-${Date.now()}.jpg`;
    const { data, error } = await (sb as any).storage
      .from("avatars")
      .upload(fileName, buff, { contentType: "image/jpeg", upsert: true });

    if (error) return null;

    const { data: pub } = (sb as any).storage.from("avatars").getPublicUrl(data.path);
    return pub?.publicUrl ?? null;
  } catch {
    return null;
  }
}

async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(TG_API("sendMessage", token), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const message = body.message || body.edited_message || body.channel_post || {};
  const text: string = message.text || "";
  const from = message.from || {};
  const chatId = message.chat?.id;

  if (!chatId) return NextResponse.json({ ok: true });

  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    if (parts.length >= 2) {
      const payload = parts[1].trim();
      const decoded = validPayload(payload);
      if (!decoded) {
        await sendMessage(chatId, "Link expired or invalid. Please tap the Link Telegram button inside the website again.");
        return NextResponse.json({ ok: true });
      }

      const telegramUserId = Number(from.id);
      const username = from.username || null;

      const sb = supabaseAdmin();

      // Enforce one TG ↔ one account
      const { data: existing } = await sb
        .from("users")
        .select("id,email")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (existing && existing.id !== decoded.uid) {
        await sendMessage(
          chatId,
          "This Telegram account is already linked to another Studywithferuzbek profile. Tap Link Telegram from the site with the correct Google account."
        );
        return NextResponse.json({ ok: true });
      }

      const avatarUrl: string | null = await fetchAvatar(telegramUserId);

      await sb
        .from("users")
        .update({
          telegram_user_id: telegramUserId,
          telegram_username: username,
          avatar_url: avatarUrl,
        })
        .eq("id", decoded.uid);

      const dashUrl = `${baseAppUrl.replace(/\/$/, "")}/dashboard`;
      await sendMessage(
        chatId,
        `✅ Telegram linked! You can return to the site now.\nDashboard: ${dashUrl}\nIf the page still shows "Link Telegram", refresh once and it will auto-open your dashboard.`
      );
      return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      "Hi! Please tap the Link Telegram button from https://studywithferuzbek.vercel.app to get a secure code."
    );
    return NextResponse.json({ ok: true });
  }

  // Fallback: ignore
  return NextResponse.json({ ok: true });
}
