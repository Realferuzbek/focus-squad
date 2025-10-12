// app/(protected)/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminSessionPanel from "@/components/AdminSessionPanel";

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
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-zinc-400">
            Manage access, force resets, and review high-level usage.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          <AdminSessionPanel />

          <section className="rounded-2xl border border-white/10 bg-[#0f0f18] p-6">
            <h2 className="font-semibold mb-4">Promote/Demote</h2>
            <form action="/api/admin/users" method="post" className="flex flex-col gap-3 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none"
              />
              <select
                name="action"
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                <option value="promote">Promote to admin</option>
                <option value="demote">Demote from admin</option>
              </select>
              <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
                Apply
              </button>
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
