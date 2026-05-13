"use client";

import { AdFitBanner } from "@/components/ads/AdFitBanner";
import {
  getSideAdConfig,
  type SideBannerSlotName,
} from "@/lib/ads/sideAds";

const SIDE_TIPS: Record<SideBannerSlotName, { title: string; body: string }> = {
  "side-banner-left": {
    title: "강화 팁",
    body: "성공률이 낮아질수록 내구도 여유를 먼저 확인하세요.",
  },
  "side-banner-right": {
    title: "랭킹 안내",
    body: "최고 가치 무기는 월드 기록과 주간 기록에 함께 반영됩니다.",
  },
};

function SideTipCard({ slotName }: { slotName: SideBannerSlotName }) {
  const tip = SIDE_TIPS[slotName];

  return (
    <aside
      className="relative mx-auto w-[160px] overflow-hidden rounded-lg border border-amber-500/18 bg-black/28 px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-white/5 backdrop-blur-[1px]"
      data-side-slot={slotName}
      aria-label={tip.title}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),transparent_36%,rgba(248,113,113,0.05)_70%,transparent)]" />
      <div className="relative">
        <div className="text-[11px] font-bold text-amber-100/78">
          {tip.title}
        </div>
        <p className="mt-2 text-[11px] font-medium leading-5 text-zinc-400">
          {tip.body}
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

  return <SideTipCard slotName={slotName} />;
}
