// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function ok() {
  return NextResponse.json({ ok: true });
}

const TG = (path: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}${path}`;

async function reply(
  chatId: number | string,
  text: string,
  buttons?: { text: string; url: string }[]
) {
  const body: any = { chat_id: chatId, text };
  if (buttons?.length) {
    body.reply_markup = {
      inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))],
    };
  }
  await fetch(TG("/sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const msg = update.message || update.edited_message || update.channel_post;
  const chatId = msg?.chat?.id;
  const from = msg?.from;

  // Ignore group messages
  if (chatId?.toString() === process.env.TELEGRAM_GROUP_ID) return ok();

  const text: string = msg?.text ?? "";
  const startMatch = text.match(/^\/start(?:\s+([A-Za-z0-9_-]{6,64}))?$/);
  const linkMatch = text.match(/^\/link\s+([A-Za-z0-9_-]{6,64})$/);

  const openDashBtn = [
    {
      text: "Open dashboard",
      url: `${process.env.NEXTAUTH_URL ?? "https://studywithferuzbek.vercel.app"}/dashboard`,
    },
  ];

  const sb = supabaseAdmin();

  async function completeLink(token: string) {
    // 1) Find token that hasn't expired
    const { data: link, error: linkErr } = await sb
      .from("link_tokens")
      .select("email, expires_at")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (linkErr || !link) {
      await reply(
        chatId,
        "❌ Link expired or invalid. Please press “Link Telegram” on the website again."
      );
      return;
    }

    const tgId = from?.id ?? null;

    // 2) Uniqueness guard: the same Telegram cannot be linked to multiple site accounts
    if (tgId) {
      const { data: taken } = await sb
        .from("users")
        .select("email")
        .eq("telegram_user_id", tgId)
        .neq("email", link.email)
        .maybeSingle();

      if (taken) {
        await reply(
          chatId,
          "❌ This Telegram account is already linked to another Focus Squad account. If you need to change it, unlink there first or contact support."
        );
        return;
      }
    }

    // 3) Upsert user row by email
    await sb
      .from("users")
      .upsert(
        {
          email: link.email,
          telegram_user_id: tgId,
          telegram_username: from?.username ?? null,
        },
        { onConflict: "email" }
      );

    // 4) Try to fetch avatar and store in Supabase Storage (optional best-effort)
    try {
      if (tgId) {
        // get profile photos
        const photos = await fetch(TG(`/getUserProfilePhotos?user_id=${tgId}&limit=1`)).then((r) =>
          r.json()
        );
        const fileId = photos?.result?.photos?.[0]?.[0]?.file_id;
        if (fileId) {
          const file = await fetch(TG(`/getFile?file_id=${fileId}`)).then((r) => r.json());
          const filePath: string | undefined = file?.result?.file_path;
          if (filePath) {
            const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
            const buf = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
            const filename = `tg_${tgId}.jpg`;
            await sb.storage.from("avatars").upload(filename, buf, {
              contentType: "image/jpeg",
              upsert: true,
            });
            const { data: pub } = sb.storage.from("avatars").getPublicUrl(filename);
            if (pub?.publicUrl) {
              await sb.from("users").update({ avatar_url: pub.publicUrl }).eq("email", link.email);
            }
          }
        }
      }
    } catch {
      // ignore avatar errors silently
    }

    // 5) Delete the token (one-time use)
    await sb.from("link_tokens").delete().eq("token", token);

    // 6) Confirm to the user
    await reply(chatId, "✅ Linked! You can close this chat.", openDashBtn);
  }

  if (linkMatch) {
    await completeLink(linkMatch[1]);
    return ok();
  }

  if (startMatch) {
    const token = startMatch[1];
    if (token) {
      await completeLink(token);
    } else {
      await reply(chatId, "To link your account, please press “Link Telegram” on the website.");
    }
    return ok();
  }

  return ok();
}
