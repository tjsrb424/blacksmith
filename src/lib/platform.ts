export type Platform = "web" | "crazygames" | "toss";

function normalizePlatform(value: string | undefined): Platform {
  const platform = value?.trim().toLowerCase();
  if (platform === "crazygames" || platform === "toss") return platform;
  return "web";
}

export const PLATFORM = normalizePlatform(
  process.env.NEXT_PUBLIC_PLATFORM ?? process.env.NEXT_PUBLIC_DISTRIBUTION,
);

export const isWebPlatform = PLATFORM === "web";
export const isCrazyGamesPlatform = PLATFORM === "crazygames";
export const isTossPlatform = PLATFORM === "toss";
export const areExternalAdsEnabled = isWebPlatform;
