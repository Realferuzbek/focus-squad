// app/(protected)/layout.tsx
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin");
  if (!(session.user as any).telegram_linked) redirect("/link-telegram");
  return <>{children}</>;
}
