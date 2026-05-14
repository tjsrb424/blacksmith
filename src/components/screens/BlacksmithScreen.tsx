"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DurabilityIcons } from "@/components/ui/DurabilityIcons";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { WeaponImage } from "@/components/ui/WeaponImage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BlacksmithResultFx } from "@/components/effects/BlacksmithResultFx";
import type { BlacksmithFxKind } from "@/components/effects/BlacksmithResultFx";
import { ForgeGlow, type ForgeAuraMode } from "@/components/effects/ForgeGlow";
import { CURRENCY_ICONS } from "@/data/assets";
import {
  formatGold,
  formatInt,
  formatPercent,
} from "@/lib/format";
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
import { useLocale } from "@/lib/i18n/useLocale";
import {
  getWeaponDisplayName,
  getWeaponGradeLabel,
} from "@/lib/i18n/weaponText";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

export function BlacksmithScreen() {
  useRenderDiagnostics("BlacksmithScreen");
  const { locale, t } = useLocale();
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
  const enhanceWaitMessage = useGameStore((s) => s.serverActionMessage);
  const serverActionPending = useGameStore((s) => s.serverActionPending);

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

  const stageWeaponName = def
    ? getWeaponDisplayName(locale, def)
    : t("blacksmith.noWeapon");
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
  const isLastWeapon = owned.length <= 1;
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
    <div className="relative flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-xl border border-amber-900/35 bg-[linear-gradient(180deg,rgba(28,15,8,0.2),rgba(0,0,0,0.14))] p-2 ring-1 ring-inset ring-amber-900/25 backdrop-blur-[2px] sm:min-h-[220px] sm:gap-2 sm:p-2.5">
      <BlacksmithResultFx kind={stageFx} burstKey={fxSession} />
      <div className="relative flex w-full flex-col items-center justify-center">
        {!def || !equipped ? (
          <>
            <p className="text-base font-medium text-zinc-300">
              {t("blacksmith.noEquippedWeapon")}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {t("blacksmith.buyWeaponPrompt")}
            </p>
            <FantasyButton className="mt-4 min-h-12" onClick={() => setTab("shop")}>
              {t("shop.goToShop")}
            </FantasyButton>
          </>
        ) : (
          <>
            <div className="relative flex h-[min(26vw,102px)] w-full max-w-[178px] items-center justify-center sm:h-[min(34vw,178px)] sm:max-w-[250px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <ForgeGlow
                  mode={auraMode === "idle" ? "neutral" : auraMode}
                  className="h-[112px] w-[112px] sm:h-44 sm:w-44"
                  showRing={false}
                />
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
                  alt={stageWeaponName}
                  className="relative z-10 max-h-[min(21vw,82px)] w-auto object-contain drop-shadow-[0_0_22px_rgba(251,146,60,0.42)] sm:max-h-[145px]"
                />
              </motion.div>
            </div>
            <div className="mt-1 flex min-h-[42px] max-w-full flex-col items-center justify-start text-center">
              <div className="max-w-full truncate px-2 text-sm font-bold leading-tight text-amber-50 drop-shadow-[0_1px_6px_rgba(0,0,0,0.72)] sm:text-base">
                {stageWeaponName}
              </div>
              <motion.div
                className="font-mono text-xs leading-tight text-amber-200/90 sm:text-sm"
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
                <StatusBadge tone="ranking" className="mt-1 px-1.5 text-[9px]">
                  {t("ranking.recordCandidate")}
                </StatusBadge>
              ) : null}
              {isMaxEnhance && transcendLevel === 0 ? (
                <StatusBadge tone="transcend" className="mt-1.5">
                  {t("transcend.available")}
                </StatusBadge>
              ) : null}
              {isMaxEnhance && transcendLevel >= 10 ? (
                <StatusBadge tone="recommended" className="mt-1.5">
                  {t("transcend.maxReached")}
                </StatusBadge>
              ) : null}
              {durability <= 1 && equipped && equipped.durability > 0 ? (
                <p className="mt-1 rounded-lg border border-red-500/24 bg-red-950/42 px-2.5 py-1 text-[10px] font-semibold text-red-200 ring-1 ring-red-500/18">
                  {t("enhance.destroyRisk")}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const infoPanel = (
    <FantasyPanel title={t("blacksmith.weaponInfo")} className="h-full p-2 [&>h3]:mb-1">
      {!def || !equipped ? (
        <p className="text-sm text-zinc-400">
          {t("blacksmith.equipOrBuyPrompt")}
        </p>
      ) : (
        <dl className="space-y-1 text-xs sm:text-sm">
          <div className="stat-row">
            <dt className="text-zinc-500">{t("weapon.grade")}</dt>
            <dd className="text-zinc-100">
              {getWeaponGradeLabel(locale, def.grade)}
            </dd>
          </div>
          <div className="stat-row">
            <dt className="text-zinc-500">{t("weapon.durability")}</dt>
            <dd className="flex items-center justify-end gap-2">
              <DurabilityIcons value={durability} emphasizeCritical />
            </dd>
          </div>
          <div className="stat-row">
            <dt className="text-zinc-500">{t("inventory.salePrice")}</dt>
            <dd className="numeric-value font-mono text-sky-300">{formatGold(saleGold)}</dd>
          </div>
          <div className="stat-row">
            <dt className="text-zinc-500">{t("ranking.score.rankingValue")}</dt>
            <dd className="numeric-value font-mono text-zinc-400">{formatGold(rankingVal)}</dd>
          </div>
        </dl>
      )}
    </FantasyPanel>
  );

  const enhancePanel = (
    <FantasyPanel title={t("enhance.title")} className="h-full p-2 [&>h3]:mb-1">
      {def && equipped ? (
        <div className="space-y-2">
          {!isMaxEnhance ? (
            <>
              <dl className="space-y-1 text-xs sm:text-sm">
                <div className="stat-row">
                  <dt className="text-zinc-500">{t("enhance.nextLevel")}</dt>
                  <dd className="numeric-value font-mono text-zinc-100">+{targetLevel}</dd>
                </div>
                <div className="stat-row">
                  <dt className="text-zinc-500">{t("enhance.successRate")}</dt>
                  <dd className="numeric-value font-mono text-emerald-300">
                    {formatPercent(successRate)}
                  </dd>
                </div>
                <div className="stat-row">
                  <dt className="text-zinc-500">{t("enhance.cost")}</dt>
                  <dd className="flex min-w-0 items-center justify-end text-amber-200">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={CURRENCY_ICONS.ember}
                        alt=""
                        draggable={false}
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                      <span className="numeric-value font-mono">{formatInt(cost)}</span>
                    </span>
                  </dd>
                </div>
                <div className="stat-row">
                  <dt className="text-zinc-500">{t("enhance.onFail")}</dt>
                  <dd className="whitespace-nowrap text-right text-[11px] text-zinc-300">
                    {failDurability
                      ? t("enhance.durabilityMinusProtected")
                      : t("enhance.durabilityKept")}
                  </dd>
                </div>
              </dl>
              {isEnhancing ? (
                <div className="rounded-xl border border-amber-600/45 bg-gradient-to-br from-amber-950/55 to-zinc-950/40 px-4 py-3 text-center ring-1 ring-amber-500/25">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/95">
                    {targetLevel >= 8 ? t("enhance.forging") : t("enhance.enhancing")}
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
                  {enhanceWaitMessage ? (
                    <p className="mt-2 text-[11px] font-medium text-amber-100/65">
                      {enhanceWaitMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <FantasyButton
                className="enhance-button min-h-[52px] w-full overflow-hidden rounded-xl border border-amber-300/45 bg-[linear-gradient(180deg,rgba(254,215,114,0.82)_0%,rgba(217,119,6,0.94)_46%,rgba(124,45,18,0.98)_100%)] px-3 py-2 text-base shadow-[0_0_28px_rgba(245,158,11,0.36),0_10px_24px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,251,235,0.45),inset_0_-12px_22px_rgba(69,26,3,0.32)] ring-1 ring-amber-200/35 hover:bg-[linear-gradient(180deg,rgba(254,226,150,0.92)_0%,rgba(234,137,16,0.97)_48%,rgba(146,64,14,1)_100%)] focus-visible:ring-2 focus-visible:ring-amber-200/90"
                disabled={
                  !equipped ||
                  !canAffordEnhance ||
                  isEnhancing ||
                  serverActionPending
                }
                onClick={() => requestEnhance()}
              >
                <span
                  className="enhance-button__label text-[18px] font-black leading-none tracking-wide drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]"
                  style={{ color: "#fff7e8" }}
                >
                  {durability <= 1 && failDurability ? t("enhance.riskyAction") : t("enhance.action")}
                </span>
              </FantasyButton>
            </>
          ) : (
            <div className="rounded-lg bg-zinc-900/60 p-3 text-center text-sm text-zinc-400 ring-1 ring-amber-900/40">
              {t("enhance.maxLevel")}
            </div>
          )}
        </div>
      ) : (
        <FantasyButton className="min-h-12 w-full" onClick={() => setTab("shop")}>
          {t("shop.buyWeapon")}
        </FantasyButton>
      )}
    </FantasyPanel>
  );

  const transcendPanel = (
    <FantasyPanel
      title={t("transcend.title")}
      className={`h-full ${isMaxEnhance ? "ring-1 ring-violet-600/30" : ""}`}
    >
      {def && equipped && isMaxEnhance ? (
        transcendLevel >= 10 ? (
          <div className="space-y-3 text-center text-sm text-zinc-400">
            <p className="font-semibold text-amber-100/90">{t("transcend.maxReached")}</p>
            <p className="text-xs">{t("transcend.noMore")}</p>
            <FantasyButton
              variant="danger"
              className="min-h-12 w-full focus-visible:ring-2 focus-visible:ring-amber-400/80"
              disabled={durability <= 0 || isEnhancing || isLastWeapon || serverActionPending}
              title={
                isLastWeapon
                  ? t("inventory.lastWeaponCannotSellLong")
                  : undefined
              }
              onClick={() => requestSellEquipped()}
            >
              {t("inventory.sell")}
            </FantasyButton>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="stat-row">
                <dt className="text-zinc-500">{t("common.current")}</dt>
                <dd className="numeric-value font-mono text-violet-200">
                  ★{transcendLevel}
                </dd>
              </div>
              <div className="stat-row">
                <dt className="text-zinc-500">{t("common.next")}</dt>
                <dd className="numeric-value font-mono text-fuchsia-200">★{nextStar}</dd>
              </div>
              <div className="stat-row">
                <dt className="text-zinc-500">{t("enhance.successRate")}</dt>
                <dd className="numeric-value font-mono text-emerald-300">
                  {formatPercent(nextTranscendRate)}
                </dd>
              </div>
              <div className="stat-row">
                <dt className="text-zinc-500">{t("transcend.requiredStone")}</dt>
                <dd className="numeric-value font-mono text-violet-200">
                  {t("transcend.stoneOwned", { cost: formatInt(nextTranscendCost), owned: formatInt(transcendStone) })}
                </dd>
              </div>
              <div className="stat-row">
                <dt className="text-zinc-500">{t("enhance.onFail")}</dt>
                <dd className="whitespace-nowrap text-right text-xs text-zinc-400">{t("transcend.failEffect")}</dd>
              </div>
              <div className="stat-row border-t border-zinc-800 pt-2">
                <dt className="text-zinc-500">{t("transcend.expectedRankingValue")}</dt>
                <dd className="numeric-value font-mono text-xs text-emerald-300/95">
                  {formatGold(previewNext)}
                </dd>
              </div>
            </dl>
            {durability <= 1 ? (
              <p className="rounded-lg bg-red-950/35 p-2 text-[11px] leading-relaxed text-red-200 ring-1 ring-red-500/30">
                {t("transcend.destroyRisk")}
              </p>
            ) : null}
            <FantasyButton
              className="min-h-14 w-full border-violet-400/35 bg-gradient-to-b from-violet-600 to-indigo-950 text-amber-50 shadow-[0_0_20px_rgba(139,92,246,0.35)] ring-1 ring-violet-400/40 hover:from-violet-500 hover:to-indigo-900 focus-visible:ring-2 focus-visible:ring-violet-300/90"
              disabled={!canTranscend || durability <= 0 || isEnhancing || serverActionPending}
              onClick={() => requestTranscend()}
            >
              {!canTranscend
                ? transcendStone < nextTranscendCost
                  ? t("transcend.notEnoughStone")
                  : t("transcend.unavailable")
                : t("transcend.action")}
            </FantasyButton>
          </div>
        )
      ) : (
        <p className="text-sm text-zinc-500">
          {t("transcend.availableAfter")}
        </p>
      )}
    </FantasyPanel>
  );

  return (
    <div className="relative mx-auto flex w-full flex-1 flex-col gap-3 px-3 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)] pt-3">
      <ScreenBackground screen="blacksmith" />

      <div className="relative z-10 grid grid-cols-1 gap-3">
        <div className="order-2">{infoPanel}</div>
        <div className="order-1">{mainColumn}</div>
        <div className="order-3 flex flex-col gap-3">
          {enhancePanel}
          {transcendPanel}
        </div>
      </div>

      {def && equipped ? (
        <div className="relative z-10 order-last flex flex-col gap-2 border-t border-zinc-800/70 pt-4">
            <FantasyButton
              variant="danger"
              className="min-h-12 flex-1 focus-visible:ring-2 focus-visible:ring-amber-400/80"
              disabled={
                !equipped ||
                durability <= 0 ||
                isEnhancing ||
                isLastWeapon ||
                serverActionPending
              }
              title={
                isLastWeapon
                  ? t("inventory.lastWeaponCannotSellLong")
                  : undefined
              }
              onClick={() => requestSellEquipped()}
            >
            {t("inventory.sell")}
          </FantasyButton>
          <FantasyButton
            variant="ghost"
            className="min-h-12 flex-1 text-xs text-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500"
            disabled={isEnhancing || serverActionPending}
            onClick={() => setTab("shop")}
          >
            {t("shop.goToShop")}
          </FantasyButton>
        </div>
      ) : null}
    </div>
  );
}
