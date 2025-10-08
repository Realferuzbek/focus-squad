// app/(protected)/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import TaskPlannerSheet from "@/components/TaskPlannerSheet";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user as any;

  return (
    <div className="min-h-[100dvh] bg-[#07070b]">
      {/* Expose email to client for recent-accounts */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__session_email=${JSON.stringify(user?.email || null)};`,
        }}
      />
      <Navbar isAdmin={!!user.is_admin} avatarUrl={user?.image || user?.avatar_url} />

      <main className="mx-auto max-w-6xl px-4 py-8 text-white">
        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl p-6 bg-gradient-to-br from-[#161628] to-[#0f0f18] border border-white/10">
            <h2 className="text-xl font-semibold mb-2">Welcome back, {session?.user?.name ?? "friend"} 👋</h2>
            <p className="text-zinc-400">
              Stay consistent. Plan your day before 10:00 and execute.
            </p>
            <div className="mt-6">
              <TaskPlannerSheet />
            </div>
          </section>

          <section className="rounded-2xl p-6 bg-gradient-to-br from-[#161628] to-[#0f0f18] border border-white/10">
            <h2 className="text-xl font-semibold mb-2">My streak 🔥</h2>
            <p className="text-zinc-400">Streak & history UI will live here (next step).</p>
          </section>
        </div>
      </main>
    </div>
  );
}
