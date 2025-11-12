import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LiveAdminError,
  addAdmin,
  appendAudit,
  listAdmins,
  removeAdmin,
  requireAdmin,
  searchAdminCandidates,
} from "@/lib/live/admin";

function handleError(error: unknown) {
  if (error instanceof LiveAdminError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  console.error("[live_admin_admins]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const session = await auth();

  let context;
  try {
    context = await requireAdmin(session);
  } catch (error) {
    return handleError(error);
  }

  const q = req.nextUrl.searchParams.get("q");
  try {
    if (q) {
      const [admins, matches] = await Promise.all([
        listAdmins(context),
        searchAdminCandidates(context, q),
      ]);
      return NextResponse.json({ admins, matches });
    }

    const admins = await listAdmins(context);
    return NextResponse.json({ admins, matches: [] });
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

  const addId = body?.add;
  const removeId = body?.remove;

  if ((addId && removeId) || (!addId && !removeId)) {
    return NextResponse.json(
      { error: "Provide either add or remove" },
      { status: 400 },
    );
  }

  if (addId) {
    if (typeof addId !== "string") {
      return NextResponse.json(
        { error: "add must be a string" },
        { status: 400 },
      );
    }

    try {
      await addAdmin(context, addId);
      await appendAudit(context, {
        action: "settings.admin.add",
        targetUser: addId,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleError(error);
    }
  }

  if (typeof removeId !== "string") {
    return NextResponse.json(
      { error: "remove must be a string" },
      { status: 400 },
    );
  }

  try {
    await removeAdmin(context, removeId);
    await appendAudit(context, {
      action: "settings.admin.remove",
      targetUser: removeId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
