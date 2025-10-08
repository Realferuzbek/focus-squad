// app/link-telegram/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-white bg-black">
        Not signed in.
      </div>
    );
  }

  const uid = (session.user as any).id;
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${uid}.${ts}`;
  const sig = signPayload(payload);
  const token = `${payload}.${sig}`;

  const botUser = process.env.TELEGRAM_BOT_USERNAME!;
  const deepLink = `https://t.me/${botUser}?start=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-[100dvh] bg-[#0b0b0f] text-white flex items-center justify-center">
      <div className="max-w-xl mx-4 p-8 rounded-2xl"
           style={{ background: "linear-gradient(180deg,#12121a 0%,#0b0b0f 100%)", boxShadow: "0 10px 60px rgba(120,80,255,.2)" }}>
        <h1 className="text-2xl font-semibold mb-2">Almost there — link your Telegram</h1>
        <p className="text-zinc-400 mb-6">
          We use Telegram for announcements and live sessions. Tap below to connect your account.
        </p>
        <a href={deepLink}
           className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-gradient-to-r from-[#8a5bff] via-[#b157ff] to-[#ff5ddd] font-semibold">
          Link Telegram
        </a>
        <p className="text-sm text-zinc-500 mt-4">
          If the bot didn’t open, copy and send in Telegram:
          <code className="ml-2 rounded bg-zinc-900 px-2 py-1">{`/start ${token}`}</code>
        </p>
        <p className="text-sm text-zinc-500 mt-3">
          After linking, come back to the site — you’ll be taken to your dashboard automatically.
        </p>
      </div>
    </div>
  );
}
