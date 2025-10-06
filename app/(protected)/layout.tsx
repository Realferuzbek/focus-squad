// app/(protected)/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/signin');

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
