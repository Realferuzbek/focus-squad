import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LiveAdminError,
  appendAudit,
  getAdminState,
  requireAdmin,
  updateState,
  type UpdateStateInput,
} from "@/lib/live/admin";

function handleError(error: unknown) {
  if (error instanceof LiveAdminError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[live_admin_state]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function GET() {
  const session = await auth();

  try {
    const context = await requireAdmin(session);
    const state = await getAdminState(context);
    return NextResponse.json({ state });
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

  const updateInput: UpdateStateInput = {};

  if (Object.prototype.hasOwnProperty.call(body, "groupName")) {
    if (body.groupName !== null && typeof body.groupName !== "string") {
      return NextResponse.json({ error: "groupName must be a string" }, { status: 400 });
    }
    updateInput.groupName = body.groupName;
  }

  if (Object.prototype.hasOwnProperty.call(body, "groupDescription")) {
    if (body.groupDescription !== null && typeof body.groupDescription !== "string") {
      return NextResponse.json(
        { error: "groupDescription must be a string" },
        { status: 400 },
      );
    }
    updateInput.groupDescription = body.groupDescription;
  }

  if (Object.prototype.hasOwnProperty.call(body, "groupAvatarUrl")) {
    if (body.groupAvatarUrl !== null && typeof body.groupAvatarUrl !== "string") {
      return NextResponse.json(
        { error: "groupAvatarUrl must be a string" },
        { status: 400 },
      );
    }
    updateInput.groupAvatarUrl = body.groupAvatarUrl;
  }

  if (Object.prototype.hasOwnProperty.call(body, "wallpaperUrl")) {
    if (body.wallpaperUrl !== null && typeof body.wallpaperUrl !== "string") {
      return NextResponse.json(
        { error: "wallpaperUrl must be a string" },
        { status: 400 },
      );
    }
    updateInput.wallpaperUrl = body.wallpaperUrl;
  }

  const hasUpdates = Object.values(updateInput).some(
    (value) => value !== undefined,
  );

  try {
    const result = await updateState(context, updateInput);

    if (hasUpdates) {
      for (const entry of result.auditEntries) {
        await appendAudit(context, entry);
      }
    }

    return NextResponse.json({ state: result.state });
  } catch (error) {
    return handleError(error);
  }
}
