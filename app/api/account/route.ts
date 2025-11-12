export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function DELETE() {
  try {
    const session = await auth();
    const user = session?.user as Record<string, unknown> | null;
    const userId = typeof user?.id === "string" ? user.id : null;
    const email =
      typeof user?.email === "string" ? user.email.toLowerCase() : null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = supabaseAdmin();

    if (email) {
      const { error: linkTokenError } = await sb
        .from("link_tokens")
        .delete()
        .eq("email", email);
      if (linkTokenError) {
        console.warn("[api/account] failed to delete link tokens", {
          email,
          error: linkTokenError.message,
        });
      }
    }

    const { error: deleteError } = await sb
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("[api/account] failed to delete user", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/account] unexpected failure", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 },
    );
  }
}
