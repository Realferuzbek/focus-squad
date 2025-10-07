// app/(protected)/dashboard/page.tsx
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/signin');

  const email = session.user.email;
  const sb = supabaseAdmin();

  // Example query you already had – keep if you use it elsewhere
  const { data: me } = await sb
    .from('users')
    .select('telegram_user_id, telegram_username')
    .eq('email', email)
    .maybeSingle();

  // layout already enforced linking; this is just here for data
  const linked = !!me?.telegram_user_id;

  return (
    <div className="space-y-6">
      {/* No <LinkTelegram /> banner here. Keep your actual dashboard content below. */}
      {/* ... your cards, sessions, history, etc ... */}
    </div>
  );
}
