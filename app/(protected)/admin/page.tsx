// app/(protected)/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

import { getCachedSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminSessionPanel from "@/components/AdminSessionPanel";
import AdminAiToggle from "@/components/AdminAiToggle";
import AdminAiDiagnostics from "@/components/AdminAiDiagnostics";
import AdminPromoteForm from "@/components/AdminPromoteForm";

export default async function AdminPage() {
  const session = await getCachedSession();
  const me = session?.user as any;
  if (!me?.is_admin) redirect("/dashboard");

  const sb = supabaseAdmin();
  const { data: users } = await sb
    .from("users")
    .select("id,email,telegram_username,telegram_user_id,is_admin")
    .order("email");

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="text-4xl font-bold tracking-tight">
            Admin Control Center
          </h1>
          <p className="text-sm text-white/55">
            Manage access, force resets, and review high-level usage.
          </p>
        </div>
        <nav className="mt-4 flex gap-3 text-sm">
          <span className="rounded-full border border-white px-4 py-2 text-white">
            Control Center
          </span>
          <a
            href="/admin/chats"
            className="rounded-full border border-white/10 px-4 py-2 text-white/70 hover:text-white"
          >
            Chats
          </a>
        </nav>

        <div className="mt-10 space-y-8">
          <AdminAiToggle />
          <AdminAiDiagnostics />
          <AdminSessionPanel />

          <section className="rounded-2xl border border-white/10 bg-[#0f0f18]/90 p-6 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.35)]">
            <h2 className="mb-4 text-xl font-semibold text-white/90">
              Promote/Demote
            </h2>
            <AdminPromoteForm className="flex flex-col gap-3 sm:flex-row" />
          </section>

          <section className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Telegram</th>
                  <th className="p-3 text-left">Admin</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((u: any) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      {u.telegram_username ? `@${u.telegram_username}` : "—"}
                    </td>
                    <td className="p-3">{u.is_admin ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <a
            href="/dashboard"
            className="inline-block text-zinc-400 hover:underline"
          >
            ← Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
