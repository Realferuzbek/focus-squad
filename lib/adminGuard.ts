import type { Session } from "next-auth";
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { auth } from "./auth";

export const INTERNAL_ADMIN_SIGNATURE_HEADER = "x-internal-admin-signature";

type UnauthorizedMessage = "unauthorized" | "forbidden";

export interface AdminUser {
  email: string;
  is_admin: true;
  [key: string]: unknown;
}

export interface AdminGuardFailure {
  ok: false;
  status: 401 | 403;
  message: UnauthorizedMessage;
}

export interface AdminGuardSessionSuccess {
  ok: true;
  session: Session;
  user: AdminUser;
}

export type AdminGuardSessionResult = AdminGuardSessionSuccess | AdminGuardFailure;

export interface AdminGuardOrInternalSuccess {
  ok: true;
  via: "internal";
}

export type AdminGuardOrInternalResult =
  | AdminGuardSessionSuccess
  | AdminGuardOrInternalSuccess
  | AdminGuardFailure;

interface ResolveSessionOptions {
  session?: Session | null;
}

export interface AdminGuardSessionOptions extends ResolveSessionOptions {}

export interface AdminGuardOrInternalOptions extends ResolveSessionOptions {
  request: NextRequest | Request;
}

function buildFailure(status: 401 | 403, message: UnauthorizedMessage): AdminGuardFailure {
  return { ok: false, status, message };
}

function normalizeAdminUser(session: Session | null | undefined): AdminGuardSessionResult {
  const user = session?.user as Record<string, unknown> | undefined;
  const emailRaw = typeof user?.email === "string" ? user.email : null;
  if (!user || !emailRaw) {
    return buildFailure(401, "unauthorized");
  }

  const isAdmin = user.is_admin === true || (user as { is_admin?: unknown }).is_admin === true;
  if (!isAdmin) {
    return buildFailure(403, "forbidden");
  }

  const email = emailRaw.toLowerCase();
  return {
    ok: true,
    session: session as Session,
    user: { ...user, email, is_admin: true } as AdminUser,
  };
}

async function resolveSession(options?: ResolveSessionOptions): Promise<Session | null> {
  if (options && "session" in options) {
    return options.session ?? null;
  }
  return (await auth()) ?? null;
}

function verifyInternalSignature(request: Request | NextRequest): boolean {
  const provided = request.headers.get(INTERNAL_ADMIN_SIGNATURE_HEADER);
  if (!provided) return false;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  try {
    const expected = createHash("sha256").update(secret).digest();
    const providedBytes = Buffer.from(provided, "hex");
    if (providedBytes.length !== expected.length) return false;
    return timingSafeEqual(providedBytes, expected);
  } catch {
    return false;
  }
}

export async function requireAdminSession(
  options?: AdminGuardSessionOptions,
): Promise<AdminGuardSessionResult> {
  const session = await resolveSession(options);
  return normalizeAdminUser(session);
}

export async function requireAdminOrInternal(
  options: AdminGuardOrInternalOptions,
): Promise<AdminGuardOrInternalResult> {
  if (verifyInternalSignature(options.request)) {
    return { ok: true, via: "internal" };
  }
  return requireAdminSession(options);
}

