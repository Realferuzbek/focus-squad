// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Force account chooser when switching
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Preserve email and name reliably in the JWT
      if (profile && "email" in profile && typeof profile.email === "string") {
        token.email = profile.email;
      }
      if (profile && "name" in profile && typeof profile.name === "string") {
        token.name = profile.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.email) session.user!.email = token.email as string;
      if (token?.name) session.user!.name = token.name as string;
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions);
