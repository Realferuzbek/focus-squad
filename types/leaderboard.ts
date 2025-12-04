export type LeaderboardScope = "day" | "week" | "month";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  minutes: number;
  title: string;
  emojis: string[];
}

export interface LeaderboardBoardSnapshot {
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  entries: LeaderboardEntry[];
}

export interface LeaderboardExportPayload {
  posted_at: string;
  source: "tracker";
  message_id: number | null | undefined;
  chat_id: number | null | undefined;
  boards: LeaderboardBoardSnapshot[];
}

export interface LeaderboardRow {
  id: string;
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at: string;
  message_id: number | null | undefined;
  chat_id: number | null | undefined;
  entries: LeaderboardEntry[];
  raw_snapshot: LeaderboardBoardSnapshot & {
    posted_at: string;
    source: "tracker";
    message_id: number | null | undefined;
    chat_id: number | null | undefined;
  };
  created_at: string;
  updated_at: string;
}

export interface LeaderboardMetaRow {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}
