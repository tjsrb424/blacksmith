"use client";

import { getAdProvider } from "@/lib/ads/adProvider";
import { requestJson } from "@/lib/server/http";
import type {
  AdRewardCompleteResponse,
  AdRewardFlowStatus,
  AdRewardIntent,
  AdRewardRequest,
  AdRewardStatusResponse,
} from "@/types/ads";

export async function requestAdReward(
  payload: AdRewardRequest,
): Promise<AdRewardIntent> {
  return requestJson<AdRewardIntent>("/api/ad/reward/request", {
    method: "POST",
    apiName: "api/ad/reward/request",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function getAdRewardStatus(params?: {
  relatedActionId?: string;
}): Promise<AdRewardStatusResponse> {
  const query = params?.relatedActionId
    ? `?relatedActionId=${encodeURIComponent(params.relatedActionId)}`
    : "";
  return requestJson<AdRewardStatusResponse>(`/api/ad/reward/status${query}`, {
    apiName: "api/ad/reward/status",
    timeoutMs: 8_000,
  });
}

export async function completeAdReward(
  intent: AdRewardIntent,
  options?: {
    onStatus?: (status: AdRewardFlowStatus) => void;
  },
): Promise<AdRewardCompleteResponse> {
  const provider = getAdProvider();
  const report = options?.onStatus;
  if (!provider.isAvailable()) {
    const message =
      "광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.";
    report?.({
      phase: "unavailable",
      message,
    });
    await requestJson<AdRewardCompleteResponse>("/api/ad/reward/complete", {
      method: "POST",
      apiName: "api/ad/reward/complete",
      timeoutMs: 10_000,
      body: JSON.stringify({
        rewardIntentId: intent.rewardIntentId,
        completeActionId: crypto.randomUUID(),
        providerResult: {
          provider: provider.id,
          rewarded: false,
          outcome: "failed",
          error: "ad_provider_unavailable",
        },
      }),
    }).catch((error) => {
      console.warn("[ads] failed to mark unavailable reward intent", error);
    });
    throw new Error(message);
  }

  report?.({ phase: "loading", message: "광고 보상 준비 중..." });
  await provider.loadRewardedAd(intent.rewardType);
  report?.({ phase: "showing", message: "광고 재생 중..." });
  const providerResult = await provider.showRewardedAd(intent);

  if (!providerResult.rewarded) {
    const failedToLoad =
      providerResult.outcome === "failed" &&
      providerResult.error !== "closed_without_reward";
    const message = failedToLoad
      ? "광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
      : "광고 시청이 완료되지 않아 보상이 지급되지 않았습니다.";
    report?.({
      phase: failedToLoad ? "unavailable" : "notCompleted",
      message,
    });
    await requestJson<AdRewardCompleteResponse>("/api/ad/reward/complete", {
      method: "POST",
      apiName: "api/ad/reward/complete",
      timeoutMs: 10_000,
      body: JSON.stringify({
        rewardIntentId: intent.rewardIntentId,
        completeActionId: crypto.randomUUID(),
        providerResult,
      }),
    }).catch((error) => {
      console.warn("[ads] failed to mark incomplete reward intent", error);
    });
    throw new Error(message);
  }

  report?.({ phase: "completing", message: "서버에서 보상 확인 중..." });
  return requestJson<AdRewardCompleteResponse>("/api/ad/reward/complete", {
    method: "POST",
    apiName: "api/ad/reward/complete",
    timeoutMs: 10_000,
    body: JSON.stringify({
      rewardIntentId: intent.rewardIntentId,
      completeActionId: crypto.randomUUID(),
      providerResult,
    }),
  });
}
