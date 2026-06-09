import type { AdProviderId } from "@/types/ads";
import { isCrazyGamesBuild } from "@/lib/distribution";

const DEFAULT_ADSENSE_CLIENT_ID = "ca-pub-4666198871295401";
const DEFAULT_ADSENSE_LEFT_SLOT_ID = "1937439790";
const DEFAULT_ADSENSE_RIGHT_SLOT_ID = "5203417292";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function firstEnvValue(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function envOrDefault(values: Array<string | undefined>, fallback: string) {
  return firstEnvValue(...values) ?? fallback;
}

export function getAdsenseClientId(): string | undefined {
  if (isCrazyGamesBuild()) return undefined;
  return envOrDefault(
    [
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_AD_CLIENT,
    ],
    DEFAULT_ADSENSE_CLIENT_ID,
  );
}

export function getAdsenseSideSlotId(side: "left" | "right"): string | undefined {
  if (isCrazyGamesBuild()) return undefined;
  return envOrDefault(
    side === "left"
      ? [
          process.env.NEXT_PUBLIC_ADSENSE_LEFT_SLOT,
          process.env.NEXT_PUBLIC_ADSENSE_SIDE_LEFT_SLOT,
        ]
      : [
          process.env.NEXT_PUBLIC_ADSENSE_RIGHT_SLOT,
          process.env.NEXT_PUBLIC_ADSENSE_SIDE_RIGHT_SLOT,
        ],
    side === "left"
      ? DEFAULT_ADSENSE_LEFT_SLOT_ID
      : DEFAULT_ADSENSE_RIGHT_SLOT_ID,
  );
}

export function isH5AdBreakTestMode() {
  return process.env.NEXT_PUBLIC_H5_ADBREAK_TEST === "true";
}

export function getGoogleRewardedAdUnitId(): string | undefined {
  if (isCrazyGamesBuild()) return undefined;
  return firstEnvValue(
    process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID,
    process.env.NEXT_PUBLIC_GOOGLE_AD_UNIT_ID,
  );
}

export function getConfiguredAdProvider(): AdProviderId {
  if (isCrazyGamesBuild()) return "disabled";

  const provider = process.env.NEXT_PUBLIC_AD_PROVIDER;
  if (provider === "mock") {
    return isProductionRuntime() ? "disabled" : "mock";
  }
  if (provider === "googleH5" || provider === "googleWeb" || provider === "disabled") {
    return provider;
  }

  if (process.env.NEXT_PUBLIC_GAME_MODE === "beta") return "googleH5";
  return isProductionRuntime() ? "disabled" : "mock";
}

export function getServerRewardProvider(): AdProviderId {
  const provider = getConfiguredAdProvider();
  if (provider === "googleWeb" && !getGoogleRewardedAdUnitId()) return "disabled";
  if (provider === "googleH5" && !getAdsenseClientId()) return "disabled";
  return provider;
}
