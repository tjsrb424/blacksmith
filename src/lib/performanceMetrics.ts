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

export function getPerformanceMetricSnapshot() {
  return snapshot;
}

export function updatePerformanceMetric(patch: ClientPerfMetric) {
  snapshot = { ...snapshot, ...patch };
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
