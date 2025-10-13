export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminManager from "@/components/linkedinhub/AdminManager";
import Notice from "@/components/linkedinhub/Notice";

export default async function LinkedInHubAdminPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.is_admin) {
    return (
      <div className="min-h-[100dvh] bg-[#07070b] px-4 py-10 text-white">
        <div className="mx-auto w-full max-w-3xl">
          <Notice title="Admins only" message="You need admin access to manage LinkedIn posts." />
        </div>
      </div>
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("linkedin_admin_posts")
    .select("id,title,excerpt,media_url,post_url,created_at,published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const missingTable = error?.code === "42P01";
  const posts = data ?? [];

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">LinkedIn Hub Admin</h1>
          <p className="text-sm text-zinc-400">
            Curate and publish posts that appear in the LinkedIn Hub feature feed.
          </p>
        </header>

        <AdminManager initialPosts={posts} missingTable={missingTable} />
      </div>
    </div>
  );
}
