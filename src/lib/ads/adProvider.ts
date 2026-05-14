"use client";

import { googleWebRewardedProvider } from "@/lib/ads/googleWebRewardedProvider";
import { mockAdProvider } from "@/lib/ads/mockAdProvider";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import type {
  AdProviderId,
  AdProviderResult,
  AdRewardIntent,
  AdRewardType,
} from "@/types/ads";

export type RewardedAdProvider = {
  id: AdProviderId;
  isAvailable: () => boolean;
  loadRewardedAd: (rewardType: AdRewardType) => Promise<void>;
  showRewardedAd: (intent: AdRewardIntent) => Promise<AdProviderResult>;
};

export const disabledAdProvider: RewardedAdProvider = {
  id: "disabled",
  isAvailable: () => false,
  loadRewardedAd: async () => {
    throw new Error("ads.failedToLoad");
  },
  showRewardedAd: async () => ({
    provider: "disabled",
    rewarded: false,
    outcome: "failed",
    error: "ad_provider_disabled",
  }),
};

export function getAdProvider(): RewardedAdProvider {
  const provider = getConfiguredAdProvider();
  if (provider === "googleWeb") {
    return googleWebRewardedProvider.isAvailable()
      ? googleWebRewardedProvider
      : disabledAdProvider;
  }
  if (provider === "disabled") return disabledAdProvider;
  return mockAdProvider;
}
