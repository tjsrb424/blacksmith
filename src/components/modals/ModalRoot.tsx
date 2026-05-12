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
import { playSound } from "@/lib/sound";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { EFFECT_ASSETS } from "@/data/assets";
import { getGameMode } from "@/lib/supabase/env";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { AdRewardStatusText } from "@/components/ads/AdRewardStatusText";

function RecordBreakBanner({ rb }: { rb: RecordBreakInfo }) {
  const gap = rb.gapToMockLeaderStrongest;
  const aheadOfMockLeader = gap != null && gap <= 0;

  return (
    <div className="rounded-xl bg-gradient-to-r from-violet-950/80 to-indigo-950/80 p-4 text-sm ring-1 ring-violet-500/40">
      <div className="font-bold text-violet-200">신기록 달성!</div>
      <p className="mt-1 text-xs text-violet-300/90">
        이전 최고 {formatGold(rb.previousBest)} → 새 최고{" "}
        <span className="font-mono text-violet-100">{formatGold(rb.newBest)}</span>
      </p>
      {rb.delta != null && rb.delta > 0 ? (
        <p className="mt-2 font-mono text-xs text-emerald-400/95">
          +{formatGold(rb.delta)} 상승
        </p>
      ) : null}
      {rb.estimatedWeeklyRankStrongest != null ? (
        <p className="mt-2 text-xs text-zinc-300">
          예상 주간 순위(최강 무기 Mock 기준):{" "}
          <span className="font-mono font-semibold text-amber-200">
            {rb.estimatedWeeklyRankStrongest}위
          </span>
        </p>
      ) : null}
      {gap != null ? (
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          {aheadOfMockLeader
            ? "Mock 주간 1위 기록보다 높거나 동일합니다."
            : `Mock 주간 선두 대비 약 ${formatGold(gap)} 남았습니다.`}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">
        주간 최강 무기 후보에 등록되었습니다.
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
          className="absolute -bottom-10 left-1/2 h-32 w-[105%] max-w-none -translate-x-1/2 object-contain opacity-[0.24] mix-blend-screen"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EFFECT_ASSETS.successFlash}
          alt=""
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
          className="game-modal-overlay fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 items-end justify-center bg-black/62 p-2 backdrop-blur-[1px] sm:items-center sm:backdrop-blur-sm"
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
                    {modal.title ?? "서버 오류"}
                  </h3>
                  <p className="text-sm text-zinc-300">{modal.message}</p>
                  <FantasyButton
                    variant="primary"
                    className="w-full"
                    onClick={() => void reloadServerSnapshot()}
                  >
                    서버 데이터 다시 불러오기
                  </FantasyButton>
                  <FantasyButton variant="secondary" className="w-full" onClick={close}>
                    확인
                  </FantasyButton>
                </div>
              ) : modal.kind === "enhance_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">강화 확인</h3>
                  <p className="text-sm text-zinc-300">
                    {modal.weaponName} +{modal.targetLevel} 강화 시도
                  </p>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>성공률: {modal.successRatePercent.toFixed(1)}%</li>
                    <li>소모: 제련의 불씨 {formatInt(modal.costEmber)}개</li>
                    <li className="flex items-center gap-2">
                      현재 내구도: <DurabilityIcons value={modal.currentDurability} />
                    </li>
                    <li>
                      실패 시:{" "}
                      {modal.durabilityLossOnFail
                        ? "내구도 -1"
                        : "내구도 유지 (보호 구간)"}
                    </li>
                  </ul>
                  {modal.currentDurability <= 1 && modal.durabilityLossOnFail ? (
                    <p className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200 ring-1 ring-red-500/30">
                      다음 실패 시 무기가 파괴될 수 있습니다.
                    </p>
                  ) : null}
                  <div className="flex gap-2 pt-2">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      취소
                    </FantasyButton>
                    <FantasyButton className="flex-1" onClick={() => commitEnhance()}>
                      {modal.currentDurability <= 1 && modal.durabilityLossOnFail
                        ? "위험 강화"
                        : "강화 진행"}
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
                    강화 성공!
                  </motion.div>
                  {modal.recordBreak ? <RecordBreakBanner rb={modal.recordBreak} /> : null}
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">
                    {modal.weaponName}{" "}
                    <span className="font-mono text-amber-100">
                      +{modal.result.beforeLevel} → +{modal.result.afterLevel}
                    </span>
                  </p>
                  <p className="font-mono text-base leading-relaxed text-zinc-400">
                    가치 {formatGold(modal.result.beforeValue)} →{" "}
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
                      계속 강화
                    </FantasyButton>
                    <FantasyButton
                      variant="promo"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        queueMicrotask(() => requestSellEquipped());
                      }}
                    >
                      판매하기
                    </FantasyButton>
                    <FantasyButton
                      variant="accent"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        setTab("ranking");
                      }}
                    >
                      랭킹 보기
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      닫기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "enhance_fail" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold leading-snug text-red-300">강화 실패</h3>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {modal.weaponName} +{modal.result.level} 유지
                  </p>
                  <div className="flex items-center justify-center gap-3 text-sm leading-relaxed text-zinc-400">
                    내구도
                    <DurabilityIcons value={modal.result.beforeDurability} />
                    <span>→</span>
                    <DurabilityIcons value={modal.result.afterDurability} />
                  </div>
                  <p className="text-xs text-zinc-500">아직 무기는 남아 있습니다.</p>
                  <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                    닫기
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "weapon_destroyed" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold text-red-400">무기 파괴</h3>
                  <p className="text-sm text-zinc-300">
                    {modal.destroyCause === "transcend" ? (
                      <>
                        초월 실패로 무기가 파괴되었습니다.
                        <br />
                        <span className="text-zinc-500">
                          {modal.result.weaponName} +{modal.result.level}
                        </span>
                      </>
                    ) : (
                      <>
                        {modal.result.weaponName} +{modal.result.level} 이(가) 파괴되었습니다.
                      </>
                    )}
                  </p>
                  <div className="rounded-xl bg-red-950/30 p-4 text-sm ring-1 ring-red-500/25">
                    <div className="mb-2 font-semibold text-red-200">잔해 보상</div>
                    <ul className="space-y-1 font-mono text-zinc-300">
                      <li>골드 {formatGold(modal.result.scrapRewards.gold)}</li>
                      <li>제련의 불씨 {formatInt(modal.result.scrapRewards.ember)}</li>
                      {modal.result.scrapRewards.transcendStone > 0 ? (
                        <li>초월석 {formatInt(modal.result.scrapRewards.transcendStone)}</li>
                      ) : null}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {!isBetaMode ? (
                      <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={() => mockDoubleDestroyScrap()}>
                        광고 보고 잔해 보상 2배
                      </FantasyButton>
                    ) : null}
                    <FantasyButton className="min-h-14 w-full" onClick={close}>
                      확인
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "transcend_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-violet-200">초월 확인</h3>
                  <div className="flex gap-4 rounded-xl border border-violet-900/50 bg-black/30 p-3 ring-1 ring-inset ring-violet-700/25">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modal.weapon.imagePath}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-lg object-contain opacity-95 ring-1 ring-violet-600/40"
                    />
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="font-semibold text-zinc-100">{modal.weapon.name}</div>
                      <div className="font-mono text-amber-200/90">
                        +{modal.owned.enhanceLevel}
                        {modal.owned.transcendLevel > 0 ? ` ★${modal.owned.transcendLevel}` : ""}{" "}
                        → ★{modal.nextStar}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        내구도 <DurabilityIcons value={modal.owned.durability} />
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>성공률: {modal.successRatePercent.toFixed(1)}%</li>
                    <li>필요 초월석: {formatInt(modal.stoneCost)}개</li>
                    <li>보유 초월석: {formatInt(modal.transcendStoneOwned)}개</li>
                    <li>
                      랭킹 가치 {formatGold(modal.currentRankingValue)} →{" "}
                      <span className="text-emerald-400">{formatGold(modal.expectedRankingValue)}</span>
                    </li>
                    <li>
                      예상 판매가 {formatGold(modal.currentSaleGold)} →{" "}
                      <span className="text-sky-300">{formatGold(modal.expectedSaleGold)}</span>
                    </li>
                    <li className="text-xs text-zinc-500">실패 시: 초월 단계 유지 · 내구도 -1</li>
                  </ul>
                  {modal.owned.durability <= 1 ? (
                    <p className="rounded-lg bg-red-950/45 p-3 text-sm text-red-100 ring-1 ring-red-500/35">
                      내구도가 1 남았습니다. 초월 실패 시 무기가 파괴됩니다.
                    </p>
                  ) : null}
                  {modal.transcendStoneOwned < modal.stoneCost ? (
                    <p className="text-center text-sm text-red-400">초월석이 부족합니다.</p>
                  ) : null}
                  <div className="flex gap-2 pt-2">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      취소
                    </FantasyButton>
                    <FantasyButton
                      className="flex-1 bg-gradient-to-b from-violet-600 to-indigo-900 text-amber-50 ring-violet-400/40 hover:from-violet-500 hover:to-indigo-800"
                      disabled={modal.transcendStoneOwned < modal.stoneCost}
                      onClick={() => commitTranscend()}
                    >
                      초월 시도
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
                    {modal.afterStar >= 10 ? "최종 초월 달성!" : "초월 성공!"}
                  </motion.div>
                  {modal.recordBreak ? <RecordBreakBanner rb={modal.recordBreak} /> : null}
                  {modal.afterStar >= 10 ? (
                    <>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        이 무기는 더 이상 초월할 수 없습니다.
                      </p>
                      <p className="font-mono text-base leading-relaxed text-zinc-400">
                        가치 {formatGold(modal.beforeRankingValue)} →{" "}
                        <span className="text-emerald-300">{formatGold(modal.afterRankingValue)}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">
                        {modal.weaponName} +15 이 ★{modal.beforeStar}에서 ★{modal.afterStar}로 초월했습니다.
                      </p>
                      <p className="font-mono text-base leading-relaxed text-zinc-400">
                        가치 {formatGold(modal.beforeRankingValue)} →{" "}
                        <span className="text-emerald-300">{formatGold(modal.afterRankingValue)}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        판매가 {formatGold(modal.beforeSaleGold)} → {formatGold(modal.afterSaleGold)}
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
                        랭킹 보기
                      </FantasyButton>
                    ) : (
                      <FantasyButton
                        className="min-h-14 w-full bg-gradient-to-b from-violet-600 to-indigo-900 text-amber-50 ring-violet-400/40"
                        onClick={() => {
                          close();
                          requestTranscend();
                        }}
                      >
                        한 번 더 초월
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
                      판매하기
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      닫기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "transcend_fail" ? (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold leading-snug text-violet-300">초월 실패</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-300">{modal.weaponName}</p>
                  <p className="text-xs text-zinc-500">초월 단계는 ★{modal.transcendLevel} 로 유지됩니다.</p>
                  <p className="text-xs text-zinc-500">
                    소모 초월석 {formatInt(modal.stoneCost)}개 (차감됨)
                  </p>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    내구도
                    <DurabilityIcons value={modal.beforeDurability} />
                    <span className="text-zinc-600">→</span>
                    <DurabilityIcons value={modal.afterDurability} />
                  </div>
                  {modal.afterDurability <= 1 ? (
                    <p className="rounded-lg bg-amber-950/40 p-3 text-xs text-amber-100 ring-1 ring-amber-600/35">
                      위험 상태입니다. 다음 실패 시 무기가 파괴됩니다.
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
                      다시 초월
                    </FantasyButton>
                    <FantasyButton
                      variant="accent"
                      className="min-h-14 w-full"
                      onClick={() => {
                        close();
                        queueMicrotask(() => requestSellEquipped());
                      }}
                    >
                      판매하기
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="min-h-14 w-full" onClick={close}>
                      닫기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "buy_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">구매 확인</h3>
                  <p className="text-sm text-zinc-300">
                    {modal.weapon.name}을(를) 구매할까요?
                  </p>
                  <ul className="text-sm text-zinc-400">
                    <li>가격: {formatGold(modal.weapon.basePrice)}</li>
                  </ul>
                  <div className="flex gap-2">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      취소
                    </FantasyButton>
                    <FantasyButton className="flex-1" onClick={() => confirmBuy()}>
                      구매하기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "buy_success" ? (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold text-emerald-300">구매 완료</p>
                  <p className="text-sm text-zinc-300">
                    {modal.weaponName}을(를) 구매했습니다.
                  </p>
                  <FantasyButton className="w-full" onClick={close}>
                    확인
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "season_started" ? (
                <div className="space-y-4 text-center">
                  <h3 className="text-lg font-bold text-amber-50">새로운 주간 시즌</h3>
                  <p className="text-sm text-zinc-300">
                    주간 랭킹이 갱신되었습니다. 이번 시즌도 최강의 무기에 도전해 보세요.
                  </p>
                  <div className="rounded-xl bg-zinc-900/60 p-3 text-left text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">시즌 ID</span>
                      <span className="font-mono text-amber-100">{modal.seasonId}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-2">
                      <span className="text-zinc-500">종료 시각</span>
                      <span className="font-mono text-xs text-zinc-300">
                        {new Date(modal.endsAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  </div>
                  <FantasyButton className="w-full" onClick={() => acknowledgeSeasonStart()}>
                    확인
                  </FantasyButton>
                </div>
              ) : null}

              {modal.kind === "offline_forge_reward" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">
                    쉬는 동안 제련로가 작동했습니다
                  </h3>
                  <p className="text-sm text-zinc-400">
                    오프라인 경과:{" "}
                    <span className="font-mono text-amber-200/90">
                      {modal.offlineDurationLabel}
                    </span>
                  </p>
                  <div className="space-y-2 rounded-xl bg-zinc-900/60 p-3 text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">제련로 레벨</span>
                      <span className="font-mono text-amber-100">Lv.{modal.forgeLevel}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">분당 생산</span>
                      <span className="font-mono text-amber-100">
                        {formatInt(modal.ratePerMinute)} / 분
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">최대 누적 시간</span>
                      <span className="font-mono text-zinc-300">
                        {modal.maxAccumulateMinutes}분
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">보관 한도</span>
                      <span className="font-mono text-zinc-300">
                        {formatInt(modal.storageCap)} 불씨
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/40 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-400">기본 획득</span>
                      <span className="font-mono text-orange-300">
                        {formatInt(modal.pendingBase)} 불씨
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="text-zinc-500">광고 2배</span>
                      <span className="font-mono text-violet-300">
                        {formatInt(modal.pendingAdDouble)} 불씨
                      </span>
                    </div>
                  </div>
                  {modal.hitTimeCap || modal.isStorageFull ? (
                    <p className="rounded-lg bg-red-950/35 p-3 text-xs leading-relaxed text-red-200 ring-1 ring-red-500/25">
                      {modal.isStorageFull
                        ? "보관 한도에 도달했습니다. 추가 생산이 중단된 상태입니다."
                        : "최대 누적 시간에 도달했습니다. 더 이상 쌓이지 않습니다."}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-1">
                    <FantasyButton
                      className="w-full"
                      onClick={() => collectForge(false)}
                      disabled={modal.pendingBase <= 0}
                    >
                      기본 수령
                    </FantasyButton>
                    <FantasyButton
                      variant="promo"
                      className="w-full"
                      onClick={() => collectForge(true)}
                      disabled={modal.pendingBase <= 0 || isRewardAdDisabled}
                    >
                      {isRewardAdDisabled
                        ? "광고 보상 준비 중"
                        : "광고 보고 2배 수령"}
                    </FantasyButton>
                    {isRewardAdDisabled ? (
                      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                        광고 보상은 준비 중입니다. 기본 수령은 정상 이용할 수 있습니다.
                      </p>
                    ) : (
                      <AdRewardStatusText rewardType="forgeCollectDouble" />
                    )}
                    <FantasyButton variant="muted" className="w-full" onClick={close}>
                      나중에 받기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_collect_complete" ? (
                <div className="relative space-y-4 text-center">
                  <h3 className="text-xl font-bold text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)]">
                    제련의 불씨 수령 완료
                  </h3>
                  <p className="text-sm text-zinc-300">
                    제련의 불씨{" "}
                    <span className="font-mono text-orange-300">{formatInt(modal.gained)}</span>
                    개를 획득했습니다.
                  </p>
                  {modal.usedAd ? (
                    <p className="text-sm text-violet-300/95">
                      광고 보너스 2배가 적용되었습니다.
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
                      대장간으로
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="w-full" onClick={close}>
                      닫기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_upgrade_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">제련로 업그레이드</h3>
                  <div className="space-y-2 rounded-xl bg-zinc-900/60 p-3 text-sm ring-1 ring-amber-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">레벨</span>
                      <span className="font-mono text-amber-100">
                        Lv.{modal.currentLevel} → Lv.{modal.nextLevel}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">분당 생산</span>
                      <span className="font-mono text-zinc-300">
                        {formatInt(modal.currentRate)} →{" "}
                        <span className="text-emerald-300">{formatInt(modal.nextRate)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">최대 누적 시간</span>
                      <span className="font-mono text-zinc-300">
                        {modal.currentMaxMinutes}분 →{" "}
                        <span className="text-emerald-300">{modal.nextMaxMinutes}분</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">업그레이드 비용</span>
                      <span className="font-mono text-amber-200">{formatGold(modal.costGold)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">보유 골드</span>
                      <span className="font-mono text-zinc-200">{formatGold(modal.playerGold)}</span>
                    </div>
                  </div>
                  {modal.playerGold < modal.costGold ? (
                    <p className="text-center text-sm text-red-400">골드가 부족합니다</p>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <FantasyButton variant="ghost" className="flex-1" onClick={close}>
                      취소
                    </FantasyButton>
                    <FantasyButton
                      className="flex-1"
                      disabled={modal.playerGold < modal.costGold}
                      onClick={() => confirmForgeUpgrade()}
                    >
                      업그레이드
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "forge_upgrade_success" ? (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold text-emerald-400">업그레이드 완료</p>
                  <p className="text-sm text-zinc-300">
                    제련로가 <span className="font-mono text-amber-200">Lv.{modal.newLevel}</span>
                    로 성장했습니다.
                  </p>
                  <FantasyButton className="w-full" onClick={close}>
                    확인
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
                    <h3 className="text-xl font-bold text-violet-100">광고 보상</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                      {modal.message}
                    </p>
                  </div>
                  {isTerminalAdState ? (
                    <FantasyButton className="w-full" onClick={close}>
                      확인
                    </FantasyButton>
                  ) : null}
                </div>
              ) : null}

              {modal.kind === "sell_confirm" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-amber-50">무기를 판매할까요?</h3>
                  <div className="flex gap-4 rounded-xl border border-amber-900/40 bg-black/30 p-3 ring-1 ring-inset ring-amber-700/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modal.weapon.imagePath}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-lg object-contain opacity-90 ring-1 ring-amber-700/30"
                    />
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="font-semibold text-zinc-100">{modal.weapon.name}</div>
                      <div className="font-mono text-amber-200/90">
                        +{modal.owned.enhanceLevel}
                        {modal.owned.transcendLevel > 0
                          ? ` ★${modal.owned.transcendLevel}`
                          : ""}
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        내구도 <DurabilityIcons value={modal.owned.durability} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-lg bg-zinc-900/50 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">기본 판매가</span>
                      <span className="font-mono text-sky-300">{formatGold(modal.saleGold)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">광고 +30%</span>
                      <span className="font-mono text-orange-300">{formatGold(modal.adSaleGold)}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-zinc-800 pt-2">
                      <span className="text-zinc-500">랭킹 가치 (참고)</span>
                      <span className="font-mono text-zinc-400">{formatGold(modal.rankingValue)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    랭킹 가치는 광고 보너스와 무관합니다.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <FantasyButton variant="accent" disabled={serverActionPending} onClick={() => commitSell("normal")}>
                        {serverActionPending ? "판매 처리 중..." : "기본 판매"}
                      </FantasyButton>
                      <FantasyButton
                        variant="promo"
                        disabled={serverActionPending || isRewardAdDisabled}
                        onClick={() => commitSell("adBonus")}
                      >
                        {serverActionPending
                          ? "판매 처리 중..."
                          : isRewardAdDisabled
                            ? "광고 보상 준비 중"
                            : "광고 보고 +30% 판매"}
                      </FantasyButton>
                    </div>
                    {isRewardAdDisabled ? (
                      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                        현재 광고를 사용할 수 없습니다. 기본 판매는 정상 이용할 수 있습니다.
                      </p>
                    ) : (
                      <AdRewardStatusText
                        rewardType="sellBonus"
                        relatedActionId={modal.instanceId}
                      />
                    )}
                    <FantasyButton variant="muted" className="w-full" onClick={close}>
                      취소
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "sell_success" ? (
                <div className="space-y-4 text-center">
                  <h3 className="text-xl font-bold text-emerald-400">무기 판매 완료</h3>
                  <p className="text-sm text-zinc-300">
                    {modal.info.weaponName} +{modal.info.enhanceLevel}
                    {modal.info.transcendLevel > 0 ? ` ★${modal.info.transcendLevel}` : ""}을(를)
                    판매했습니다.
                  </p>
                  {modal.info.usedAdBonus ? (
                    <p className="text-sm text-orange-300/90">
                      광고 보너스 +30%가 적용되었습니다.
                    </p>
                  ) : null}
                  <p className="font-mono text-lg text-amber-100">
                    획득 골드: {formatGold(modal.info.finalSaleGold)}
                  </p>
                  <p className="text-xs text-zinc-500">더 높은 무기를 구매해보세요.</p>
                  <div className="flex flex-col gap-2 pt-2">
                    <FantasyButton onClick={() => { close(); setTab("shop"); }}>
                      무기상점으로
                    </FantasyButton>
                    <FantasyButton variant="secondary" className="w-full" onClick={close}>
                      닫기
                    </FantasyButton>
                  </div>
                </div>
              ) : null}

              {modal.kind === "sell_locked_notice" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-red-400">판매 불가</h3>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    잠긴 무기는 판매할 수 없습니다. 잠금을 해제한 뒤 판매해주세요.
                  </p>
                  <FantasyButton variant="secondary" className="w-full" onClick={close}>
                    확인
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
