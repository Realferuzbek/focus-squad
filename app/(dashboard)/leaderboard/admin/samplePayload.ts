import { LeaderboardExportPayload } from "@/types/leaderboard";

export function createSampleLeaderboardPayload(): LeaderboardExportPayload {
  const now = new Date().toISOString();
  return {
    posted_at: now,
    source: "tracker",
    message_id: 123456,
    chat_id: 987654321,
    boards: [
      {
        scope: "day",
        period_start: "2024-05-01",
        period_end: "2024-05-01",
        entries: [
          {
            rank: 1,
            username: "alice",
            minutes: 120,
            title: "Daily Leader",
            emojis: ["🔥"],
          },
          {
            rank: 2,
            username: "bob",
            minutes: 95,
            title: "Focused",
            emojis: ["💪"],
          },
        ],
      },
      {
        scope: "week",
        period_start: "2024-04-29",
        period_end: "2024-05-05",
        entries: [
          {
            rank: 1,
            username: "charlie",
            minutes: 540,
            title: "Week Winner",
            emojis: ["🏆"],
          },
          {
            rank: 2,
            username: "alice",
            minutes: 520,
            title: "Consistent",
            emojis: ["✨"],
          },
          {
            rank: 3,
            username: "bob",
            minutes: 480,
            title: "Closer",
            emojis: ["🎯"],
          },
        ],
      },
      {
        scope: "month",
        period_start: "2024-04-01",
        period_end: "2024-04-30",
        entries: [
          {
            rank: 1,
            username: "diana",
            minutes: 2100,
            title: "Monthly MVP",
            emojis: ["🌙"],
          },
          {
            rank: 2,
            username: "charlie",
            minutes: 1980,
            title: "Runner-up",
            emojis: ["🥈"],
          },
          {
            rank: 3,
            username: "alice",
            minutes: 1820,
            title: "Podium",
            emojis: ["🥉"],
          },
        ],
      },
    ],
  };
}
