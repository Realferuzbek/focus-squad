export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

type RoomRecord = {
  id: string;
  created_at: string;
  created_by: string;
  title: string;
  description: string | null;
  visibility: "public" | "unlisted";
  status: "active" | "ended";
  max_size: number;
  hms_room_id: string;
  hms_room_name: string;
};

function canViewRoom(room: RoomRecord, userId: string, isAdmin: boolean) {
  if (room.visibility === "public") return true;
  if (room.visibility === "unlisted") return true;
  if (room.created_by === userId) return true;
  if (isAdmin) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await auth();
  const user = session?.user as { id?: string; is_admin?: boolean } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("live_voice_rooms")
    .select(
      "id, created_at, created_by, title, description, visibility, status, max_size, hms_room_id, hms_room_name",
    )
    .eq("id", params.roomId)
    .maybeSingle();

  if (error) {
    console.error("[voice rooms] get failed", error);
    return NextResponse.json(
      { error: "Failed to load room" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const room = data as RoomRecord;
  const isAdmin = user.is_admin === true;
  if (!canViewRoom(room, user.id, isAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: room.id,
    created_at: room.created_at,
    created_by: room.created_by,
    title: room.title,
    description: room.description,
    visibility: room.visibility,
    status: room.status,
    max_size: room.max_size,
  });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { roomId: string } },
) {
  const session = await auth();
  const user = session?.user as { id?: string; is_admin?: boolean } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: room, error } = await sb
    .from("live_voice_rooms")
    .select("id, created_by")
    .eq("id", params.roomId)
    .maybeSingle();

  if (error) {
    console.error("[voice rooms] load room failed", error);
    return NextResponse.json(
      { error: "Failed to load room" },
      { status: 500 },
    );
  }

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isAdmin = user.is_admin === true;
  if (!isAdmin && room.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await sb
    .from("live_voice_rooms")
    .update({ status: "ended" })
    .eq("id", params.roomId);

  if (updateError) {
    console.error("[voice rooms] end room failed", updateError);
    return NextResponse.json(
      { error: "Failed to end room" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
