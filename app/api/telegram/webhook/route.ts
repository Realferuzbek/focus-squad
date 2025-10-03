// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Telegram checks reachability with GET/HEAD — answer fast.
export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET' });
}
export async function HEAD() {
  return new NextResponse('ok', { status: 200 });
}

function ok() {
  // Always respond 200 quickly to avoid Telegram retries/timeouts
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const sb = supabaseAdmin();
  const msg = update.message || update.edited_message || update.channel_post;

  // 1) /start <jwt> — link user account to their Telegram
  if (msg?.text?.startsWith('/start')) {
    const parts = msg.text.split(' ');
    const token = parts[1];
    if (!token) return ok();

    try {
      const { email } = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as { email: string };
      if (!email) return ok();

      await sb
        .from('users')
        .update({
          telegram_user_id: msg.from?.id,
          telegram_username: msg.from?.username ?? null,
        })
        .eq('email', email);

      // Confirmation
      const replyUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(replyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: '✅ Telegram linked to your Focus Squad account. You can close this chat.',
        }),
      });
    } catch {
      const replyUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(replyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: '❌ Link expired or invalid. Open the dashboard and press “Link Telegram” again.',
        }),
      });
    }
    return ok();
  }

  // 2) Update live status from your group’s video chat events
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
