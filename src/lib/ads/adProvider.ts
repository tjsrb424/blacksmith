"use client";

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

export async function getAdProvider(): Promise<RewardedAdProvider> {
  const provider = getConfiguredAdProvider();
  if (provider === "googleH5") {
    const { googleH5RewardedProvider } = await import(
      "@/lib/ads/googleH5RewardedProvider"
    );
    return googleH5RewardedProvider.isAvailable()
      ? googleH5RewardedProvider
      : disabledAdProvider;
  }
  if (provider === "googleWeb") {
    const { googleWebRewardedProvider } = await import(
      "@/lib/ads/googleWebRewardedProvider"
    );
    return googleWebRewardedProvider.isAvailable()
      ? googleWebRewardedProvider
      : disabledAdProvider;
  }
  if (provider === "disabled") return disabledAdProvider;
  return mockAdProvider;
}
