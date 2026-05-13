"use client";

import { useEffect, useMemo, useState } from "react";
import { useBetaPlayer } from "@/components/auth/AuthGate";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

const EMPTY_HOLDER_LABEL = "아직 기록 없음";

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
    <div className="relative mx-auto w-full flex-1 space-y-5 px-3 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+24px)] pt-5">
      <ScreenBackground screen="ranking" />
      <header className="relative z-10 space-y-1.5">
        <h2 className="text-2xl font-black tracking-wide text-amber-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          랭킹
        </h2>
        <p className="text-sm font-medium text-zinc-300/90">
          이번 시즌 기록과 월드 레코드를 확인하세요.
        </p>
      </header>

      <div className="relative z-10 grid grid-cols-3 gap-1 rounded-xl border border-amber-700/25 bg-[rgba(8,6,4,0.76)] p-1 shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_12px_28px_rgba(0,0,0,0.24)] ring-1 ring-black/30 backdrop-blur-[2px]">
        {(
          [
            ["weekly", "주간 랭킹"],
            ["world", "월드 레코드"],
            ["me", "내 기록"],
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
        <div className="grid gap-4">
          <aside className="space-y-3">
            <div className="rounded-xl border border-amber-700/30 bg-[rgba(8,6,4,0.74)] p-3.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-black/25 backdrop-blur-[2px]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
                    이번 주간 시즌
                  </div>
                  <div className="mt-1 font-mono text-lg leading-none text-amber-100">
                    {season.seasonId}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold text-zinc-500">시즌 종료까지</div>
                  <div className="numeric-value mt-1 font-mono text-sm font-bold text-sky-200">
                    {formatSeasonCountdown(season.remainingMs)}
                  </div>
                </div>
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
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    weeklyCat === c.id
                      ? "bg-amber-600/25 text-amber-100 ring-1 ring-amber-400/40"
                      : "bg-[rgba(6,8,14,0.72)] text-zinc-400 ring-1 ring-zinc-700/80 hover:text-zinc-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <FantasyPanel
              title={`주간 · ${catMeta.label}`}
              className="overflow-hidden border-amber-700/30 bg-[rgba(8,6,4,0.76)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-amber-900/30 pb-3 text-xs text-zinc-400">
                <span className="min-w-0">이번 시즌 기준 {catMeta.scoreLabel} 순위입니다.</span>
                <span className="shrink-0 text-amber-300/75">TOP 기록</span>
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
                              나
                            </StatusBadge>
                          ) : null}
                        </div>
                        <div className="mt-1 min-w-0 truncate text-sm text-zinc-400">
                          <span>{row.weaponName}</span>{" "}
                          <span className="font-mono text-zinc-500">
                            +{row.enhanceLevel}
                            {row.transcendLevel >= 1
                              ? ` ★${row.transcendLevel}`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-[86px] shrink-0 text-right">
                        <div className="numeric-value font-mono text-base font-bold text-amber-200">
                          {formatScore(weeklyCat, row)}
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          {catMeta.scoreLabel}
                        </div>
                      </div>
                    </div>
                  </li>
                )) : (
                  <li className="rounded-xl border border-amber-800/20 bg-zinc-950/65 px-4 py-7 text-center ring-1 ring-black/20">
                    <div className="text-sm font-semibold text-zinc-300">
                      {weeklyResult ? "아직 주간 랭킹 기록이 없습니다." : "랭킹 데이터를 불러오는 중입니다."}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {weeklyResult ? "강화를 진행해 첫 기록을 남겨보세요." : "시즌 기록을 확인하고 있습니다."}
                    </div>
                  </li>
                )}
              </ul>
            </FantasyPanel>

            <div className="rounded-xl border border-indigo-600/25 bg-[rgba(18,13,38,0.52)] p-4 ring-1 ring-indigo-800/25">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-200/90">
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
              <RecordCard
                title="세계 최고가 무기"
                categoryLabel="랭킹 가치"
                subject={worldRecords.highestWeapon.weaponName}
                meta={`+${worldRecords.highestWeapon.enhanceLevel} · ★${worldRecords.highestWeapon.transcendLevel}`}
                value={formatGold(worldRecords.highestWeapon.rankingValue)}
                owner={worldRecords.highestWeapon.holderName}
                isPlayer={worldRecords.highestWeapon.isPlayer}
                accent="gold"
                empty={!hasWorldWeaponRecord(worldRecords.highestWeapon)}
                emptyDescription="가치 기록이 생기면 이곳에 표시됩니다."
              />

              <RecordCard
                title="최고 초월 무기"
                categoryLabel="초월 단계 우선 · 동률 시 가치"
                subject={worldRecords.bestTranscend.weaponName}
                meta={`★${worldRecords.bestTranscend.transcendLevel}`}
                value={formatGold(worldRecords.bestTranscend.rankingValue)}
                owner={worldRecords.bestTranscend.holderName}
                isPlayer={worldRecords.bestTranscend.isPlayer}
                accent="purple"
                empty={!hasWorldWeaponRecord(worldRecords.bestTranscend)}
                emptyDescription="첫 초월 기록이 생기면 이곳에 표시됩니다."
              />

              <RecordCard
                title="최고 판매가"
                categoryLabel="단일 거래 · 판매 골드"
                subject={worldRecords.bestSale.weaponName}
                value={formatGold(worldRecords.bestSale.gold)}
                owner={worldRecords.bestSale.holderName}
                isPlayer={worldRecords.bestSale.isPlayer}
                accent="blue"
                empty={!hasWorldSaleRecord(worldRecords.bestSale)}
                emptyDescription="판매 기록이 생기면 이곳에 표시됩니다."
              />

              <RecordCard
                title="최대 강화 시도"
                categoryLabel="누적 시도 횟수"
                value={formatInt(worldRecords.mostEnhanceAttempts.value)}
                owner={worldRecords.mostEnhanceAttempts.holderName}
                isPlayer={worldRecords.mostEnhanceAttempts.isPlayer}
                accent="bronze"
                empty={!hasWorldCountRecord(worldRecords.mostEnhanceAttempts)}
                emptyDescription="강화 시도 기록이 생기면 이곳에 표시됩니다."
              />

              <RecordCard
                title="최대 초월 성공"
                categoryLabel="누적 성공 횟수"
                value={formatInt(worldRecords.mostTranscendSuccesses.value)}
                owner={worldRecords.mostTranscendSuccesses.holderName}
                isPlayer={worldRecords.mostTranscendSuccesses.isPlayer}
                accent="purple"
                empty={!hasWorldCountRecord(worldRecords.mostTranscendSuccesses)}
                emptyDescription="첫 초월 성공자가 기록됩니다."
              />

              <RecordCard
                title="파괴된 전설"
                categoryLabel="파괴 기록"
                subject={worldRecords.destroyedLegend.weaponName}
                meta={`+${worldRecords.destroyedLegend.enhanceLevel} · ★${worldRecords.destroyedLegend.transcendLevel}`}
                value={formatGold(worldRecords.destroyedLegend.rankingValue)}
                owner={worldRecords.destroyedLegend.holderName}
                isPlayer={worldRecords.destroyedLegend.isPlayer}
                accent="red"
                empty={!hasWorldWeaponRecord(worldRecords.destroyedLegend)}
                emptyDescription="파괴 기록이 생기면 이곳에 표시됩니다."
              />
            </>
          ) : (
            <div className="rounded-xl border border-amber-800/20 bg-zinc-950/65 px-4 py-7 text-center ring-1 ring-black/20">
              <div className="text-sm font-semibold text-zinc-300">월드 레코드를 불러오는 중입니다.</div>
              <div className="mt-1 text-xs text-zinc-500">기록의 전당을 정리하고 있습니다.</div>
            </div>
          )}
        </div>
      ) : null}

      {sub === "me" ? (
        <div className="grid gap-4">
          <FantasyPanel title="역대 최고 무기" className="space-y-3 border-amber-600/35 bg-[rgba(8,6,4,0.78)]">
            {bestWeaponSnapshotView ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-zinc-50">
                      {bestWeaponSnapshotView.weaponName}
                    </div>
                    <div className="mt-1 font-mono text-sm text-amber-200/85">
                      +{bestWeaponSnapshotView.enhanceLevel}
                      {bestWeaponSnapshotView.transcendLevel >= 1
                        ? ` · ★${bestWeaponSnapshotView.transcendLevel}`
                        : ""}{" "}
                      · 내구 {bestWeaponSnapshotView.durability}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-semibold text-zinc-500">랭킹 가치</div>
                    <div className="numeric-value mt-1 font-mono text-2xl font-black text-amber-300">
                      {formatGold(bestWeaponSnapshotView.rankingValue)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-amber-900/25 pt-3 text-xs text-zinc-500">
                  달성일 {achievedLabel}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-800/20 bg-zinc-950/45 p-4">
                <div className="text-sm font-semibold text-zinc-200">아직 기록 없음</div>
                <p className="mt-1 text-xs text-zinc-500">
                  강화를 진행해 첫 최고 기록을 남겨보세요.
                </p>
                <span className="numeric-value mt-3 block font-mono text-sm text-amber-200/80">
                  역대 최고 가치(참고):{" "}
                  {formatGold(recordsView.personalBestRankingValue)}
                </span>
              </div>
            )}
          </FantasyPanel>

          <FantasyPanel title="판매 실적" className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label="최고 단일 판매가" value={formatGold(recordsView.bestSaleGold)} mono />
            <StatRow label="총 판매 골드" value={formatGold(recordsView.totalSalesGold)} mono />
            <StatRow label="판매한 무기 수" value={formatInt(recordsView.soldWeaponCount)} mono />
          </FantasyPanel>

          <FantasyPanel title="강화 통계" className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label="강화 시도" value={formatInt(recordsView.totalEnhanceAttempts)} mono />
            <StatRow label="강화 성공" value={formatInt(recordsView.totalEnhanceSuccesses)} mono />
            <StatRow label="강화 실패" value={formatInt(recordsView.enhanceFailCount)} mono />
            <StatRow label="강화 파괴" value={formatInt(recordsView.enhanceDestroyedCount)} mono />
            <StatRow label="파괴한 무기 (전체)" value={formatInt(recordsView.destroyedWeaponCount)} mono accent />
            <StatRow label="성공률" value={`${enhanceRate}%`} mono />
            <StatRow label="역대 최고 강화 단계" value={`+${recordsView.maxEnhanceLevel}`} mono />
          </FantasyPanel>

          <FantasyPanel title="초월 통계" className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
            <StatRow label="초월 시도" value={formatInt(recordsView.transcendAttemptCount)} mono />
            <StatRow label="초월 성공" value={formatInt(recordsView.transcendSuccessCount)} mono />
            <StatRow label="초월 실패" value={formatInt(recordsView.transcendFailCount)} mono />
            <StatRow label="최고 초월" value={`★${recordsView.maxTranscendLevel}`} mono accent />
            <StatRow
              label="초월 무기 최고 가치"
              value={formatGold(recordsView.bestTranscendedWeaponValue)}
              mono
            />
            <StatRow label="초월 실패 파괴" value={formatInt(recordsView.transcendDestroyedCount)} mono accent />
          </FantasyPanel>

          <FantasyPanel title="제련로 통계" className="space-y-2.5 border-amber-700/25 bg-[rgba(8,6,4,0.74)] text-sm">
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
    <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-zinc-800/80 pt-3 text-xs">
      <span className="min-w-0 text-zinc-500">보유자</span>
      <span className="flex min-w-0 max-w-[220px] items-center justify-end gap-2 text-right font-medium text-zinc-200">
        <span className="truncate">{name}</span>
        {isPlayer ? (
          <StatusBadge tone="ranking" className="px-1.5">
            나
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
        className={`stat-value ${mono ? "font-mono text-zinc-100" : "text-zinc-200"}`}
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
          <div className="text-sm font-semibold text-zinc-200">아직 기록 없음</div>
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
