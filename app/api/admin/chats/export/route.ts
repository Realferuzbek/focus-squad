export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { exportChatLogs } from "@/lib/ai-chat/logging";

export async function GET(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.message },
      { status: guard.status },
    );
  }

  const { searchParams } = req.nextUrl;
  const format = (searchParams.get("format") || "json").toLowerCase();
  const userId = searchParams.get("userId") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const usedRagParam = searchParams.get("usedRag");
  const usedRag =
    usedRagParam === "true"
      ? true
      : usedRagParam === "false"
        ? false
        : undefined;

  const rows = await exportChatLogs({
    userId,
    from,
    to,
    usedRag,
  });

  if (format === "csv") {
    const csv = buildCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ai-chats.csv"`,
      },
    });
  }

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "no-store" },
  });
}

function buildCsv(rows: any[]) {
  const header = [
    "id",
    "user_id",
    "session_id",
    "language",
    "used_rag",
    "rating",
    "created_at",
    "question",
    "answer",
  ];
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };
  const lines = rows.map((row) =>
    [
      row.id,
      row.user_id,
      row.session_id,
      row.language,
      row.used_rag,
      row.rating ?? "",
      row.created_at,
      row.input,
      row.reply,
    ].map(escape),
  );
  return [header.join(","), ...lines.map((line) => line.join(","))].join("\n");
}
