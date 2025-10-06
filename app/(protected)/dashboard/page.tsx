// app/(protected)/dashboard/page.tsx
import LinkTelegram from "@/components/LinkTelegram";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  const email = session.user?.email!;
  const sb = supabaseAdmin();

  const { data: me } = await sb
    .from("users")
    .select("telegram_user_id, telegram_username")
    .eq("email", email)
    .maybeSingle();

  const linked = !!me?.telegram_user_id;

  return (
    <div className="space-y-6">
      {!linked && <LinkTelegram />}
      {/* rest of dashboard ... */}
    </div>
  );
}
