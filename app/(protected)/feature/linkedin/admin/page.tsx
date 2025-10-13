export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import ProfileHeader from "@/components/linkedinhub/ProfileHeader";
import AdminFeed from "@/components/linkedinhub/AdminFeed";

const DEFAULT_HEADLINE = "Sharing focus, productivity, and community updates.";

export default async function LinkedInAdminFeedPage() {
  const session = await auth();
  const viewer = session?.user as any;

  const sb = supabaseAdmin();
  const { data: owner } = await sb
    .from("users")
    .select("id,display_name,name,email,avatar_url")
    .eq("is_admin", true)
    .order("email")
    .limit(1)
    .maybeSingle();

  const name =
    owner?.display_name ??
    owner?.name ??
    viewer?.display_name ??
    viewer?.name ??
    viewer?.email ??
    "LinkedIn Admin";

  const avatarUrl = owner?.avatar_url ?? (viewer as any)?.avatar_url ?? viewer?.image ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="space-y-3">
          <span className="pill">Admin Suite</span>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            LinkedIn Hub Admin
          </h1>
          <p className="max-w-2xl text-base text-white/60">
            Deliver polished updates for the community and keep the hub alive with premium stories.
          </p>
        </div>

        <ProfileHeader
          name={name}
          headline={DEFAULT_HEADLINE}
          avatarUrl={avatarUrl}
          followers="Focus Squad community"
        />

        <AdminFeed ownerName={name} avatarUrl={avatarUrl} />
      </div>
    </div>
  );
}
