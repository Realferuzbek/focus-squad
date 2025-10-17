import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LiveAdminError,
  appendAudit,
  listMembers,
  removeMember,
  requireAdmin,
  restoreMember,
} from "@/lib/live/admin";

function handleError(error: unknown) {
  if (error instanceof LiveAdminError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[live_admin_members]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new LiveAdminError("limit must be a positive integer", 400);
  }
  return parsed;
}

export async function GET(req: NextRequest) {
  const session = await auth();

  let context;
  try {
    context = await requireAdmin(session);
  } catch (error) {
    return handleError(error);
  }

  const searchParams = req.nextUrl.searchParams;
  let limit: number | undefined;

  try {
    limit = parseLimit(searchParams.get("limit"));
  } catch (error) {
    if (error instanceof LiveAdminError) {
      return handleError(error);
    }
    throw error;
  }

  const q = searchParams.get("q");
  const cursor = searchParams.get("cursor");

  try {
    const result = await listMembers(context, { q, cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  let context;
  try {
    context = await requireAdmin(session);
  } catch (error) {
    return handleError(error);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const removeId = body?.remove;
  const restoreId = body?.restore;

  if ((removeId && restoreId) || (!removeId && !restoreId)) {
    return NextResponse.json(
      { error: "Provide either remove or restore" },
      { status: 400 },
    );
  }

  if (removeId) {
    if (typeof removeId !== "string") {
      return NextResponse.json({ error: "remove must be a string" }, { status: 400 });
    }

    try {
      await removeMember(context, removeId);
      await appendAudit(context, {
        action: "members.remove",
        targetUser: removeId,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleError(error);
    }
  }

  if (typeof restoreId !== "string") {
    return NextResponse.json({ error: "restore must be a string" }, { status: 400 });
  }

  try {
    await restoreMember(context, restoreId);
    await appendAudit(context, {
      action: "members.restore",
      targetUser: restoreId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
