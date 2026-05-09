"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DurabilityIcons } from "@/components/ui/DurabilityIcons";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { WeaponImage } from "@/components/ui/WeaponImage";
import { BlacksmithResultFx } from "@/components/effects/BlacksmithResultFx";
import type { BlacksmithFxKind } from "@/components/effects/BlacksmithResultFx";
import { ForgeGlow, type ForgeAuraMode } from "@/components/effects/ForgeGlow";
import { gradeLabel } from "@/lib/labels";
import { formatGold, formatInt, formatPercent } from "@/lib/format";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateSaleGold } from "@/lib/economy";
import { calculateRankingValue } from "@/lib/ranking";
import { durabilityLossOnFail } from "@/data/balance";
import {
  getEnhanceCostEmber,
  getEnhanceSuccessRate,
} from "@/lib/enhancement";
import {
  canTranscendWeapon,
  getTranscendStoneCost,
  getTranscendSuccessRate,
} from "@/lib/transcend";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/cn";

export function BlacksmithScreen() {
  const modal = useGameStore((s) => s.modal);
  const equippedId = useGameStore((s) => s.equippedWeaponId);
  const owned = useGameStore((s) => s.ownedWeapons);
  const requestEnhance = useGameStore((s) => s.requestEnhanceEquipped);
  const requestTranscend = useGameStore((s) => s.requestTranscendEquipped);
  const requestSellEquipped = useGameStore((s) => s.requestSellEquipped);
  const setTab = useGameStore((s) => s.setActiveTab);
  const transcendStone = useGameStore((s) => s.transcendStone);
  const ember = useGameStore((s) => s.ember);
  const records = useGameStore((s) => s.records);
  const isEnhancing = useGameStore((s) => s.isEnhancing);
  const hammerPhase = useGameStore((s) => s.enhanceHammerPhase);

  const [stageFx, setStageFx] = useState<BlacksmithFxKind>("idle");
  const [fxSession, setFxSession] = useState(0);

  useEffect(() => {
    if (!modal) {
      const id = requestAnimationFrame(() => setStageFx("idle"));
      return () => cancelAnimationFrame(id);
    }
    const k = modal.kind;
    let fx: BlacksmithFxKind = "idle";
    if (k === "enhance_success") fx = "enhance_ok";
    else if (k === "enhance_fail") fx = "enhance_fail";
    else if (k === "weapon_destroyed") fx = "destroy";
    else if (k === "transcend_success") fx = "transcend_ok";
    else if (k === "transcend_fail") fx = "transcend_fail";
    if (fx === "idle") return;
    const tick = window.setTimeout(() => {
      setFxSession((s) => s + 1);
      setStageFx(fx);
    }, 0);
    const reset = window.setTimeout(() => setStageFx("idle"), 1050);
    return () => {
      window.clearTimeout(tick);
      window.clearTimeout(reset);
    };
  }, [modal]);

  const equipped = owned.find((w) => w.instanceId === equippedId) ?? null;
  const def = equipped ? WEAPONS_BY_ID[equipped.weaponId] : null;

  const stageWeaponName = def?.name ?? "무기 없음";
  const enhanceLevel = equipped?.enhanceLevel ?? 0;
  const transcendLevel = equipped?.transcendLevel ?? 0;
  const durability = equipped?.durability ?? 0;

  const targetLevel = enhanceLevel + 1;
  const cost =
    def && equipped && enhanceLevel < 15
      ? getEnhanceCostEmber(def, targetLevel)
      : 0;
  const successRate =
    def && enhanceLevel < 15 ? getEnhanceSuccessRate(targetLevel) : 0;
  const canAffordEnhance = def && enhanceLevel < 15 ? ember >= cost : false;
  const saleGold =
    def && equipped ? calculateSaleGold(def, equipped) : 0;
  const rankingVal =
    def && equipped ? calculateRankingValue(def, equipped) : 0;
  const failDurability =
    def && enhanceLevel < 15
      ? durabilityLossOnFail(targetLevel)
      : false;

  const isMaxEnhance = enhanceLevel >= 15;
  const canTranscend =
    def && equipped
      ? canTranscendWeapon(def, equipped, transcendStone)
      : false;
  const nextTranscendCost =
    def && equipped && isMaxEnhance && transcendLevel < 10
      ? getTranscendStoneCost(transcendLevel)
      : 0;
  const nextTranscendRate =
    def && equipped && isMaxEnhance && transcendLevel < 10
      ? getTranscendSuccessRate(transcendLevel)
      : 0;
  const nextStar = transcendLevel + 1;
  const previewNext =
    def && equipped && isMaxEnhance && transcendLevel < 10
      ? calculateRankingValue(def, { ...equipped, transcendLevel: nextStar })
      : rankingVal;

  let auraMode: ForgeAuraMode = "idle";
  if (def && equipped) {
    if (durability <= 1 && failDurability && enhanceLevel < 15) auraMode = "danger";
    else if (isMaxEnhance && transcendLevel >= 10) auraMode = "maxStar";
    else if (isMaxEnhance && transcendLevel < 10) auraMode = "transcend";
    else auraMode = "neutral";
  }

  const rankingCandidate =
    def && equipped && rankingVal >= records.personalBestRankingValue * 0.98;

  const weaponMotion =
    stageFx === "enhance_ok"
      ? { scale: [1, 1.08, 1], transition: { duration: 0.55 } }
      : stageFx === "enhance_fail"
        ? {
            x: [0, -7, 7, -5, 5, 0],
            transition: { duration: 0.48 },
          }
        : stageFx === "destroy"
          ? { opacity: [1, 0.35, 1], transition: { duration: 0.85 } }
          : stageFx === "transcend_ok"
            ? { scale: [1, 1.06, 1], rotate: [0, 2, -2, 0], transition: { duration: 0.6 } }
            : stageFx === "transcend_fail"
              ? {
                  x: [0, -6, 6, 0],
                  transition: { duration: 0.45 },
                }
              : {};

  const forgeBusyMotion =
    isEnhancing && hammerPhase > 0
      ? {
          scale: [1, 1 + hammerPhase * 0.028, 1],
          x: [0, hammerPhase * 1.8, -hammerPhase * 1.8, 0],
          transition: { duration: 0.14 },
        }
      : weaponMotion;

  const mainColumn = (
    <div className="relative flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl border border-amber-900/35 bg-[rgba(0,0,0,0.14)] p-3 ring-1 ring-inset ring-amber-900/25 backdrop-blur-[2px] sm:min-h-[300px] sm:p-4">
      <BlacksmithResultFx kind={stageFx} burstKey={fxSession} />
      <div className="relative flex w-full flex-col items-center justify-center">
        {!def || !equipped ? (
          <>
            <p className="text-base font-medium text-zinc-300">
              장착한 무기가 없습니다.
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              상점에서 무기를 구매해 강화해보세요.
            </p>
            <FantasyButton className="mt-4 min-h-12" onClick={() => setTab("shop")}>
              무기상점으로
            </FantasyButton>
          </>
        ) : (
          <>
            <div className="relative flex h-[min(58vw,340px)] w-full max-w-[340px] items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center">
                <ForgeGlow mode={auraMode === "idle" ? "neutral" : auraMode} />
              </div>
              <motion.div
                className={cn(
                  "relative z-10 flex flex-col items-center px-4",
                  def &&
                    equipped &&
                    durability <= 1 &&
                    failDurability &&
                    enhanceLevel < 15 &&
                    "motion-safe:animate-pulse rounded-2xl ring-2 ring-red-500/40 ring-offset-2 ring-offset-transparent",
                )}
                animate={forgeBusyMotion}
              >
                <WeaponImage
                  src={def.imagePath}
                  alt={def.name}
                  className="relative z-10 max-h-[min(52vw,220px)] w-auto object-contain drop-shadow-[0_0_28px_rgba(251,146,60,0.45)] sm:max-h-[240px]"
                />
              </motion.div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-50">{stageWeaponName}</div>
              <motion.div
                className="mt-1 font-mono text-sm text-amber-200/90"
                animate={
                  stageFx === "enhance_ok"
                    ? { scale: [1, 1.15, 1], color: ["#fde68a", "#fef08a", "#fde68a"] }
                    : {}
                }
                transition={{ duration: 0.45 }}
              >
                +{enhanceLevel}
                {transcendLevel >= 1 ? ` ★${transcendLevel}` : ""}
              </motion.div>
              {rankingCandidate ? (
                <span className="mt-2 inline-block rounded-full bg-indigo-600/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-100 ring-1 ring-indigo-400/40">
                  기록 후보
                </span>
              ) : null}
              {isMaxEnhance && transcendLevel === 0 ? (
                <span className="mt-2 inline-block rounded-full bg-violet-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200 ring-1 ring-violet-500/45">
                  초월 가능
                </span>
              ) : null}
              {isMaxEnhance && transcendLevel >= 10 ? (
                <span className="mt-2 inline-block rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-100 ring-1 ring-amber-400/55">
                  최종 초월 달성
                </span>
              ) : null}
              {durability <= 1 && equipped && equipped.durability > 0 ? (
                <p className="mt-3 rounded-lg bg-red-950/45 px-3 py-1.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-500/35">
                  위험: 다음 실패 시 파괴 가능
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const infoPanel = (
    <FantasyPanel title="무기 정보" className="h-full">
      {!def || !equipped ? (
        <p className="text-sm text-zinc-400">
          장착한 무기가 없습니다. 보관함에서 장착하거나 상점에서 구매하세요.
        </p>
      ) : (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">등급</dt>
            <dd className="text-zinc-100">{gradeLabel(def.grade)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">내구도</dt>
            <dd className="flex items-center gap-2">
              <DurabilityIcons value={durability} emphasizeCritical />
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">판매가</dt>
            <dd className="font-mono text-sky-300">{formatGold(saleGold)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">랭킹 가치</dt>
            <dd className="font-mono text-zinc-400">{formatGold(rankingVal)}</dd>
          </div>
        </dl>
      )}
    </FantasyPanel>
  );

  const enhancePanel = (
    <FantasyPanel title="강화" className="h-full">
      {def && equipped ? (
        <div className="space-y-4">
          {!isMaxEnhance ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">다음 단계</dt>
                  <dd className="font-mono text-zinc-100">+{targetLevel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">성공률</dt>
                  <dd className="font-mono text-emerald-300">
                    {formatPercent(successRate)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">비용</dt>
                  <dd className="font-mono text-amber-200">
                    {formatInt(cost)} 불씨
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">실패 시</dt>
                  <dd className="text-xs text-zinc-300">
                    {failDurability
                      ? "내구도 -1 (+8 이상 구간)"
                      : "내구도 유지 (+0~+7)"}
                  </dd>
                </div>
              </dl>
              {isEnhancing ? (
                <div className="rounded-xl border border-amber-600/45 bg-gradient-to-br from-amber-950/55 to-zinc-950/40 px-4 py-3 text-center ring-1 ring-amber-500/25">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/95">
                    {targetLevel >= 8 ? "제련 중..." : "강화중..."}
                  </div>
                  <div className="mt-2 flex justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.55)] motion-safe:animate-pulse"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <FantasyButton
                className="min-h-14 w-full text-base focus-visible:ring-2 focus-visible:ring-amber-400/80"
                disabled={!equipped || !canAffordEnhance || isEnhancing}
                onClick={() => requestEnhance()}
              >
                {!canAffordEnhance
                  ? "불씨 부족"
                  : durability <= 1 && failDurability
                    ? "위험 강화"
                    : "강화하기"}
              </FantasyButton>
            </>
          ) : (
            <div className="rounded-lg bg-zinc-900/60 p-3 text-center text-sm text-zinc-400 ring-1 ring-amber-900/40">
              최대 강화 달성 (+15)
            </div>
          )}
        </div>
      ) : (
        <FantasyButton className="min-h-12 w-full" onClick={() => setTab("shop")}>
          무기 구매하기
        </FantasyButton>
      )}
    </FantasyPanel>
  );

  const transcendPanel = (
    <FantasyPanel
      title="초월"
      className={`h-full ${isMaxEnhance ? "ring-1 ring-violet-600/30" : ""}`}
    >
      {def && equipped && isMaxEnhance ? (
        transcendLevel >= 10 ? (
          <div className="space-y-3 text-center text-sm text-zinc-400">
            <p className="font-semibold text-amber-100/90">최종 초월 달성</p>
            <p className="text-xs">★10 — 더 이상 초월할 수 없습니다.</p>
            <FantasyButton
              variant="accent"
              className="min-h-12 w-full focus-visible:ring-2 focus-visible:ring-amber-400/80"
              disabled={durability <= 0 || isEnhancing}
              onClick={() => requestSellEquipped()}
            >
              판매하기
            </FantasyButton>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">현재</dt>
                <dd className="font-mono text-violet-200">
                  ★{transcendLevel}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">다음</dt>
                <dd className="font-mono text-fuchsia-200">★{nextStar}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">성공률</dt>
                <dd className="font-mono text-emerald-300">
                  {formatPercent(nextTranscendRate)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">필요 초월석</dt>
                <dd className="font-mono text-violet-200">
                  {formatInt(nextTranscendCost)}개 (보유 {formatInt(transcendStone)})
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">실패 시</dt>
                <dd className="text-xs text-zinc-400">내구도 -1 · 단계 유지</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                <dt className="text-zinc-500">예상 랭킹 가치</dt>
                <dd className="font-mono text-xs text-emerald-300/95">
                  {formatGold(previewNext)}
                </dd>
              </div>
            </dl>
            {durability <= 1 ? (
              <p className="rounded-lg bg-red-950/35 p-2 text-[11px] leading-relaxed text-red-200 ring-1 ring-red-500/30">
                다음 실패 시 파괴 위험 — 내구도가 1입니다.
              </p>
            ) : null}
            <FantasyButton
              className="min-h-14 w-full bg-gradient-to-b from-violet-600 to-indigo-950 text-amber-50 shadow-[0_0_20px_rgba(139,92,246,0.35)] ring-1 ring-violet-400/40 hover:from-violet-500 hover:to-indigo-900 focus-visible:ring-2 focus-visible:ring-violet-300/90"
              disabled={!canTranscend || durability <= 0 || isEnhancing}
              onClick={() => requestTranscend()}
            >
              {!canTranscend
                ? transcendStone < nextTranscendCost
                  ? "초월석 부족"
                  : "초월 불가"
                : "초월하기"}
            </FantasyButton>
          </div>
        )
      ) : (
        <p className="text-sm text-zinc-500">
          +15 강화 후 초월을 시도할 수 있습니다.
        </p>
      )}
    </FantasyPanel>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-3 pb-28 pt-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:px-6 lg:pb-10 lg:pt-6 xl:gap-7">
      <ScreenBackground screen="blacksmith" />

      <div className="relative z-10 grid grid-cols-1 gap-4 lg:col-span-3 lg:grid-cols-3 lg:gap-5 xl:gap-7">
        <div className="order-2 lg:order-none">{infoPanel}</div>
        <div className="order-1 lg:order-none">{mainColumn}</div>
        <div className="order-3 flex flex-col gap-4 lg:order-none">
          {enhancePanel}
          {transcendPanel}
        </div>
      </div>

      {def && equipped ? (
        <div className="relative z-10 order-last col-span-full flex flex-col gap-2 border-t border-zinc-800/70 pt-4 lg:flex-row">
            <FantasyButton
              variant="accent"
              className="min-h-12 flex-1 focus-visible:ring-2 focus-visible:ring-amber-400/80"
              disabled={!equipped || durability <= 0 || isEnhancing}
              onClick={() => requestSellEquipped()}
            >
            판매하기
          </FantasyButton>
          <FantasyButton
            variant="ghost"
            className="min-h-12 flex-1 text-xs text-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500"
            disabled={isEnhancing}
            onClick={() => setTab("shop")}
          >
            무기 상점으로
          </FantasyButton>
        </div>
      ) : null}
    </div>
  );
}
