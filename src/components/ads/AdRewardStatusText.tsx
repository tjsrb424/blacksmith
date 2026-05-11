"use client";

import { useEffect, useState } from "react";
import { getAdRewardStatus } from "@/lib/ads/adRewardApi";
import { getGameMode } from "@/lib/supabase/env";
import type { AdRewardStatusEntry, AdRewardType } from "@/types/ads";

const AD_STATUS_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  entry: AdRewardStatusEntry | null;
};

const statusCache = new Map<string, CacheEntry>();

function cacheKey(rewardType: AdRewardType, relatedActionId?: string) {
  return `${rewardType}:${relatedActionId ?? "none"}`;
}

function runWhenIdle(callback: () => void) {
  const requestIdle = window.requestIdleCallback;
  if (requestIdle) requestIdle(callback, { timeout: 1_200 });
  else window.setTimeout(callback, 450);
}

export function AdRewardStatusText({
  rewardType,
  relatedActionId,
}: {
  rewardType: AdRewardType;
  relatedActionId?: string;
}) {
  const key = cacheKey(rewardType, relatedActionId);
  const [entry, setEntry] = useState<AdRewardStatusEntry | null>(() => {
    const cached = statusCache.get(key);
    return cached && cached.expiresAt > Date.now() ? cached.entry : null;
  });

  useEffect(() => {
    if (getGameMode() !== "beta") return;
    let active = true;

    const load = async () => {
      const cached = statusCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        if (active) setEntry(cached.entry);
        return;
      }

      try {
        const status = await getAdRewardStatus({ relatedActionId });
        const nextEntry = status.rewards[rewardType] ?? null;
        statusCache.set(key, {
          entry: nextEntry,
          expiresAt: Date.now() + AD_STATUS_CACHE_TTL_MS,
        });
        if (active) setEntry(nextEntry);
      } catch {
        if (active) setEntry(null);
      }
    };

    runWhenIdle(() => {
      if (active) void load();
    });
    const timer = window.setInterval(() => {
      runWhenIdle(() => {
        if (active) void load();
      });
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [key, relatedActionId, rewardType]);

  if (getGameMode() !== "beta" || !entry) return null;

  return (
    <p className="text-center text-[11px] leading-relaxed text-zinc-500">
      오늘 {entry.dailyUsed}/{entry.dailyLimit}
      {entry.message ? ` · ${entry.message}` : null}
    </p>
  );
}
