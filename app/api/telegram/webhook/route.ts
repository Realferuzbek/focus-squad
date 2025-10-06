// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

function ok() {
  return NextResponse.json({ ok: true });
}

async function reply(chatId: number, text: string, buttonUrl?: string, buttonText?: string) {
  const body: any = { chat_id: chatId, text };
  if (buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: buttonText ?? 'Open dashboard', url: buttonUrl }]],
    };
  }
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function GET() {
  // helps Telegram check reachability
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const msg = update.message || update.edited_message || update.channel_post;
  const text: string = (msg?.text ?? '').trim();
  const chatId: number | undefined = msg?.chat?.id;

  const sb = supabaseAdmin();
  const dashboardUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '') + '/dashboard';

  // ---- Linking flow ---------------------------------------------------------
  // Accept /start <code> OR /link <code>, with or without angle brackets
  if (/^\/start\b/i.test(text) || /^\/link\b/i.test(text)) {
    // Extract token from either command
    let token = '';
    const mStart = text.match(/^\/start(?:\s+(.+))?$/i);
    const mLink = text.match(/^\/link\s+(.+)$/i);
    token = (mStart?.[1] ?? mLink?.[1] ?? '')
      .trim()
      .replace(/[<>]/g, '')           // strip angle brackets if user pasted them
      .replace(/\u200b/g, '');        // strip zero-width if any

    if (!token) {
      if (chatId) {
        await reply(
          chatId,
          'To link your account, please go to the website and press “Link Telegram”.'
        );
      }
      return ok();
    }

    // Look up the short token
    const { data, error } = await sb
      .from('link_tokens')
      .select('email, expires_at')
      .eq('token', token)
      .maybeSingle();

    const expired =
      !data || !data.expires_at || Date.now() >= new Date(data.expires_at).getTime();

    if (expired || error) {
      if (chatId) {
        await reply(
          chatId,
          '❌ Link expired or invalid. Please press “Link Telegram” on the website again.'
        );
      }
      return ok();
    }

    // Require a public @username so group announcements can mention people
    if (!msg?.from?.username) {
      if (chatId) {
        await reply(
          chatId,
          'ℹ️ Please set a Telegram @username first (Settings ▸ Edit Profile ▸ Username), then press “Link Telegram” again.',
          'https://t.me/settings',
          'Open Telegram Settings'
        );
      }
      return ok();
    }

    // Update your user row
    await sb
      .from('users')
      .update({
        telegram_user_id: msg.from.id,
        telegram_username: msg.from.username,
      })
      .eq('email', data.email);

    // Consume the token so it can’t be reused
    await sb.from('link_tokens').delete().eq('token', token);

    if (chatId) {
      await reply(
        chatId,
        '✅ Linked! You can close this chat.',
        dashboardUrl,
        'Open dashboard'
      );
    }
    return ok();
  }

  // ---- Live / scheduled group events (keep your existing behaviour) ---------
  const isGroup = msg?.chat?.id?.toString() === process.env.TELEGRAM_GROUP_ID;
  if (isGroup) {
    if (msg.video_chat_scheduled) {
      await sb
        .from('live_status')
        .upsert(
          { id: 1, state: 'scheduled', scheduled_at: new Date(msg.video_chat_scheduled.start_date * 1000).toISOString() },
          { onConflict: 'id' }
        );
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
