import { recordPerfEvent } from "@/lib/perfRecorder";

export type ClientPerfMetric = {
  gameMode?: string;
  origin?: string;
  userAgentShort?: string;
  authStage?: string;
  authStageElapsedMs?: number;
  authAttempt?: number;
  lastAuthEvent?: string;
  lastAuthError?: string;
  apiName?: string;
  elapsedMs?: number;
  errorCode?: string;
  bootstrapElapsedMs?: number;
  playerSyncElapsedMs?: number;
  lastStoreSyncElapsedMs?: number;
  tabSwitchElapsedMs?: number;
  tabTarget?: string;
  backgroundLoadedFromCache?: boolean;
  rankingFetchMs?: number;
  adStatusCacheHit?: boolean;
  adStatusFetchMs?: number;
  adStatusApiCalled?: boolean;
  adProvider?: string;
  displayAdProvider?: string;
  sideBannerAdsEnabled?: boolean;
  adSdkLoaded?: boolean;
  adFetchSkippedReason?: string;
  adRewardCompleteElapsedMs?: number;
  adRewardProviderRewardedEventMs?: number;
  adRewardEventToCompleteApiStartMs?: number;
  adCompleteApiMs?: number;
  adRewardResultDataCreateMs?: number;
  adCompleteResponseToModalOpenMs?: number;
  adRewardModalOpenRequestMs?: number;
  adRewardModalOpenMs?: number;
  adRewardPatchApplyMs?: number;
  adRewardDeferredSyncScheduledMs?: number;
  adRewardDeferredSyncMs?: number;
  adRewardStoreSyncMs?: number;
  adCompleteTotalMs?: number;
  adStatusRefreshMs?: number;
  adStatusRefreshScheduledAfterRewardMs?: number;
  adStatusRefreshAfterRewardMs?: number;
  renderCountDuringAdReward?: number;
  rankingCacheStatus?: "hit" | "miss";
  enhanceTotalMs?: number;
  enhanceApiMs?: number;
  enhanceAnimationWaitMs?: number;
  enhanceModalOpenMs?: number;
  enhanceStoreSyncMs?: number;
  enhanceRenderCountDuringAction?: number;
  renderTick?: number;
  currentScreen?: string;
  renderCounts?: Record<string, number>;
};

const listeners = new Set<() => void>();

let snapshot: ClientPerfMetric = {};
let renderTick = 0;

function renderSummary(renderCounts?: Record<string, number>) {
  return Object.entries(renderCounts ?? {})
    .slice(-8)
    .map(([name, count]) => `${name}:${count}`)
    .join(" ");
}

function recordMetricPatch(patch: ClientPerfMetric) {
  const screen = patch.currentScreen ?? snapshot.currentScreen ?? "unknown";
  const common = {
    screen,
    origin: patch.origin ?? snapshot.origin,
  };

  if (patch.playerSyncElapsedMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "action",
      actionName: "player_sync",
      elapsedMs: patch.playerSyncElapsedMs,
      playerSyncMs: patch.playerSyncElapsedMs,
      error: "",
    });
  }

  if (patch.lastStoreSyncElapsedMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "action",
      actionName: "store_sync",
      elapsedMs: patch.lastStoreSyncElapsedMs,
      storeSyncMs: patch.lastStoreSyncElapsedMs,
      error: "",
    });
  }

  if (patch.tabSwitchElapsedMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "tab",
      actionName: patch.tabTarget ?? patch.currentScreen ?? snapshot.tabTarget ?? "tab",
      elapsedMs: patch.tabSwitchElapsedMs,
      tabMs: patch.tabSwitchElapsedMs,
      error: "",
    });
  }

  if (patch.adStatusFetchMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "ad",
      actionName: "ad_fetch",
      api: "/api/ad/reward/status",
      elapsedMs: patch.adStatusFetchMs,
      adFetchMs: patch.adStatusFetchMs,
      adStatus:
        (patch.adStatusCacheHit ?? snapshot.adStatusCacheHit) == null
          ? undefined
          : (patch.adStatusCacheHit ?? snapshot.adStatusCacheHit)
            ? "hit"
            : "miss",
      adStatusApiCalled: patch.adStatusApiCalled ?? true,
      adProvider: patch.adProvider,
      displayAdProvider: patch.displayAdProvider,
      sideBannerAdsEnabled: patch.sideBannerAdsEnabled,
      adSdkLoaded: patch.adSdkLoaded,
      adFetchSkippedReason: patch.adFetchSkippedReason,
      error: patch.errorCode ?? "",
    });
  }

  if (patch.adRewardCompleteElapsedMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "ad",
      actionName: "ad_complete",
      api: "/api/ad/reward/complete",
      elapsedMs: patch.adRewardCompleteElapsedMs,
      error: patch.errorCode ?? "",
    });
  }

  if (patch.enhanceModalOpenMs !== undefined) {
    recordPerfEvent({
      ...common,
      eventType: "action",
      actionName: "enhance_modal",
      elapsedMs: patch.enhanceModalOpenMs,
      enhanceModalMs: patch.enhanceModalOpenMs,
      error: "",
    });
  }
}

export function getPerformanceMetricSnapshot() {
  return snapshot;
}

export function updatePerformanceMetric(patch: ClientPerfMetric) {
  const previousScreen = snapshot.currentScreen;
  snapshot = { ...snapshot, ...patch };
  if (
    patch.currentScreen &&
    patch.currentScreen !== previousScreen &&
    patch.tabSwitchElapsedMs === undefined
  ) {
    recordPerfEvent({
      screen: patch.currentScreen,
      eventType: "screen",
      actionName: patch.currentScreen,
      elapsedMs: 0,
      error: "",
    });
  }
  recordMetricPatch(patch);
  listeners.forEach((listener) => listener());
}

export function subscribePerformanceMetrics(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordRender(component: string) {
  if (process.env.NODE_ENV === "production") return;
  const renderCounts = { ...(snapshot.renderCounts ?? {}) };
  renderCounts[component] = (renderCounts[component] ?? 0) + 1;
  renderTick += 1;
  updatePerformanceMetric({
    renderCounts,
    renderTick,
  });
  if (renderCounts[component] % 25 === 0) {
    recordPerfEvent({
      screen: snapshot.currentScreen ?? "unknown",
      eventType: "render",
      actionName: component,
      elapsedMs: 0,
      renderSummary: renderSummary(renderCounts),
      error: "",
    });
  }
}

export function getRenderCount(component: string): number {
  return snapshot.renderCounts?.[component] ?? 0;
}

export function resetRenderDiagnostics() {
  renderTick = 0;
  updatePerformanceMetric({
    renderTick,
    renderCounts: {},
  });
}

export function diagnosticLog(
  scope: string,
  event: string,
  details?: Record<string, unknown>,
) {
  const debugEnabled =
    process.env.NEXT_PUBLIC_PERF_DEBUG === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_PERF_DEBUG !== "false");
  if (!debugEnabled) return;
  const payload = details ? { ...details } : undefined;
  console.log(`[diag:${scope}] ${event}`, payload ?? "");
}
