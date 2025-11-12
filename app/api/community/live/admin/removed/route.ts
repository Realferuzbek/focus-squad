import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LiveAdminError, listRemoved, requireAdmin } from "@/lib/live/admin";

function handleError(error: unknown) {
  if (error instanceof LiveAdminError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  console.error("[live_admin_removed]", error);
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
    const result = await listRemoved(context, { q, cursor, limit });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
