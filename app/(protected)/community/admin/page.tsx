export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { mapThread } from "@/lib/adminchat/server";
import AdminChatClient from "@/components/community/AdminChatClient";

export default async function AdminChatPage() {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) redirect("/signin");

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("dm_threads")
    .select(
      "id,user_id,status,started_at,last_message_at,wallpaper_url,avatar_url,description",
    )
    .eq("user_id", me.id)
    .maybeSingle();

  if (error) {
    console.error("admin chat thread fetch error", error);
  }

  const initialThread = data ? mapThread(data) : null;

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-8 text-white md:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <AdminChatClient
          user={{
            id: me.id,
            name: me.display_name ?? me.name ?? me.email,
            email: me.email,
            avatarUrl: me.avatar_url ?? null,
            isDmAdmin: !!me.is_dm_admin,
          }}
          initialThread={initialThread}
        />
      </div>
    </div>
  );
}

