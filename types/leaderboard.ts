export type LeaderboardScope = 'day' | 'week' | 'month';

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
  source: 'tracker';
  message_id: number;
  chat_id: number;
  boards: LeaderboardBoardSnapshot[];
}

export interface LeaderboardRow {
  id: string;
  scope: LeaderboardScope;
  period_start: string;
  period_end: string;
  posted_at: string;
  message_id: number;
  chat_id: number;
  entries: LeaderboardEntry[];
  raw_snapshot: LeaderboardBoardSnapshot & {
    posted_at: string;
    source: 'tracker';
    message_id: number;
    chat_id: number;
  };
  created_at: string;
  updated_at: string;
}

export interface LeaderboardMetaRow {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}
