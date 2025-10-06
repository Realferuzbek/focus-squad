// lib/auth.ts
import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";

// your existing export:
// export const authOptions: NextAuthOptions = { ... }

export function auth() {
  return getServerSession(authOptions);
}
