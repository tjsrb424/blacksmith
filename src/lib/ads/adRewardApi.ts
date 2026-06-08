"use client";

import { getAdProvider } from "@/lib/ads/adProvider";
import { getGuestRequestContext } from "@/lib/player/guest";
import { requestJson } from "@/lib/server/http";
import type {
  AdRewardCompleteResponse,
  AdRewardFlowStatus,
  AdRewardIntent,
  AdRewardRequest,
  AdRewardStatusResponse,
  AdProviderResult,
} from "@/types/ads";
import type { GuestRequestContext } from "@/types/server";

type AdRewardTimingEvent =
  | "provider_load_start"
  | "provider_load_end"
  | "provider_show_start"
  | "rewarded_event"
  | "complete_api_start"
  | "complete_api_response";

function withGuestContext<T extends object>(payload: T): T & GuestRequestContext {
  return {
    ...getGuestRequestContext(),
    ...payload,
  };
}

function guestContextSearchParams() {
  const context = getGuestRequestContext();
  const params = new URLSearchParams();
  if (context.mode === "guest") {
    params.set("mode", "guest");
    if (context.guestId) params.set("guestId", context.guestId);
    if (context.guestSecret) params.set("guestSecret", context.guestSecret);
    if (context.nickname) params.set("nickname", context.nickname);
  }
  return params;
}

export async function requestAdReward(
  payload: AdRewardRequest,
): Promise<AdRewardIntent> {
  return requestJson<AdRewardIntent>("/api/ad/reward/request", {
    method: "POST",
    apiName: "api/ad/reward/request",
    timeoutMs: 8_000,
    body: JSON.stringify(withGuestContext(payload)),
  });
}

export async function getAdRewardStatus(params?: {
  relatedActionId?: string;
}): Promise<AdRewardStatusResponse> {
  const queryParams = guestContextSearchParams();
  if (params?.relatedActionId) {
    queryParams.set("relatedActionId", params.relatedActionId);
  }
  const query = queryParams.size ? `?${queryParams.toString()}` : "";
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
      ...getGuestRequestContext(),
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
    const message = "ads.failedToLoad";
    report?.({ phase: "unavailable", message });
    await markIncompleteReward(intent, {
      provider: provider.id,
      rewarded: false,
      outcome: "failed",
      error: "ad_provider_unavailable",
    });
    throw new Error(message);
  }

  report?.({ phase: "loading", message: "ads.preparingReward" });
  timing?.("provider_load_start");
  await provider.loadRewardedAd(intent.rewardType);
  timing?.("provider_load_end");

  report?.({ phase: "showing", message: "ads.playing" });
  timing?.("provider_show_start");
  const providerResult = await provider.showRewardedAd(intent);
  timing?.("rewarded_event");

  if (!providerResult.rewarded) {
    const failedToLoad =
      providerResult.outcome === "failed" &&
      providerResult.error !== "closed_without_reward";
    const message = failedToLoad
      ? "ads.failedToLoad"
      : "ads.notCompleted";
    report?.({
      phase: failedToLoad ? "unavailable" : "notCompleted",
      message,
    });
    await markIncompleteReward(intent, providerResult);
    throw new Error(message);
  }

  report?.({ phase: "completing", message: "ads.confirmingReward" });
  timing?.("complete_api_start");
  const response = await requestJson<AdRewardCompleteResponse>(
    "/api/ad/reward/complete",
    {
      method: "POST",
      apiName: "api/ad/reward/complete",
      timeoutMs: 10_000,
      body: JSON.stringify({
        ...getGuestRequestContext(),
        rewardIntentId: intent.rewardIntentId,
        completeActionId: crypto.randomUUID(),
        providerResult,
      }),
    },
  );
  timing?.("complete_api_response");
  return response;
}
