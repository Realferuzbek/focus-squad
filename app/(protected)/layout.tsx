// app/(protected)/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  const { data, error } = await supabaseAdmin()
    .from("users")
    .select("telegram_user_id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    // If something odd happens, push to signin so we don't render a blank page
    redirect("/signin");
  }

  if (!data?.telegram_user_id) {
    redirect("/link-telegram");
  }

  return <>{children}</>;
}
