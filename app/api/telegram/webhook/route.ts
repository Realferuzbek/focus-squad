import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';

export const dynamic = 'force-dynamic';
const ok = () => NextResponse.json({ ok: true });

async function reply(chatId: number, text: string, buttonUrl?: string, buttonText?: string) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: any = { chat_id: chatId, text };
  if (buttonUrl && buttonText) {
    body.reply_markup = {
      inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
    };
  }
  await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function GET() {
  // used by Telegram’s reachability check
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const msg = update.message || update.edited_message || update.channel_post;
  const sb = supabaseAdmin();

  // ---- 1) Deep link: /start <code> or manual: /link <code> ----
  const text: string | undefined = msg?.text;
  if (text && (text.startsWith('/start') || text.startsWith('/link'))) {
    const parts = text.split(' ');
    const code = parts[1]?.trim();

    if (!code) {
      await reply(msg.chat.id,
        'To link your account, please go to the website and tap “Link Telegram”. If I still don’t reply, send /link <code> with the code shown on the site.');
      return ok();
    }

    // validate short code (not expired)
    const { data: rec } = await sb
      .from('link_tokens')
      .select('email, expires_at')
      .eq('token', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!rec?.email) {
      await reply(msg.chat.id, '❌ Link expired or invalid. Please press “Link Telegram” on the website again.');
      return ok();
    }

    // link the account
    await sb
      .from('users')
      .update({
        telegram_user_id: msg.from?.id ?? null,
        telegram_username: msg.from?.username ?? null,
      })
      .eq('email', rec.email);

    // consume the code
    await sb.from('link_tokens').delete().eq('token', code);

    // confirm & provide “Open Dashboard” button
    await reply(
      msg.chat.id,
      '✅ Telegram linked. You can close this chat.',
      `${process.env.NEXTAUTH_URL || ''}/dashboard`,
      'Open Dashboard'
    );
    return ok();
  }

  // ---- 2) Group voice chat events → update live_status ----
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

  // Fallback
  if (msg?.chat?.type === 'private') {
    await reply(msg.chat.id, 'Hi! Use the website’s “Link Telegram” button to connect your account.');
  }
  return ok();
}
