"use client";

import type { RewardedAdProvider } from "@/lib/ads/adProvider";
import { getAdsenseClientId } from "@/lib/ads/adConfig";
import type { AdProviderResult, AdRewardIntent } from "@/types/ads";

type H5PlacementInfo = {
  breakStatus?: string;
  type?: string;
  name?: string;
};

type H5AdBreakConfig = {
  type: "reward";
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: H5PlacementInfo) => void;
};

declare global {
  interface Window {
    adBreak?: (config: H5AdBreakConfig | Record<string, unknown>) => void;
    adConfig?: (config: Record<string, unknown>) => void;
  }
}

function warnStatus(status: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[ads.googleH5] ${status}`, detail ?? "");
  }
}

function waitForAdBreak(timeoutMs = 10_000): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google H5 ads require a browser."));
  }
  if (window.adBreak) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      if (window.adBreak) {
        window.clearInterval(intervalId);
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(intervalId);
        reject(new Error("google_h5_adbreak_unavailable"));
      }
    }, 100);
  });
}

function showGoogleH5RewardedAd(
  intent: AdRewardIntent,
): Promise<AdProviderResult> {
  return new Promise((resolve) => {
    let settled = false;
    let viewed = false;
    let rewardPromptShown = false;

    const finish = (result: AdProviderResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (!result.rewarded) warnStatus("not_completed", result);
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        provider: "googleH5",
        rewarded: false,
        outcome: "failed",
        error: "google_h5_timeout",
      });
    }, 30_000);

    try {
      window.adBreak?.({
        type: "reward",
        name: intent.rewardType,
        beforeAd: () => {
          warnStatus("before_ad");
        },
        afterAd: () => {
          warnStatus("after_ad");
        },
        beforeReward: (showAdFn) => {
          rewardPromptShown = true;
          warnStatus("before_reward");
          showAdFn();
        },
        adDismissed: () => {
          finish({
            provider: "googleH5",
            rewarded: false,
            outcome: "canceled",
            error: "dismissed_without_reward",
          });
        },
        adViewed: () => {
          viewed = true;
          finish({
            provider: "googleH5",
            rewarded: true,
            outcome: "completed",
            providerRewardId: `google_h5_${intent.rewardIntentId}`,
          });
        },
        adBreakDone: (placementInfo) => {
          warnStatus("ad_break_done", placementInfo);
          if (viewed || settled) return;
          finish({
            provider: "googleH5",
            rewarded: false,
            outcome: rewardPromptShown ? "canceled" : "failed",
            error: placementInfo.breakStatus ?? "google_h5_no_reward",
          });
        },
      });
    } catch (error) {
      finish({
        provider: "googleH5",
        rewarded: false,
        outcome: "failed",
        error: error instanceof Error ? error.message : "google_h5_ad_failed",
      });
    }
  });
}

export const googleH5RewardedProvider: RewardedAdProvider = {
  id: "googleH5",
  isAvailable: () => Boolean(getAdsenseClientId()),
  loadRewardedAd: async () => {
    await waitForAdBreak();
  },
  showRewardedAd: async (intent) => {
    try {
      await waitForAdBreak();
      return await showGoogleH5RewardedAd(intent);
    } catch (error) {
      warnStatus("error", error);
      return {
        provider: "googleH5",
        rewarded: false,
        outcome: "failed",
        error: error instanceof Error ? error.message : "google_h5_ad_failed",
      };
    }
  },
};
