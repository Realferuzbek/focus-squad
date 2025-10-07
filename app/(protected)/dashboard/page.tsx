// app/(protected)/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";
import LivePill from "@/components/LivePill";
import TaskInput from "@/components/TaskInput";
import SessionsCard from "@/components/SessionsCard";
import StreakCard from "@/components/StreakCard";
import ReviewerPanel from "@/components/ReviewerPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }

  const email = session.user.email;
  const sb = supabaseAdmin();

  const { data: me } = await sb
    .from("users")
    .select("id, display_name, is_admin, avatar_url")
    .eq("email", email)
    .maybeSingle();

  return (
    <div className="px-4 md:px-8 lg:px-10 py-6 space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Focus Squad" className="h-7 w-7" />
          <h1 className="text-xl md:text-2xl font-semibold">Focus Squad</h1>
          <LivePill />
        </div>
        <div className="flex items-center gap-3">
          {me?.is_admin && (
            <Link
              href="/reviewer"
              className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition"
            >
              Reviewer panel
            </Link>
          )}
          <div className="flex items-center gap-2">
            {me?.avatar_url ? (
              <img
                src={me.avatar_url}
                className="h-8 w-8 rounded-full object-cover"
                alt="avatar"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-white/10" />
            )}
            <span className="text-sm text-gray-300">
              {session.user.name ?? email}
            </span>
          </div>
        </div>
      </header>

      {/* Planner & Progress */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TaskInput />
          <SessionsCard />
        </div>
        <div className="space-y-6">
          <StreakCard />
          {/* History is embedded in SessionsCard in your codebase; keep this lean */}
        </div>
      </section>
    </div>
  );
}
