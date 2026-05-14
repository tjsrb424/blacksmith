"use client";

import { useEffect, useState } from "react";
import {
  adRewardStatusCacheKey,
  getCachedAdRewardStatusEntry,
  refreshAdRewardStatusEntry,
} from "@/lib/ads/adRewardStatusCache";
import { useLocale } from "@/lib/i18n/useLocale";
import { getGameMode } from "@/lib/supabase/env";
import type { AdRewardStatusEntry, AdRewardType } from "@/types/ads";

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
  const { t } = useLocale();
  const key = adRewardStatusCacheKey(rewardType, relatedActionId);
  const [entry, setEntry] = useState<AdRewardStatusEntry | null>(() => {
    return getCachedAdRewardStatusEntry(rewardType, relatedActionId);
  });

  useEffect(() => {
    if (getGameMode() !== "beta") return;
    let active = true;

    const load = async () => {
      try {
        const nextEntry = await refreshAdRewardStatusEntry({
          rewardType,
          relatedActionId,
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
      {t("ads.dailyUsage", { used: entry.dailyUsed, limit: entry.dailyLimit })}
      {entry.message ? (
        <>
          {" · "}
          {entry.message.includes(".") ? t(entry.message) : entry.message}
        </>
      ) : null}
    </p>
  );
}
