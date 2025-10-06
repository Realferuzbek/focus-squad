// app/(protected)/dashboard/page.tsx
import LinkTelegram from '@/components/LinkTelegram';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getEmailFromSession() {
  // Build a minimal Request carrying the cookies so getToken can read them
  const cookieHeader = cookies().getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const req = new Request('https://local', { headers: { cookie: cookieHeader } });
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.email as string | undefined;
}

export default async function DashboardPage() {
  const email = await getEmailFromSession();
  if (!email) {
    // Not logged in -> send to sign-in (adjust path if yours is different)
    redirect('/signin');
  }

  const sb = supabaseAdmin();
  const { data: me } = await sb
    .from('users')
    .select('telegram_user_id, telegram_username')
    .eq('email', email)
    .single();

  const linked = !!me?.telegram_user_id;

  return (
    <div className="space-y-6">
      {/* your plan / streak cards ... */}

      {!linked && (
        <div>
          <LinkTelegram />
        </div>
      )}

      {/* rest of dashboard */}
    </div>
  );
}
