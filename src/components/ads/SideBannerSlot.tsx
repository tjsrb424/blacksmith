"use client";

import { AdFitBanner } from "@/components/ads/AdFitBanner";
import { AdsenseSideBanner } from "@/components/ads/AdsenseSideBanner";
import { useLocale } from "@/lib/i18n/useLocale";
import {
  getSideAdConfig,
  type SideBannerSlotName,
} from "@/lib/ads/sideAds";

const SIDE_TIP_KEYS: Record<SideBannerSlotName, { title: string; body: string }> = {
  "side-banner-left": {
    title: "ads.sideTipEnhanceTitle",
    body: "ads.sideTipEnhanceBody",
  },
  "side-banner-right": {
    title: "ads.sideTipRankingTitle",
    body: "ads.sideTipRankingBody",
  },
};

function SideTipCard({ slotName }: { slotName: SideBannerSlotName }) {
  const { t } = useLocale();
  const tip = SIDE_TIP_KEYS[slotName];
  const title = t(tip.title);

  return (
    <aside
      className="relative mx-auto w-[160px] overflow-hidden rounded-lg border border-amber-500/18 bg-black/28 px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-white/5 backdrop-blur-[1px]"
      data-side-slot={slotName}
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),transparent_36%,rgba(248,113,113,0.05)_70%,transparent)]" />
      <div className="relative">
        <div className="text-[11px] font-bold text-amber-100/78">
          {title}
        </div>
        <p className="mt-2 text-[11px] font-medium leading-5 text-zinc-400">
          {t(tip.body)}
        </p>
      </div>
    </aside>
  );
}

export function SideBannerSlot({
  slotName,
}: {
  slotName: SideBannerSlotName;
}) {
  const sideAdConfig = getSideAdConfig(slotName);

  if (
    sideAdConfig.provider === "adfit" &&
    sideAdConfig.enabled &&
    sideAdConfig.unitId
  ) {
    return (
      <AdFitBanner
        slotName={slotName}
        unitId={sideAdConfig.unitId}
        width={sideAdConfig.width}
        height={sideAdConfig.height}
      />
    );
  }

  if (
    sideAdConfig.provider === "adsense" &&
    sideAdConfig.enabled &&
    sideAdConfig.clientId &&
    sideAdConfig.unitId
  ) {
    return (
      <AdsenseSideBanner
        slotName={slotName}
        clientId={sideAdConfig.clientId}
        slotId={sideAdConfig.unitId}
        width={sideAdConfig.width}
        height={sideAdConfig.height}
      />
    );
  }

  return <SideTipCard slotName={slotName} />;
}
