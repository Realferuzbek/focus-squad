// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';

export const dynamic = 'force-dynamic';

export async function GET() {
  // for reachability checks
  return NextResponse.json({ ok: true, method: 'GET' });
}

function ok() { return NextResponse.json({ ok: true }); }

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const sb = supabaseAdmin();
  const msg = update.message || update.edited_message || update.channel_post;

  // 1) /start <short-token> — link user account to Telegram
  if (msg?.text?.startsWith('/start')) {
    const token = msg.text.split(' ')[1];
    if (!token) return ok();

    const { data: row } = await sb.from('link_tokens').select('email').eq('token', token).single();
    if (row?.email) {
      await sb.from('users').update({
        telegram_user_id: msg.from?.id,
        telegram_username: msg.from?.username ?? null,
      }).eq('email', row.email);
      await sb.from('link_tokens').delete().eq('token', token);

      // confirm to the user
      const replyUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(replyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: '✅ Telegram linked to your Focus Squad account. You can close this chat.',
        }),
      });
    }
    return ok();
  }

  // 2) Group voice events -> live pill
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
