import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  // 1) require a signed-in user
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    // you can change to '/api/auth/signin' if you prefer the NextAuth page
    redirect('/signin');
  }

  // 2) gate until Telegram is linked
  const { data } = await supabaseAdmin()
    .from('users')
    .select('telegram_user_id')
    .eq('email', email)
    .single();

  if (!data?.telegram_user_id) {
    redirect('/link-telegram');
  }

  return <>{children}</>;
}
