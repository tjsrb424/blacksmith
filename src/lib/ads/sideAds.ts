import { isCrazyGamesBuild } from "@/lib/distribution";

export type SideAdProviderId = "disabled" | "adfit";

export type SideBannerSlotName = "side-banner-left" | "side-banner-right";

export type SideAdConfig = {
  provider: SideAdProviderId;
  enabled: boolean;
  unitId?: string;
  width: 160;
  height: 600;
};

const SIDE_AD_WIDTH = 160;
const SIDE_AD_HEIGHT = 600;

function getSideAdProvider(): SideAdProviderId {
  if (isCrazyGamesBuild()) return "disabled";
  return process.env.NEXT_PUBLIC_SIDE_AD_PROVIDER === "adfit"
    ? "adfit"
    : "disabled";
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
  const enabled = provider === "adfit" && isAdFitSideAdsEnabled();

  return {
    provider,
    enabled,
    unitId: enabled ? getAdFitUnitId(slotName) : undefined,
    width: SIDE_AD_WIDTH,
    height: SIDE_AD_HEIGHT,
  };
}
