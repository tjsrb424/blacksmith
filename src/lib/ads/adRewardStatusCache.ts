"use client";

import { getAdRewardStatus } from "@/lib/ads/adRewardApi";
import { updatePerformanceMetric } from "@/lib/performanceMetrics";
import type { AdRewardStatusEntry, AdRewardType } from "@/types/ads";

const AD_STATUS_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  entry: AdRewardStatusEntry | null;
};

const statusCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AdRewardStatusEntry | null>>();

export function adRewardStatusCacheKey(
  rewardType: AdRewardType,
  relatedActionId?: string,
) {
  return `${rewardType}:${relatedActionId ?? "none"}`;
}

export function getCachedAdRewardStatusEntry(
  rewardType: AdRewardType,
  relatedActionId?: string,
): AdRewardStatusEntry | null {
  const cached = statusCache.get(adRewardStatusCacheKey(rewardType, relatedActionId));
  return cached && cached.expiresAt > Date.now() ? cached.entry : null;
}

export async function refreshAdRewardStatusEntry(params: {
  rewardType: AdRewardType;
  relatedActionId?: string;
  afterReward?: boolean;
}): Promise<AdRewardStatusEntry | null> {
  const key = adRewardStatusCacheKey(params.rewardType, params.relatedActionId);
  const cached = statusCache.get(key);
  if (!params.afterReward && cached && cached.expiresAt > Date.now()) {
    updatePerformanceMetric({ adStatusCacheHit: true });
    return cached.entry;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const load = (async () => {
    const startedAt = Date.now();
    updatePerformanceMetric({ adStatusCacheHit: false });
    try {
      const status = await getAdRewardStatus({
        relatedActionId: params.relatedActionId,
      });
      const elapsedMs = Date.now() - startedAt;
      updatePerformanceMetric({
        adStatusFetchMs: elapsedMs,
        adStatusRefreshMs: elapsedMs,
        ...(params.afterReward ? { adStatusRefreshAfterRewardMs: elapsedMs } : {}),
      });
      const nextEntry = status.rewards[params.rewardType] ?? null;
      statusCache.set(key, {
        entry: nextEntry,
        expiresAt: Date.now() + AD_STATUS_CACHE_TTL_MS,
      });
      return nextEntry;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, load);
  return load;
}

export function scheduleAdRewardStatusRefreshAfterReward(params: {
  rewardType: AdRewardType;
  relatedActionId?: string;
}) {
  const scheduledAt = Date.now();
  updatePerformanceMetric({ adStatusRefreshScheduledAfterRewardMs: 0 });

  const run = () => {
    updatePerformanceMetric({
      adStatusRefreshScheduledAfterRewardMs: Date.now() - scheduledAt,
    });
    void refreshAdRewardStatusEntry({ ...params, afterReward: true }).catch(() => {
      updatePerformanceMetric({ adStatusRefreshAfterRewardMs: Date.now() - scheduledAt });
    });
  };

  if (typeof window === "undefined") {
    run();
    return;
  }

  const requestIdle = window.requestIdleCallback;
  if (requestIdle) requestIdle(run, { timeout: 1_200 });
  else window.setTimeout(run, 120);
}
