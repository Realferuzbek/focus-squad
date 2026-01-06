export type SortableEntry = {
  username: string;
  minutes: number;
};

export const MAX_LEADERBOARD_ENTRIES = 5;

export function normalizeUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export function getUsernameSortKey(value: string) {
  return normalizeUsername(value).normalize("NFKD").toLowerCase();
}

export function sortByMinutesThenUsername<T extends SortableEntry>(
  entries: T[],
) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const minutesA = Number.isFinite(a.entry.minutes) ? a.entry.minutes : 0;
      const minutesB = Number.isFinite(b.entry.minutes) ? b.entry.minutes : 0;
      if (minutesA !== minutesB) return minutesB - minutesA;

      const nameA = getUsernameSortKey(a.entry.username);
      const nameB = getUsernameSortKey(b.entry.username);
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

export function withCanonicalRanks<T extends SortableEntry & { rank: number }>(
  entries: T[],
) {
  const sorted = sortByMinutesThenUsername(entries);
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function withDisplayRanks<T extends SortableEntry>(entries: T[]) {
  const sorted = sortByMinutesThenUsername(entries);
  return sorted.map((entry, index) => ({ ...entry, displayRank: index + 1 }));
}
