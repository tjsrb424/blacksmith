"use client";

import { getAdProvider } from "@/lib/ads/adProvider";
import { requestJson } from "@/lib/server/http";
import type {
  AdRewardCompleteResponse,
  AdRewardFlowStatus,
  AdRewardIntent,
  AdRewardRequest,
  AdRewardStatusResponse,
  AdProviderResult,
} from "@/types/ads";

type AdRewardTimingEvent =
  | "provider_load_start"
  | "provider_load_end"
  | "provider_show_start"
  | "rewarded_event"
  | "complete_api_start"
  | "complete_api_response";

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

async function markIncompleteReward(
  intent: AdRewardIntent,
  providerResult: AdProviderResult,
) {
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
}

export async function completeAdReward(
  intent: AdRewardIntent,
  options?: {
    onStatus?: (status: AdRewardFlowStatus) => void;
    onTiming?: (event: AdRewardTimingEvent) => void;
  },
): Promise<AdRewardCompleteResponse> {
  const provider = getAdProvider();
  const report = options?.onStatus;
  const timing = options?.onTiming;

  if (!provider.isAvailable()) {
    const message =
      "광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.";
    report?.({ phase: "unavailable", message });
    await markIncompleteReward(intent, {
      provider: provider.id,
      rewarded: false,
      outcome: "failed",
      error: "ad_provider_unavailable",
    });
    throw new Error(message);
  }

  report?.({ phase: "loading", message: "광고 보상 준비 중..." });
  timing?.("provider_load_start");
  await provider.loadRewardedAd(intent.rewardType);
  timing?.("provider_load_end");

  report?.({ phase: "showing", message: "광고 재생 중..." });
  timing?.("provider_show_start");
  const providerResult = await provider.showRewardedAd(intent);
  timing?.("rewarded_event");

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
    await markIncompleteReward(intent, providerResult);
    throw new Error(message);
  }

  report?.({ phase: "completing", message: "서버에서 보상 확인 중..." });
  timing?.("complete_api_start");
  const response = await requestJson<AdRewardCompleteResponse>(
    "/api/ad/reward/complete",
    {
      method: "POST",
      apiName: "api/ad/reward/complete",
      timeoutMs: 10_000,
      body: JSON.stringify({
        rewardIntentId: intent.rewardIntentId,
        completeActionId: crypto.randomUUID(),
        providerResult,
      }),
    },
  );
  timing?.("complete_api_response");
  return response;
}
