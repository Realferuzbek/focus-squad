import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}
