export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Navbar from "@/components/Navbar";
import LeaderboardClient from "./LeaderboardClient";
import { getCachedSession } from "@/lib/server-session";
import {
  loadLatestLeaderboards,
  type LeaderboardSnapshot,
} from "@/lib/leaderboard/loadLatest";
import {
  getLeaderboardHistoryByScope,
  type LeaderboardHistoryByScope,
} from "@/lib/leaderboard/history";
import type { LeaderboardScope } from "@/types/leaderboard";
import { getLanguageOptions, getTranslations } from "@/lib/i18n";

const EMPTY_SNAPSHOTS: Record<LeaderboardScope, LeaderboardSnapshot | null> = {
  day: null,
  week: null,
  month: null,
};

const EMPTY_HISTORY: LeaderboardHistoryByScope = {
  day: [],
  week: [],
  month: [],
};

export default async function LeaderboardPage() {
  const session = await getCachedSession();
  const viewer = session?.user as any;
  const avatarSrc = viewer?.avatar_url ?? viewer?.image ?? null;

  const { locale, t } = getTranslations();
  const languageOptions = getLanguageOptions(locale);

  let snapshots = EMPTY_SNAPSHOTS;
  let historyByScope = EMPTY_HISTORY;
  let loadError = false;

  try {
    snapshots = await loadLatestLeaderboards();
  } catch (error) {
    console.error("leaderboard: failed to load snapshots", error);
    loadError = true;
  }

  try {
    historyByScope = await getLeaderboardHistoryByScope(90);
  } catch (error) {
    console.error("leaderboard: failed to load leaderboard history", error);
    historyByScope = EMPTY_HISTORY;
  }

  const dataLoadedAt = new Date().toISOString();

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white">
      <Navbar
        isAdmin={!!viewer?.is_admin}
        avatarUrl={avatarSrc}
        viewerName={viewer?.name ?? null}
        viewerEmail={viewer?.email ?? null}
        locale={locale}
        translations={t.nav}
        languageOptions={languageOptions}
      />

      <LeaderboardClient
        snapshots={snapshots}
        historyByScope={historyByScope}
        dataLoadedAt={dataLoadedAt}
        loadError={loadError}
        backLabel={t.common.backToDashboard}
      />
    </div>
  );
}
