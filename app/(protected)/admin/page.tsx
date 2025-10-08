// app/(protected)/admin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as any;
  if (!me?.is_admin) redirect("/dashboard");

  const sb = supabaseAdmin();
  const { data: users } = await sb
    .from("users")
    .select("id,email,telegram_username,telegram_user_id,is_admin")
    .order("email");

  async function PromoteForm() { return null }

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold mb-6">Admin</h1>

        <div className="rounded-2xl border border-white/10 p-6 bg-[#0f0f18]">
          <h2 className="font-semibold mb-4">Promote/Demote</h2>
          <form action="/api/admin/users" method="post" className="flex gap-2">
            <input name="email" type="email" required placeholder="user@example.com"
                   className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none" />
            <select name="action" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2">
              <option value="promote">Promote to admin</option>
              <option value="demote">Demote from admin</option>
            </select>
            <button className="rounded-lg px-4 bg-white/10 hover:bg-white/15">Apply</button>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">TG</th>
                <th className="text-left p-3">Admin</th>
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
        </div>

        <a href="/dashboard" className="inline-block mt-6 text-zinc-400 hover:underline">
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
