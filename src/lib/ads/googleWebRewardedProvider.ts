"use client";

import type { RewardedAdProvider } from "@/lib/ads/adProvider";
import { getGoogleRewardedAdUnitId } from "@/lib/ads/adConfig";
import type { AdProviderResult, AdRewardIntent } from "@/types/ads";

type GoogleSlot = object;

type GoogleRewardedSlotReadyEvent = {
  slot: GoogleSlot;
  makeRewardedVisible: () => void;
};

type GoogleRewardedSlotGrantedEvent = {
  slot: GoogleSlot;
  payload?: {
    rewardType?: string;
    amount?: number;
  };
};

type GoogleRewardedSlotClosedEvent = {
  slot: GoogleSlot;
};

type GoogleSlotRenderEndedEvent = {
  slot: GoogleSlot;
  isEmpty?: boolean;
};

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>;
      pubads?: () => {
        addEventListener?: (event: string, handler: (event: unknown) => void) => void;
        removeEventListener?: (event: string, handler: (event: unknown) => void) => void;
      };
      defineOutOfPageSlot?: (
        adUnitPath: string,
        format: unknown,
      ) => (GoogleSlot & { addService: (service: unknown) => GoogleSlot }) | null;
      display?: (slot: GoogleSlot) => void;
      destroySlots?: (slots: GoogleSlot[]) => boolean;
      enableServices?: () => void;
      enums?: {
        OutOfPageFormat?: {
          REWARDED?: unknown;
        };
      };
    };
  }
}

const GPT_SRC = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";

let scriptPromise: Promise<void> | null = null;

function warnStatus(status: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[ads.googleWeb] ${status}`, detail ?? "");
  }
}

function loadGptScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Web rewarded ads require a browser."));
      return;
    }
    if (window.googletag) {
      resolve();
      return;
    }
    window.googletag = { cmd: [] };
    const script = document.createElement("script");
    script.async = true;
    script.src = GPT_SRC;
    warnStatus("script_loading");
    script.onload = () => {
      warnStatus("script_loaded");
      resolve();
    };
    script.onerror = () => {
      scriptPromise = null;
      warnStatus("error", "script_load_failed");
      reject(new Error("Google ad script failed to load."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function isSameSlot(eventSlot: unknown, slot: GoogleSlot): boolean {
  return eventSlot === slot;
}

function showGoogleRewardedAd(intent: AdRewardIntent): Promise<AdProviderResult> {
  const adUnitId = intent.clientAdConfig.adUnitId ?? getGoogleRewardedAdUnitId();
  if (!adUnitId) {
    warnStatus("missing_ad_unit_id");
    return Promise.resolve({
      provider: "googleWeb",
      rewarded: false,
      outcome: "failed",
      error: "missing_ad_unit_id",
    });
  }

  return new Promise((resolve) => {
    const googletag = window.googletag;
    let slot: GoogleSlot | null = null;
    let granted = false;
    let settled = false;
    let timeoutId = 0;

    const finish = (result: AdProviderResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      const pubads = window.googletag?.pubads?.();
      if (pubads) {
        pubads.removeEventListener?.("rewardedSlotReady", onReady);
        pubads.removeEventListener?.("rewardedSlotGranted", onGranted);
        pubads.removeEventListener?.("rewardedSlotClosed", onClosed);
        pubads.removeEventListener?.("slotRenderEnded", onRenderEnded);
      }
      if (slot) window.googletag?.destroySlots?.([slot]);
      if (!result.rewarded) {
        console.warn("[ads.googleWeb] rewarded ad did not complete", result);
      }
      resolve(result);
    };

    const onReady = (event: unknown) => {
      const ready = event as GoogleRewardedSlotReadyEvent;
      if (!slot || !isSameSlot(ready.slot, slot)) return;
      try {
        warnStatus("ad_ready");
        ready.makeRewardedVisible();
        warnStatus("ad_shown");
      } catch (error) {
        warnStatus("error", error);
        finish({
          provider: "googleWeb",
          rewarded: false,
          outcome: "failed",
          error: error instanceof Error ? error.message : "google_web_show_failed",
        });
      }
    };

    const onGranted = (event: unknown) => {
      const reward = event as GoogleRewardedSlotGrantedEvent;
      if (!slot || !isSameSlot(reward.slot, slot)) return;
      warnStatus("rewarded", reward.payload);
      granted = true;
    };

    const onClosed = (event: unknown) => {
      const closed = event as GoogleRewardedSlotClosedEvent;
      if (!slot || !isSameSlot(closed.slot, slot)) return;
      finish(
        granted
          ? {
              provider: "googleWeb",
              rewarded: true,
              outcome: "completed",
              providerRewardId: `google_${intent.rewardIntentId}`,
            }
          : {
              provider: "googleWeb",
              rewarded: false,
              outcome: "canceled",
              error: "closed_without_reward",
            },
      );
      if (!granted) warnStatus("closed_without_reward");
    };

    const onRenderEnded = (event: unknown) => {
      const rendered = event as GoogleSlotRenderEndedEvent;
      if (!slot || !isSameSlot(rendered.slot, slot) || !rendered.isEmpty) return;
      finish({
        provider: "googleWeb",
        rewarded: false,
        outcome: "failed",
        error: "no_fill",
      });
      warnStatus("no_fill");
    };

    timeoutId = window.setTimeout(() => {
      finish({
        provider: "googleWeb",
        rewarded: false,
        outcome: "failed",
        error: "google_web_load_timeout",
      });
    }, 15_000);

    googletag?.cmd.push(() => {
      const pubads = window.googletag?.pubads?.();
      const rewardedFormat = window.googletag?.enums?.OutOfPageFormat?.REWARDED;
      const defineOutOfPageSlot = window.googletag?.defineOutOfPageSlot;
      if (!pubads || !rewardedFormat || !defineOutOfPageSlot || !window.googletag?.display) {
        warnStatus("provider_unavailable");
        finish({
          provider: "googleWeb",
          rewarded: false,
          outcome: "failed",
          error: "provider_unavailable",
        });
        return;
      }

      const rewardedSlot = defineOutOfPageSlot(adUnitId, rewardedFormat);
      if (!rewardedSlot) {
        warnStatus("provider_unavailable", "slot_unavailable");
        finish({
          provider: "googleWeb",
          rewarded: false,
          outcome: "failed",
          error: "google_web_slot_unavailable",
        });
        return;
      }

      slot = rewardedSlot;
      rewardedSlot.addService(pubads);
      pubads.addEventListener?.("rewardedSlotReady", onReady);
      pubads.addEventListener?.("rewardedSlotGranted", onGranted);
      pubads.addEventListener?.("rewardedSlotClosed", onClosed);
      pubads.addEventListener?.("slotRenderEnded", onRenderEnded);
      window.googletag?.enableServices?.();
      window.googletag?.display?.(rewardedSlot);
    });
  });
}

export const googleWebRewardedProvider: RewardedAdProvider = {
  id: "googleWeb",
  isAvailable: () => Boolean(getGoogleRewardedAdUnitId()),
  loadRewardedAd: async () => {
    await loadGptScript();
  },
  showRewardedAd: async (intent) => {
    try {
      await loadGptScript();
      return await showGoogleRewardedAd(intent);
    } catch (error) {
      warnStatus("error", error);
      return {
        provider: "googleWeb",
        rewarded: false,
        outcome: "failed",
        error: error instanceof Error ? error.message : "google_web_ad_failed",
      };
    }
  },
};
