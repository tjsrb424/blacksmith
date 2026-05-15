import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_DURABILITY,
  FORGE_START_LEVEL,
  INITIAL_EMBER,
  INITIAL_GOLD,
  INITIAL_TRANSCEND_STONE,
  SAVE_STORAGE_KEY,
  forgeUpgradeCostGold,
  durabilityLossOnFail,
  getForgeMaxAccumulateMinutes,
} from "@/data/balance";
import {
  STARTER_WEAPON_ID,
  WEAPON_DEFINITIONS,
  WEAPONS_BY_ID,
} from "@/data/weapons";
import { calculateSaleGold, calculateAdSaleGold } from "@/lib/economy";
import {
  calculateRankingValue,
  getBestWeaponForRanking,
  maybeUpdateBestWeaponSnapshot,
  bumpWeeklySeasonStrongest,
} from "@/lib/ranking";
import {
  buildLocalRecordBreakInfo,
  enrichRecordBreakUi,
} from "@/lib/rankingLeaderboard";
import { getCurrentSeasonInfo } from "@/lib/season";
import {
  clampDurability,
  computeScrapRewards,
  getEnhanceCostEmber,
  getEnhanceSuccessRate,
  rollEnhancement,
  shouldConfirmEnhance,
} from "@/lib/enhancement";
import {
  getTranscendStoneCost,
  getTranscendSuccessRate,
  rollTranscendAttempt,
} from "@/lib/transcend";
import {
  computePendingForgeEmber,
  formatOfflineDuration,
  getForgeEmberPerMinute,
  getForgeSnapshot,
} from "@/lib/forge";
import {
  beginTranscendAttemptSounds,
  playSound,
  playUiError,
  scheduleEnhanceOutcomeSounds,
  scheduleTranscendOutcomeSounds,
} from "@/lib/sound";
import {
  buyWeapon as buyWeaponApi,
  collectForge as collectForgeApi,
  enhanceWeapon as enhanceWeaponApi,
  sellWeapon as sellWeaponApi,
  transcendWeapon as transcendWeaponApi,
  upgradeForge as upgradeForgeApi,
} from "@/lib/server/gameActionApi";
import {
  completeAdReward,
  requestAdReward,
} from "@/lib/ads/adRewardApi";
import { scheduleAdRewardStatusRefreshAfterReward } from "@/lib/ads/adRewardStatusCache";
import { ApiRequestError } from "@/lib/server/http";
import {
  getCurrentPlayerSnapshot,
  invalidatePlayerApiCache,
} from "@/lib/server/playerApi";
import {
  diagnosticLog,
  getRenderCount,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { recordPerfEvent } from "@/lib/perfRecorder";
import { getGameMode } from "@/lib/supabase/env";
import type {
  EnhanceAnimationTier,
  EnhancePendingResolution,
  ModalState,
  NavTab,
  OwnedWeapon,
  PlayerRecords,
  SaveDataV1,
  SellMode,
  WeeklySeasonStats,
} from "@/types/game";
import type {
  BetaPlayerSnapshot,
  ServerActionPatch,
  ServerGameActionResponse,
} from "@/types/server";
import type { AdRewardFlowStatus } from "@/types/ads";

/** 세션당 오프라인 제련 보상 모달 1회 */
let sessionOfflineForgeModalShown = false;

const devSuccessRng = () => 0;

function devToolsRuntimeEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED !== "false"
  );
}

function isBetaMode(): boolean {
  return getGameMode() === "beta";
}

function newActionMeta() {
  return {
    actionId: crypto.randomUUID(),
    clientCreatedAt: new Date().toISOString(),
  };
}

function mapServerSnapshot(snapshot: BetaPlayerSnapshot, prev: GameStore) {
  const ownedWeapons = snapshot.ownedWeapons.map((w) => {
    const def = WEAPONS_BY_ID[w.weapon_id];
    const owned: OwnedWeapon = {
      instanceId: w.id,
      weaponId: w.weapon_id,
      enhanceLevel: Number(w.enhance_level),
      transcendLevel: Number(w.transcend_level),
      durability: Number(w.durability),
      locked: Boolean(w.is_locked),
      createdAt: new Date(w.created_at).getTime(),
      bestValue: 0,
    };
    return {
      ...owned,
      bestValue: def ? calculateRankingValue(def, owned) : 0,
    };
  });
  const equippedStillExists = ownedWeapons.some(
    (w) => w.instanceId === prev.equippedWeaponId,
  );

  return {
    gold: Number(snapshot.playerState.gold),
    ember: Number(snapshot.playerState.forge_ember),
    transcendStone: Number(snapshot.playerState.transcend_stone),
    forgeLevel: Number(snapshot.playerState.forge_level),
    forgeLastCollectAt: new Date(
      snapshot.playerState.forge_last_collected_at,
    ).getTime(),
    ownedWeapons,
    equippedWeaponId: equippedStillExists
      ? prev.equippedWeaponId
      : (getBestWeaponForRanking(ownedWeapons, (wid) => WEAPONS_BY_ID[wid]) ??
        ownedWeapons[0]?.instanceId ??
        null),
    records: snapshot.records,
    bestWeaponSnapshot: snapshot.bestWeaponSnapshot,
    weeklySeasonStats: snapshot.weeklySeasonStats,
    storedSeasonId: snapshot.currentSeason.seasonId,
  };
}

function serverErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return error instanceof Error
    ? error.message
    : "error.generic";
}

function sellErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "last_weapon_cannot_sell") {
      return "inventory.lastWeaponCannotSellLong";
    }
    if (error.code === "weapon_not_found") {
      return "error.weaponNotFound";
    }
    if (error.code === "weapon_already_sold") {
      return "error.weaponAlreadySold";
    }
    if (error.code === "request_timeout") {
      return "error.requestTimeout";
    }
  }
  return "error.generic";
}

function isAdRewardUserError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.code?.startsWith("ad_") ?? false;
  }
  return error instanceof Error && error.message.startsWith("ads.");
}

function adProgressModal(status: AdRewardFlowStatus): ModalState {
  return {
    kind: "ad_reward_progress",
    phase: status.phase,
    message: status.message,
  };
}

function patchFromServerAction(
  response: ServerGameActionResponse,
  prev: GameStore,
): Partial<GameStore> {
  const base = response.patch
    ? mapServerPatch(response.patch, prev)
    : response.snapshot
      ? mapServerSnapshot(response.snapshot, prev)
      : {};
  const display = response.display;
  if (!display) return base;

  switch (display.kind) {
    case "buy":
      return {
        ...base,
        modal: {
          kind: "buy_success",
          weaponId: display.weaponId,
          weaponName: display.weaponName,
        },
      };
    case "enhance": {
      const recordBreak = display.recordBreak
        ? enrichRecordBreakUi(display.recordBreak)
        : undefined;
      if (display.result.type === "success") {
        return {
          ...base,
          modal: {
            kind: "enhance_success",
            weaponId: display.weaponId,
            weaponName: display.weaponName,
            result: display.result,
            recordBreak,
          },
        };
      }
      if (display.result.type === "fail") {
        return {
          ...base,
          modal: {
            kind: "enhance_fail",
            weaponId: display.weaponId,
            weaponName: display.weaponName,
            result: display.result,
          },
        };
      }
      return {
        ...base,
        modal: {
          kind: "weapon_destroyed",
          destroyCause: "enhance",
          result: display.result,
        },
      };
    }
    case "transcend": {
      const recordBreak = display.recordBreak
        ? enrichRecordBreakUi(display.recordBreak)
        : undefined;
      if (display.result.type === "success") {
        return {
          ...base,
          modal: {
            kind: "transcend_success",
            weaponId: display.weaponId,
            weaponName: display.weaponName,
            weaponImagePath: display.weaponImagePath,
            beforeStar: display.result.beforeTranscend,
            afterStar: display.result.afterTranscend,
            beforeRankingValue: display.result.beforeRankingValue,
            afterRankingValue: display.result.afterRankingValue,
            beforeSaleGold: display.result.beforeSaleGold,
            afterSaleGold: display.result.afterSaleGold,
            recordBreak,
          },
        };
      }
      if (display.result.type === "fail") {
        return {
          ...base,
          modal: {
            kind: "transcend_fail",
            weaponId: display.weaponId,
            weaponName: display.weaponName,
            transcendLevel: display.result.transcendLevel,
            beforeDurability: display.result.beforeDurability,
            afterDurability: display.result.afterDurability,
            stoneCost: display.result.stoneCost,
          },
        };
      }
      return {
        ...base,
        modal: {
          kind: "weapon_destroyed",
          destroyCause: "transcend",
          result: {
            type: "destroyed",
            level: display.result.enhanceLevel,
            scrapRewards: display.result.scrapRewards,
            weaponName: display.result.weaponName,
          },
        },
      };
    }
    case "sell":
      return {
        ...base,
        modal: { kind: "sell_success", info: display.info },
      };
    case "forgeCollect":
      return {
        ...base,
        modal: {
          kind: "forge_collect_complete",
          gained: display.gained,
          basePending: display.basePending,
          usedAd: display.usedAd,
        },
      };
    case "forgeUpgrade":
      return {
        ...base,
        modal: { kind: "forge_upgrade_success", newLevel: display.newLevel },
      };
    default:
      return base;
  }
}

function modalFromEnhanceResponse(response: ServerGameActionResponse): ModalState {
  const display = response.display;
  if (display?.kind !== "enhance") return null;

  const recordBreak = display.recordBreak
    ? enrichRecordBreakUi(display.recordBreak)
    : undefined;

  if (display.result.type === "success") {
    return {
      kind: "enhance_success",
      weaponId: display.weaponId,
      weaponName: display.weaponName,
      result: display.result,
      recordBreak,
    };
  }

  if (display.result.type === "fail") {
    return {
      kind: "enhance_fail",
      weaponId: display.weaponId,
      weaponName: display.weaponName,
      result: display.result,
    };
  }

  return {
    kind: "weapon_destroyed",
    destroyCause: "enhance",
    result: display.result,
  };
}

function rowToStoreWeapon(row: ServerActionPatch["changedWeapon"]): OwnedWeapon | null {
  if (!row) return null;
  const def = WEAPONS_BY_ID[row.weapon_id];
  const owned: OwnedWeapon = {
    instanceId: row.id,
    weaponId: row.weapon_id,
    enhanceLevel: Number(row.enhance_level),
    transcendLevel: Number(row.transcend_level),
    durability: Number(row.durability),
    locked: Boolean(row.is_locked),
    createdAt: new Date(row.created_at).getTime(),
    bestValue: 0,
  };
  return {
    ...owned,
    bestValue: def ? calculateRankingValue(def, owned) : 0,
  };
}

function mapServerPatch(
  patch: ServerActionPatch,
  prev: GameStore,
): Partial<GameStore> {
  let ownedWeapons = prev.ownedWeapons;
  if (patch.removedWeaponId) {
    ownedWeapons = ownedWeapons.filter(
      (weapon) => weapon.instanceId !== patch.removedWeaponId,
    );
  }

  const changedWeapon = rowToStoreWeapon(patch.changedWeapon);
  if (changedWeapon) {
    const exists = ownedWeapons.some(
      (weapon) => weapon.instanceId === changedWeapon.instanceId,
    );
    ownedWeapons = exists
      ? ownedWeapons.map((weapon) =>
          weapon.instanceId === changedWeapon.instanceId ? changedWeapon : weapon,
        )
      : [...ownedWeapons, changedWeapon];
  }

  let equippedWeaponId =
    patch.equippedWeaponId !== undefined
      ? patch.equippedWeaponId
      : prev.equippedWeaponId;
  if (
    equippedWeaponId &&
    !ownedWeapons.some((weapon) => weapon.instanceId === equippedWeaponId)
  ) {
    equippedWeaponId =
      getBestWeaponForRanking(ownedWeapons, (wid) => WEAPONS_BY_ID[wid]) ??
      ownedWeapons[0]?.instanceId ??
      null;
  }

  return {
    ...(patch.currentGold !== undefined ? { gold: patch.currentGold } : {}),
    ...(patch.currentEmber !== undefined ? { ember: patch.currentEmber } : {}),
    ...(patch.currentStone !== undefined
      ? { transcendStone: patch.currentStone }
      : {}),
    ...(patch.forgeLevel !== undefined ? { forgeLevel: patch.forgeLevel } : {}),
    ...(patch.forgeLastCollectedAt
      ? { forgeLastCollectAt: new Date(patch.forgeLastCollectedAt).getTime() }
      : {}),
    ownedWeapons,
    equippedWeaponId,
    ...(patch.records ? { records: patch.records } : {}),
    ...(patch.weeklySeasonStats
      ? { weeklySeasonStats: patch.weeklySeasonStats }
      : {}),
    ...(patch.bestWeaponSnapshot !== undefined
      ? { bestWeaponSnapshot: patch.bestWeaponSnapshot }
      : {}),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runWhenIdle(callback: () => void): void {
  if (typeof window === "undefined") {
    callback();
    return;
  }
  const run = () => {
    const requestIdle = window.requestIdleCallback;
    if (requestIdle) requestIdle(callback, { timeout: 700 });
    else window.setTimeout(callback, 80);
  };
  requestAnimationFrame(run);
}

function syncServerSnapshotDeferred(
  snapshot: BetaPlayerSnapshot | undefined,
  get: () => GameStore,
  set: (patch: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  source?: "enhance" | "adReward",
): void {
  if (!snapshot) return;
  runWhenIdle(() => {
    const startedAt = Date.now();
    set({
      ...mapServerSnapshot(snapshot, get()),
    });
    const elapsedMs = Date.now() - startedAt;
    updatePerformanceMetric({
      lastStoreSyncElapsedMs: Date.now() - startedAt,
      ...(source === "enhance" ? { enhanceStoreSyncMs: elapsedMs } : {}),
      ...(source === "adReward"
        ? {
            adRewardPatchApplyMs: elapsedMs,
            adRewardStoreSyncMs: elapsedMs,
            adRewardDeferredSyncMs: elapsedMs,
          }
        : {}),
    });
    diagnosticLog("store", "server snapshot sync complete", {
      source,
      elapsedMs,
    });
  });
}

function syncServerPatchDeferred(
  patch: ServerActionPatch | undefined,
  get: () => GameStore,
  set: (patch: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  source?: "enhance" | "adReward",
  onComplete?: () => void,
): void {
  if (!patch) return;
  runWhenIdle(() => {
    const startedAt = Date.now();
    set({
      ...mapServerPatch(patch, get()),
    });
    const elapsedMs = Date.now() - startedAt;
    updatePerformanceMetric({
      lastStoreSyncElapsedMs: elapsedMs,
      ...(source === "enhance" ? { enhanceStoreSyncMs: elapsedMs } : {}),
      ...(source === "adReward"
        ? {
            adRewardStoreSyncMs: elapsedMs,
            adRewardDeferredSyncMs: elapsedMs,
          }
        : {}),
    });
    diagnosticLog("store", "server patch sync complete", {
      source,
      elapsedMs,
    });
    onComplete?.();
  });
}

function syncLatestServerSnapshotDeferred(
  get: () => GameStore,
  set: (patch: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
): void {
  invalidatePlayerApiCache();
  runWhenIdle(() => {
    const startedAt = Date.now();
    diagnosticLog("adReward", "deferred snapshot sync start");
    void getCurrentPlayerSnapshot({ force: true })
      .then((snapshot) => {
        set((state) => mapServerSnapshot(snapshot, state));
        updatePerformanceMetric({
          adRewardDeferredSyncMs: Date.now() - startedAt,
        });
        diagnosticLog("adReward", "deferred snapshot sync finished", {
          elapsedMs: Date.now() - startedAt,
        });
      })
      .catch((error) => {
        diagnosticLog("adReward", "deferred snapshot sync failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

function modalFromAdRewardResponse(response: ServerGameActionResponse): ModalState {
  const display = response.display;
  if (display?.kind === "forgeCollect") {
    return {
      kind: "forge_collect_complete",
      gained: display.gained,
      basePending: display.basePending,
      usedAd: display.usedAd,
    };
  }
  if (display?.kind === "sell") {
    return {
      kind: "sell_success",
      info: display.info,
    };
  }
  return null;
}

async function runAdRewardAction(params: {
  request: Parameters<typeof requestAdReward>[0];
  get: () => GameStore;
  set: (patch: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void;
  onApplied?: () => void;
  onPatchSynced?: () => void;
  onFailure?: () => void;
}) {
  const renderStart = getRenderCount("ModalRoot");
  params.set({
    serverActionPending: true,
    serverActionMessage: "loading.rewardChecking",
    modal: {
      kind: "ad_reward_progress",
      phase: "preparing",
      message: "loading.rewardChecking",
    },
  });

  try {
    const intent = await requestAdReward(params.request);
    const completeStartedAt = Date.now();
    let rewardedAt: number | null = null;
    let completeApiStartedAt: number | null = null;
    let completeApiResponseAt: number | null = null;
    const response = await completeAdReward(intent, {
      onStatus: (status) =>
        params.set({
          modal: adProgressModal(status),
          serverActionMessage:
            status.phase === "completing"
              ? "loading.rewardChecking"
              : status.message,
        }),
      onTiming: (event) => {
        const now = Date.now();
        diagnosticLog("adReward", event, { elapsedMs: now - completeStartedAt });
        if (event === "rewarded_event") {
          rewardedAt = now;
          updatePerformanceMetric({
            adRewardProviderRewardedEventMs: now - completeStartedAt,
          });
        }
        if (event === "complete_api_start") {
          completeApiStartedAt = now;
          updatePerformanceMetric({
            adRewardEventToCompleteApiStartMs: rewardedAt
              ? now - rewardedAt
              : undefined,
          });
        }
        if (event === "complete_api_response") {
          completeApiResponseAt = now;
          updatePerformanceMetric({
            adCompleteApiMs: completeApiStartedAt
              ? now - completeApiStartedAt
              : undefined,
          });
        }
      },
    });
    const responseReceivedAt = completeApiResponseAt ?? Date.now();
    updatePerformanceMetric({
      adRewardCompleteElapsedMs: Date.now() - completeStartedAt,
      adCompleteTotalMs: Date.now() - completeStartedAt,
    });
    params.onApplied?.();
    const resultStartedAt = Date.now();
    const nextModal = modalFromAdRewardResponse(response);
    updatePerformanceMetric({
      adRewardResultDataCreateMs: Date.now() - resultStartedAt,
    });
    const modalStartedAt = Date.now();
    params.set({
      modal: nextModal,
      serverActionPending: false,
      serverActionMessage: null,
    });
    updatePerformanceMetric({
      adCompleteResponseToModalOpenMs: modalStartedAt - responseReceivedAt,
      adRewardModalOpenRequestMs: modalStartedAt - responseReceivedAt,
    });
    requestAnimationFrame(() => {
      updatePerformanceMetric({
        adRewardModalOpenMs: Date.now() - modalStartedAt,
        adCompleteTotalMs: Date.now() - completeStartedAt,
        renderCountDuringAdReward:
          getRenderCount("ModalRoot") - renderStart,
      });
    });
    if (response.patch) {
      updatePerformanceMetric({
        adRewardDeferredSyncScheduledMs: Date.now() - responseReceivedAt,
      });
      syncServerPatchDeferred(
        response.patch,
        params.get,
        params.set,
        "adReward",
        params.onPatchSynced,
      );
    } else {
      updatePerformanceMetric({
        adRewardDeferredSyncScheduledMs: Date.now() - responseReceivedAt,
      });
      syncServerSnapshotDeferred(
        response.snapshot,
        params.get,
        params.set,
        "adReward",
      );
      params.onPatchSynced?.();
    }
    if (!response.patch && !response.snapshot) {
      syncLatestServerSnapshotDeferred(params.get, params.set);
    }
    scheduleAdRewardStatusRefreshAfterReward({
      rewardType: params.request.rewardType,
      relatedActionId:
        params.request.targetWeaponInstanceId ?? params.request.relatedActionId,
    });
  } catch (error) {
    params.onFailure?.();
    playUiError();
    const message = serverErrorMessage(error);
    params.set({
      serverActionPending: false,
      serverActionMessage: null,
      modal: isAdRewardUserError(error)
        ? {
            kind: "ad_reward_progress",
            phase: message === "ads.failedToLoad" ? "unavailable" : "notCompleted",
            message,
          }
        : {
            kind: "server_error",
            message,
          },
    });
  }
}

export interface GameStore extends SaveDataV1 {
  activeTab: NavTab;
  modal: ModalState;
  /** 강화 연출 중 — persist 제외 */
  isEnhancing: boolean;
  enhancePending: EnhancePendingResolution | null;
  enhanceAnimationTier: EnhanceAnimationTier | null;
  /** 망치 타격 연출 강도 1~3 */
  enhanceHammerPhase: 0 | 1 | 2 | 3;
  /** beta mode 서버 액션 중복 클릭 방지 */
  serverActionPending: boolean;
  serverActionMessage: string | null;
  pendingSellWeaponIds: string[];
  /** 개발 전용 — persist 제외 */
  devForceSuccess: boolean;
  syncFromServerPlayerMe: (snapshot: BetaPlayerSnapshot) => void;
  reloadServerSnapshot: () => Promise<void>;
  runDevPerfSmoke: () => Promise<void>;
  setActiveTab: (tab: NavTab) => void;
  closeModal: () => void;
  acknowledgeSeasonStart: () => void;
  buyWeapon: (weaponId: string) => void;
  confirmBuyWeapon: () => void;
  equipWeapon: (instanceId: string) => void;
  requestEnhanceEquipped: () => void;
  prepareEnhanceRoll: () => boolean;
  finalizeEnhanceOutcome: () => void;
  setEnhanceHammerPhase: (phase: 0 | 1 | 2 | 3) => void;
  requestTranscendEquipped: () => void;
  commitTranscendEquipped: () => void;
  collectForge: (withAd: boolean) => void;
  requestForgeUpgrade: () => void;
  confirmForgeUpgrade: () => void;
  tryAutoOfflineForgeModal: () => void;
  mockWatchAd: () => void;
  mockDoubleDestroyScrap: () => void;
  mockAdReward: (kind: "gold" | "ember" | "stone") => void;
  devAddGold: (n: number) => void;
  devAddEmber: (n: number) => void;
  devAddStone: (n: number) => void;
  devMaxEnhanceEquipped: () => void;
  devRestoreDurability: () => void;
  devSetEquippedTranscendLevel: (lv: number) => void;
  devSetForceSuccess: (enabled: boolean) => void;
  resetProgress: () => void;
  requestSellEquipped: () => void;
  requestSellWeapon: (instanceId: string) => void;
  commitSell: (mode: SellMode) => void;
  toggleWeaponLock: (instanceId: string) => void;
}

function newInstanceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `inst_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeRecords(r: Partial<PlayerRecords> | undefined): PlayerRecords {
  return {
    weeklyBestValue: r?.weeklyBestValue ?? 0,
    totalEnhanceAttempts: r?.totalEnhanceAttempts ?? 0,
    totalEnhanceSuccesses: r?.totalEnhanceSuccesses ?? 0,
    totalSalesGold: r?.totalSalesGold ?? 0,
    bestSaleGold: r?.bestSaleGold ?? 0,
    soldWeaponCount: r?.soldWeaponCount ?? 0,
    totalForgeCollected: r?.totalForgeCollected ?? 0,
    totalForgeAdBonusCollected: r?.totalForgeAdBonusCollected ?? 0,
    forgeCollectCount: r?.forgeCollectCount ?? 0,
    forgeAdCollectCount: r?.forgeAdCollectCount ?? 0,
    personalBestRankingValue: r?.personalBestRankingValue ?? r?.weeklyBestValue ?? 0,
    transcendAttemptCount: r?.transcendAttemptCount ?? 0,
    transcendSuccessCount: r?.transcendSuccessCount ?? 0,
    transcendFailCount: r?.transcendFailCount ?? 0,
    maxTranscendLevel: r?.maxTranscendLevel ?? 0,
    bestTranscendedWeaponValue: r?.bestTranscendedWeaponValue ?? 0,
    transcendDestroyedCount: r?.transcendDestroyedCount ?? 0,
    enhanceFailCount: r?.enhanceFailCount ?? 0,
    enhanceDestroyedCount: r?.enhanceDestroyedCount ?? 0,
    destroyedWeaponCount: r?.destroyedWeaponCount ?? 0,
    maxEnhanceLevel: r?.maxEnhanceLevel ?? 0,
  };
}

function starterOwned(): OwnedWeapon {
  const def = WEAPONS_BY_ID[STARTER_WEAPON_ID];
  const instanceId = newInstanceId();
  const w: OwnedWeapon = {
    instanceId,
    weaponId: STARTER_WEAPON_ID,
    enhanceLevel: 0,
    transcendLevel: 0,
    durability: DEFAULT_DURABILITY,
    locked: false,
    createdAt: Date.now(),
    bestValue: 0,
  };
  return {
    ...w,
    bestValue: calculateRankingValue(def, w),
  };
}

function initialRecords(): PlayerRecords {
  return {
    weeklyBestValue: 0,
    totalEnhanceAttempts: 0,
    totalEnhanceSuccesses: 0,
    totalSalesGold: 0,
    bestSaleGold: 0,
    soldWeaponCount: 0,
    totalForgeCollected: 0,
    totalForgeAdBonusCollected: 0,
    forgeCollectCount: 0,
    forgeAdCollectCount: 0,
    personalBestRankingValue: 0,
    transcendAttemptCount: 0,
    transcendSuccessCount: 0,
    transcendFailCount: 0,
    maxTranscendLevel: 0,
    bestTranscendedWeaponValue: 0,
    transcendDestroyedCount: 0,
    enhanceFailCount: 0,
    enhanceDestroyedCount: 0,
    destroyedWeaponCount: 0,
    maxEnhanceLevel: 0,
  };
}

function freshWeeklySeasonStats(seasonId: string): WeeklySeasonStats {
  return {
    seasonId,
    weeklyStrongestWeaponValue: 0,
    weeklyStrongestWeaponName: "",
    weeklyStrongestEnhanceLevel: 0,
    weeklyStrongestTranscendLevel: 0,
    enhanceSuccessesThisSeason: 0,
    transcendSuccessesThisSeason: 0,
    salesGoldThisSeason: 0,
  };
}

export function createFreshSave(): SaveDataV1 {
  const s = starterOwned();
  const starterDef = WEAPONS_BY_ID[s.weaponId];
  const starterRv = starterDef ? calculateRankingValue(starterDef, s) : 0;
  const si = getCurrentSeasonInfo();
  const snap =
    starterDef && starterRv > 0
      ? maybeUpdateBestWeaponSnapshot(starterDef, s, null)
      : null;
  return {
    version: 1,
    gold: INITIAL_GOLD,
    ember: INITIAL_EMBER,
    transcendStone: INITIAL_TRANSCEND_STONE,
    ownedWeapons: [s],
    equippedWeaponId: s.instanceId,
    forgeLevel: FORGE_START_LEVEL,
    forgeLastCollectAt: Date.now(),
    records: {
      ...initialRecords(),
      weeklyBestValue: starterRv,
      personalBestRankingValue: starterRv,
      maxEnhanceLevel: s.enhanceLevel,
    },
    bestWeaponSnapshot: snap,
    weeklySeasonStats: freshWeeklySeasonStats(si.seasonId),
    storedSeasonId: si.seasonId,
    lastAcknowledgedSeasonId: si.seasonId,
  };
}

function bumpWeeklyBest(
  records: PlayerRecords,
  owned: OwnedWeapon[],
): PlayerRecords {
  let max = records.weeklyBestValue;
  for (const o of owned) {
    const def = WEAPONS_BY_ID[o.weaponId];
    if (!def) continue;
    max = Math.max(max, calculateRankingValue(def, o));
  }
  return { ...records, weeklyBestValue: max };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createFreshSave(),
      activeTab: "blacksmith" as NavTab,
      modal: null as ModalState,
      isEnhancing: false,
      enhancePending: null as EnhancePendingResolution | null,
      enhanceAnimationTier: null as EnhanceAnimationTier | null,
      enhanceHammerPhase: 0 as 0 | 1 | 2 | 3,
      serverActionPending: false,
      serverActionMessage: null,
      pendingSellWeaponIds: [] as string[],
      devForceSuccess: false,

      syncFromServerPlayerMe: (snapshot: BetaPlayerSnapshot) => {
        set((state) => mapServerSnapshot(snapshot, state));
      },

      reloadServerSnapshot: async () => {
        if (!isBetaMode()) return;
        invalidatePlayerApiCache();
        set({
          serverActionPending: true,
          serverActionMessage: "loading.reloadServerData",
        });
        try {
          const snapshot = await getCurrentPlayerSnapshot({ force: true });
          set((state) => ({
            ...mapServerSnapshot(snapshot, state),
            serverActionPending: false,
            serverActionMessage: null,
            modal: null,
          }));
        } catch (error) {
          set({
            serverActionPending: false,
            serverActionMessage: null,
            modal: {
              kind: "server_error",
              message: serverErrorMessage(error),
            },
          });
        }
      },

      runDevPerfSmoke: async () => {
        if (!isBetaMode() || !devToolsRuntimeEnabled()) return;
        if (get().serverActionPending) return;

        set({
          serverActionPending: true,
          serverActionMessage: "Perf smoke running...",
          modal: null,
        });

        const applyResponse = (response: ServerGameActionResponse) => {
          set((state) => ({
            ...patchFromServerAction(response, state),
            modal: null,
          }));
        };

        try {
          let enhanceCount = 0;
          let buyCount = 0;
          let forgeCollectCount = 0;
          let sellCount = 0;

          for (let i = 0; i < 5; i += 1) {
            const targetId = get().equippedWeaponId;
            if (!targetId) break;
            const target = get().ownedWeapons.find(
              (weapon) => weapon.instanceId === targetId,
            );
            if (!target || target.enhanceLevel >= 15) break;
            applyResponse(
              await enhanceWeaponApi({
                ...newActionMeta(),
                weaponInstanceId: targetId,
              }),
            );
            enhanceCount += 1;
          }

          for (const def of WEAPON_DEFINITIONS) {
            if (buyCount >= 5) break;
            const state = get();
            if (state.ownedWeapons.some((weapon) => weapon.weaponId === def.id)) {
              continue;
            }
            if (state.gold < def.basePrice) continue;
            applyResponse(
              await buyWeaponApi({
                ...newActionMeta(),
                weaponId: def.id,
              }),
            );
            buyCount += 1;
          }

          for (let i = 0; i < 2; i += 1) {
            const state = get();
            const pending = computePendingForgeEmber({
              forgeLevel: state.forgeLevel,
              forgeLastCollectAt: state.forgeLastCollectAt,
              now: Date.now(),
            });
            if (pending <= 0) break;
            applyResponse(
              await collectForgeApi({
                ...newActionMeta(),
                collectMode: "normal",
              }),
            );
            forgeCollectCount += 1;
          }

          for (let i = 0; i < 5; i += 1) {
            const state = get();
            const sellable = state.ownedWeapons.find(
              (weapon) =>
                weapon.instanceId !== state.equippedWeaponId &&
                !weapon.locked &&
                !state.pendingSellWeaponIds.includes(weapon.instanceId),
            );
            if (!sellable || state.ownedWeapons.length <= 1) break;
            applyResponse(
              await sellWeaponApi({
                ...newActionMeta(),
                weaponInstanceId: sellable.instanceId,
                sellMode: "normal",
              }),
            );
            sellCount += 1;
          }

          set({
            serverActionPending: false,
            serverActionMessage: `Perf smoke done: enhance ${enhanceCount}, buy ${buyCount}, forge ${forgeCollectCount}, sell ${sellCount}`,
            modal: null,
          });
          window.setTimeout(() => {
            if (get().serverActionMessage?.startsWith("Perf smoke done:")) {
              set({ serverActionMessage: null });
            }
          }, 2500);
        } catch (error) {
          set({
            serverActionPending: false,
            serverActionMessage: null,
            modal: {
              kind: "server_error",
              message: serverErrorMessage(error),
            },
          });
        }
      },

      setActiveTab: (tab: NavTab) => set({ activeTab: tab }),

      closeModal: () => set({ modal: null }),

      acknowledgeSeasonStart: () => {
        const si = getCurrentSeasonInfo();
        set({
          lastAcknowledgedSeasonId: si.seasonId,
          modal: null,
        });
      },
      buyWeapon: (weaponId: string) => {
        const def = WEAPONS_BY_ID[weaponId];
        if (!def) return;
        const price = def.basePrice;
        const state = get();
        if (state.gold < price) {
          playUiError();
          return;
        }
        set({
          modal: {
            kind: "buy_confirm",
            weapon: def,
          },
        });
      },

      confirmBuyWeapon: () => {
        const modal = get().modal;
        if (!modal || modal.kind !== "buy_confirm") return;
        const def = modal.weapon;
        if (isBetaMode()) {
          const state = get();
          if (state.serverActionPending) return;
          set({
            serverActionPending: true,
            serverActionMessage: "loading.purchaseProcessing",
          });
          void buyWeaponApi({
            ...newActionMeta(),
            weaponId: def.id,
          })
            .then((response) => {
              playSound("weaponPurchase");
              set({
                ...patchFromServerAction(response, get()),
                serverActionPending: false,
                serverActionMessage: null,
              });
            })
            .catch((error) => {
              playUiError();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                modal: {
                  kind: "server_error",
                  message: serverErrorMessage(error),
                },
              });
            });
          return;
        }
        const price = def.basePrice;
        const state = get();
        if (state.gold < price) {
          playUiError();
          return;
        }

        playSound("weaponPurchase");

        const created: OwnedWeapon = {
          instanceId: newInstanceId(),
          weaponId: def.id,
          enhanceLevel: 0,
          transcendLevel: 0,
          durability: DEFAULT_DURABILITY,
          locked: false,
          createdAt: Date.now(),
          bestValue: 0,
        };
        const fixed: OwnedWeapon = {
          ...created,
          bestValue: calculateRankingValue(def, created),
        };

        const ownedWeapons = [...state.ownedWeapons, fixed];
        set({
          gold: state.gold - price,
          ownedWeapons,
          records: bumpWeeklyBest(state.records, ownedWeapons),
          modal: { kind: "buy_success", weaponId: def.id, weaponName: def.name },
        });
      },

      equipWeapon: (instanceId: string) => {
        const startedAt = performance.now();
        const state = get();
        const exists = state.ownedWeapons.some((w) => w.instanceId === instanceId);
        if (!exists) return;
        if (state.pendingSellWeaponIds.includes(instanceId)) return;
        set({
          equippedWeaponId: instanceId,
          activeTab: "blacksmith",
        });
        recordPerfEvent({
          screen: state.activeTab,
          eventType: "action",
          actionName: "equip",
          elapsedMs: performance.now() - startedAt,
          error: "",
        });
      },

      requestSellEquipped: () => {
        const id = get().equippedWeaponId;
        if (!id) return;
        get().requestSellWeapon(id);
      },

      requestSellWeapon: (instanceId: string) => {
        const state = get();
        if (state.serverActionPending || state.pendingSellWeaponIds.includes(instanceId)) {
          return;
        }
        const w = state.ownedWeapons.find((x) => x.instanceId === instanceId);
        if (!w) return;
        if (state.ownedWeapons.length <= 1) {
          playUiError();
          set({
            modal: {
              kind: "server_error",
              message: "inventory.lastWeaponCannotSellLong",
            },
          });
          return;
        }
        if (w.locked) {
          playUiError();
          set({ modal: { kind: "sell_locked_notice" } });
          return;
        }
        if (w.durability <= 0) return;
        const def = WEAPONS_BY_ID[w.weaponId];
        if (!def) return;
        const saleGold = calculateSaleGold(def, w);
        const adSaleGold = calculateAdSaleGold(saleGold);
        const rankingValue = calculateRankingValue(def, w);
        set({
          modal: {
            kind: "sell_confirm",
            instanceId,
            weapon: def,
            owned: w,
            saleGold,
            adSaleGold,
            rankingValue,
          },
        });
      },

      commitSell: (mode: SellMode) => {
        const modal = get().modal;
        if (!modal || modal.kind !== "sell_confirm") return;
        const { instanceId } = modal;
        if (isBetaMode()) {
          const state = get();
          if (
            state.serverActionPending ||
            state.pendingSellWeaponIds.includes(instanceId)
          ) {
            return;
          }
          const actionMeta = newActionMeta();
          set({
            pendingSellWeaponIds: [...state.pendingSellWeaponIds, instanceId],
            serverActionPending: true,
            serverActionMessage:
              mode === "adBonus" ? "loading.adSellProcessing" : "loading.sellProcessing",
          });
          const action =
            mode === "adBonus"
              ? runAdRewardAction({
                  request: {
                    actionId: actionMeta.actionId,
                    rewardType: "sellBonus",
                    targetWeaponInstanceId: instanceId,
                  },
                  get,
                  set,
                  onApplied: () => playSound("weaponSell"),
                  onPatchSynced: () =>
                    set((s) => ({
                      pendingSellWeaponIds: s.pendingSellWeaponIds.filter(
                        (id) => id !== instanceId,
                      ),
                    })),
                  onFailure: () =>
                    set((s) => ({
                      pendingSellWeaponIds: s.pendingSellWeaponIds.filter(
                        (id) => id !== instanceId,
                      ),
                    })),
                })
              : sellWeaponApi({
                  ...actionMeta,
                  weaponInstanceId: instanceId,
                  sellMode: mode,
                }).then((response) => {
                  playSound("weaponSell");
                  set({
                    ...patchFromServerAction(response, get()),
                    serverActionPending: false,
                    serverActionMessage: null,
                    pendingSellWeaponIds: get().pendingSellWeaponIds.filter(
                      (id) => id !== instanceId,
                    ),
                  });
                });
          void action
            .then((response) => {
              void response;
            })
            .catch((error) => {
              playUiError();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                pendingSellWeaponIds: get().pendingSellWeaponIds.filter(
                  (id) => id !== instanceId,
                ),
                modal: {
                  kind: "server_error",
                  message: sellErrorMessage(error),
                },
              });
            });
          return;
        }
        const state = get();
        const live = state.ownedWeapons.find((x) => x.instanceId === instanceId);
        if (!live || live.locked) {
          set({ modal: null });
          return;
        }
        const def = WEAPONS_BY_ID[live.weaponId];
        if (!def || live.durability <= 0) return;

        const saleGold = calculateSaleGold(def, live);
        const finalGold =
          mode === "adBonus" ? calculateAdSaleGold(saleGold) : saleGold;

        playSound("weaponSell");

        const wasEquipped = state.equippedWeaponId === instanceId;
        const remaining = state.ownedWeapons.filter(
          (x) => x.instanceId !== instanceId,
        );

        let nextEquipped = state.equippedWeaponId;
        if (wasEquipped || nextEquipped === instanceId) {
          nextEquipped =
            getBestWeaponForRanking(remaining, (wid) => WEAPONS_BY_ID[wid]) ??
            null;
        }

        const nextRecords: PlayerRecords = {
          ...state.records,
          totalSalesGold: state.records.totalSalesGold + finalGold,
          bestSaleGold: Math.max(state.records.bestSaleGold, finalGold),
          soldWeaponCount: state.records.soldWeaponCount + 1,
        };

        const bestWeaponSnapshot = maybeUpdateBestWeaponSnapshot(
          def,
          live,
          state.bestWeaponSnapshot,
        );
        const si = getCurrentSeasonInfo();
        let weeklySeasonStats = { ...state.weeklySeasonStats };
        if (weeklySeasonStats.seasonId !== si.seasonId) {
          weeklySeasonStats = freshWeeklySeasonStats(si.seasonId);
        }
        weeklySeasonStats = {
          ...weeklySeasonStats,
          salesGoldThisSeason: weeklySeasonStats.salesGoldThisSeason + finalGold,
        };

        set({
          gold: state.gold + finalGold,
          ownedWeapons: remaining,
          equippedWeaponId: nextEquipped,
          bestWeaponSnapshot,
          weeklySeasonStats,
          records: bumpWeeklyBest(nextRecords, remaining),
          modal: {
            kind: "sell_success",
            info: {
              weaponId: def.id,
              weaponName: def.name,
              enhanceLevel: live.enhanceLevel,
              transcendLevel: live.transcendLevel,
              baseSaleGold: saleGold,
              finalSaleGold: finalGold,
              usedAdBonus: mode === "adBonus",
              wasEquipped,
            },
          },
        });
      },

      toggleWeaponLock: (instanceId: string) => {
        const startedAt = performance.now();
        const state = get();
        if (
          state.serverActionPending ||
          state.pendingSellWeaponIds.includes(instanceId)
        ) {
          return;
        }
        set((s) => ({
          ownedWeapons: s.ownedWeapons.map((w) =>
            w.instanceId === instanceId ? { ...w, locked: !w.locked } : w,
          ),
        }));
        recordPerfEvent({
          screen: state.activeTab,
          eventType: "action",
          actionName: "lock",
          elapsedMs: performance.now() - startedAt,
          error: "",
        });
      },

      requestEnhanceEquipped: () => {
        const state = get();
        const id = state.equippedWeaponId;
        if (!id) return;
        if (state.pendingSellWeaponIds.includes(id)) return;
        const owned = state.ownedWeapons.find((w) => w.instanceId === id);
        if (!owned) return;
        const def = WEAPONS_BY_ID[owned.weaponId];
        if (!def) return;
        if (owned.enhanceLevel >= 15) {
          playUiError();
          return;
        }

        const targetLevel = owned.enhanceLevel + 1;
        const cost = getEnhanceCostEmber(def, targetLevel);
        if (state.ember < cost) {
          playUiError();
          return;
        }

        const rate = getEnhanceSuccessRate(targetLevel);
        const need = shouldConfirmEnhance({
          targetLevel,
          durability: owned.durability,
        });

        if (need) {
          set({
            modal: {
              kind: "enhance_confirm",
              weaponId: def.id,
              weaponName: def.name,
              targetLevel,
              successRatePercent: rate * 100,
              costEmber: cost,
              durabilityLossOnFail: durabilityLossOnFail(targetLevel),
              currentDurability: owned.durability,
            },
          });
          return;
        }

        get().prepareEnhanceRoll();
      },

      setEnhanceHammerPhase: (phase: 0 | 1 | 2 | 3) =>
        set({ enhanceHammerPhase: phase }),

      prepareEnhanceRoll: () => {
        const state = get();
        if (state.isEnhancing) return false;

        const id = state.equippedWeaponId;
        if (!id) return false;
        if (state.pendingSellWeaponIds.includes(id)) return false;
        const owned = state.ownedWeapons.find((w) => w.instanceId === id);
        if (!owned) return false;
        const def = WEAPONS_BY_ID[owned.weaponId];
        if (!def) return false;
        if (owned.enhanceLevel >= 15) return false;

        const targetLevel = owned.enhanceLevel + 1;
        const cost = getEnhanceCostEmber(def, targetLevel);
        if (state.ember < cost) {
          playUiError();
          return false;
        }

        if (isBetaMode()) {
          if (state.serverActionPending) return false;
          const tier: EnhanceAnimationTier = targetLevel >= 8 ? "heavy" : "fast";
          const minAnimationMs = tier === "heavy" ? 1_800 : 650;
          const slowMessageMs = tier === "heavy" ? 2_500 : 1_500;
          const actionStartedAt = Date.now();
          const renderStart = getRenderCount("BlacksmithScreen");
          let waitMessageTimer: ReturnType<typeof setTimeout> | null = null;
          diagnosticLog("enhance", "button click", {
            weaponInstanceId: id,
            targetLevel,
            tier,
          });
          set({
            serverActionPending: true,
            serverActionMessage: null,
            modal: null,
            isEnhancing: true,
            enhancePending: null,
            enhanceAnimationTier: tier,
            enhanceHammerPhase: 0,
          });
          playSound("enhanceStart", { bypassThrottle: true });
          updatePerformanceMetric({
            enhanceTotalMs: 0,
            enhanceApiMs: undefined,
            enhanceAnimationWaitMs: minAnimationMs,
            enhanceRenderCountDuringAction: 0,
          });
          waitMessageTimer = setTimeout(() => {
            if (get().serverActionPending) {
              set({ serverActionMessage: "loading.resultChecking" });
            }
          }, slowMessageMs);
          void (async () => {
            const animationPromise = delay(minAnimationMs);
            try {
              const apiStartedAt = Date.now();
              diagnosticLog("enhance", "api request start", { targetLevel });
              const responsePromise = enhanceWeaponApi({
                ...newActionMeta(),
                weaponInstanceId: id,
              }).then((response) => {
                const apiMs = Date.now() - apiStartedAt;
                diagnosticLog("enhance", "api response received", { apiMs });
                updatePerformanceMetric({ enhanceApiMs: apiMs });
                return response;
              });
              const [response] = await Promise.all([
                responsePromise,
                animationPromise,
              ]);
              diagnosticLog("enhance", "animation and api complete", {
                elapsedMs: Date.now() - actionStartedAt,
              });
              const display = response.display;
              const resultModal = modalFromEnhanceResponse(response);
              const modalStartedAt = Date.now();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                isEnhancing: false,
                enhancePending: null,
                enhanceAnimationTier: null,
                enhanceHammerPhase: 0,
                modal: resultModal,
              });
              requestAnimationFrame(() => {
                updatePerformanceMetric({
                  enhanceModalOpenMs: Date.now() - modalStartedAt,
                  enhanceTotalMs: Date.now() - actionStartedAt,
                  enhanceRenderCountDuringAction:
                    getRenderCount("BlacksmithScreen") - renderStart,
                });
              });
              if (display?.kind === "enhance") {
                scheduleEnhanceOutcomeSounds(
                  display.result,
                  Boolean(display.recordBreak),
                  100,
                );
              }
              if (response.patch) {
                syncServerPatchDeferred(response.patch, get, set, "enhance");
              } else {
                syncServerSnapshotDeferred(response.snapshot, get, set, "enhance");
              }
            } catch (error) {
              await animationPromise.catch(() => undefined);
              playUiError();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                isEnhancing: false,
                enhancePending: null,
                enhanceAnimationTier: null,
                enhanceHammerPhase: 0,
                modal: {
                  kind: "server_error",
                  message: serverErrorMessage(error),
                },
              });
            } finally {
              if (waitMessageTimer) clearTimeout(waitMessageTimer);
            }
          })();
          return true;
        }

        set({ ember: state.ember - cost, modal: null });

        const afterSpend = get();
        const current = afterSpend.ownedWeapons.find((w) => w.instanceId === id);
        if (!current) {
          set({ ember: afterSpend.ember + cost });
          return false;
        }

        const result = rollEnhancement({
          def,
          weapon: current,
          rng:
            afterSpend.devForceSuccess && process.env.NODE_ENV !== "production"
              ? devSuccessRng
              : Math.random,
        });

        let enhanceRecordBreak = false;
        if (result.type === "success") {
          const projected: OwnedWeapon = {
            ...current,
            enhanceLevel: result.afterLevel,
          };
          const rankingAfter = calculateRankingValue(def, projected);
          enhanceRecordBreak = Boolean(
            buildLocalRecordBreakInfo({
              previousBest: afterSpend.records.personalBestRankingValue,
              newBest: rankingAfter,
              previousWeeklyBest:
                afterSpend.weeklySeasonStats.weeklyStrongestWeaponValue,
            }),
          );
        }

        const tier: EnhanceAnimationTier = targetLevel < 8 ? "fast" : "heavy";

        set({
          isEnhancing: true,
          enhancePending: {
            instanceId: id,
            weaponId: def.id,
            result,
            enhanceRecordBreak,
            tier,
          },
          enhanceHammerPhase: 0,
        });
        return true;
      },

      finalizeEnhanceOutcome: () => {
        const state = get();
        const pending = state.enhancePending;
        if (!pending) return;

        const id = pending.instanceId;
        const def = WEAPONS_BY_ID[pending.weaponId];
        const result = pending.result;
        if (!def) {
          set({
            isEnhancing: false,
            enhancePending: null,
            enhanceHammerPhase: 0,
          });
          return;
        }

        const afterSpend = state;
        const current = afterSpend.ownedWeapons.find((w) => w.instanceId === id);
        if (!current) {
          set({
            isEnhancing: false,
            enhancePending: null,
            enhanceHammerPhase: 0,
          });
          return;
        }

        let nextWeapons = afterSpend.ownedWeapons;
        let nextEquipped = afterSpend.equippedWeaponId;
        let nextGold = afterSpend.gold;
        let nextEmber = afterSpend.ember;
        let nextStone = afterSpend.transcendStone;
        let nextRecords: PlayerRecords = {
          ...afterSpend.records,
          totalEnhanceAttempts: afterSpend.records.totalEnhanceAttempts + 1,
        };

        if (result.type === "success") {
          const projected: OwnedWeapon = {
            ...current,
            enhanceLevel: result.afterLevel,
          };
          const rankingAfter = calculateRankingValue(def, projected);
          const prevPersonal = nextRecords.personalBestRankingValue;
          const recordBreak = buildLocalRecordBreakInfo({
            previousBest: prevPersonal,
            newBest: rankingAfter,
            previousWeeklyBest:
              afterSpend.weeklySeasonStats.weeklyStrongestWeaponValue,
          });
          nextRecords = {
            ...nextRecords,
            totalEnhanceSuccesses: nextRecords.totalEnhanceSuccesses + 1,
            personalBestRankingValue: Math.max(prevPersonal, rankingAfter),
            maxEnhanceLevel: Math.max(nextRecords.maxEnhanceLevel, result.afterLevel),
          };
          nextWeapons = nextWeapons.map((w) =>
            w.instanceId === id
              ? {
                  ...w,
                  enhanceLevel: result.afterLevel,
                  bestValue: Math.max(w.bestValue, rankingAfter),
                }
              : w,
          );

          const si = getCurrentSeasonInfo();
          const bestWeaponSnapshot = maybeUpdateBestWeaponSnapshot(
            def,
            projected,
            afterSpend.bestWeaponSnapshot,
          );
          let weeklySeasonStats = bumpWeeklySeasonStrongest(
            afterSpend.weeklySeasonStats,
            si.seasonId,
            def,
            projected,
          );
          weeklySeasonStats = {
            ...weeklySeasonStats,
            enhanceSuccessesThisSeason:
              weeklySeasonStats.enhanceSuccessesThisSeason + 1,
          };

          set({
            ownedWeapons: nextWeapons,
            records: bumpWeeklyBest(nextRecords, nextWeapons),
            bestWeaponSnapshot,
            weeklySeasonStats,
            modal: {
              kind: "enhance_success",
              weaponId: def.id,
              weaponName: def.name,
              result,
              recordBreak,
            },
            isEnhancing: false,
            enhancePending: null,
            enhanceHammerPhase: 0,
          });
          scheduleEnhanceOutcomeSounds(result, pending.enhanceRecordBreak, 300);
          return;
        }

        if (result.type === "fail") {
          nextRecords = {
            ...nextRecords,
            enhanceFailCount: nextRecords.enhanceFailCount + 1,
          };
          nextWeapons = nextWeapons.map((w) =>
            w.instanceId === id ? { ...w, durability: clampDurability(result.afterDurability) } : w,
          );
          set({
            ownedWeapons: nextWeapons,
            records: nextRecords,
            modal: {
              kind: "enhance_fail",
              weaponId: def.id,
              weaponName: def.name,
              result,
            },
            isEnhancing: false,
            enhancePending: null,
            enhanceHammerPhase: 0,
          });
          scheduleEnhanceOutcomeSounds(result, pending.enhanceRecordBreak, 300);
          return;
        }

        const scrap = result.scrapRewards ?? computeScrapRewards(def);
        nextGold += scrap.gold;
        nextEmber += scrap.ember;
        nextStone += scrap.transcendStone;

        const bestWeaponSnapshot = maybeUpdateBestWeaponSnapshot(
          def,
          current,
          afterSpend.bestWeaponSnapshot,
        );

        nextRecords = {
          ...nextRecords,
          enhanceDestroyedCount: nextRecords.enhanceDestroyedCount + 1,
          destroyedWeaponCount: nextRecords.destroyedWeaponCount + 1,
        };

        nextWeapons = nextWeapons.filter((w) => w.instanceId !== id);
        if (nextEquipped === id) {
          nextEquipped =
            getBestWeaponForRanking(nextWeapons, (wid) => WEAPONS_BY_ID[wid]) ??
            null;
        }

        set({
          gold: nextGold,
          ember: nextEmber,
          transcendStone: nextStone,
          ownedWeapons: nextWeapons,
          equippedWeaponId: nextEquipped,
          bestWeaponSnapshot,
          records: bumpWeeklyBest(nextRecords, nextWeapons),
          modal: {
            kind: "weapon_destroyed",
            destroyCause: "enhance",
            result: {
              type: "destroyed",
              level: result.level,
              scrapRewards: scrap,
              weaponId: def.id,
              weaponName: def.name,
            },
          },
          isEnhancing: false,
          enhancePending: null,
          enhanceHammerPhase: 0,
        });
        scheduleEnhanceOutcomeSounds(result, pending.enhanceRecordBreak, 300);
      },

      requestTranscendEquipped: () => {
        const state = get();
        const id = state.equippedWeaponId;
        if (!id) return;
        if (state.pendingSellWeaponIds.includes(id)) return;
        const owned = state.ownedWeapons.find((w) => w.instanceId === id);
        if (!owned) return;
        const def = WEAPONS_BY_ID[owned.weaponId];
        if (!def) return;
        if (owned.enhanceLevel !== 15 || owned.transcendLevel >= 10 || owned.durability <= 0) {
          playUiError();
          return;
        }
        const nextStar = owned.transcendLevel + 1;
        const stoneCost = getTranscendStoneCost(owned.transcendLevel);
        const rate = getTranscendSuccessRate(owned.transcendLevel);
        const previewOwned: OwnedWeapon = {
          ...owned,
          transcendLevel: nextStar,
        };
        set({
          modal: {
            kind: "transcend_confirm",
            instanceId: id,
            weapon: def,
            owned,
            nextStar,
            successRatePercent: rate * 100,
            stoneCost,
            transcendStoneOwned: state.transcendStone,
            currentRankingValue: calculateRankingValue(def, owned),
            expectedRankingValue: calculateRankingValue(def, previewOwned),
            currentSaleGold: calculateSaleGold(def, owned),
            expectedSaleGold: calculateSaleGold(def, previewOwned),
          },
        });
      },

      commitTranscendEquipped: () => {
        const state = get();
        const modal = state.modal;
        if (!modal || modal.kind !== "transcend_confirm") return;
        const id = modal.instanceId;
        const owned = state.ownedWeapons.find((w) => w.instanceId === id);
        const def = WEAPONS_BY_ID[owned?.weaponId ?? ""];
        if (!owned || !def) return;
        if (
          owned.enhanceLevel !== 15 ||
          owned.transcendLevel >= 10 ||
          owned.durability <= 0
        ) {
          set({ modal: null });
          return;
        }
        const stoneCost = getTranscendStoneCost(owned.transcendLevel);
        if (state.transcendStone < stoneCost) {
          playUiError();
          return;
        }

        if (isBetaMode()) {
          if (state.serverActionPending) return;
          set({ serverActionPending: true, modal: null });
          beginTranscendAttemptSounds();
          void transcendWeaponApi({
            ...newActionMeta(),
            weaponInstanceId: id,
          })
            .then((response) => {
              const display = response.display;
              set({
                ...patchFromServerAction(response, get()),
                serverActionPending: false,
              });
              if (display?.kind === "transcend") {
                scheduleTranscendOutcomeSounds(
                  display.result,
                  Boolean(display.recordBreak),
                );
              }
            })
            .catch((error) => {
              playUiError();
              set({
                serverActionPending: false,
                modal: {
                  kind: "server_error",
                  message: serverErrorMessage(error),
                },
              });
            });
          return;
        }

        set({
          transcendStone: state.transcendStone - stoneCost,
          modal: null,
        });

        const afterSpend = get();
        const current = afterSpend.ownedWeapons.find((w) => w.instanceId === id);
        if (!current) return;

        beginTranscendAttemptSounds();

        const result = rollTranscendAttempt({
          def,
          weapon: current,
          rng:
            afterSpend.devForceSuccess && process.env.NODE_ENV !== "production"
              ? devSuccessRng
              : Math.random,
        });

        const transcendRb =
          result.type === "success" &&
          Boolean(
            buildLocalRecordBreakInfo({
              previousBest: afterSpend.records.personalBestRankingValue,
              newBest: result.afterRankingValue,
              previousWeeklyBest:
                afterSpend.weeklySeasonStats.weeklyStrongestWeaponValue,
            }),
          );
        scheduleTranscendOutcomeSounds(result, transcendRb);

        let nextRecords: PlayerRecords = {
          ...afterSpend.records,
          transcendAttemptCount: afterSpend.records.transcendAttemptCount + 1,
        };

        if (result.type === "success") {
          const prevPersonal = nextRecords.personalBestRankingValue;
          const prevBestTrans = nextRecords.bestTranscendedWeaponValue;
          const recordBreak = buildLocalRecordBreakInfo({
            previousBest: prevPersonal,
            newBest: result.afterRankingValue,
            previousWeeklyBest:
              afterSpend.weeklySeasonStats.weeklyStrongestWeaponValue,
          });
          nextRecords = {
            ...nextRecords,
            transcendSuccessCount: nextRecords.transcendSuccessCount + 1,
            maxTranscendLevel: Math.max(
              nextRecords.maxTranscendLevel,
              result.afterTranscend,
            ),
            bestTranscendedWeaponValue: Math.max(
              prevBestTrans,
              result.afterRankingValue,
            ),
            personalBestRankingValue: Math.max(
              prevPersonal,
              result.afterRankingValue,
            ),
          };
          const updated: OwnedWeapon = {
            ...current,
            transcendLevel: result.afterTranscend,
            bestValue: Math.max(current.bestValue, result.afterRankingValue),
          };
          const nextWeapons = afterSpend.ownedWeapons.map((w) =>
            w.instanceId === id ? updated : w,
          );
          const si = getCurrentSeasonInfo();
          const bestWeaponSnapshot = maybeUpdateBestWeaponSnapshot(
            def,
            updated,
            afterSpend.bestWeaponSnapshot,
          );
          let weeklySeasonStats = bumpWeeklySeasonStrongest(
            afterSpend.weeklySeasonStats,
            si.seasonId,
            def,
            updated,
          );
          weeklySeasonStats = {
            ...weeklySeasonStats,
            transcendSuccessesThisSeason:
              weeklySeasonStats.transcendSuccessesThisSeason + 1,
          };
          set({
            ownedWeapons: nextWeapons,
            records: bumpWeeklyBest(nextRecords, nextWeapons),
            bestWeaponSnapshot,
            weeklySeasonStats,
            modal: {
              kind: "transcend_success",
              weaponId: def.id,
              weaponName: def.name,
              weaponImagePath: def.imagePath,
              beforeStar: result.beforeTranscend,
              afterStar: result.afterTranscend,
              beforeRankingValue: result.beforeRankingValue,
              afterRankingValue: result.afterRankingValue,
              beforeSaleGold: result.beforeSaleGold,
              afterSaleGold: result.afterSaleGold,
              recordBreak,
            },
          });
          return;
        }

        if (result.type === "fail") {
          nextRecords = {
            ...nextRecords,
            transcendFailCount: nextRecords.transcendFailCount + 1,
          };
          const nextWeapons = afterSpend.ownedWeapons.map((w) =>
            w.instanceId === id
              ? { ...w, durability: clampDurability(result.afterDurability) }
              : w,
          );
          set({
            ownedWeapons: nextWeapons,
            records: nextRecords,
            modal: {
              kind: "transcend_fail",
              weaponId: def.id,
              weaponName: def.name,
              transcendLevel: result.transcendLevel,
              beforeDurability: result.beforeDurability,
              afterDurability: result.afterDurability,
              stoneCost: result.stoneCost,
            },
          });
          return;
        }

        nextRecords = {
          ...nextRecords,
          transcendFailCount: nextRecords.transcendFailCount + 1,
          transcendDestroyedCount: nextRecords.transcendDestroyedCount + 1,
          destroyedWeaponCount: nextRecords.destroyedWeaponCount + 1,
        };

        const scrap = result.scrapRewards;
        const nextGold = afterSpend.gold + scrap.gold;
        const nextEmber = afterSpend.ember + scrap.ember;
        const nextStone = afterSpend.transcendStone + scrap.transcendStone;
        const nextWeapons = afterSpend.ownedWeapons.filter((w) => w.instanceId !== id);
        let nextEquipped = afterSpend.equippedWeaponId;
        if (nextEquipped === id) {
          nextEquipped =
            getBestWeaponForRanking(nextWeapons, (wid) => WEAPONS_BY_ID[wid]) ??
            null;
        }

        const bestWeaponSnapshot = maybeUpdateBestWeaponSnapshot(
          def,
          current,
          afterSpend.bestWeaponSnapshot,
        );

        set({
          gold: nextGold,
          ember: nextEmber,
          transcendStone: nextStone,
          ownedWeapons: nextWeapons,
          equippedWeaponId: nextEquipped,
          bestWeaponSnapshot,
          records: bumpWeeklyBest(nextRecords, nextWeapons),
          modal: {
            kind: "weapon_destroyed",
            destroyCause: "transcend",
            result: {
              type: "destroyed",
              level: result.enhanceLevel,
              scrapRewards: scrap,
              weaponId: def.id,
              weaponName: result.weaponName,
            },
          },
        });
      },

      collectForge: (withAd: boolean) => {
        const state = get();
        if (isBetaMode()) {
          if (state.serverActionPending) return;
          const actionMeta = newActionMeta();
          const action = withAd
            ? runAdRewardAction({
                request: {
                  actionId: actionMeta.actionId,
                  rewardType: "forgeCollectDouble",
                },
                get,
                set,
                onApplied: () => playSound("forgeCollect", { volumeMul: 1.15 }),
              })
            : collectForgeApi({
                ...actionMeta,
                collectMode: "normal",
              }).then((response) => {
                playSound("forgeCollect", { volumeMul: 1 });
                set({
                  ...patchFromServerAction(response, get()),
                  serverActionPending: false,
                  serverActionMessage: null,
                });
              });
          if (!withAd) {
            set({
              serverActionPending: true,
              serverActionMessage: "loading.collecting",
            });
          }
          void action
            .catch((error) => {
              playUiError();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                modal: {
                  kind: "server_error",
                  message: serverErrorMessage(error),
                },
              });
            });
          return;
        }
        const now = Date.now();
        const pending = computePendingForgeEmber({
          forgeLevel: state.forgeLevel,
          forgeLastCollectAt: state.forgeLastCollectAt,
          now,
        });
        if (pending <= 0) {
          playUiError();
          return;
        }
        const gained = withAd ? pending * 2 : pending;
        const adBonusExtra = withAd ? pending : 0;

        playSound("forgeCollect", { volumeMul: withAd ? 1.15 : 1 });

        set({
          ember: state.ember + gained,
          forgeLastCollectAt: now,
          records: {
            ...state.records,
            totalForgeCollected: state.records.totalForgeCollected + gained,
            totalForgeAdBonusCollected:
              state.records.totalForgeAdBonusCollected + adBonusExtra,
            forgeCollectCount: state.records.forgeCollectCount + 1,
            forgeAdCollectCount: withAd
              ? state.records.forgeAdCollectCount + 1
              : state.records.forgeAdCollectCount,
          },
          modal: {
            kind: "forge_collect_complete",
            gained,
            basePending: pending,
            usedAd: withAd,
          },
        });
      },

      tryAutoOfflineForgeModal: () => {
        if (sessionOfflineForgeModalShown) return;
        const state = get();
        if (state.modal !== null) return;

        const now = Date.now();
        const elapsedMs = Math.max(0, now - state.forgeLastCollectAt);
        if (elapsedMs < 60_000) return;

        const pending = computePendingForgeEmber({
          forgeLevel: state.forgeLevel,
          forgeLastCollectAt: state.forgeLastCollectAt,
          now,
        });
        if (pending < 1) return;

        sessionOfflineForgeModalShown = true;

        const snap = getForgeSnapshot({
          forgeLevel: state.forgeLevel,
          forgeLastCollectAt: state.forgeLastCollectAt,
          now,
        });

        set({
          modal: {
            kind: "offline_forge_reward",
            offlineDurationMs: snap.elapsedMs,
            offlineDurationLabel: formatOfflineDuration(snap.elapsedMs),
            forgeLevel: state.forgeLevel,
            ratePerMinute: snap.ratePerMinute,
            maxAccumulateMinutes: snap.maxAccumulateMinutes,
            storageCap: snap.storageCap,
            pendingBase: pending,
            pendingAdDouble: pending * 2,
            isStorageFull: snap.isFull,
            hitTimeCap: snap.hitTimeCap,
          },
        });
      },

      requestForgeUpgrade: () => {
        const state = get();
        if (state.forgeLevel >= 10) {
          playUiError();
          return;
        }
        const lv = state.forgeLevel;
        const cost = forgeUpgradeCostGold(lv);
        set({
          modal: {
            kind: "forge_upgrade_confirm",
            currentLevel: lv,
            nextLevel: lv + 1,
            currentRate: getForgeEmberPerMinute(lv),
            nextRate: getForgeEmberPerMinute(lv + 1),
            currentMaxMinutes: getForgeMaxAccumulateMinutes(lv),
            nextMaxMinutes: getForgeMaxAccumulateMinutes(lv + 1),
            costGold: cost,
            playerGold: state.gold,
          },
        });
      },

      confirmForgeUpgrade: () => {
        const state = get();
        const modal = state.modal;
        if (!modal || modal.kind !== "forge_upgrade_confirm") return;
        const cost = modal.costGold;
        if (state.gold < cost) {
          playUiError();
          return;
        }
        if (isBetaMode()) {
          if (state.serverActionPending) return;
          set({
            serverActionPending: true,
            serverActionMessage: "loading.upgrading",
          });
          void upgradeForgeApi({
            ...newActionMeta(),
          })
            .then((response) => {
              set({
                ...patchFromServerAction(response, get()),
                serverActionPending: false,
                serverActionMessage: null,
              });
            })
            .catch((error) => {
              playUiError();
              set({
                serverActionPending: false,
                serverActionMessage: null,
                modal: {
                  kind: "server_error",
                  message: serverErrorMessage(error),
                },
              });
            });
          return;
        }
        const nextLv = modal.nextLevel;
        set({
          gold: state.gold - cost,
          forgeLevel: nextLv,
          modal: { kind: "forge_upgrade_success", newLevel: nextLv },
        });
      },

      mockWatchAd: () => set({ modal: null }),

      /** 파괴 잔해 광고 Mock — 동일 잔해를 한 번 더 지급 */
      mockDoubleDestroyScrap: () => {
        if (isBetaMode()) {
          playUiError();
          set({
            modal: {
              kind: "server_error",
              title: "ads.rewardPreparing",
              message: "ads.destroyRewardPreparing",
            },
          });
          return;
        }
        const m = get().modal;
        if (!m || m.kind !== "weapon_destroyed") return;
        const r = m.result.scrapRewards;
        set((s) => ({
          gold: s.gold + r.gold,
          ember: s.ember + r.ember,
          transcendStone: s.transcendStone + r.transcendStone,
          modal: null,
        }));
      },

      /** 상단 재화바 광고 Mock — 소량 지급 */
      mockAdReward: (kind: "gold" | "ember" | "stone") => {
        if (isBetaMode()) {
          playUiError();
          return;
        }
        set((s) => ({
          gold: kind === "gold" ? s.gold + 800 : s.gold,
          ember: kind === "ember" ? s.ember + 150 : s.ember,
          transcendStone:
            kind === "stone" ? s.transcendStone + 5 : s.transcendStone,
        }));
      },

      devAddGold: (n: number) => {
        if (!devToolsRuntimeEnabled()) return;
        set((s) => ({ gold: s.gold + n }));
      },
      devAddEmber: (n: number) => {
        if (!devToolsRuntimeEnabled()) return;
        set((s) => ({ ember: s.ember + n }));
      },
      devAddStone: (n: number) => {
        if (!devToolsRuntimeEnabled()) return;
        set((s) => ({ transcendStone: s.transcendStone + n }));
      },
      devMaxEnhanceEquipped: () => {
        if (!devToolsRuntimeEnabled()) return;
        const state = get();
        const id = state.equippedWeaponId;
        if (!id) return;
        set({
          ownedWeapons: state.ownedWeapons.map((w) =>
            w.instanceId === id ? { ...w, enhanceLevel: 15 } : w,
          ),
        });
      },
      devRestoreDurability: () => {
        if (!devToolsRuntimeEnabled()) return;
        const state = get();
        const id = state.equippedWeaponId;
        if (!id) return;
        set({
          ownedWeapons: state.ownedWeapons.map((w) =>
            w.instanceId === id ? { ...w, durability: DEFAULT_DURABILITY } : w,
          ),
        });
      },
      devSetEquippedTranscendLevel: (lv: number) => {
        if (!devToolsRuntimeEnabled()) return;
        const state = get();
        const id = state.equippedWeaponId;
        if (!id) return;
        const clamped = Math.max(0, Math.min(10, Math.floor(lv)));
        set({
          ownedWeapons: state.ownedWeapons.map((w) =>
            w.instanceId === id ? { ...w, transcendLevel: clamped } : w,
          ),
        });
      },
      devSetForceSuccess: (enabled: boolean) => {
        if (!devToolsRuntimeEnabled()) return;
        set({ devForceSuccess: enabled });
      },
      resetProgress: () => {
        sessionOfflineForgeModalShown = false;
        const fresh = createFreshSave();
        set({
          ...fresh,
          modal: null,
          isEnhancing: false,
          enhancePending: null,
          enhanceAnimationTier: null,
          enhanceHammerPhase: 0,
          serverActionPending: false,
          serverActionMessage: null,
          pendingSellWeaponIds: [],
          devForceSuccess: false,
        });
      },
    }),
    {
      name: SAVE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version,
        gold: s.gold,
        ember: s.ember,
        transcendStone: s.transcendStone,
        ownedWeapons: s.ownedWeapons,
        equippedWeaponId: s.equippedWeaponId,
        forgeLevel: s.forgeLevel,
        forgeLastCollectAt: s.forgeLastCollectAt,
        records: s.records,
        bestWeaponSnapshot: s.bestWeaponSnapshot,
        weeklySeasonStats: s.weeklySeasonStats,
        storedSeasonId: s.storedSeasonId,
        lastAcknowledgedSeasonId: s.lastAcknowledgedSeasonId,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SaveDataV1> | undefined;
        if (!p || p.version !== 1) return current;
        const si = getCurrentSeasonInfo();
        let weeklySeasonStats: WeeklySeasonStats = p.weeklySeasonStats
          ? { ...freshWeeklySeasonStats(si.seasonId), ...p.weeklySeasonStats }
          : freshWeeklySeasonStats(si.seasonId);
        let storedSeasonId = p.storedSeasonId ?? si.seasonId;
        if (storedSeasonId !== si.seasonId) {
          weeklySeasonStats = freshWeeklySeasonStats(si.seasonId);
          storedSeasonId = si.seasonId;
        } else if (weeklySeasonStats.seasonId !== si.seasonId) {
          weeklySeasonStats = freshWeeklySeasonStats(si.seasonId);
        }
        const lastAcknowledgedSeasonId =
          p.lastAcknowledgedSeasonId ?? si.seasonId;

        const rawOwned = Array.isArray(p.ownedWeapons) ? p.ownedWeapons : [];
        const ownedWeapons = rawOwned.filter((o) => WEAPONS_BY_ID[o.weaponId]);
        let equippedWeaponId = p.equippedWeaponId ?? null;
        if (
          equippedWeaponId &&
          !ownedWeapons.some((w) => w.instanceId === equippedWeaponId)
        ) {
          equippedWeaponId = ownedWeapons[0]?.instanceId ?? null;
        }

        return {
          ...current,
          ...p,
          ownedWeapons,
          equippedWeaponId,
          weeklySeasonStats,
          storedSeasonId,
          lastAcknowledgedSeasonId,
          bestWeaponSnapshot: p.bestWeaponSnapshot ?? null,
          records: normalizeRecords({ ...current.records, ...p.records }),
          activeTab: current.activeTab,
          modal: null,
          isEnhancing: false,
          enhancePending: null,
          enhanceHammerPhase: 0,
          serverActionPending: false,
          serverActionMessage: null,
          pendingSellWeaponIds: [],
        };
      },
      onRehydrateStorage: () => () => {},
    },
  ),
);
