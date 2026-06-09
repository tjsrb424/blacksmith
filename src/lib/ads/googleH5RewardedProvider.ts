"use client";

import type { RewardedAdProvider } from "@/lib/ads/adProvider";
import { getAdsenseClientId } from "@/lib/ads/adConfig";
import type { AdProviderResult, AdRewardIntent, AdRewardType } from "@/types/ads";

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

type H5RewardPromptDetail = {
  rewardType: AdRewardType;
  displayReward: string;
  handled?: boolean;
  accept: () => void;
  dismiss: () => void;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (config: H5AdBreakConfig | Record<string, unknown>) => void;
    adConfig?: (config: Record<string, unknown>) => void;
  }

  interface WindowEventMap {
    "blacksmith:h5-reward-prompt": CustomEvent<H5RewardPromptDetail>;
  }
}

function warnStatus(status: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[ads.googleH5] ${status}`, detail ?? "");
  }
}

function ensureAdPlacementApi() {
  if (typeof window === "undefined") return;

  window.adsbygoogle = window.adsbygoogle || [];

  const adPlacementApiShim = (
    config: H5AdBreakConfig | Record<string, unknown>,
  ) => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push(config);
  };

  window.adBreak = window.adBreak || adPlacementApiShim;
  window.adConfig = window.adConfig || adPlacementApiShim;
}

function waitForAdBreak(timeoutMs = 10_000): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google H5 ads require a browser."));
  }
  ensureAdPlacementApi();
  if (window.adBreak) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      ensureAdPlacementApi();
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

function requestRewardPrompt(
  intent: AdRewardIntent,
  showAdFn: () => void,
): Promise<"accepted" | "dismissed" | "unhandled"> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: "accepted" | "dismissed" | "unhandled") => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const detail: H5RewardPromptDetail = {
      rewardType: intent.rewardType,
      displayReward: intent.displayReward,
      accept: () => {
        if (settled) return;
        try {
          showAdFn();
          settle("accepted");
        } catch (error) {
          warnStatus("show_reward_failed", error);
          settle("unhandled");
        }
      },
      dismiss: () => settle("dismissed"),
    };

    window.dispatchEvent(
      new CustomEvent("blacksmith:h5-reward-prompt", { detail }),
    );

    window.setTimeout(() => {
      if (!detail.handled) settle("unhandled");
    }, 0);
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
          void requestRewardPrompt(intent, showAdFn).then((result) => {
            if (result === "accepted") return;
            finish({
              provider: "googleH5",
              rewarded: false,
              outcome: result === "dismissed" ? "canceled" : "failed",
              error:
                result === "dismissed"
                  ? "reward_prompt_dismissed"
                  : "reward_prompt_unhandled",
            });
          });
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
