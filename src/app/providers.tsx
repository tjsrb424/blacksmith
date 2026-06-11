"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { areExternalAdsEnabled } from "@/lib/platform";

const AdsenseRuntimeInit = dynamic(
  areExternalAdsEnabled
    ? () =>
        import("@/components/ads/AdsenseRuntimeInit").then(
          (mod) => mod.AdsenseRuntimeInit,
        )
    : () => Promise.resolve(() => null),
  { ssr: false },
);

export function Providers({
  adsenseClientId,
  h5AdBreakTestMode,
  children,
}: {
  adsenseClientId?: string;
  h5AdBreakTestMode?: boolean;
  children: ReactNode;
}) {
  return (
    <LocaleProvider>
      {areExternalAdsEnabled ? (
        <AdsenseRuntimeInit
          clientId={adsenseClientId}
          h5AdBreakTestMode={h5AdBreakTestMode}
        />
      ) : null}
      {children}
    </LocaleProvider>
  );
}
