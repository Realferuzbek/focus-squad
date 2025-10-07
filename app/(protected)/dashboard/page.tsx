// app/(protected)/dashboard/page.tsx
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");

  const email = session.user.email;
  const sb = supabaseAdmin();

  // Fetch anything you need for the dashboard. Telegram is already gated in layout.
  const { data: me } = await sb
    .from("users")
    .select("display_name, avatar_url")
    .eq("email", email)
    .maybeSingle();

  return (
    <div className="space-y-6 p-4">
      <div className="text-xl">Welcome{me?.display_name ? `, ${me.display_name}` : ""}!</div>
      {/* ... your dashboard widgets ... */}
    </div>
  );
}
