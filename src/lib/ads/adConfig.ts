import type { AdProviderId } from "@/types/ads";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function getGoogleRewardedAdUnitId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_AD_UNIT_ID ??
    undefined
  );
}

export function getConfiguredAdProvider(): AdProviderId {
  const provider = process.env.NEXT_PUBLIC_AD_PROVIDER;
  if (provider === "mock") {
    return isProductionRuntime() ? "disabled" : "mock";
  }
  if (provider === "googleWeb" || provider === "disabled") {
    return provider;
  }

  if (process.env.NEXT_PUBLIC_GAME_MODE === "beta") return "googleWeb";
  return isProductionRuntime() ? "disabled" : "mock";
}

export function getServerRewardProvider(): AdProviderId {
  const provider = getConfiguredAdProvider();
  if (provider === "googleWeb" && !getGoogleRewardedAdUnitId()) return "disabled";
  return provider;
}
