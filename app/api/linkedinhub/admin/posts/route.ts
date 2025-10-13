export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

const INSERT_SCHEMA = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  excerpt: z.string().trim().min(1).max(2000).optional(),
  mediaUrl: z.string().trim().url().optional(),
  postUrl: z.string().trim().url(),
  publishedAt: z.string().datetime().optional(),
});

const UPDATE_SCHEMA = INSERT_SCHEMA.extend({
  id: z.string().uuid(),
});

const DELETE_SCHEMA = z.object({
  id: z.string().uuid(),
});

const SELECT_COLUMNS =
  "id,title,excerpt,media_url,post_url,created_at,published_at";

function isMissingTable(errorCode?: string | null) {
  return errorCode === "42P01";
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("linkedin_admin_posts")
    .select(SELECT_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ ok: false, missingTable: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.is_admin) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parseResult = INSERT_SCHEMA.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json(
      { ok: false, error: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payload = parseResult.data;
  const record = {
    title: payload.title ?? null,
    excerpt: payload.excerpt ?? null,
    media_url: payload.mediaUrl ?? null,
    post_url: payload.postUrl,
    published_at: payload.publishedAt ?? null,
  };

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("linkedin_admin_posts")
    .insert(record)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ ok: false, missingTable: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.is_admin) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parseResult = UPDATE_SCHEMA.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json(
      { ok: false, error: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id, ...rest } = parseResult.data;
  const updates: Record<string, string | null | undefined> = {};

  if ("title" in rest) {
    updates.title = rest.title ?? null;
  }
  if ("excerpt" in rest) {
    updates.excerpt = rest.excerpt ?? null;
  }
  if ("mediaUrl" in rest) {
    updates.media_url = rest.mediaUrl ?? null;
  }
  if ("postUrl" in rest) {
    updates.post_url = rest.postUrl ?? undefined;
  }
  if ("publishedAt" in rest) {
    updates.published_at = rest.publishedAt ?? null;
  }

  if ("post_url" in updates && updates.post_url === undefined) {
    delete updates.post_url;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("linkedin_admin_posts")
    .update(updates)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ ok: false, missingTable: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.is_admin) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parseResult = DELETE_SCHEMA.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json(
      { ok: false, error: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("linkedin_admin_posts")
    .delete()
    .eq("id", parseResult.data.id);

  if (error) {
    if (isMissingTable(error.code)) {
      return NextResponse.json({ ok: false, missingTable: true }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
