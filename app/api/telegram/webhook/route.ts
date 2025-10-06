// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const DASHBOARD_URL = `${process.env.NEXTAUTH_URL}/dashboard`;

function ok() { return NextResponse.json({ ok: true }); }

export async function GET() {
  // Useful for Telegram's reachability checks
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const sb = supabaseAdmin();
  const msg = update.message || update.edited_message || update.channel_post;

  // Helper to reply
  async function reply(text: string, withOpenButton = false) {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body: any = { chat_id: msg.chat.id, text };
    if (withOpenButton) {
      body.reply_markup = {
        inline_keyboard: [[{ text: 'Open dashboard', url: DASHBOARD_URL }]],
      };
    }
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  // 1) /start <jwt> — link account to Telegram
  if (msg?.text?.startsWith('/start')) {
    const token = msg.text.split(' ')[1]; // may be undefined
    if (!token) {
      await reply('To link your account, please go to the website and tap “Link Telegram”.');
      return ok();
    }

    try {
      const { email } = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as { email: string };
      if (email) {
        await sb.from('users')
          .update({
            telegram_user_id: msg.from?.id ?? null,
            telegram_username: msg.from?.username ?? null,
          })
          .eq('email', email);
        await reply('✅ Telegram linked to your Focus Squad account.', true);
      }
    } catch {
      await reply('❌ Link expired or invalid. Please tap “Link Telegram” on the website again.');
    }
    return ok();
  }

  // 2) Video chat events from your group → live pill
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
