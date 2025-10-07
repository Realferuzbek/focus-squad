// app/(protected)/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { cookies, headers } from "next/headers";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  // 1) Enforce Telegram linkage
  const { data: userRow } = await supabaseAdmin()
    .from("users")
    .select("telegram_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!userRow?.telegram_user_id) {
    redirect("/link-telegram");
  }

  // 2) Persist session-version cookie (supports future global re-login)
  const svFromEnv =
    process.env.NEXT_PUBLIC_SESSION_VERSION ??
    process.env.SESSION_VERSION ??
    "1";
  const jar = cookies();
  if (jar.get("sv")?.value !== svFromEnv) {
    jar.set("sv", svFromEnv, {
      path: "/",
      sameSite: "lax",
      // not httpOnly so middleware or client can read if needed
    });
  }

  return <>{children}</>;
}
