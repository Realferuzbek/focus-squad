import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// NextAuth v5 style
export const {
  auth,                                 // use in Server Components: const session = await auth()
  handlers: { GET, POST },              // API route handlers
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
