export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LiveChatClient from "@/components/community/LiveChatClient";

export default async function LiveCommunityPage() {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) {
    redirect("/signin");
  }

  const user = {
    id: me.id as string,
    name: me.display_name ?? me.name ?? me.email ?? null,
    avatarUrl: me.avatar_url ?? null,
  };

  let adminState: any = null;

  try {
    const cookieStore = cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((item) => `${item.name}=${item.value}`)
      .join("; ");

    const headerList = headers();
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const host = headerList.get("host");
    if (host) {
      const origin = `${proto}://${host}`;
      const res = await fetch(`${origin}/api/community/live/admin/state`, {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        adminState = data.state ?? null;
      }
    }
  } catch (error) {
    console.error("live-admin-state", error);
  }

  return (
    <div className="min-h-[100dvh] bg-[#07070f] px-4 py-8 text-white md:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <LiveChatClient user={user} adminState={adminState} />
      </div>
    </div>
  );
}
