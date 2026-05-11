import type { BetaPlayerSnapshot, ServerActionDisplay } from "@/types/server";

export type AdRewardType =
  | "forgeCollectDouble"
  | "sellBonus"
  | "destructionScrapDouble"
  | "dailyTranscendStoneBox";

export type AdRewardStatus =
  | "pending"
  | "processing"
  | "completed"
  | "expired"
  | "failed"
  | "canceled";

export type AdProviderId = "mock" | "googleWeb" | "disabled";

export type AdRewardRequest = {
  actionId: string;
  rewardType: AdRewardType;
  relatedActionId?: string;
  targetWeaponInstanceId?: string;
};

export type AdRewardIntent = {
  rewardIntentId: string;
  rewardType: AdRewardType;
  provider: AdProviderId;
  expiresAt: string;
  displayReward: string;
  clientAdConfig: {
    provider: AdProviderId;
    adUnitId?: string;
    mockDelayMs?: number;
  };
};

export type AdProviderResult = {
  provider: AdProviderId;
  rewarded: boolean;
  outcome: "completed" | "canceled" | "failed";
  providerRewardId?: string;
  error?: string;
};

export type AdRewardFlowPhase =
  | "preparing"
  | "loading"
  | "showing"
  | "completing"
  | "completed"
  | "unavailable"
  | "notCompleted";

export type AdRewardFlowStatus = {
  phase: AdRewardFlowPhase;
  message: string;
};

export type AdRewardCompleteRequest = {
  rewardIntentId: string;
  completeActionId?: string;
  providerResult: AdProviderResult;
};

export type AdRewardCompleteResponse = {
  actionId: string;
  actionType: "ad_reward";
  status: "applied" | "replayed";
  rewardIntentId: string;
  rewardType: AdRewardType;
  snapshot: BetaPlayerSnapshot;
  display?: ServerActionDisplay;
};

export type AdRewardStatusEntry = {
  rewardType: AdRewardType;
  dailyUsed: number;
  dailyLimit: number;
  cooldownRemainingMs: number;
  available: boolean;
  message?: string;
  activePendingIntent?: AdRewardIntent;
};

export type AdRewardStatusResponse = {
  serverTime: string;
  rewards: Record<AdRewardType, AdRewardStatusEntry>;
};
