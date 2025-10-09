// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ADMIN_EMAILS } from "@/lib/auth"; // reuse the same allowlist
import { supabaseAdmin } from "@/lib/supabaseServer";

// build the same config used in lib/auth
const authInstance = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  ],
  pages: { signIn: "/signin" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
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
            display_name: user.name,
            avatar_url: user.image ?? null,
            is_admin: ADMIN_EMAILS.has(email),
          });
        } else if (ADMIN_EMAILS.has(email) && !existing.is_admin) {
          await sb.from("users").update({ is_admin: true }).eq("email", email);
        }
      } catch {}
      return true;
    },
    async jwt({ token }) { return token; },
    async session({ session }) { return session; },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export const { GET, POST } = authInstance;
