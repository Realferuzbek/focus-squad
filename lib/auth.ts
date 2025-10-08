// lib/auth.ts
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
      authorization: {
        params: {
          prompt: "consent", // always show chooser when we ask
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/signin" },
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 1) make sure user exists in Supabase and mark admins
    async signIn({ user }) {
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
      } catch {
        // fail open so auth isn’t blocked
      }
      return true;
    },

    // 2) enrich token with flags from DB
    async jwt({ token }) {
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
          (token as any).avatar_url = data.avatar_url ?? null;
        } else {
          (token as any).is_admin = ADMIN_EMAILS.has(email);
          (token as any).telegram_linked = false;
          (token as any).avatar_url = null;
        }
      } catch {
        // ignore
      }
      return token;
    },

    // 3) expose flags on session.user for UI
    async session({ session, token }) {
      (session.user as any).id = (token as any).uid;
      (session.user as any).is_admin = !!(token as any).is_admin;
      (session.user as any).telegram_linked = !!(token as any).telegram_linked;
      (session.user as any).avatar_url = (token as any).avatar_url ?? null;
      return session;
    },
  },
});
