"use client";

import type { RewardedAdProvider } from "@/lib/ads/adProvider";
import type { AdProviderResult, AdRewardIntent } from "@/types/ads";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createMockButton(label: string, className: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  return button;
}

function showMockDebugOverlay(intent: AdRewardIntent): Promise<AdProviderResult> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className =
      "fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4";

    const panel = document.createElement("div");
    panel.className =
      "w-full max-w-sm rounded-2xl border border-violet-500/35 bg-zinc-950 p-5 text-center text-zinc-100 shadow-2xl";

    const title = document.createElement("div");
    title.className = "text-lg font-bold text-violet-100";
    title.textContent = "Mock 광고 결과 선택";

    const body = document.createElement("p");
    body.className = "mt-2 text-sm leading-relaxed text-zinc-300";
    body.textContent = `${intent.rewardType} · ${intent.displayReward}`;

    const buttons = document.createElement("div");
    buttons.className = "mt-5 grid gap-2";

    const cleanup = (result: AdProviderResult) => {
      root.remove();
      resolve(result);
    };

    const complete = createMockButton(
      "광고 완료",
      "rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white",
    );
    complete.onclick = () =>
      cleanup({
        provider: "mock",
        rewarded: true,
        outcome: "completed",
        providerRewardId: `mock_${intent.rewardIntentId}`,
      });

    const close = createMockButton(
      "광고 닫기",
      "rounded-xl bg-zinc-800 px-4 py-3 font-semibold text-zinc-100",
    );
    close.onclick = () =>
      cleanup({
        provider: "mock",
        rewarded: false,
        outcome: "canceled",
        error: "mock_ad_closed",
      });

    const fail = createMockButton(
      "광고 실패",
      "rounded-xl bg-red-700 px-4 py-3 font-semibold text-white",
    );
    fail.onclick = () =>
      cleanup({
        provider: "mock",
        rewarded: false,
        outcome: "failed",
        error: "mock_ad_failed",
      });

    buttons.append(complete, close, fail);
    panel.append(title, body, buttons);
    root.append(panel);
    document.body.append(root);
  });
}

export const mockAdProvider: RewardedAdProvider = {
  id: "mock",
  isAvailable: () => true,
  loadRewardedAd: async () => {
    await wait(150);
  },
  showRewardedAd: async (intent) => {
    await wait(intent.clientAdConfig.mockDelayMs ?? 700);
    if (process.env.NODE_ENV !== "production") {
      return showMockDebugOverlay(intent);
    }

    return {
      provider: "mock",
      rewarded: true,
      outcome: "completed",
      providerRewardId: `mock_${intent.rewardIntentId}`,
    };
  },
};
