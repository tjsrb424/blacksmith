import { areExternalAdsEnabled } from "@/lib/platform";
import { getAdsenseClientId, getAdsenseSideSlotId } from "@/lib/ads/adConfig";

export type SideAdProviderId = "disabled" | "adfit" | "adsense";

export type SideBannerSlotName = "side-banner-left" | "side-banner-right";

export type SideAdConfig = {
  provider: SideAdProviderId;
  enabled: boolean;
  unitId?: string;
  clientId?: string;
  width: 160;
  height: 600;
};

const SIDE_AD_WIDTH = 160;
const SIDE_AD_HEIGHT = 600;

function getSideAdProvider(): SideAdProviderId {
  if (!areExternalAdsEnabled) return "disabled";
  const provider = process.env.NEXT_PUBLIC_SIDE_AD_PROVIDER;
  if (provider === "adfit" || provider === "adsense") return provider;
  return process.env.NEXT_PUBLIC_GAME_MODE === "beta" ? "adsense" : "disabled";
}

function isAdFitSideAdsEnabled() {
  return process.env.NEXT_PUBLIC_ADFIT_SIDE_ADS_ENABLED === "true";
}

function getAdFitUnitId(slotName: SideBannerSlotName) {
  const unitId =
    slotName === "side-banner-left"
      ? process.env.NEXT_PUBLIC_ADFIT_LEFT_UNIT
      : process.env.NEXT_PUBLIC_ADFIT_RIGHT_UNIT;

  return unitId?.trim() || undefined;
}

export function getSideAdConfig(slotName: SideBannerSlotName): SideAdConfig {
  const provider = getSideAdProvider();
  const adsenseClientId = getAdsenseClientId();
  const adsenseSlotId = getAdsenseSideSlotId(
    slotName === "side-banner-left" ? "left" : "right",
  );
  const enabled =
    (provider === "adfit" && isAdFitSideAdsEnabled()) ||
    (provider === "adsense" && Boolean(adsenseClientId && adsenseSlotId));

  return {
    provider,
    enabled,
    unitId:
      enabled && provider === "adfit"
        ? getAdFitUnitId(slotName)
        : enabled && provider === "adsense"
          ? adsenseSlotId
          : undefined,
    clientId: enabled && provider === "adsense" ? adsenseClientId : undefined,
    width: SIDE_AD_WIDTH,
    height: SIDE_AD_HEIGHT,
  };
}
