"use client";

import { useEffect, useRef, useState } from "react";

import { useLocale } from "@/lib/i18n/useLocale";
import type { SideBannerSlotName } from "@/lib/ads/sideAds";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdsenseSideBannerProps = {
  slotName: SideBannerSlotName;
  clientId: string;
  slotId: string;
  width: 160;
  height: 600;
};

export function AdsenseSideBanner({
  slotName,
  clientId,
  slotId,
  width,
  height,
}: AdsenseSideBannerProps) {
  const { t } = useLocale();
  const pushedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      window.setTimeout(() => setFailed(true), 0);
    }
  }, []);

  return (
    <div
      className="relative mx-auto flex h-[600px] w-[160px] items-center justify-center overflow-hidden rounded-md border border-amber-500/16 bg-black/20 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-white/5"
      data-adsense-slot={slotName}
      style={{ width, height }}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: "inline-block",
          width,
          height,
        }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
      />
      {failed ? (
        <div className="pointer-events-none px-4 text-center text-[11px] font-semibold leading-5 text-amber-100/56">
          {t("ads.sideRailFallback")}
        </div>
      ) : null}
    </div>
  );
}
