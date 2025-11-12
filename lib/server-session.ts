import "server-only";

import { cache } from "react";
import type { Session } from "next-auth";
import { auth } from "./auth";

/**
 * EFFECT: Deduplicates server-side session lookups (getServerSession)
 * so layouts and pages in the same request don't hit Supabase twice.
 */
export const getCachedSession = cache(async (): Promise<Session | null> => {
  try {
    return await auth();
  } catch (error) {
    console.error("[session-cache] failed to resolve session", error);
    return null;
  }
});

