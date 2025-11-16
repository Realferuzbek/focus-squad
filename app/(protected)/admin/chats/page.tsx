export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

import { redirect } from "next/navigation";
import { getCachedSession } from "@/lib/server-session";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminChatDashboard from "@/components/AdminChatDashboard";

export default async function AdminChatsPage() {
  const session = await getCachedSession();
  const me = session?.user as any;
  if (!me?.is_admin) redirect("/dashboard");

  const sb = supabaseAdmin();
  const { data: users } = await sb
    .from("users")
    .select("id,email")
    .order("email");

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Admin – Chats
            </h1>
            <p className="text-sm text-white/55">
              Monitor how the AI assistant is used across the community.
            </p>
          </div>
        </div>
        <nav className="flex gap-3 text-sm">
          <a
            href="/admin"
            className="rounded-full border border-white/10 px-4 py-2 text-white/70 hover:text-white"
          >
            Control Center
          </a>
          <span className="rounded-full border border-white px-4 py-2 text-white">
            Chats
          </span>
        </nav>
        <AdminChatDashboard users={users ?? []} />
        <a
          href="/dashboard"
          className="inline-block text-sm text-white/60 hover:text-white"
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
