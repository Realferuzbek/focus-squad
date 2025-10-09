// lib/auth.ts (NextAuth v5, locked to our plan/features)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "./supabaseServer";

export const ADMIN_EMAILS = new Set<string>([
  "feruzbekqurbonov03@gmail.com",
]);

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // keep defaults; no extra params to avoid provider quirks
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    // Provision user & sync admin flag
    async signIn({ user }) {
      try {
        const sb = supabaseAdmin();
        const email = (user.email || "").toLowerCase();
        if (!email) return false;

        const { data: existing } = await sb
          .from("users")
          .select("id,email,is_admin")
          .eq("email", email)
          .maybeSingle();

        if (!existing) {
          await sb.from("users").insert({
            email,
            name: user.name,
            avatar_url: user.image ?? null,
            is_admin: ADMIN_EMAILS.has(email),
          });
        } else if (ADMIN_EMAILS.has(email) && !existing.is_admin) {
          await sb.from("users").update({ is_admin: true }).eq("email", email);
        }
      } catch {
        // fail open; we still allow sign-in
      }
      return true;
    },
    async jwt({ token, user, profile }) {
      // ensure email on token
      if (user?.email) token.email = user.email;
      if (!token.email && profile && (profile as any).email)
        token.email = (profile as any).email;

      const email = (token.email || "").toString().toLowerCase();
      if (!email) return token;

      try {
        const sb = supabaseAdmin();
        const { data } = await sb
          .from("users")
          .select("id,is_admin,telegram_user_id,avatar_url")
          .eq("email", email)
          .maybeSingle();

        if (data) {
          (token as any).uid = data.id;
          (token as any).is_admin = !!data.is_admin;
          (token as any).telegram_linked = !!data.telegram_user_id;
          (token as any).avatar_url = data.avatar_url || null;
        } else {
          (token as any).is_admin = ADMIN_EMAILS.has(email);
          (token as any).telegram_linked = false;
          (token as any).avatar_url = null;
        }
      } catch {
        // ignore & keep token minimal
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token as any).uid ?? null;
      (session.user as any).is_admin = !!(token as any).is_admin;
      (session.user as any).telegram_linked = !!(token as any).telegram_linked;
      (session.user as any).image =
        (token as any).avatar_url || (session.user as any).image || null;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
