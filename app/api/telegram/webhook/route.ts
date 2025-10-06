// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const ok = () => NextResponse.json({ ok: true });
export async function GET() { return ok(); }

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg) return ok();

  // ---- helpers
  const text: string = (msg.text ?? '').trim();
  const parse = (t: string) => {
    // handle normal spaces + NBSP; captures "/cmd <arg>"
    const m = t.match(/^\/(\w+)(?:[\s\u00A0]+(.+))?$/i);
    return { cmd: (m?.[1] || '').toLowerCase(), arg: (m?.[2] || '').trim() };
  };
  const reply = async (body: any) => {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  const { cmd, arg } = parse(text);

  // primary path: deep-link "/start <code>" OR fallback "/link <code>"
  if (cmd === 'start' || cmd === 'link') {
    // strip anything that isn't [a-z0-9-_] to avoid unicode mishaps
    const code = (arg || '').replace(/[^\w-]/g, '');
    if (!code) {
      await reply({
        chat_id: msg.chat.id,
        text: 'To link your account, open the website and press “Link Telegram”.',
      });
      return ok();
    }

    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from('link_tokens')
      .select('email')
      .eq('token', code)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!row?.email) {
      await reply({
        chat_id: msg.chat.id,
        text: '❌ Link expired or invalid. Please press “Link Telegram” on the website again.',
      });
      return ok();
    }

    await sb
      .from('users')
      .update({
        telegram_user_id: msg.from?.id ?? null,
        telegram_username: msg.from?.username ?? null,
      })
      .eq('email', row.email);

    // burn the token so it can’t be reused
    await sb.from('link_tokens').delete().eq('token', code);

    await reply({
      chat_id: msg.chat.id,
      text: '✅ Linked! You can close this chat.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Open dashboard', url: `${process.env.NEXTAUTH_URL}/dashboard` }]],
      },
    });
    return ok();
  }

  // group live-status events handled elsewhere (not relevant here)
  return ok();
}
