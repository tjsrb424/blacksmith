"use client";

import { useEffect, useRef } from "react";
import type { ModalPayload, RecordBreakInfo } from "@/types/game";
import { AnimatePresence, motion } from "framer-motion";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { formatGold, formatInt } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";
import { ScreenShake } from "@/components/effects/ScreenShake";
import { DurabilityIcons } from "@/components/ui/DurabilityIcons";
import type { ModalTone } from "@/components/modals/modalTone";
import {
  getModalShellClass,
  getModalToneFromPayload,
  getModalFrameArtPath,
} from "@/components/modals/modalTone";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/useLocale";
import {
  getWeaponDisplayName,
  getWeaponDisplayNameById,
} from "@/lib/i18n/weaponText";
import { playSound } from "@/lib/sound";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { EFFECT_ASSETS } from "@/data/assets";
import { getGameMode } from "@/lib/supabase/env";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { AdRewardStatusText } from "@/components/ads/AdRewardStatusText";
import { useIsCrazyGamesMode } from "@/lib/distributionContext";

type TranslationFn = ReturnType<typeof useLocale>["t"];

function formatOfflineDurationLabel(ms: number, t: TranslationFn): string {
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return t("time.hoursMinutes", { hours, minutes });
  }
  if (hours > 0) {
    return t("time.hours", { hours });
  }
  return t("time.minutes", { minutes: totalMinutes });
}

function RecordBreakBanner({ rb }: { rb: RecordBreakInfo }) {
  const { t } = useLocale();

  return (
    <div className="rounded-xl bg-gradient-to-r from-violet-950/80 to-indigo-950/80 p-4 text-sm ring-1 ring-violet-500/40">
      <div className="font-bold text-violet-200">{t("records.newRecord")}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rb.isPersonalBest ? (
          <span className="rounded-full bg-amber-500/18 px-2 py-0.5 text-[11px] font-bold text-amber-100 ring-1 ring-amber-400/30">
            {t("records.personalBestUpdated")}
          </span>
        ) : null}
        {rb.isWeeklyTop100 ? (
          <span className="rounded-full bg-emerald-500/18 px-2 py-0.5 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-400/30">
            {t("records.weeklyTopEntered")}
          </span>
        ) : null}
      </div>
      {rb.isPersonalBest ? (
      <p className="mt-1 text-xs text-violet-300/90">
          {t("records.personalBestChange", { previous: formatGold(rb.previousBest) })}{" "}
          <span className="font-mono text-violet-100">{formatGold(rb.newBest)}</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-violet-300/90">
          {t("records.currentRankingValue")}{" "}
          <span className="font-mono text-violet-100">{formatGold(rb.newBest)}</span>
        </p>
      )}
      {rb.isPersonalBest && rb.delta != null && rb.delta > 0 ? (
        <p className="mt-2 font-mono text-xs text-emerald-400/95">
          {t("records.valueIncrease", { value: formatGold(rb.delta) })}
        </p>
      ) : null}
      {rb.estimatedWeeklyRank != null && rb.isWeeklyTop100 ? (
        <p className="mt-2 text-xs text-zinc-300">
          {t("records.estimatedWeeklyRank")}{" "}
          <span className="font-mono font-semibold text-amber-200">
            {t("ranking.rankPosition", { rank: rb.estimatedWeeklyRank })}
          </span>
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">
        {t("records.weeklyCandidateRegistered")}
      </p>
    </div>
  );
}

function ModalFrameBackdrop({ tone }: { tone: ModalTone }) {
  const src = getModalFrameArtPath(tone);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full max-h-full object-fill object-center opacity-[0.2]"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/40" />
    </div>
  );
}

function isResultModal(modal: ModalPayload): boolean {
  return (
    modal.kind === "enhance_success" ||
    modal.kind === "enhance_fail" ||
    modal.kind === "weapon_destroyed" ||
    modal.kind === "transcend_success" ||
    modal.kind === "transcend_fail" ||
    modal.kind === "sell_success" ||
    modal.kind === "forge_collect_complete" ||
    modal.kind === "forge_upgrade_success" ||
    modal.kind === "offline_forge_reward" ||
    modal.kind === "season_started"
  );
}

function ModalToneEffects({ modal }: { modal: ModalPayload }) {
  if (modal.kind === "forge_collect_complete") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EFFECT_ASSETS.emberBurst}
          alt=""
          draggable={false}
          className="absolute -bottom-10 left-1/2 h-32 w-[105%] max-w-none -translate-x-1/2 object-contain opacity-[0.24] mix-blend-screen"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EFFECT_ASSETS.successFlash}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
        />
      </div>
    );
  }

  if (modal.kind === "offline_forge_reward") {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EFFECT_ASSETS.forgeGlow}
          alt=""
          draggable={false}
          className="absolute -bottom-14 left-1/2 h-44 w-[120%] -translate-x-1/2 object-contain opacity-[0.22] mix-blend-screen"
        />
      </div>
    );
  }

  const tone = getModalToneFromPayload(modal);

  switch (tone) {
    case "success":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EFFECT_ASSETS.successFlash}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-[0.1]"
          />
        </div>
      );
    case "fail":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EFFECT_ASSETS.failSmoke}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-[0.06]"
          />
        </div>
      );
    case "destruction":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EFFECT_ASSETS.destructionCrack}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-[0.12]"
          />
        </div>
      );
    case "transcend":
    case "transcendFail":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EFFECT_ASSETS.transcendAura}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-[0.09]"
          />
        </div>
      );
    case "record":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(167,139,250,0.14),transparent_58%)]" />
        </div>
      );
    default:
      return null;
  }
}

export function ModalRoot() {
  useRenderDiagnostics("ModalRoot");
  const { locale, t } = useLocale();
  const isCrazyGamesMode = useIsCrazyGamesMode();
  const modal = useGameStore((s) => s.modal);
  const serverActionPending = useGameStore((s) => s.serverActionPending);
  const prevModalRef = useRef(modal);
  useEffect(() => {
    const prev = prevModalRef.current;
    if (modal && !prev) {
      playSound("uiModalOpen");
    } else if (!modal && prev) {
      playSound("uiModalClose");
    }
    prevModalRef.current = modal;
  }, [modal]);

  const close = useGameStore((s) => s.closeModal);
  const reloadServerSnapshot = useGameStore((s) => s.reloadServerSnapshot);
  const commitEnhance = useGameStore((s) => s.prepareEnhanceRoll);
  const confirmBuy = useGameStore((s) => s.confirmBuyWeapon);
  const mockDoubleDestroyScrap = useGameStore((s) => s.mockDoubleDestroyScrap);
  const commitSell = useGameStore((s) => s.commitSell);
  const setTab = useGameStore((s) => s.setActiveTab);
  const collectForge = useGameStore((s) => s.collectForge);
  const confirmForgeUpgrade = useGameStore((s) => s.confirmForgeUpgrade);
  const commitTranscend = useGameStore((s) => s.commitTranscendEquipped);
  const requestSellEquipped = useGameStore((s) => s.requestSellEquipped);
  const requestTranscend = useGameStore((s) => s.requestTranscendEquipped);
  const acknowledgeSeasonStart = useGameStore((s) => s.acknowledgeSeasonStart);
  const isBetaMode = getGameMode() === "beta";
  const isRewardAdDisabled = getConfiguredAdProvider() === "disabled";
  const showRewardAds = !isCrazyGamesMode;
  const isTerminalAdState =
    modal?.kind === "ad_reward_progress" &&
    (modal.phase === "unavailable" ||
      modal.phase === "notCompleted" ||
      modal.phase === "completed");
  const shakeActive =
    modal?.kind === "enhance_fail" ||
    modal?.kind === "weapon_destroyed" ||
    modal?.kind === "transcend_fail";
  const shakePreset =
    modal?.kind === "weapon_destroyed"
      ? "heavy"
      : modal?.kind === "enhance_fail" || modal?.kind === "transcend_fail"
        ? "medium"
        : "medium";
  const isResult = modal ? isResultModal(modal) : false;

  return (
    <AnimatePresence>
      {modal ? (
        <motion.div
          className="game-no-select game-modal-overlay fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 items-end justify-center bg-black/62 p-2 backdrop-blur-[1px] sm:items-center sm:backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <ScreenShake
            active={shakeActive}
            preset={shakePreset}
            className={cn("flex w-full justify-center", isResult ? "max-w-[440px]" : "max-w-[406px]")}
          >
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className={cn(
                modal ? getModalShellClass(getModalToneFromPayload(modal)) : "",
                "relative max-h-[calc(100%-1rem)] min-w-0 w-full overflow-y-auto",
                isResult
                  ? "max-w-[440px] px-4 py-6 sm:px-5 sm:py-7"
                  : "max-w-[406px]",
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalFrameBackdrop tone={getModalToneFromPayload(modal)} />
              <ModalToneEffects modal={modal} />
              <div className="relative z-20 w-full min-w-0">
              {modal.kind === "server_error" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-red-100">
                    {modal.title
                      ? modal.title.includes(".")
                        ? t(modal.title)
                        : modal.title
                      : t("error.server")}
                  </h3>
                  <p className="text-sm text-zinc-300">
                    {modal.message.includes(".") ? t(modal.message) : modal.message}
                  </p>
                  <FantasyButton
                    variant="primary"
                    className="w-full"
                    onClick={() => void reloadServerSnapshot()}
                  >
                    {t("error.reloadServerData")}
                  </FantasyButton>
                  <FantasyButton variant="secondary" className="w-full" onClick={close}>
                    {t("common.confirm")}
                  </FantasyButton>
                </div>
              ) : modal.kind === "enhance_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">{t("modal.enhanceConfirm")}</h3>
                  <p className="text-sm text-zinc-300">
                    {t("modal.enhanceAttempt", { weapon: getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName), level: modal.targetLevel })}
                  </p>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>{t("enhance.successRate")}: {modal.successRatePercent.toFixed(1)}%</li>
                    <li>{t("modal.costEmber", { amount: formatInt(modal.costEmber) })}</li>
                    <li className="flex items-center gap-2">
                      {t("modal.currentDurability")}: <DurabilityIcons value={modal.currentDurability} />
                    </li>
                    <li>
                      {t("enhance.onFail")}:{" "}
                      {modal.durabilityLossOnFail
                        ? t("enhance.durabilityMinus")
                        : t("enhance.durabilityProtected")}
                    </li>
                  </ul>
                  {modal.currentDurability <= 1 && modal.durabilityLossOnFail ? (
                    <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
                      {t("enhance.nextFailMayDestroy")}
                    </p>
                  ) : null}
                  <div className="flex gap-2 pt-2">
                    <FantasyButton
                      variant="ghost"
                      className="flex-1"
                      disabled={serverActionPending}
                      onClick={close}
                    >
                      {t("common.cancel")}
                    </FantasyButton>
                    <FantasyButton className="flex-1" onClick={() => commitEnhance()}>
                      {modal.currentDurability <= 1 && modal.durabilityLossOnFail
                        ? t("enhance.riskyAction")
                        : t("enhance.proceed")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "enhance_success" ? (
                <div className="w-full space-y-5 text-center">
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: 1 }}
                    className="text-[1.625rem] font-extrabold leading-snug text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)] sm:text-3xl"
                  >
                    {t("modal.enhanceSuccess")}
                  </motion.div>
                  {modal.recordBreak ? <RecordBreakBanner rb={modal.recordBreak} /> : null}
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">
                    {getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName)}{" "}
                    <span className="font-mono text-amber-100">
                      +{modal.result.beforeLevel} → +{modal.result.afterLevel}
                    </span>
                  </p>
                  <p className="font-mono text-base leading-relaxed text-zinc-400">
                    {t("ranking.score.rankingValue")} {formatGold(modal.result.beforeValue)} →{" "}
                    <span className="text-emerald-300">{formatGold(modal.result.afterValue)}</span>
                  </p>
                  <div className="flex w-full flex-col gap-2.5 pt-2">
                    <FantasyButton
                      className="min-h-14 w-full shadow-[0_0_20px_rgba(245,158,11,0.22)]"
                      onClick={() => {
                        close();
                        setTab("blacksmith");
                      }}
                    >
                      {t("enhance.continue")}
                    </FantasyButton>
                    <FantasyButton
                      variant="promo"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        queueMicrotask(() => requestSellEquipped());
                      }}
                    >
                      {t("inventory.sell")}
                    </FantasyButton>
                    <FantasyButton
                      variant="accent"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        setTab("ranking");
                      }}
                    >
                      {t("ranking.view")}
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      {t("common.close")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "enhance_fail" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold leading-snug text-red-300">{t("modal.enhanceFail")}</h3>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {t("modal.enhanceLevelKept", { weapon: getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName), level: modal.result.level })}
                  </p>
                  <div className="flex items-center justify-center gap-3 text-sm leading-relaxed text-zinc-400">
                    {t("weapon.durability")}
                    <DurabilityIcons value={modal.result.beforeDurability} />
                    <span>→</span>
                    <DurabilityIcons value={modal.result.afterDurability} />
                  </div>
                  <p className="text-xs text-zinc-500">{t("modal.weaponSurvived")}</p>
                  <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                    {t("common.close")}
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "weapon_destroyed" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold text-red-400">{t("modal.weaponDestroyed")}</h3>
                  <p className="text-sm text-zinc-300">
                    {modal.destroyCause === "transcend" ? (
                      <>
                        {t("modal.destroyedByTranscend")}
                        <br />
                        <span className="text-zinc-500">
                          {getWeaponDisplayNameById(locale, "weaponId" in modal.result ? modal.result.weaponId : undefined, modal.result.weaponName)} +{modal.result.level}
                        </span>
                      </>
                    ) : (
                      <>
                        {t("modal.destroyedWeaponLine", { weapon: getWeaponDisplayNameById(locale, "weaponId" in modal.result ? modal.result.weaponId : undefined, modal.result.weaponName), level: modal.result.level })}
                      </>
                    )}
                  </p>
                  <div className="rounded-xl bg-red-950/30 p-4 text-sm ring-1 ring-red-500/25">
                    <div className="mb-2 font-semibold text-red-200">{t("modal.scrapReward")}</div>
                    <ul className="space-y-1 font-mono text-zinc-300">
                      <li>{t("currency.gold")} {formatGold(modal.result.scrapRewards.gold)}</li>
                      <li>{t("currency.ember")} {formatInt(modal.result.scrapRewards.ember)}</li>
                      {modal.result.scrapRewards.transcendStone > 0 ? (
                        <li>{t("currency.transcendStone")} {formatInt(modal.result.scrapRewards.transcendStone)}</li>
                      ) : null}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {!isBetaMode ? (
                      <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={() => mockDoubleDestroyScrap()}>
                        {t("reward.doubleScrap")}
                      </FantasyButton>
                    ) : null}
                    <FantasyButton className="min-h-14 w-full" onClick={close}>
                      {t("common.confirm")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "transcend_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-violet-200">{t("modal.transcendConfirm")}</h3>
                  <div className="flex gap-4 rounded-xl border border-violet-900/50 bg-black/30 p-3 ring-1 ring-inset ring-violet-700/25">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modal.weapon.imagePath}
                      alt=""
                      draggable={false}
                      className="h-24 w-24 shrink-0 rounded-lg object-contain opacity-95 ring-1 ring-violet-600/40"
                    />
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="font-semibold text-zinc-100">{getWeaponDisplayName(locale, modal.weapon)}</div>
                      <div className="font-mono text-amber-200/90">
                        +{modal.owned.enhanceLevel}
                        {modal.owned.transcendLevel > 0 ? ` ★${modal.owned.transcendLevel}` : ""}{" "}
                        → ★{modal.nextStar}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        {t("weapon.durability")} <DurabilityIcons value={modal.owned.durability} />
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>{t("enhance.successRate")}: {modal.successRatePercent.toFixed(1)}%</li>
                    <li>{t("transcend.requiredStone")}: {formatInt(modal.stoneCost)}</li>
                    <li>{t("transcend.stoneOwned")}: {formatInt(modal.transcendStoneOwned)}</li>
                    <li>
                      {t("ranking.score.rankingValue")} {formatGold(modal.currentRankingValue)} →{" "}
                      <span className="text-emerald-400">{formatGold(modal.expectedRankingValue)}</span>
                    </li>
                    <li>
                      {t("modal.expectedSalePrice")} {formatGold(modal.currentSaleGold)} →{" "}
                      <span className="text-sky-300">{formatGold(modal.expectedSaleGold)}</span>
                    </li>
                    <li className="text-xs text-zinc-500">{t("transcend.failEffect")}</li>
                  </ul>
                  {modal.owned.durability <= 1 ? (
                    <p className="rounded-lg bg-red-950/45 p-3 text-sm text-red-100 ring-1 ring-red-500/35">
                      {t("transcend.nextFailMayDestroy")}
                    </p>
                  ) : null}
                  {modal.transcendStoneOwned < modal.stoneCost ? (
                    <p className="text-center text-sm text-red-400">{t("transcend.notEnoughStone")}</p>
                  ) : null}
                  <div className="flex gap-2 pt-2">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      {t("common.cancel")}
                    </FantasyButton>
                    <FantasyButton
                      className="flex-1 bg-gradient-to-b from-violet-600 to-indigo-900 text-amber-50 ring-violet-400/40 hover:from-violet-500 hover:to-indigo-800"
                      disabled={modal.transcendStoneOwned < modal.stoneCost}
                      onClick={() => commitTranscend()}
                    >
                      {t("transcend.action")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "transcend_success" ? (
                <div className="space-y-5 text-center">
                  <motion.div
                    initial={{ scale: 0.88 }}
                    animate={{ scale: 1 }}
                    className={`text-[1.625rem] font-extrabold leading-snug drop-shadow-[0_0_22px_rgba(167,139,250,0.5)] sm:text-3xl ${
                      modal.afterStar >= 10 ? "text-amber-200" : "text-violet-300"
                    }`}
                  >
                    {modal.afterStar >= 10 ? t("modal.finalTranscendComplete") : t("modal.transcendSuccess")}
                  </motion.div>
                  {modal.recordBreak ? <RecordBreakBanner rb={modal.recordBreak} /> : null}
                  {modal.afterStar >= 10 ? (
                    <>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {t("transcend.noMore")}
                      </p>
                      <p className="font-mono text-base leading-relaxed text-zinc-400">
                        {t("ranking.score.rankingValue")} {formatGold(modal.beforeRankingValue)} →{" "}
                        <span className="text-emerald-300">{formatGold(modal.afterRankingValue)}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">
                        {t("modal.transcendSuccessLine", {
                          weapon: getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName),
                          before: modal.beforeStar,
                          after: modal.afterStar,
                        })}
                      </p>
                      <p className="font-mono text-base leading-relaxed text-zinc-400">
                        {t("ranking.score.rankingValue")} {formatGold(modal.beforeRankingValue)} →{" "}
                        <span className="text-emerald-300">{formatGold(modal.afterRankingValue)}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {t("inventory.salePrice")} {formatGold(modal.beforeSaleGold)} → {formatGold(modal.afterSaleGold)}
                      </p>
                    </>
                  )}
                  <div className="flex flex-col gap-2.5 pt-2">
                    {modal.afterStar >= 10 ? (
                      <FantasyButton
                        variant="accent"
                        className="min-h-14 w-full"
                        onClick={() => {
                          close();
                          setTab("ranking");
                        }}
                      >
                        {t("ranking.view")}
                      </FantasyButton>
                    ) : (
                      <FantasyButton
                        className="min-h-14 w-full bg-gradient-to-b from-violet-600 to-indigo-900 text-amber-50 ring-violet-400/40"
                        onClick={() => {
                          close();
                          requestTranscend();
                        }}
                      >
                        {t("transcend.tryAgain")}
                      </FantasyButton>
                    )}
                    <FantasyButton
                      variant="accent"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        queueMicrotask(() => requestSellEquipped());
                      }}
                    >
                      {t("inventory.sell")}
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      {t("common.close")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "transcend_fail" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold leading-snug text-violet-300">{t("modal.transcendFail")}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">{getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName)}</p>
                  <p className="text-xs text-zinc-500">
                    {t("modal.transcendLevelKept", { level: modal.transcendLevel })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("modal.transcendStoneConsumed", { amount: formatInt(modal.stoneCost) })}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    {t("weapon.durability")}
                    <DurabilityIcons value={modal.beforeDurability} />
                    <span className="text-zinc-600">→</span>
                    <DurabilityIcons value={modal.afterDurability} />
                  </div>
                  {modal.afterDurability <= 1 ? (
                    <p className="rounded-lg bg-amber-950/40 p-3 text-xs text-amber-100 ring-1 ring-amber-600/35">
                      {t("enhance.nextFailMayDestroy")}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2.5 pt-2">
                    <FantasyButton
                      className="min-h-14 w-full bg-gradient-to-b from-violet-700 to-zinc-900 text-violet-100 ring-violet-500/35"
                      onClick={() => {
                        close();
                        requestTranscend();
                      }}
                    >
                      {t("transcend.tryAgain")}
                    </FantasyButton>
                    <FantasyButton
                      variant="accent"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        queueMicrotask(() => requestSellEquipped());
                      }}
                    >
                      {t("inventory.sell")}
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      {t("common.close")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "buy_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">{t("modal.buyConfirm")}</h3>
                  <p className="text-sm text-zinc-300">
                    {t("modal.buyQuestion", { weapon: getWeaponDisplayName(locale, modal.weapon) })}
                  </p>
                  <ul className="text-sm text-zinc-400">
                    <li>{t("modal.price")}: {formatGold(modal.weapon.basePrice)}</li>
                  </ul>
                  <div className="flex gap-2">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      {t("common.cancel")}
                    </FantasyButton>
                    <FantasyButton
                      className="flex-1"
                      disabled={serverActionPending}
                      onClick={() => confirmBuy()}
                    >
                      {t("shop.buyWeapon")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "buy_success" ? (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold text-emerald-300">{t("modal.buyComplete")}</p>
                  <p className="text-sm text-zinc-300">
                    {t("modal.buyCompleteLine", { weapon: getWeaponDisplayNameById(locale, "weaponId" in modal ? modal.weaponId : undefined, modal.weaponName) })}
                  </p>
                  <FantasyButton className="w-full" onClick={close}>
                    {t("common.confirm")}
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "season_started" ? (
                <div className="space-y-4 text-center">
                  <h3 className="text-lg font-bold text-amber-50">{t("modal.newSeason")}</h3>
                  <p className="text-sm text-zinc-300">
                    {t("modal.newSeasonDescription")}
                  </p>
                  <div className="rounded-xl bg-zinc-900/60 p-3 text-left text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("modal.seasonId")}</span>
                      <span className="font-mono text-amber-100">{modal.seasonId}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-2">
                      <span className="text-zinc-500">{t("modal.endsAt")}</span>
                      <span className="font-mono text-xs text-zinc-300">
                        {new Date(modal.endsAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  </div>
                  <FantasyButton className="w-full" onClick={() => acknowledgeSeasonStart()}>
                    {t("common.confirm")}
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "offline_forge_reward" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">
                    {t("modal.offlineForgeWorked")}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {t("modal.offlineElapsed")}:{" "}
                    <span className="font-mono text-amber-200/90">
                      {formatOfflineDurationLabel(modal.offlineDurationMs, t)}
                    </span>
                  </p>
                  <div className="space-y-2 rounded-xl bg-zinc-900/60 p-3 text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("records.forgeLevel")}</span>
                      <span className="font-mono text-amber-100">Lv.{modal.forgeLevel}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("forge.productionPerMinute")}</span>
                      <span className="font-mono text-amber-100">
                        {t("forge.perMinuteValue", { amount: formatInt(modal.ratePerMinute) })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("modal.maxAccumulationTime")}</span>
                      <span className="font-mono text-zinc-300">
                        {t("time.minutes", { minutes: modal.maxAccumulateMinutes })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">{t("modal.storageLimit")}</span>
                      <span className="font-mono text-zinc-300">
                        {t("modal.emberAmount", { amount: formatInt(modal.storageCap) })}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/40 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">{t("modal.baseGain")}</span>
                      <span className="font-mono text-orange-300">
                        {t("modal.emberAmount", { amount: formatInt(modal.pendingBase) })}
                      </span>
                    </div>
                    {showRewardAds ? (
                      <div className="mt-1 flex justify-between gap-2">
                        <span className="text-zinc-500">{t("forge.adDouble")}</span>
                        <span className="font-mono text-violet-300">
                          {t("modal.emberAmount", { amount: formatInt(modal.pendingAdDouble) })}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {modal.hitTimeCap || modal.isStorageFull ? (
                    <p className="rounded-lg bg-red-950/35 p-3 text-xs leading-relaxed text-red-200 ring-1 ring-red-500/25">
                      {modal.isStorageFull
                        ? t("modal.storageLimitReached")
                        : t("modal.maxAccumulationReached")}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-1">
                    <FantasyButton
                      className="w-full"
                      onClick={() => collectForge(false)}
                      disabled={modal.pendingBase <= 0 || serverActionPending}
                    >
                      {t("forge.basicCollect")}
                    </FantasyButton>
                    {showRewardAds ? (
                      <>
                        <FantasyButton
                          variant="promo"
                          className="w-full"
                          onClick={() => collectForge(true)}
                          disabled={
                            modal.pendingBase <= 0 ||
                            isRewardAdDisabled ||
                            serverActionPending
                          }
                        >
                          {isRewardAdDisabled
                            ? t("ads.rewardPreparing")
                            : t("ads.watchForDoubleCollect")}
                        </FantasyButton>
                        {isRewardAdDisabled ? (
                          <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                            {t("reward.extraPreparing")}
                          </p>
                        ) : (
                          <AdRewardStatusText rewardType="forgeCollectDouble" />
                        )}
                      </>
                    ) : null}
                    <FantasyButton variant="muted" className="w-full" onClick={close}>
                      {t("modal.collectLater")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_collect_complete" ? (
                <div className="relative space-y-4 text-center">
                  <h3 className="text-xl font-bold text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)]">
                    {t("modal.forgeCollectComplete")}
                  </h3>
                  <p className="text-sm text-zinc-300">
                    {t("currency.ember")}{" "}
                    <span className="font-mono text-orange-300">{formatInt(modal.gained)}</span>
                    {t("modal.gainedSuffix")}
                  </p>
                  {modal.usedAd ? (
                    <p className="text-sm text-violet-300/95">
                      {t("ads.doubleBonusApplied")}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-2">
                    <FantasyButton
                      className="w-full"
                      onClick={() => {
                        close();
                        setTab("blacksmith");
                      }}
                    >
                      {t("nav.blacksmith")}
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="w-full" onClick={close}>
                      {t("common.close")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_upgrade_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">{t("modal.forgeUpgrade")}</h3>
                  <div className="space-y-2 rounded-xl bg-zinc-900/60 p-3 text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("forge.levelLabel")}</span>
                      <span className="font-mono text-amber-100">
                        Lv.{modal.currentLevel} → Lv.{modal.nextLevel}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("forge.productionPerMinute")}</span>
                      <span className="font-mono text-zinc-300">
                        {formatInt(modal.currentRate)} →{" "}
                        <span className="text-emerald-300">{formatInt(modal.nextRate)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("modal.maxAccumulationTime")}</span>
                      <span className="font-mono text-zinc-300">
                        {t("time.minutes", { minutes: modal.currentMaxMinutes })} →{" "}
                        <span className="text-emerald-300">{t("time.minutes", { minutes: modal.nextMaxMinutes })}</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">{t("modal.upgradeCost")}</span>
                      <span className="font-mono text-amber-200">{formatGold(modal.costGold)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("shop.goldOwned")}</span>
                      <span className="font-mono text-zinc-200">{formatGold(modal.playerGold)}</span>
                    </div>
                  </div>
                  {modal.playerGold < modal.costGold ? (
                    <p className="text-center text-sm text-red-400">{t("shop.notEnoughGold")}</p>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <FantasyButton
                      variant="ghost"
                      className="flex-1"
                      disabled={serverActionPending}
                      onClick={close}
                    >
                      {t("common.cancel")}
                    </FantasyButton>
                    <FantasyButton
                      className="flex-1"
                      disabled={modal.playerGold < modal.costGold || serverActionPending}
                      onClick={() => confirmForgeUpgrade()}
                    >
                      {t("forge.upgrade")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_upgrade_success" ? (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold text-emerald-400">{t("modal.upgradeComplete")}</p>
                  <p className="text-sm text-zinc-300">
                    {t("modal.forgeUpgradedLineBefore")}{" "}
                    <span className="font-mono text-amber-200">Lv.{modal.newLevel}</span>
                    {t("modal.forgeUpgradedLineAfter")}
                  </p>
                  <FantasyButton className="w-full" onClick={close}>
                    {t("common.confirm")}
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "ad_reward_progress" ? (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-500/35 bg-violet-950/35">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full border-2 border-violet-300/30 border-t-violet-200",
                        isTerminalAdState ? "" : "animate-spin",
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-violet-100">{t("ads.reward")}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                      {modal.message.includes(".") ? t(modal.message) : modal.message}
                    </p>
                  </div>
                  {isTerminalAdState ? (
                    <FantasyButton className="w-full" onClick={close}>
                      {t("common.confirm")}
                    </FantasyButton>
                  ) : null}
                </div>
              ) : null}

              {modal.kind === "sell_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">{t("modal.sellQuestion")}</h3>
                  <div className="flex gap-4 rounded-xl border border-amber-900/40 bg-black/30 p-3 ring-1 ring-inset ring-amber-700/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modal.weapon.imagePath}
                      alt=""
                      draggable={false}
                      className="h-24 w-24 shrink-0 rounded-lg object-contain opacity-90 ring-1 ring-amber-700/30"
                    />
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="font-semibold text-zinc-100">{getWeaponDisplayName(locale, modal.weapon)}</div>
                      <div className="font-mono text-amber-200/90">
                        +{modal.owned.enhanceLevel}
                        {modal.owned.transcendLevel > 0
                          ? ` ★${modal.owned.transcendLevel}`
                          : ""}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        {t("weapon.durability")} <DurabilityIcons value={modal.owned.durability} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-lg bg-zinc-900/50 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("modal.baseSalePrice")}</span>
                      <span className="font-mono text-sky-300">{formatGold(modal.saleGold)}</span>
                    </div>
                    {showRewardAds ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">{t("ads.saleBonus")}</span>
                        <span className="font-mono text-orange-300">{formatGold(modal.adSaleGold)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">{t("modal.rankingValueReference")}</span>
                      <span className="font-mono text-zinc-400">{formatGold(modal.rankingValue)}</span>
                    </div>
                  </div>
                  {showRewardAds ? (
                    <p className="text-xs text-zinc-500">
                      {t("modal.rankingValueUnaffectedByAd")}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className={showRewardAds ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "grid grid-cols-1 gap-2"}>
                      <FantasyButton variant="accent" disabled={serverActionPending} onClick={() => commitSell("normal")}>
                        {serverActionPending ? t("inventory.selling") : t("modal.basicSale")}
                      </FantasyButton>
                      {showRewardAds ? (
                        <FantasyButton
                          variant="promo"
                          disabled={serverActionPending || isRewardAdDisabled}
                          onClick={() => commitSell("adBonus")}
                        >
                          {serverActionPending
                            ? t("inventory.selling")
                            : isRewardAdDisabled
                              ? t("ads.rewardPreparing")
                              : t("ads.watchForBonusSale")}
                        </FantasyButton>
                      ) : null}
                    </div>
                    {showRewardAds ? (
                      isRewardAdDisabled ? (
                        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                          {t("ads.unavailableBasicSaleAvailable")}
                        </p>
                      ) : (
                        <AdRewardStatusText
                          rewardType="sellBonus"
                          relatedActionId={modal.instanceId}
                        />
                      )
                    ) : null}
                    <FantasyButton variant="muted" className="w-full" onClick={close}>
                      {t("common.cancel")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "sell_success" ? (
                <div className="space-y-4 text-center">
                  <h3 className="text-xl font-bold text-emerald-400">{t("modal.sellComplete")}</h3>
                  <p className="text-sm text-zinc-300">
                    {getWeaponDisplayNameById(locale, modal.info.weaponId, modal.info.weaponName)} +{modal.info.enhanceLevel}
                    {modal.info.transcendLevel > 0 ? ` ★${modal.info.transcendLevel}` : ""}{" "}
                    {t("modal.soldLineSuffix")}
                  </p>
                  {modal.info.usedAdBonus ? (
                    <p className="text-sm text-orange-300/90">
                      {t("ads.saleBonusApplied")}
                    </p>
                  ) : null}
                  <p className="font-mono text-lg text-amber-100">
                    {t("modal.goldGained")}: {formatGold(modal.info.finalSaleGold)}
                  </p>
                  <p className="text-xs text-zinc-500">{t("modal.buyHigherWeaponPrompt")}</p>
                  <div className="flex flex-col gap-2 pt-2">
                    <FantasyButton onClick={() => { close(); setTab("shop"); }}>
                      {t("shop.goToShop")}
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="w-full" onClick={close}>
                      {t("common.close")}
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "sell_locked_notice" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-red-400">{t("inventory.cannotSell")}</h3>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {t("modal.lockedWeaponCannotSell")}
                  </p>
                  <FantasyButton variant="secondary" className="w-full" onClick={close}>
                    {t("common.confirm")}
                  </FantasyButton>
                </div>
              ) : null}
              </div>
            </motion.div>
          </ScreenShake>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
