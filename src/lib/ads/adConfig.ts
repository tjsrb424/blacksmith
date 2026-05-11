import type { AdProviderId } from "@/types/ads";

export function getGoogleRewardedAdUnitId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_AD_UNIT_ID ??
    undefined
  );
}

export function getConfiguredAdProvider(): AdProviderId {
  const provider = process.env.NEXT_PUBLIC_AD_PROVIDER;
  if (provider === "mock" || provider === "googleWeb" || provider === "disabled") {
    return provider;
  }

  return process.env.NEXT_PUBLIC_GAME_MODE === "beta" ? "googleWeb" : "mock";
}

export function getServerRewardProvider(): AdProviderId {
  const provider = getConfiguredAdProvider();
  if (provider === "googleWeb" && !getGoogleRewardedAdUnitId()) return "disabled";
  return provider;
}
