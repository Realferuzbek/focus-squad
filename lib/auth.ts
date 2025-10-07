// lib/auth.ts
import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabaseServer';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Always send users to our pretty sign-in screen
  pages: { signIn: '/signin' },
  session: { strategy: 'jwt' },

  callbacks: {
    // Enforce Google-only; optionally block users flagged in DB
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false;

      try {
        const sb = supabaseAdmin();
        const { data: u } = await sb
          .from('users')
          .select('is_blocked')
          .eq('email', user.email)
          .maybeSingle();

        if (u?.is_blocked) return false;
      } catch {
        // don't block if check fails
      }
      return true;
    },

    // Keep email on session consistently
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },

    async jwt({ token }) {
      return token;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}
