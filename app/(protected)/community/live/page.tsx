export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-[100dvh] bg-[#07070f] px-4 py-8 text-white md:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <LiveChatClient user={user} />
      </div>
    </div>
  );
}
