// app/(protected)/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { getCachedSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user) redirect("/signin");
  if (!(session.user as any).telegram_linked) redirect("/link-telegram");
  return <>{children}</>;
}
