// lib/auth.ts (NextAuth v4 style)
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabaseServer';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/signin' },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== 'google' || !user.email) return false;

      const sb = supabaseAdmin();

      // Blocked users are denied
      const { data: existing } = await sb
        .from('users')
        .select('id, is_blocked')
        .eq('email', user.email)
        .maybeSingle();
      if (existing?.is_blocked) return false;

      // Upsert user
      await sb
        .from('users')
        .upsert(
          {
            email: user.email,
            display_name: user.name,
            avatar_url: user.image
          },
          { onConflict: 'email' }
        );

      // Promote if on allow-list
      const { data: allow } = await sb
        .from('admin_allowlist')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();
      if (allow) {
        await sb.from('users').update({ is_admin: true }).eq('email', user.email);
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      // carry through user basics
      if (account?.provider === 'google' && profile) {
        token.email = (profile as any).email;
        token.name = (profile as any).name;
        token.picture = (profile as any).picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
