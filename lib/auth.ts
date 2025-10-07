// lib/auth.ts
import { getServerSession, NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "./supabaseServer";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Ensure a row exists in "users" for this email
      const email = user.email ?? "";
      if (!email) return false;

      const sb = supabaseAdmin();
      await sb
        .from("users")
        .upsert(
          {
            email,
            display_name: user.name ?? email.split("@")[0],
            avatar_url: user.image ?? null,
          },
          { onConflict: "email" },
        );

      return true;
    },
    async session({ session, token }) {
      // surface email consistently
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // keep token email up to date
      if (profile?.email) token.email = profile.email;
      return token;
    },
  },
  // IMPORTANT in prod: set NEXTAUTH_URL and NEXTAUTH_SECRET in Vercel
};

export async function auth() {
  return getServerSession(authOptions);
}
