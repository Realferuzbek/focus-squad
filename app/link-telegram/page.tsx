// app/link-telegram/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import LinkTelegramWatcher from "@/components/LinkTelegramWatcher";
import { redirect } from "next/navigation";
import { createHmac } from "crypto";

function b64url(i: Buffer | string) {
  const s = (i instanceof Buffer ? i : Buffer.from(i))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return s;
}

function signPayload(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET!;
  const sig = createHmac("sha256", secret).update(payload).digest();
  return b64url(sig);
}

export default async function LinkTelegramPage() {
  const session = await auth();
  if (!session?.user?.email) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-white bg-black">
        Not signed in.
      </div>
    );
  }

  const uid = (session.user as any).id;
  const sb = supabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("telegram_user_id,display_name")
    .eq("id", uid)
    .maybeSingle();

  if (user?.telegram_user_id) {
    redirect("/dashboard");
  }

  const ts = Math.floor(Date.now() / 1000);
  const payload = `${uid}.${ts}`;
  const sig = signPayload(payload);
  const token = `${payload}.${sig}`;

  const botUser = process.env.TELEGRAM_BOT_USERNAME!;
  const deepLink = `https://t.me/${botUser}?start=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-[100dvh] bg-[#05050b] text-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-[28px] border border-white/5 bg-[#0e0e16]/90 p-8 shadow-[0_25px_60px_rgba(123,58,237,0.25)] backdrop-blur">
        <div className="flex flex-col gap-2 text-center mb-8">
          <span className="text-sm uppercase tracking-[0.25em] text-fuchsia-400/70">
            Secure Step
          </span>
          <h1 className="text-3xl font-bold">Link your Telegram</h1>
          <p className="text-sm text-zinc-400">
            {session.user?.name
              ? `Hi ${session.user.name.split(" ")[0]}, tap the button below to open @${botUser}.`
              : `Tap the button below to open @${botUser}.`}
            {" Once you hit Start in Telegram, we’ll recognize you immediately."}
          </p>
        </div>

        <div className="space-y-4">
          <a
            href={deepLink}
            className="block w-full rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] px-6 py-4 text-center text-base font-semibold shadow-[0_18px_35px_rgba(138,92,246,0.3)] transition hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
          >
            Link Telegram
          </a>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-400">
            <p className="font-semibold text-zinc-200 mb-1">Manual backup</p>
            <p className="mb-2">If Telegram didn’t open, copy and send this inside the bot:</p>
            <div className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 font-mono text-xs">
              <span className="text-zinc-500">/start</span>
              <span className="break-all text-zinc-200">{token}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
          <p className="font-semibold">What happens next?</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-purple-50/80">
            <li>Telegram opens with @{botUser}. Hit <strong>Start</strong>.</li>
            <li>We link this Google account to your Telegram safely.</li>
            <li>Watch this page — we’ll move you to the dashboard as soon as linking finishes.</li>
          </ol>
        </div>
      </div>
      <LinkTelegramWatcher />
    </div>
  );
}
