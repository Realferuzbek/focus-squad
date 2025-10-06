// lib/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Minimal NextAuth options so the app compiles and runs.
 * Swap/add real OAuth providers later if you want (Google/GitHub/etc).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Email only",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = (credentials?.email ?? "").trim();
        if (!email) return null;
        // Accept any email. Your API routes already enforce admin/allowlist/etc.
        return { id: email, email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = String(token.email);
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
