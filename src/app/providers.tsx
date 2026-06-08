"use client";

import type { ReactNode } from "react";
import { AdsenseRuntimeInit } from "@/components/ads/AdsenseRuntimeInit";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export function Providers({
  adsenseClientId,
  children,
}: {
  adsenseClientId?: string;
  children: ReactNode;
}) {
  return (
    <LocaleProvider>
      <AdsenseRuntimeInit clientId={adsenseClientId} />
      {children}
    </LocaleProvider>
  );
}
