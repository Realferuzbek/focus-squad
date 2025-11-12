export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

import { redirect } from "next/navigation";
import { getCachedSession } from "@/lib/server-session";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { mapThread } from "@/lib/adminchat/server";
import AdminChatClient, {
  type ChatUser,
  type ThreadMeta,
} from "@/components/community/AdminChatClient";
import AdminChatAdminView from "@/components/community/AdminChatAdminView";
import {
  getThreadDisplayMeta,
  listAdminThreads,
  loadThreadForAdmin,
  type AdminInboxThread,
  type ThreadDisplayMeta,
} from "@/lib/community/admin/server";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminChatPage({ searchParams }: PageProps) {
  const session = await getCachedSession();
  const me = session?.user as any;
  if (!me?.id) redirect("/signin");

  const user: ChatUser = {
    id: me.id,
    name: me.display_name ?? me.name ?? me.email,
    email: me.email,
    avatarUrl: me.avatar_url ?? null,
    isDmAdmin: !!me.is_dm_admin,
  };

  const threadParam = searchParams?.thread;
  const requestedThreadId =
    typeof threadParam === "string"
      ? threadParam
      : Array.isArray(threadParam)
        ? threadParam[0]
        : null;

  if (user.isDmAdmin) {
    const inboxThreads = await listAdminThreads(user.id);
    const activeThreadId = requestedThreadId ?? inboxThreads[0]?.id ?? null;

    const threadPromise: Promise<ThreadMeta | null> = activeThreadId
      ? loadThreadForAdmin(activeThreadId)
      : Promise.resolve(null);
    const metaPromise: Promise<ThreadDisplayMeta | null> = activeThreadId
      ? getThreadDisplayMeta(activeThreadId)
      : Promise.resolve(null);
    const [initialThread, threadMeta] = await Promise.all([
      threadPromise,
      metaPromise,
    ]);

    return (
      <AdminChatAdminView
        user={user}
        inboxThreads={inboxThreads}
        initialThread={initialThread}
        activeThreadId={activeThreadId}
        displayMeta={threadMeta}
      />
    );
  }

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
        <AdminChatClient user={user} initialThread={initialThread} />
      </div>
    </div>
  );
}
