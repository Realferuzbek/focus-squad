// app/(protected)/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminSessionPanel from "@/components/AdminSessionPanel";
import GlowPanel from "@/components/GlowPanel";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
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
          <h1 className="text-4xl font-bold tracking-tight">Admin Control Center</h1>
          <p className="text-sm text-white/55">
            Manage access, force resets, and review high-level usage.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <GlowPanel className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="pill">Feature Spotlight</span>
                <h2 className="text-2xl font-bold tracking-tight text-white">LinkedIn Hub Admin</h2>
                <p className="max-w-xl text-sm text-white/65">
                  Curate premium LinkedIn updates, refresh the feed, and keep the community inspired.
                </p>
              </div>
              <Link href="/admin/linkedinhub" className="btn-primary min-w-[160px] justify-center">
                Open
              </Link>
            </div>
          </GlowPanel>

          <AdminSessionPanel />

          <section className="rounded-2xl border border-white/10 bg-[#0f0f18]/90 p-6 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.35)]">
            <h2 className="mb-4 text-xl font-semibold text-white/90">Promote/Demote</h2>
            <form action="/api/admin/users" method="post" className="flex flex-col gap-3 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none transition hover:border-white/20 focus:border-[var(--swf-glow-start)]"
              />
              <select
                name="action"
                className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none transition hover:border-white/20 focus:border-[var(--swf-glow-start)]"
              >
                <option value="promote">Promote to admin</option>
                <option value="demote">Demote from admin</option>
              </select>
              <button className="btn-primary">Apply</button>
            </form>
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
                    <td className="p-3">{u.telegram_username ? `@${u.telegram_username}` : "—"}</td>
                    <td className="p-3">{u.is_admin ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <a href="/dashboard" className="inline-block text-zinc-400 hover:underline">
            ← Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
