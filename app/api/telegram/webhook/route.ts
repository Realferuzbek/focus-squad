// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';

export const dynamic = 'force-dynamic';

function ok() { return NextResponse.json({ ok: true }); }

async function tgSend(chatId: number | string, text: string, buttonUrl?: string) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: any = { chat_id: chatId, text };
  if (buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: 'Open dashboard', url: buttonUrl }]],
    };
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function GET() {
  // lets Telegram check reachability
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const sb = supabaseAdmin();
  const msg = update.message || update.edited_message || update.channel_post;

  // 1) Deep-link: /start <short-code>
  if (msg?.text?.startsWith('/start')) {
    const code = (msg.text.split(' ')[1] || '').trim();
    if (code) {
      // look up token (still valid?)
      const { data: rows } = await sb
        .from('link_tokens')
        .select('email, expires_at')
        .eq('token', code)
        .limit(1);

      const row = rows?.[0];
      if (row && DateTime.fromISO(row.expires_at).toJSDate() > new Date()) {
        // link the account
        await sb
          .from('users')
          .update({
            telegram_user_id: msg.from?.id ?? null,
            telegram_username: msg.from?.username ?? null,
          })
          .eq('email', row.email);

        // burn the token
        await sb.from('link_tokens').delete().eq('token', code);

        await tgSend(
          msg.chat.id,
          '✅ Telegram linked to your Focus Squad account.\nYou can return to the website.',
          `${process.env.NEXTAUTH_URL}/dashboard`
        );
        return ok();
      }
    }

    // No/invalid token
    await tgSend(
      msg.chat.id,
      'ℹ️ To link your account, please go to the website and tap “Link Telegram”.',
      `${process.env.NEXTAUTH_URL}/dashboard#link-telegram`
    );
    return ok();
  }

  // 2) Live status from your group (optional)
  const isGroup = msg?.chat?.id?.toString() === process.env.TELEGRAM_GROUP_ID;
  if (isGroup) {
    if (msg.video_chat_scheduled) {
      const start = DateTime.fromSeconds(msg.video_chat_scheduled.start_date, { zone: 'UTC' }).toISO();
      await sb.from('live_status').upsert({ id: 1, state: 'scheduled', scheduled_at: start }, { onConflict: 'id' });
      return ok();
    }
    if (msg.video_chat_started) {
      await sb.from('live_status').upsert({ id: 1, state: 'live', scheduled_at: null }, { onConflict: 'id' });
      return ok();
    }
    if (msg.video_chat_ended) {
      await sb.from('live_status').upsert({ id: 1, state: 'none', scheduled_at: null }, { onConflict: 'id' });
      return ok();
    }
  }

  return ok();
}
