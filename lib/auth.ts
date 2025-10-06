// lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const {
  auth,                      // server-side: const session = await auth()
  handlers: { GET, POST },   // API route handlers for /api/auth/[...nextauth]
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
});
