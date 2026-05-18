"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBetaPlayer } from "@/components/auth/AuthGate";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { formatGold, formatInt } from "@/lib/format";
import { useLocale } from "@/lib/i18n/useLocale";
import { getWeaponDisplayNameById } from "@/lib/i18n/weaponText";
import { getGuestProfile } from "@/lib/player/guest";
import { getGameMode, type WeeklyRankingAdapterResult, type WorldRecordsAdapterResult } from "@/lib/ranking/rankingAdapter";
import { mockRankingAdapter } from "@/lib/ranking/mockRankingAdapter";
import { serverRankingAdapter } from "@/lib/ranking/serverRankingAdapter";
import { formatSeasonCountdown, getCurrentSeasonInfo } from "@/lib/season";
import { useIsCrazyGamesMode } from "@/lib/distributionContext";
import type { RankingCategory, RankingRowDisplay } from "@/types/game";
import { useGameStore } from "@/store/gameStore";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

type SubTab = "weekly" | "world" | "me";

const MANUAL_RANKING_REFRESH_COOLDOWN_MS = 30_000;

const CATEGORY_META: {
  id: RankingCategory;
  labelKey: string;
  scoreLabelKey: string;
}[] = [
  {
    id: "weeklyStrongestWeapon",
    labelKey: "ranking.category.strongestWeapon",
    scoreLabelKey: "ranking.score.rankingValue",
  },
  {
    id: "weeklyEnhancementKing",
    labelKey: "ranking.category.enhancementKing",
    scoreLabelKey: "ranking.score.enhanceSuccess",
  },
  {
    id: "weeklyTranscendKing",
    labelKey: "ranking.category.transcendKing",
    scoreLabelKey: "ranking.score.transcendSuccess",
  },
  {
    id: "weeklySalesKing",
    labelKey: "ranking.category.salesKing",
    scoreLabelKey: "ranking.score.seasonSales",
  },
];

function formatScore(cat: RankingCategory, row: RankingRowDisplay): string {
  if (cat === "weeklyStrongestWeapon" || cat === "weeklySalesKing") {
    return formatGold(row.score);
  }
  return formatInt(Math.round(row.score));
}

function formatRecentRefresh(
  timestamp: number | null,
  now: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!timestamp) return t("ranking.neverUpdated");
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 5) return t("ranking.justNow");
  if (elapsedSeconds < 60) return t("ranking.secondsAgo", { seconds: elapsedSeconds });
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return t("ranking.minutesAgo", { minutes: elapsedMinutes });
  return t("ranking.hoursAgo", { hours: Math.floor(elapsedMinutes / 60) });
}

const EMPTY_HOLDER_LABEL = "No record yet";
const CRAZYGAMES_RECORDS_KEY = "blacksmith_cg_records";

type CrazyGamesLocalRecords = {
  bestWeaponName: string;
  highestEnhancement: number;
  bestSaleValue: number;
  bestTranscendLevel: number;
  bestRankingValue: number;
  updatedAt: number;
};

const CHALLENGE_TARGETS = [
  { title: "Bronze Smith", value: 10_000 },
  { title: "Iron Smith", value: 50_000 },
  { title: "Steel Smith", value: 100_000 },
  { title: "Royal Smith", value: 500_000 },
  { title: "Legendary Smith", value: 1_000_000 },
  { title: "Mythic Smith", value: 5_000_000 },
] as const;

function isEmptyHolder(name: string): boolean {
  return name.trim() === EMPTY_HOLDER_LABEL;
}

function hasWorldWeaponRecord(record: {
  weaponName: string;
  rankingValue: number;
  holderName: string;
}): boolean {
  return (
    record.rankingValue > 0 &&
    record.weaponName !== "-" &&
    !isEmptyHolder(record.holderName)
  );
}

function hasWorldSaleRecord(record: {
  gold: number;
  weaponName: string;
  holderName: string;
}): boolean {
  return (
    record.gold > 0 &&
    record.weaponName !== "-" &&
    !isEmptyHolder(record.holderName)
  );
}

function hasWorldCountRecord(record: { value: number; holderName: string }): boolean {
  return record.value > 0 && !isEmptyHolder(record.holderName);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/35 to-amber-900/45 text-lg ring-2 ring-amber-400/55 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
        title="Rank 1"
      >
        👑
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-300/35 to-slate-700/50 font-mono text-sm font-bold text-slate-100 ring-2 ring-slate-400/45 shadow-[0_0_16px_rgba(148,163,184,0.28)]">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-900/40 to-orange-950/55 font-mono text-sm font-bold text-amber-100 ring-2 ring-amber-700/45 shadow-[0_0_14px_rgba(180,83,9,0.28)]">
        3
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 font-mono text-sm text-zinc-400 ring-1 ring-zinc-700">
      {rank}
    </span>
  );
}

export function RankingScreen() {
  const isCrazyGamesMode = useIsCrazyGamesMode();

  if (isCrazyGamesMode) {
    return <CrazyGamesRankingScreen />;
  }

  return <StandardRankingScreen />;
}

function writeCrazyGamesRecords(records: CrazyGamesLocalRecords | null) {
  if (typeof window === "undefined") return;
  try {
    if (!records) {
      window.localStorage.removeItem(CRAZYGAMES_RECORDS_KEY);
      return;
    }
    window.localStorage.setItem(
      CRAZYGAMES_RECORDS_KEY,
      JSON.stringify({ ...records, updatedAt: records.updatedAt || Date.now() }),
    );
  } catch {
    // Embedded game surfaces can deny storage access; the UI still works from store state.
  }
}

function CrazyGamesRankingScreen() {
  useRenderDiagnostics("CrazyGamesRankingScreen");
  const records = useGameStore((s) => s.records);
  const bestWeaponSnapshot = useGameStore((s) => s.bestWeaponSnapshot);

  const localRecords = useMemo<CrazyGamesLocalRecords | null>(() => {
    const hasPlayedForRecord =
      records.totalEnhanceAttempts > 0 ||
      records.bestSaleGold > 0 ||
      records.soldWeaponCount > 0 ||
      records.transcendAttemptCount > 0 ||
      records.maxEnhanceLevel > 0 ||
      records.maxTranscendLevel > 0;

    if (!hasPlayedForRecord) {
      return null;
    }

    return {
      bestWeaponName: bestWeaponSnapshot
        ? getWeaponDisplayNameById(
            "en",
            bestWeaponSnapshot.weaponId,
            bestWeaponSnapshot.weaponName,
          )
        : "Unknown Weapon",
      highestEnhancement: Math.max(
        records.maxEnhanceLevel,
        bestWeaponSnapshot?.enhanceLevel ?? 0,
      ),
      bestSaleValue: records.bestSaleGold,
      bestTranscendLevel: Math.max(
        records.maxTranscendLevel,
        bestWeaponSnapshot?.transcendLevel ?? 0,
      ),
      bestRankingValue: Math.max(
        records.personalBestRankingValue,
        bestWeaponSnapshot?.rankingValue ?? 0,
        records.weeklyBestValue,
      ),
      updatedAt: 0,
    };
  }, [bestWeaponSnapshot, records]);

  useEffect(() => {
    writeCrazyGamesRecords(localRecords);
  }, [localRecords]);

  const reachedValue = localRecords?.bestRankingValue ?? 0;
  const hasRecord = Boolean(localRecords);

  return (
    <div className="relative mx-auto w-full flex-1 space-y-4 px-3 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+24px)] pt-4">
      <ScreenBackground screen="ranking" />
      <header className="relative z-10 space-y-1.5">
        <h2 className="text-2xl font-black tracking-wide text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          Ranking
        </h2>
        <p className="text-sm font-medium text-zinc-300/90">
          Track your local records and chase clear challenge targets.
        </p>
      </header>

      <FantasyPanel title="My Records" className="relative z-10 space-y-3 border-amber-600/35 bg-[rgba(8,6,4,0.78)]">
        {hasRecord && localRecords ? (
          <>
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/12 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/78">
                Best Weapon
              </div>
              <div className="mt-1 truncate text-lg font-black text-amber-50">
                {localRecords.bestWeaponName}
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <StatRow
                label="Highest Enhancement"
                value={`+${localRecords.highestEnhancement}`}
                mono
              />
              <StatRow
                label="Best Sale Value"
                value={formatGold(localRecords.bestSaleValue)}
                mono
              />
              <StatRow
                label="Best Transcend Level"
                value={`Lv.${localRecords.bestTranscendLevel}`}
                mono
              />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/48 p-4 text-center">
            <div className="text-sm font-bold text-zinc-100">No record yet.</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Forge your first weapon to set a record.
            </p>
          </div>
        )}
      </FantasyPanel>

      <FantasyPanel title="Challenge Board" className="relative z-10 space-y-3 border-amber-700/25 bg-[rgba(8,6,4,0.74)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-2 border-b border-zinc-800/70 pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
          <span>Challenge Target</span>
          <span className="text-right">Target Value</span>
          <span className="text-right">Reached</span>
        </div>
        <ol className="space-y-2">
          {CHALLENGE_TARGETS.map((target, index) => {
            const reached = reachedValue >= target.value;
            return (
              <li
                key={target.title}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 ${
                  reached
                    ? "border-emerald-500/28 bg-emerald-950/16"
                    : "border-zinc-800/75 bg-zinc-950/50"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 font-mono text-xs font-black text-zinc-300 ring-1 ring-zinc-700/70">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-zinc-100">
                    {target.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    Target Value {formatGold(target.value)}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                    reached
                      ? "bg-emerald-500/16 text-emerald-200 ring-1 ring-emerald-400/24"
                      : "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-700/70"
                  }`}
                >
                  {reached ? "Reached" : "Locked"}
                </span>
              </li>
            );
          })}
        </ol>
      </FantasyPanel>

      <FantasyPanel title="Global Ranking" className="relative z-10 space-y-3 border-sky-500/25 bg-[rgba(6,10,16,0.72)]">
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/16 p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/75">
            Coming Soon
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-sky-50">
            Sign in with CrazyGames to compete globally after leaderboard integration.
          </p>
        </div>
      </FantasyPanel>
    </div>
  );
}

function StandardRankingScreen() {
  useRenderDiagnostics("RankingScreen");
  const [sub, setSub] = useState<SubTab>("weekly");
  const { locale, t } = useLocale();
  const [weeklyCat, setWeeklyCat] = useState<RankingCategory>(
    "weeklyStrongestWeapon",
  );
  const [now, setNow] = useState(() => Date.now());
  const [weeklyResult, setWeeklyResult] =
    useState<WeeklyRankingAdapterResult | null>(null);
  const [worldResult, setWorldResult] =
    useState<WorldRecordsAdapterResult | null>(null);
  const [lastRankingLoadedAt, setLastRankingLoadedAt] = useState<number | null>(null);
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const records = useGameStore((s) => s.records);
  const bestWeaponSnapshot = useGameStore((s) => s.bestWeaponSnapshot);
  const weeklySeasonStats = useGameStore((s) => s.weeklySeasonStats);
  const forgeLevel = useGameStore((s) => s.forgeLevel);
  const { snapshot: betaPlayerSnapshot } = useBetaPlayer();
  const guestProfile = getGuestProfile();

  const season = useMemo(() => getCurrentSeasonInfo(now), [now]);
  const gameMode = getGameMode();
  const adapter = gameMode === "beta" ? serverRankingAdapter : mockRankingAdapter;
  const playerId =
    guestProfile
      ? guestProfile.guestId
      : gameMode === "beta" && betaPlayerSnapshot
      ? betaPlayerSnapshot.userId
      : "local-player";
  const adapterContext = useMemo(
    () => ({
      playerId,
      records,
      bestWeaponSnapshot,
      weeklySeasonStats,
    }),
    [bestWeaponSnapshot, playerId, records, weeklySeasonStats],
  );

  const cooldownRemainingMs = lastManualRefreshAt
    ? Math.max(
        0,
        MANUAL_RANKING_REFRESH_COOLDOWN_MS - (now - lastManualRefreshAt),
      )
    : 0;
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const canManualRefresh = cooldownRemainingMs <= 0 && !manualRefreshing;
  const refreshButtonLabel = manualRefreshing
    ? t("ranking.refreshing")
    : cooldownRemainingMs > 0
      ? t("ranking.refreshCooldown", { seconds: cooldownRemainingSeconds })
      : t("ranking.refresh");

  const loadRanking = useCallback(
    async (options?: { force?: boolean }) => {
      const [weekly, world] = await Promise.all([
        adapter.getWeeklyRanking(
          weeklyCat,
          season.seasonId,
          adapterContext,
          options,
        ),
        adapter.getWorldRecords(adapterContext, options),
      ]);
      setWeeklyResult(weekly);
      setWorldResult(world);
      setLastRankingLoadedAt(Date.now());
      if (weekly.error || world.error) {
        throw new Error(
          weekly.error || world.error || t("ranking.refreshError"),
        );
      }
    },
    [adapter, adapterContext, season.seasonId, t, weeklyCat],
  );

  const manualRefreshRanking = async () => {
    if (manualRefreshing) return;
    if (cooldownRemainingMs > 0) {
      setRefreshMessage(
        t("ranking.refreshBlocked", { seconds: cooldownRemainingSeconds }),
      );
      return;
    }

    setManualRefreshing(true);
    setRefreshMessage(null);
    try {
      await loadRanking({ force: true });
      setLastManualRefreshAt(Date.now());
      setRefreshMessage(t("ranking.refreshSuccess"));
    } catch {
      setRefreshMessage(t("ranking.refreshError"));
    } finally {
      setManualRefreshing(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void adapter
      .getWeeklyRanking(weeklyCat, season.seasonId, adapterContext)
      .then((result) => {
        if (alive) {
          setWeeklyResult(result);
          setLastRankingLoadedAt(Date.now());
        }
      });
    return () => {
      alive = false;
    };
  }, [adapter, adapterContext, season.seasonId, weeklyCat]);

  useEffect(() => {
    let alive = true;
    void adapter.getWorldRecords(adapterContext).then((result) => {
      if (alive) {
        setWorldResult(result);
        setLastRankingLoadedAt(Date.now());
      }
    });
    return () => {
      alive = false;
    };
  }, [adapter, adapterContext]);

  const mergedWeekly = weeklyResult?.rows ?? [];
  const myWeeklyRank = weeklyResult?.playerRank ?? null;

  const catMeta = CATEGORY_META.find((c) => c.id === weeklyCat)!;
  const catLabel = t(catMeta.labelKey);
  const catScoreLabel = t(catMeta.scoreLabelKey);
  const recordsView = records;
  const bestWeaponSnapshotView = bestWeaponSnapshot;
  const worldRecords = worldResult?.records;

  const enhanceRate =
    recordsView.totalEnhanceAttempts > 0
      ? (
          (recordsView.totalEnhanceSuccesses / recordsView.totalEnhanceAttempts) *
          100
        ).toFixed(1)
      : "—";

  const achievedLabel =
    bestWeaponSnapshotView && bestWeaponSnapshotView.achievedAt > 0
      ? new Date(bestWeaponSnapshotView.achievedAt).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div className="relative mx-auto w-full flex-1 space-y-3.5 px-3 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+24px)] pt-4">
      <ScreenBackground screen="ranking" />
      <header className="relative z-10 space-y-1.5">
        <h2 className="text-2xl font-black tracking-wide text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          {t("ranking.title")}
        </h2>
        <p className="text-sm font-medium text-zinc-300/90">
          {t("ranking.subtitle")}
        </p>
      </header>

      <div className="relative z-10 rounded-lg border border-zinc-800/65 bg-[rgba(8,6,4,0.46)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(251,191,36,0.04)] ring-1 ring-black/20 backdrop-blur-[1px]">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              Sync
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {t("ranking.lastUpdated")}: {formatRecentRefresh(lastRankingLoadedAt, now, t)}
            </p>
          </div>
          <button
            type="button"
            disabled={!canManualRefresh}
            onClick={() => void manualRefreshRanking()}
            className="min-h-8 shrink-0 rounded-md border border-zinc-700/80 bg-zinc-950/35 px-2.5 text-[11px] font-bold text-zinc-300 transition hover:border-amber-500/40 hover:bg-amber-950/18 hover:text-amber-100 disabled:cursor-not-allowed disabled:border-zinc-800/75 disabled:bg-zinc-950/30 disabled:text-zinc-600"
          >
            {refreshButtonLabel}
          </button>
        </div>
        {refreshMessage ? (
          <p
            className={`mt-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
              refreshMessage === t("ranking.refreshError")
                ? "border-red-700/35 bg-red-950/24 text-red-100"
                : "border-zinc-800/70 bg-zinc-950/32 text-zinc-400"
            }`}
          >
            {refreshMessage}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-1 rounded-xl border border-amber-700/25 bg-[rgba(8,6,4,0.76)] p-1 shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_12px_28px_rgba(0,0,0,0.24)] ring-1 ring-black/30 backdrop-blur-[2px]">
        {(
          [
            ["weekly", t("ranking.tabs.weekly")],
            ["world", t("ranking.tabs.world")],
            ["me", t("ranking.tabs.me")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`min-w-0 whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-sm font-bold transition ${
              sub === id
                ? "bg-gradient-to-b from-amber-500/28 to-amber-900/28 text-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.12)] ring-1 ring-amber-400/45"
                : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "weekly" ? (
        <div className="grid gap-2.5">
          <aside className="space-y-2">
            <div className="rounded-xl border border-amber-700/30 bg-[rgba(8,6,4,0.74)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-black/25 backdrop-blur-[2px]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
                    {t("ranking.currentWeeklySeason")}
                  </div>
                  <div className="mt-1 font-mono text-base leading-none text-amber-100">
                    {season.seasonId}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold text-zinc-500">{t("ranking.seasonEndsIn")}</div>
                  <div className="numeric-value mt-1 font-mono text-xs font-bold text-sky-200">
                    {formatSeasonCountdown(season.remainingMs)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-indigo-500/18 bg-indigo-950/16 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-zinc-500">
                    {t("ranking.myWeeklyRank", { category: catLabel })}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-lg font-black leading-none text-indigo-100">
                    {myWeeklyRank != null
                      ? t("ranking.rankPosition", { rank: myWeeklyRank })
                      : t("ranking.noRecord")}
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden">
              <div className="mb-2 text-xs font-semibold text-zinc-500">
                {t("ranking.categoryLabel")}
              </div>
              <nav className="flex flex-col gap-1">
                {CATEGORY_META.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setWeeklyCat(c.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      weeklyCat === c.id
                        ? "bg-indigo-950/80 text-indigo-100 ring-1 ring-indigo-500/40"
                        : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                    }`}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0 space-y-2.5">
            <FantasyPanel
              title={t("ranking.weeklyPanelTitle", { category: catLabel })}
              className="overflow-hidden border-amber-700/30 bg-[rgba(8,6,4,0.76)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-amber-900/30 pb-3 text-xs text-zinc-400">
                <span className="min-w-0">
                  {t("ranking.weeklyPanelDescription", { scoreLabel: catScoreLabel })}
                </span>
                <span className="shrink-0 text-amber-300/75">
                  {t("ranking.topRecords")}
                </span>
              </div>
              <div className="mb-3 flex gap-1.5 overflow-x-auto px-0.5 py-1">
                {CATEGORY_META.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setWeeklyCat(c.id)}
                    className={`min-h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[11px] font-semibold leading-none transition ${
                      weeklyCat === c.id
                        ? "bg-amber-600/25 text-amber-100 ring-1 ring-amber-400/40"
                        : "bg-[rgba(6,8,14,0.72)] text-zinc-400 ring-1 ring-zinc-700/80 hover:text-zinc-200"
                    }`}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
              <ul className="space-y-2">
                {mergedWeekly.length > 0 ? mergedWeekly.map((row) => (
                  <li
                    key={`${row.rank}-${row.playerName}-${row.weaponName}`}
                    className={`rounded-xl border px-3 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition sm:px-4 ${
                      row.isPlayer
                        ? "border-indigo-400/30 bg-indigo-950/35 ring-1 ring-indigo-400/25"
                        : row.rank === 1
                          ? "border-amber-500/35 bg-gradient-to-br from-amber-950/35 to-zinc-950/72 ring-1 ring-amber-500/25"
                          : "border-zinc-800/80 bg-zinc-950/68"
                    }`}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                      <RankBadge rank={row.rank} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate font-semibold text-zinc-100">
                            {row.playerName}
                          </span>
                          {row.isPlayer ? (
                            <StatusBadge tone="ranking" className="px-1.5">
                              {t("records.me")}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <div className="mt-1 min-w-0 truncate text-sm text-zinc-400">
                          <span>
                            {getWeaponDisplayNameById(
                              locale,
                              row.weaponId,
                              row.weaponName,
                            )}
                          </span>{" "}
                          <span className="font-mono text-zinc-500">
                            +{row.enhanceLevel}
                            {row.transcendLevel >= 1
                              ? ` ★${row.transcendLevel}`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-[86px] shrink-0 text-right">
                        <div className="numeric-value max-w-[8.5rem] font-mono text-base font-bold text-amber-200">
                          {formatScore(weeklyCat, row)}
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          {catScoreLabel}
                        </div>
                      </div>
                    </div>
                  </li>
                )) : (
                  <li className="rounded-xl border border-amber-800/20 bg-zinc-950/65 px-4 py-7 text-center ring-1 ring-black/20">
                    <div className="text-sm font-semibold text-zinc-300">
                      {weeklyResult ? t("ranking.weeklyEmpty") : t("ranking.loadingData")}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {weeklyResult ? t("ranking.weeklyEmptyDescription") : t("ranking.checkingSeason")}
                    </div>
                  </li>
                )}
              </ul>
            </FantasyPanel>
          </div>
        </div>
      ) : null}

      {sub === "world" ? (
        <div className="grid gap-4">
          {worldRecords ? (
            <>
              <RecordCard
                title={t("records.highestWeapon")}
                categoryLabel={t("ranking.score.rankingValue")}
                subject={getWeaponDisplayNameById(
                  locale,
                  worldRecords.highestWeapon.weaponId,
                  worldRecords.highestWeapon.weaponName,
                )}
                meta={`+${worldRecords.highestWeapon.enhanceLevel} · ★${worldRecords.highestWeapon.transcendLevel}`}
                value={formatGold(worldRecords.highestWeapon.rankingValue)}
                owner={worldRecords.highestWeapon.holderName}
                isPlayer={worldRecords.highestWeapon.isPlayer}
                accent="gold"
                empty={!hasWorldWeaponRecord(worldRecords.highestWeapon)}
                emptyDescription={t("records.emptyValue")}
              />

              <RecordCard
                title={t("records.bestTranscendWeapon")}
                categoryLabel={t("records.transcendCategory")}
                subject={getWeaponDisplayNameById(
                  locale,
                  worldRecords.bestTranscend.weaponId,
                  worldRecords.bestTranscend.weaponName,
                )}
                meta={`★${worldRecords.bestTranscend.transcendLevel}`}
                value={formatGold(worldRecords.bestTranscend.rankingValue)}
                owner={worldRecords.bestTranscend.holderName}
                isPlayer={worldRecords.bestTranscend.isPlayer}
                accent="purple"
                empty={!hasWorldWeaponRecord(worldRecords.bestTranscend)}
                emptyDescription={t("records.emptyTranscend")}
              />

              <RecordCard
                title={t("records.bestSale")}
                categoryLabel={t("records.singleSaleGold")}
                subject={getWeaponDisplayNameById(
                  locale,
                  worldRecords.bestSale.weaponId,
                  worldRecords.bestSale.weaponName,
                )}
                value={formatGold(worldRecords.bestSale.gold)}
                owner={worldRecords.bestSale.holderName}
                isPlayer={worldRecords.bestSale.isPlayer}
                accent="blue"
                empty={!hasWorldSaleRecord(worldRecords.bestSale)}
                emptyDescription={t("records.emptySale")}
              />

              <RecordCard
                title={t("records.mostEnhanceAttempts")}
                categoryLabel={t("records.totalAttempts")}
                value={formatInt(worldRecords.mostEnhanceAttempts.value)}
                owner={worldRecords.mostEnhanceAttempts.holderName}
                isPlayer={worldRecords.mostEnhanceAttempts.isPlayer}
                accent="bronze"
                empty={!hasWorldCountRecord(worldRecords.mostEnhanceAttempts)}
                emptyDescription={t("records.emptyEnhanceAttempts")}
              />

              <RecordCard
                title={t("records.mostTranscendSuccess")}
                categoryLabel={t("records.totalSuccesses")}
                value={formatInt(worldRecords.mostTranscendSuccesses.value)}
                owner={worldRecords.mostTranscendSuccesses.holderName}
                isPlayer={worldRecords.mostTranscendSuccesses.isPlayer}
                accent="purple"
                empty={!hasWorldCountRecord(worldRecords.mostTranscendSuccesses)}
                emptyDescription={t("records.emptyTranscendSuccess")}
              />

              <RecordCard
                title={t("records.destroyedLegend")}
                categoryLabel={t("records.destroyRecord")}
                subject={getWeaponDisplayNameById(
                  locale,
                  worldRecords.destroyedLegend.weaponId,
                  worldRecords.destroyedLegend.weaponName,
                )}
                meta={`+${worldRecords.destroyedLegend.enhanceLevel} · ★${worldRecords.destroyedLegend.transcendLevel}`}
                value={formatGold(worldRecords.destroyedLegend.rankingValue)}
                owner={worldRecords.destroyedLegend.holderName}
                isPlayer={worldRecords.destroyedLegend.isPlayer}
                accent="red"
                empty={!hasWorldWeaponRecord(worldRecords.destroyedLegend)}
                emptyDescription={t("records.emptyDestroy")}
              />
            </>
          ) : (
            <div className="rounded-xl border border-amber-800/20 bg-zinc-950/65 px-4 py-7 text-center ring-1 ring-black/20">
              <div className="text-sm font-semibold text-zinc-300">{t("records.loadingWorld")}</div>
              <div className="mt-1 text-xs text-zinc-500">{t("records.arrangingHall")}</div>
            </div>
          )}
        </div>
      ) : null}

      {sub === "me" ? (
        <div className="grid gap-4">
          <FantasyPanel title={t("records.personalBestWeapon")} className="space-y-3 border-amber-600/35 bg-[rgba(8,6,4,0.78)]">
            {bestWeaponSnapshotView ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-zinc-50">
                      {getWeaponDisplayNameById(
                        locale,
                        bestWeaponSnapshotView.weaponId,
                        bestWeaponSnapshotView.weaponName,
                      )}
                    </div>
                    <div className="mt-1 font-mono text-sm text-amber-200/85">
                      +{bestWeaponSnapshotView.enhanceLevel}
                      {bestWeaponSnapshotView.transcendLevel >= 1
                        ? ` · ★${bestWeaponSnapshotView.transcendLevel}`
                        : ""}{" "}
                      · {t("weapon.durability")} {bestWeaponSnapshotView.durability}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-semibold text-zinc-500">{t("ranking.score.rankingValue")}</div>
                    <div className="numeric-value mt-1 font-mono text-2xl font-black text-amber-300">
                      {formatGold(bestWeaponSnapshotView.rankingValue)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-amber-900/25 pt-3 text-xs text-zinc-500">
                  {t("records.achievedAt")} {achievedLabel}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-800/20 bg-zinc-950/45 p-4">
                <div className="text-sm font-semibold text-zinc-200">{t("ranking.noRecord")}</div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("records.emptyPersonalBest")}
                </p>
                <span className="numeric-value mt-3 block font-mono text-sm text-amber-200/80">
                  {t("records.personalBestReference")}:{" "}
                  {formatGold(recordsView.personalBestRankingValue)}
                </span>
              </div>
            )}
          </FantasyPanel>

          <FantasyPanel title={t("records.salesPerformance")} className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label={t("records.bestSingleSale")} value={formatGold(recordsView.bestSaleGold)} mono />
            <StatRow label={t("records.totalSalesGold")} value={formatGold(recordsView.totalSalesGold)} mono />
            <StatRow label={t("records.soldWeaponCount")} value={formatInt(recordsView.soldWeaponCount)} mono />
          </FantasyPanel>

          <FantasyPanel title={t("records.enhanceStats")} className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label={t("records.enhanceAttempts")} value={formatInt(recordsView.totalEnhanceAttempts)} mono />
            <StatRow label={t("records.enhanceSuccesses")} value={formatInt(recordsView.totalEnhanceSuccesses)} mono />
            <StatRow label={t("records.enhanceFails")} value={formatInt(recordsView.enhanceFailCount)} mono />
            <StatRow label={t("records.enhanceDestroyed")} value={formatInt(recordsView.enhanceDestroyedCount)} mono />
            <StatRow label={t("records.destroyedWeaponTotal")} value={formatInt(recordsView.destroyedWeaponCount)} mono accent />
            <StatRow label={t("enhance.successRate")} value={`${enhanceRate}%`} mono />
            <StatRow label={t("records.maxEnhanceLevel")} value={`+${recordsView.maxEnhanceLevel}`} mono />
          </FantasyPanel>

          <FantasyPanel title={t("records.transcendStats")} className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label={t("records.transcendAttempts")} value={formatInt(recordsView.transcendAttemptCount)} mono />
            <StatRow label={t("records.transcendSuccesses")} value={formatInt(recordsView.transcendSuccessCount)} mono />
            <StatRow label={t("records.transcendFails")} value={formatInt(recordsView.transcendFailCount)} mono />
            <StatRow label={t("records.maxTranscend")} value={`★${recordsView.maxTranscendLevel}`} mono accent />
            <StatRow
              label={t("records.bestTranscendedWeaponValue")}
              value={formatGold(recordsView.bestTranscendedWeaponValue)}
              mono
            />
            <StatRow label={t("records.transcendDestroyed")} value={formatInt(recordsView.transcendDestroyedCount)} mono accent />
          </FantasyPanel>

          <FantasyPanel title={t("records.forgeStats")} className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label={t("records.totalForgeCollected")} value={formatInt(recordsView.totalForgeCollected)} mono />
            <StatRow
              label={t("records.adBonusCollected")}
              value={formatInt(recordsView.totalForgeAdBonusCollected)}
              mono
            />
            <StatRow label={t("records.forgeLevel")} value={`Lv.${forgeLevel}`} mono accent />
          </FantasyPanel>
        </div>
      ) : null}
    </div>
  );
}

function HolderFooter({
  name,
  isPlayer,
}: {
  name: string;
  isPlayer: boolean;
}) {
  const { t } = useLocale();

  return (
    <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-zinc-800/80 pt-3 text-xs">
      <span className="min-w-0 text-zinc-500">{t("records.holder")}</span>
      <span className="flex min-w-0 max-w-[220px] items-center justify-end gap-2 text-right font-medium text-zinc-200">
        <span className="truncate">{name}</span>
        {isPlayer ? (
          <StatusBadge tone="ranking" className="px-1.5">
            {t("records.me")}
          </StatusBadge>
        ) : null}
      </span>
    </div>
  );
}

function StatRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="stat-row border-b border-zinc-800/60 pb-2 last:border-0">
      <span className={`min-w-0 ${accent ? "text-violet-300/90" : "text-zinc-500"}`}>{label}</span>
      <span
        className={`stat-value numeric-value ${mono ? "font-mono text-zinc-100" : "text-zinc-200"}`}
      >
        {value}
      </span>
    </div>
  );
}

function RecordCard({
  title,
  categoryLabel,
  subject,
  meta,
  value,
  owner,
  isPlayer,
  accent,
  empty,
  emptyDescription,
}: {
  title: string;
  categoryLabel: string;
  subject?: string;
  meta?: string;
  value: string;
  owner: string;
  isPlayer: boolean;
  accent: "gold" | "purple" | "blue" | "bronze" | "red";
  empty: boolean;
  emptyDescription: string;
}) {
  const { t } = useLocale();

  const accentClass =
    accent === "gold"
      ? {
          border: "border-amber-500/35",
          ring: "ring-amber-600/25",
          label: "text-amber-300/80",
          value: "text-amber-300",
          glow: "shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_0_22px_rgba(245,158,11,0.08)]",
        }
      : accent === "purple"
        ? {
            border: "border-violet-500/30",
            ring: "ring-violet-500/20",
            label: "text-violet-300/80",
            value: "text-violet-200",
            glow: "shadow-[inset_0_1px_0_rgba(196,181,253,0.08),0_0_22px_rgba(139,92,246,0.08)]",
          }
        : accent === "blue"
          ? {
              border: "border-sky-500/30",
              ring: "ring-sky-500/20",
              label: "text-sky-300/80",
              value: "text-sky-200",
              glow: "shadow-[inset_0_1px_0_rgba(125,211,252,0.08),0_0_22px_rgba(14,165,233,0.08)]",
            }
          : accent === "red"
            ? {
                border: "border-red-500/30",
                ring: "ring-red-500/20",
                label: "text-red-300/80",
                value: "text-red-200",
                glow: "shadow-[inset_0_1px_0_rgba(252,165,165,0.08),0_0_22px_rgba(239,68,68,0.08)]",
              }
            : {
                border: "border-orange-600/30",
                ring: "ring-orange-700/20",
                label: "text-orange-300/80",
                value: "text-orange-100",
                glow: "shadow-[inset_0_1px_0_rgba(253,186,116,0.08),0_0_22px_rgba(194,65,12,0.07)]",
              };

  return (
    <div
      className={`rounded-2xl border ${accentClass.border} bg-[rgba(8,6,4,0.78)] p-4 ${accentClass.glow} ${accentClass.ring} ring-1 backdrop-blur-[2px]`}
    >
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${accentClass.label}`}>
        {categoryLabel}
      </div>
      <h3 className="mt-1 text-lg font-black text-zinc-50">{title}</h3>
      {empty ? (
        <div className="mt-5 rounded-xl border border-zinc-800/70 bg-zinc-950/48 p-4">
          <div className="text-sm font-semibold text-zinc-200">{t("ranking.noRecord")}</div>
          <div className="mt-1 text-xs leading-relaxed text-zinc-500">{emptyDescription}</div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              {subject ? (
                <div className="truncate text-lg font-bold text-zinc-100">{subject}</div>
              ) : null}
              {meta ? (
                <div className="mt-1 font-mono text-sm text-zinc-400">{meta}</div>
              ) : null}
            </div>
            <div className={`numeric-value max-w-[190px] font-mono text-2xl font-black ${accentClass.value}`}>
              {value}
            </div>
          </div>
          <HolderFooter name={owner} isPlayer={isPlayer} />
        </>
      )}
    </div>
  );
}
