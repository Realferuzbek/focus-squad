// app/link-telegram/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function LinkTelegramPage() {
  const session = await auth();
  if (!session?.user?.email) {
    // must be signed in to link
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Link href="/signin" className="underline">
          Sign in first
        </Link>
      </div>
    );
  }

  // The client component/CTA you already have can call /api/link to get token+url.
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="max-w-xl w-full p-6">
        <h1 className="text-2xl mb-4">Almost there — link your Telegram</h1>
        {/* Put your existing <LinkTelegram /> client component here if you want */}
        {/* Or a simple link that hits /api/link and opens bot */}
        <a
          href="/api/link"
          className="block w-full text-center rounded-full py-3 text-white"
          style={{
            background:
              "linear-gradient(90deg, rgba(244,114,182,1) 0%, rgba(147,51,234,1) 100%)",
          }}
        >
          Link Telegram
        </a>
        <p className="opacity-70 mt-3">
          After linking in Telegram, return to this site—your dashboard will open automatically.
        </p>
      </div>
    </div>
  );
}
