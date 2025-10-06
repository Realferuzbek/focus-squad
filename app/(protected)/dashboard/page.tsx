// app/(protected)/dashboard/page.tsx
import LinkTelegram from "@/components/LinkTelegram";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null; // layout will redirect
  const email = session.user!.email!;
  const sb = supabaseAdmin();

  const { data: me } = await sb
    .from("users")
    .select("telegram_user_id, telegram_username")
    .eq("email", email)
    .maybeSingle(); // allows null without throwing

  const linked = !!me?.telegram_user_id;

  return (
    <div className="space-y-6">
      {!linked && <LinkTelegram />}
      {/* rest of dashboard */}
    </div>
  );
}
