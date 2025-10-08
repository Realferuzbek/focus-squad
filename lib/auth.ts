// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "./supabaseServer";

export const ADMIN_EMAILS = new Set<string>([
  "feruzbekqurbonov03@gmail.com",
]);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Force Google account chooser when we call with prompt=select_account
      authorization: { params: { prompt: "consent", access_type: "offline", response_type: "code" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      // Auto-provision the user in Postgres if not present
      try {
        const sb = supabaseAdmin();
        const { data: existing } = await sb
          .from("users")
          .select("id,email")
          .eq("email", user.email)
          .maybeSingle();

        if (!existing) {
          await sb.from("users").insert({
            email: user.email,
            name: user.name,
            avatar_url: user.image ?? null,
            is_admin: ADMIN_EMAILS.has((user.email || "").toLowerCase()),
          });
        } else if (ADMIN_EMAILS.has((existing.email || "").toLowerCase())) {
          await sb.from("users").update({ is_admin: true }).eq("email", existing.email);
        }
      } catch (_) {}
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // Enrich token with DB flags on every request
      if (user?.email) token.email = user.email;
      if (!token.email && profile && (profile as any).email) token.email = (profile as any).email;

      const email = (token.email || "").toString().toLowerCase();
      if (!email) return token;

      try {
        const sb = supabaseAdmin();
        const { data } = await sb
          .from("users")
          .select("id,is_admin,telegram_user_id")
          .eq("email", email)
          .maybeSingle();

        if (data) {
          (token as any).uid = data.id;
          (token as any).is_admin = !!data.is_admin;
          (token as any).telegram_linked = !!data.telegram_user_id;
        } else {
          (token as any).is_admin = ADMIN_EMAILS.has(email);
          (token as any).telegram_linked = false;
        }
      } catch {
        // fail open
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token as any).uid;
      (session.user as any).is_admin = !!(token as any).is_admin;
      (session.user as any).telegram_linked = !!(token as any).telegram_linked;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
