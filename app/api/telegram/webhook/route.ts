// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

function ok() { return NextResponse.json({ ok: true }); }

const TG = (path: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}${path}`;

async function reply(chatId: number | string, text: string, buttons?: { text: string; url: string }[]) {
  const body: any = { chat_id: chatId, text };
  if (buttons?.length) {
    body.reply_markup = { inline_keyboard: [buttons.map(b => ({ text: b.text, url: b.url }))] };
  }
  await fetch(TG('/sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function GET() {
  // for Telegram's reachability ping
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: NextRequest) {
  const update = await req.json().catch(() => null);
  if (!update) return ok();

  const msg = update.message || update.edited_message || update.channel_post;
  const chatId = msg?.chat?.id;
  const from = msg?.from;

  // --- 0) Group live status (keep your existing logic if you had it)
  if (chatId?.toString() === process.env.TELEGRAM_GROUP_ID) return ok();

  // --- 1) Parse commands
  const text: string = msg?.text ?? '';
  const startMatch = text.match(/^\/start(?:\s+([A-Za-z0-9_-]{6,64}))?$/);
  const linkMatch  = text.match(/^\/link\s+([A-Za-z0-9_-]{6,64})$/);

  const openDashBtn = [{ text: 'Open dashboard', url: `${process.env.NEXTAUTH_URL ?? 'https://studywithferuzbek.vercel.app'}/dashboard` }];

  const sb = supabaseAdmin();

  // helper: complete link using a short token
  async function completeLink(token: string) {
    // find short token that hasn't expired
    const { data: link, error: linkErr } = await sb
      .from('link_tokens')
      .select('email, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (linkErr || !link) {
      await reply(chatId, '❌ Link expired or invalid. Please press “Link Telegram” on the website again.');
      return;
    }

    // update the user row; request the email back to be sure one row was changed
    const { data: updated, error: updErr } = await sb
      .from('users')
      .update({
        telegram_user_id: from?.id ?? null,
        telegram_username: from?.username ?? null,
      })
      .eq('email', link.email)
      .select('email')
      .single();

    if (updErr || !updated) {
      console.error('Failed to update users row', updErr);
      await reply(chatId, '❌ Could not link your account. Please try again from the website.');
      return;
    }

    // best-effort: delete token to prevent reuse
    await sb.from('link_tokens').delete().eq('token', token);

    await reply(chatId, '✅ Linked! You can close this chat.', openDashBtn);
  }

  // /link <token>
  if (linkMatch) {
    await completeLink(linkMatch[1]);
    return ok();
  }

  // /start <token> (deep link)
  if (startMatch) {
    const token = startMatch[1];
    if (token) {
      await completeLink(token);
    } else {
      await reply(chatId, 'To link your account, please go to the website and press “Link Telegram”.');
    }
    return ok();
  }

  // ignore anything else
  return ok();
}
