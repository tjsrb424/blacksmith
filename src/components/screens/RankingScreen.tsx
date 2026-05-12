"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useBetaPlayer } from "@/components/auth/AuthGate";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { formatGold, formatInt } from "@/lib/format";
import { getGameMode, type PlayerRecordAdapterResult, type WeeklyRankingAdapterResult, type WorldRecordsAdapterResult } from "@/lib/ranking/rankingAdapter";
import { mockRankingAdapter } from "@/lib/ranking/mockRankingAdapter";
import { serverRankingAdapter } from "@/lib/ranking/serverRankingAdapter";
import { formatSeasonCountdown, getCurrentSeasonInfo } from "@/lib/season";
import type { RankingCategory, RankingRowDisplay } from "@/types/game";
import { useGameStore } from "@/store/gameStore";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

type SubTab = "weekly" | "world" | "me";

const CATEGORY_META: {
  id: RankingCategory;
  label: string;
  scoreLabel: string;
}[] = [
  { id: "weeklyStrongestWeapon", label: "최강 무기", scoreLabel: "랭킹 가치" },
  { id: "weeklyEnhancementKing", label: "강화왕", scoreLabel: "강화 성공" },
  { id: "weeklyTranscendKing", label: "초월왕", scoreLabel: "초월 성공" },
  { id: "weeklySalesKing", label: "판매왕", scoreLabel: "시즌 판매" },
];

function formatScore(cat: RankingCategory, row: RankingRowDisplay): string {
  if (cat === "weeklyStrongestWeapon" || cat === "weeklySalesKing") {
    return formatGold(row.score);
  }
  return formatInt(Math.round(row.score));
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/35 to-amber-900/45 text-lg ring-2 ring-amber-400/55 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
        title="1위"
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
  useRenderDiagnostics("RankingScreen");
  const [sub, setSub] = useState<SubTab>("weekly");
  const [weeklyCat, setWeeklyCat] = useState<RankingCategory>(
    "weeklyStrongestWeapon",
  );
  const [now, setNow] = useState(() => Date.now());
  const [weeklyResult, setWeeklyResult] =
    useState<WeeklyRankingAdapterResult | null>(null);
  const [worldResult, setWorldResult] =
    useState<WorldRecordsAdapterResult | null>(null);
  const [playerRecordResult, setPlayerRecordResult] =
    useState<PlayerRecordAdapterResult | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const records = useGameStore((s) => s.records);
  const bestWeaponSnapshot = useGameStore((s) => s.bestWeaponSnapshot);
  const weeklySeasonStats = useGameStore((s) => s.weeklySeasonStats);
  const forgeLevel = useGameStore((s) => s.forgeLevel);
  const { snapshot: betaPlayerSnapshot } = useBetaPlayer();

  const season = useMemo(() => getCurrentSeasonInfo(now), [now]);
  const gameMode = getGameMode();
  const adapter = gameMode === "beta" ? serverRankingAdapter : mockRankingAdapter;
  const playerId =
    gameMode === "beta" && betaPlayerSnapshot
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

  useEffect(() => {
    let alive = true;
    void adapter
      .getWeeklyRanking(weeklyCat, season.seasonId, adapterContext)
      .then((result) => {
        if (alive) setWeeklyResult(result);
      });
    return () => {
      alive = false;
    };
  }, [adapter, adapterContext, season.seasonId, weeklyCat]);

  useEffect(() => {
    let alive = true;
    void adapter.getWorldRecords(adapterContext).then((result) => {
      if (alive) setWorldResult(result);
    });
    return () => {
      alive = false;
    };
  }, [adapter, adapterContext]);

  useEffect(() => {
    let alive = true;
    void adapter
      .getPlayerRecord(playerId, season.seasonId, adapterContext)
      .then((result) => {
        if (alive) setPlayerRecordResult(result);
      });
    return () => {
      alive = false;
    };
  }, [adapter, adapterContext, playerId, season.seasonId]);

  const mergedWeekly = weeklyResult?.rows ?? [];
  const myWeeklyRank = weeklyResult?.playerRank ?? null;

  const catMeta = CATEGORY_META.find((c) => c.id === weeklyCat)!;
  const playerRecord = playerRecordResult?.record;
  const recordsView = playerRecord?.records ?? records;
  const bestWeaponSnapshotView =
    playerRecord?.bestWeaponSnapshot ?? bestWeaponSnapshot;
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
    <div className="relative mx-auto w-full flex-1 space-y-6 px-3 pb-5 pt-6">
      <ScreenBackground screen="ranking" />
      <header className="relative z-10 space-y-2">
        <h2 className="text-xl font-bold text-amber-50">랭킹</h2>
        <p className="text-sm text-zinc-400">
          {gameMode === "beta"
            ? "betaServerMode · 서버 랭킹 API 우선, 실패 시 로컬 fallback"
            : "localMode · LocalStorage + Mock ranking adapter"}
        </p>
        <div className="inline-flex rounded bg-zinc-950/75 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-700/45">
          {gameMode === "beta" &&
          weeklyResult?.source !== "fallback" &&
          worldResult?.source !== "fallback"
            ? "SERVER RANKING"
            : "임시 랭킹 데이터"}
        </div>
      </header>

      {weeklyResult?.source === "fallback" || worldResult?.source === "fallback" ? (
        <div className="relative z-10 rounded-lg border border-amber-700/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-100">
          서버 랭킹 API에 연결하지 못해 로컬 Mock 랭킹을 표시 중입니다.
          {weeklyResult?.error ?? worldResult?.error ? (
            <span className="ml-2 font-mono text-amber-200/80">
              {weeklyResult?.error ?? worldResult?.error}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative z-10 flex gap-2 overflow-x-auto rounded-xl bg-[rgba(6,8,14,0.68)] p-1 ring-1 ring-amber-900/38 backdrop-blur-[1px]">
        {(
          [
            ["weekly", "주간 랭킹"],
            ["world", "월드레코드"],
            ["me", "내 기록"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              sub === id
                ? "bg-amber-600/25 text-amber-50 ring-1 ring-amber-500/45"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "weekly" ? (
        <div className="grid gap-6">
          <aside className="space-y-3">
            <div className="rounded-xl border border-amber-800/35 bg-[rgba(6,8,14,0.7)] p-4 ring-1 ring-inset ring-amber-900/25 backdrop-blur-[1px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/90">
                이번 주간 시즌
              </div>
              <div className="mt-1 font-mono text-lg text-amber-100">
                {season.seasonId}
              </div>
              <div className="mt-3 text-xs text-zinc-500">시즌 종료까지</div>
              <div className="font-mono text-sm text-sky-300/95">
                {formatSeasonCountdown(season.remainingMs)}
              </div>
            </div>
            <div className="hidden">
              <div className="mb-2 text-xs font-semibold text-zinc-500">
                카테고리
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
                    {c.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORY_META.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setWeeklyCat(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    weeklyCat === c.id
                      ? "bg-indigo-600/35 text-indigo-100 ring-1 ring-indigo-400/40"
                      : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <FantasyPanel
              title={`주간 · ${catMeta.label}`}
              className="overflow-hidden"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3 text-xs text-zinc-500">
                <span>{catMeta.scoreLabel} 기준 · Mock + 내 기록 합성</span>
              </div>
              <ul className="space-y-2">
                {mergedWeekly.length > 0 ? mergedWeekly.map((row) => (
                  <li
                    key={`${row.rank}-${row.playerName}-${row.weaponName}`}
                    className={`rounded-xl px-3 py-3 ring-1 transition sm:px-4 ${
                      row.isPlayer
                        ? "bg-indigo-950/35 ring-indigo-500/35"
                        : row.rank === 1
                          ? "bg-amber-950/25 ring-amber-600/35"
                          : "bg-zinc-950/60 ring-zinc-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <RankBadge rank={row.rank} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-100">
                            {row.playerName}
                          </span>
                          {row.isPlayer ? (
                            <span className="rounded bg-indigo-600/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-100">
                              나
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-sm text-zinc-400">
                          {row.weaponName}{" "}
                          <span className="font-mono text-zinc-500">
                            +{row.enhanceLevel}
                            {row.transcendLevel >= 1
                              ? ` ★${row.transcendLevel}`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-base text-amber-200">
                          {formatScore(weeklyCat, row)}
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          {catMeta.scoreLabel}
                        </div>
                      </div>
                    </div>
                  </li>
                )) : (
                  <li className="rounded-xl bg-zinc-950/60 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-800">
                    랭킹 데이터를 불러오는 중입니다.
                  </li>
                )}
              </ul>
            </FantasyPanel>

            <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 ring-1 ring-indigo-800/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300/90">
                내 예상 순위 ({catMeta.label})
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-3xl text-indigo-100">
                  {myWeeklyRank != null ? `${myWeeklyRank}위` : "기록 없음"}
                </span>
                {myWeeklyRank != null && myWeeklyRank <= 3 ? (
                  <span className="text-sm text-amber-300/90">상위권 진입!</span>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                시즌 내 활동이 없으면 목록에 표시되지 않을 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {sub === "world" ? (
        <div className="grid gap-4">
          {worldRecords ? (
            <>
              <WorldCard
                title="세계 최고가 무기"
                subtitle="랭킹 가치 · 서버 계산 기준"
                accent="amber"
              >
                <div className="text-lg font-semibold text-zinc-100">
                  {worldRecords.highestWeapon.weaponName}
                </div>
                <div className="mt-1 font-mono text-sm text-amber-200/90">
                  +{worldRecords.highestWeapon.enhanceLevel} ★
                  {worldRecords.highestWeapon.transcendLevel}
                </div>
                <div className="mt-3 font-mono text-2xl text-amber-300">
                  {formatGold(worldRecords.highestWeapon.rankingValue)}
                </div>
                <HolderFooter
                  name={worldRecords.highestWeapon.holderName}
                  isPlayer={worldRecords.highestWeapon.isPlayer}
                />
              </WorldCard>

              <WorldCard
                title="최고 초월 무기"
                subtitle="초월 단계 우선 · 동률 시 가치"
                accent="violet"
              >
                <div className="text-lg font-semibold text-zinc-100">
                  {worldRecords.bestTranscend.weaponName}
                </div>
                <div className="mt-1 font-mono text-sm text-violet-200">
                  ★{worldRecords.bestTranscend.transcendLevel}
                </div>
                <div className="mt-3 font-mono text-2xl text-violet-200">
                  {formatGold(worldRecords.bestTranscend.rankingValue)}
                </div>
                <HolderFooter
                  name={worldRecords.bestTranscend.holderName}
                  isPlayer={worldRecords.bestTranscend.isPlayer}
                />
              </WorldCard>

              <WorldCard title="최고 판매가" subtitle="단일 거래 · 판매 골드" accent="sky">
                <div className="font-mono text-2xl text-sky-300">
                  {formatGold(worldRecords.bestSale.gold)}
                </div>
                <div className="mt-2 text-sm text-zinc-400">{worldRecords.bestSale.weaponName}</div>
                <HolderFooter name={worldRecords.bestSale.holderName} isPlayer={worldRecords.bestSale.isPlayer} />
              </WorldCard>

              <WorldCard title="최다 강화 시도" subtitle="누적 시도 횟수" accent="zinc">
                <div className="font-mono text-2xl text-zinc-100">
                  {formatInt(worldRecords.mostEnhanceAttempts.value)}
                </div>
                <HolderFooter
                  name={worldRecords.mostEnhanceAttempts.holderName}
                  isPlayer={worldRecords.mostEnhanceAttempts.isPlayer}
                />
              </WorldCard>

              <WorldCard title="최다 초월 성공" subtitle="누적 성공 횟수" accent="fuchsia">
                <div className="font-mono text-2xl text-fuchsia-200">
                  {formatInt(worldRecords.mostTranscendSuccesses.value)}
                </div>
                <HolderFooter
                  name={worldRecords.mostTranscendSuccesses.holderName}
                  isPlayer={worldRecords.mostTranscendSuccesses.isPlayer}
                />
              </WorldCard>

              <WorldCard
                title="파괴된 전설"
                subtitle="서버 기록 · fallback 시 Mock"
                accent="red"
              >
                <div className="text-lg font-semibold text-zinc-100">
                  {worldRecords.destroyedLegend.weaponName}
                </div>
                <div className="mt-1 font-mono text-sm text-red-300/90">
                  +{worldRecords.destroyedLegend.enhanceLevel} ★
                  {worldRecords.destroyedLegend.transcendLevel}
                </div>
                <div className="mt-2 font-mono text-xl text-red-200/90">
                  {formatGold(worldRecords.destroyedLegend.rankingValue)}
                </div>
                <HolderFooter name={worldRecords.destroyedLegend.holderName} isPlayer={worldRecords.destroyedLegend.isPlayer} />
              </WorldCard>
            </>
          ) : (
            <div className="rounded-xl bg-zinc-950/60 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-800">
              월드레코드를 불러오는 중입니다.
            </div>
          )}
        </div>
      ) : null}

      {sub === "me" ? (
        <div className="grid gap-4">
          <FantasyPanel title="역대 최고 무기" className="space-y-3">
            {bestWeaponSnapshotView ? (
              <>
                <div className="text-lg font-semibold text-zinc-100">
                  {bestWeaponSnapshotView.weaponName}
                </div>
                <div className="font-mono text-amber-200/90">
                  +{bestWeaponSnapshotView.enhanceLevel}
                  {bestWeaponSnapshotView.transcendLevel >= 1
                    ? ` ★${bestWeaponSnapshotView.transcendLevel}`
                    : ""}{" "}
                  · 내구 {bestWeaponSnapshotView.durability}
                </div>
                <div className="font-mono text-2xl text-amber-300">
                  {formatGold(bestWeaponSnapshotView.rankingValue)}
                </div>
                <div className="text-xs text-zinc-500">달성일 {achievedLabel}</div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                아직 스냅샷이 없습니다. 강화·초월로 가치를 올려 보세요.
                <span className="mt-2 block font-mono text-amber-200/80">
                  역대 최고 가치(참고):{" "}
                  {formatGold(recordsView.personalBestRankingValue)}
                </span>
              </p>
            )}
          </FantasyPanel>

          <FantasyPanel title="판매 실적" className="space-y-3 text-sm">
            <StatRow label="최고 단일 판매가" value={formatGold(recordsView.bestSaleGold)} mono />
            <StatRow label="총 판매 골드" value={formatGold(recordsView.totalSalesGold)} mono />
            <StatRow label="판매한 무기 수" value={formatInt(recordsView.soldWeaponCount)} mono />
          </FantasyPanel>

          <FantasyPanel title="강화 통계" className="space-y-3 text-sm">
            <StatRow label="강화 시도" value={formatInt(recordsView.totalEnhanceAttempts)} mono />
            <StatRow label="강화 성공" value={formatInt(recordsView.totalEnhanceSuccesses)} mono />
            <StatRow label="강화 실패" value={formatInt(recordsView.enhanceFailCount)} mono />
            <StatRow label="강화 파괴" value={formatInt(recordsView.enhanceDestroyedCount)} mono />
            <StatRow label="파괴한 무기 (전체)" value={formatInt(recordsView.destroyedWeaponCount)} mono accent />
            <StatRow label="성공률" value={`${enhanceRate}%`} mono />
            <StatRow label="역대 최고 강화 단계" value={`+${recordsView.maxEnhanceLevel}`} mono />
          </FantasyPanel>

          <FantasyPanel title="초월 통계" className="space-y-3 text-sm">
            <StatRow label="초월 시도" value={formatInt(recordsView.transcendAttemptCount)} mono />
            <StatRow label="초월 성공" value={formatInt(recordsView.transcendSuccessCount)} mono />
            <StatRow label="초월 실패" value={formatInt(recordsView.transcendFailCount)} mono />
            <StatRow label="최고 초월 ★" value={`★${recordsView.maxTranscendLevel}`} mono accent />
            <StatRow
              label="초월 무기 최고 가치"
              value={formatGold(recordsView.bestTranscendedWeaponValue)}
              mono
            />
            <StatRow label="초월 실패 파괴" value={formatInt(recordsView.transcendDestroyedCount)} mono accent />
          </FantasyPanel>

          <FantasyPanel title="제련로 통계" className="space-y-3 text-sm">
            <StatRow label="총 수령 제련의 불씨" value={formatInt(recordsView.totalForgeCollected)} mono />
            <StatRow
              label="광고 보너스 수령량"
              value={formatInt(recordsView.totalForgeAdBonusCollected)}
              mono
            />
            <StatRow label="제련로 레벨" value={`Lv.${forgeLevel}`} mono accent />
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
  return (
    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs">
      <span className="text-zinc-500">보유자</span>
      <span className="flex items-center gap-2 font-medium text-zinc-200">
        {name}
        {isPlayer ? (
          <span className="rounded bg-indigo-600/35 px-1.5 py-0.5 text-[10px] text-indigo-100">
            나
          </span>
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
    <div className="flex justify-between gap-3 border-b border-zinc-800/60 pb-2 last:border-0">
      <span className={accent ? "text-violet-300/90" : "text-zinc-500"}>{label}</span>
      <span
        className={`text-right ${mono ? "font-mono text-zinc-100" : "text-zinc-200"}`}
      >
        {value}
      </span>
    </div>
  );
}

function WorldCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "amber" | "violet" | "sky" | "zinc" | "fuchsia" | "red";
  children: ReactNode;
}) {
  const ring =
    accent === "amber"
      ? "ring-amber-700/35"
      : accent === "violet"
        ? "ring-violet-600/35"
        : accent === "sky"
          ? "ring-sky-700/35"
          : accent === "fuchsia"
            ? "ring-fuchsia-700/35"
            : accent === "red"
              ? "ring-red-700/35"
              : "ring-zinc-700/35";

  return (
    <div
      className={`rounded-2xl border border-zinc-800/80 bg-[rgba(6,8,14,0.72)] p-5 shadow-inner ${ring} ring-1 backdrop-blur-[1px]`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {subtitle}
      </div>
      <h3 className="mt-1 text-lg font-bold text-zinc-50">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}
