"use client";

import type { ReactNode } from "react";
import { AdsenseRuntimeInit } from "@/components/ads/AdsenseRuntimeInit";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

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
      <AdsenseRuntimeInit
        clientId={adsenseClientId}
        h5AdBreakTestMode={h5AdBreakTestMode}
      />
      {children}
    </LocaleProvider>
  );
}
