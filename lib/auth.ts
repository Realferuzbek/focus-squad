// lib/auth.ts
import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "./supabaseServer";
import {
  generateSessionId,
  needsRollingRotation,
  resolveSessionRollingInterval,
} from "./session-security";
import {
  isBlockedFlag,
  resolveBlockedStatus,
  shouldDenySignIn,
} from "./blocked-user-guard";

export const ADMIN_EMAILS = new Set<string>(["feruzbekqurbonov03@gmail.com"]);

const SESSION_ROLLING_INTERVAL_MS = resolveSessionRollingInterval(
  process.env.NEXTAUTH_SESSION_ROLLING_INTERVAL_MINUTES,
);

const SESSION_COOKIE_SECURE =
  process.env.NODE_ENV === "production" ||
  (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

function mintSessionState(now: number) {
  try {
    return {
      sid: generateSessionId(),
      sidIssuedAt: now,
    } as const;
  } catch {
    return { sid: null, sidIssuedAt: null } as const;
  }
}

export const authOptions: NextAuthOptions = {
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
  // Cookie options: do not set Domain to avoid cross-subdomain exposure; Secure only in production
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_COOKIE_NAME || 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: SESSION_COOKIE_SECURE,
      },
    },
  },
  callbacks: {
    async signIn({ user }) {
      try {
        const sb = supabaseAdmin();
        const email = (user.email || "").toLowerCase();
        if (!email) return false;

        const { data: existing } = await sb
          .from("users")
          .select("id,email,is_admin,is_blocked")
          .eq("email", email)
          .maybeSingle();

        if (shouldDenySignIn(existing)) {
          return false;
        } else if (!existing) {
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
      // On sign-in we want a fresh session identifier (sid) to mitigate fixation.
      const minted = mintSessionState(Date.now());
      if (minted.sid && minted.sidIssuedAt) {
        (user as any).sid = minted.sid;
        (user as any).sidIssuedAt = minted.sidIssuedAt;
      }
      return true;
    },

    async jwt({ token, user }) {
      const now = Date.now();
      const email = (token.email || "").toString().toLowerCase();

      const prevIsAdmin = !!(token as any).is_admin;
      const prevIsDmAdmin = !!(token as any).is_dm_admin;

      let sid = typeof (token as any).sid === "string" ? ((token as any).sid as string) : null;
      let sidIssuedAt =
        typeof (token as any).sidIssuedAt === "number" && Number.isFinite((token as any).sidIssuedAt)
          ? ((token as any).sidIssuedAt as number)
          : null;

      if (user && (user as any).sid) {
        sid = (user as any).sid ?? sid;
        sidIssuedAt = (user as any).sidIssuedAt ?? now;
      } else if (!sid || !sidIssuedAt) {
        const minted = mintSessionState(now);
        if (minted.sid && minted.sidIssuedAt) {
          sid = minted.sid;
          sidIssuedAt = minted.sidIssuedAt;
        }
      }

      if (!email) {
        if (sid) (token as any).sid = sid;
        if (sidIssuedAt) (token as any).sidIssuedAt = sidIssuedAt;
        return token;
      }

      let nextUid = (token as any).uid;
      let nextIsAdmin = prevIsAdmin;
      let nextIsDmAdmin = prevIsDmAdmin;
      let nextTelegramLinked = !!(token as any).telegram_linked;
      let nextAvatarUrl = (token as any).avatar_url ?? null;
      let nextDisplayName = (token as any).display_name ?? (token as any).name ?? null;
      let nextIsBlocked = isBlockedFlag((token as any).is_blocked);

      try {
        const sb = supabaseAdmin();
        const { data } = await sb
          .from("users")
          .select("id,is_admin,is_dm_admin,telegram_user_id,avatar_url,name,display_name,is_blocked")
          .eq("email", email)
          .maybeSingle();

        if (data) {
          nextUid = data.id;
          nextIsAdmin = !!data.is_admin;
          nextIsDmAdmin = !!data.is_dm_admin;
          nextTelegramLinked = !!data.telegram_user_id;
          nextAvatarUrl = data.avatar_url ?? null;
          nextDisplayName = data.display_name ?? data.name ?? null;
          nextIsBlocked = resolveBlockedStatus(nextIsBlocked, data);
        } else {
          nextIsAdmin = ADMIN_EMAILS.has(email);
          nextIsDmAdmin = false;
          nextTelegramLinked = false;
          nextIsBlocked = false;
        }
      } catch {}

      const privilegeElevated =
        (!prevIsAdmin && nextIsAdmin) || (!prevIsDmAdmin && nextIsDmAdmin);

      if (privilegeElevated) {
        const minted = mintSessionState(now);
        if (minted.sid && minted.sidIssuedAt) {
          sid = minted.sid;
          sidIssuedAt = minted.sidIssuedAt;
        }
      }

      if (needsRollingRotation(sidIssuedAt, now, SESSION_ROLLING_INTERVAL_MS)) {
        const minted = mintSessionState(now);
        if (minted.sid && minted.sidIssuedAt) {
          sid = minted.sid;
          sidIssuedAt = minted.sidIssuedAt;
        }
      }

      (token as any).uid = nextUid;
      (token as any).is_admin = nextIsAdmin;
      (token as any).is_dm_admin = nextIsDmAdmin;
      (token as any).telegram_linked = nextTelegramLinked;
      (token as any).avatar_url = nextAvatarUrl;
      (token as any).display_name = nextDisplayName;
      if (sid) (token as any).sid = sid;
      if (sidIssuedAt) (token as any).sidIssuedAt = sidIssuedAt;
      (token as any).is_blocked = nextIsBlocked;
      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = (token as any).uid;
      (session.user as any).is_admin = !!(token as any).is_admin;
      (session.user as any).is_dm_admin = !!(token as any).is_dm_admin;
      (session.user as any).telegram_linked = !!(token as any).telegram_linked;
      (session.user as any).avatar_url = (token as any).avatar_url ?? session.user?.image ?? null;
      (session.user as any).display_name = (token as any).display_name ?? session.user?.name ?? null;
      (session.user as any).is_blocked = isBlockedFlag((token as any).is_blocked);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const auth = () => getServerSession(authOptions);

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
