"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "adsense-h5-loader";

type AdPlacementWindow = Window & {
  adBreak?: (config: unknown) => void;
  adConfig?: (config: Record<string, unknown>) => void;
};

export function AdsenseRuntimeInit({
  clientId,
  h5AdBreakTestMode,
}: {
  clientId?: string;
  h5AdBreakTestMode?: boolean;
}) {
  const adBreakTestMode = Boolean(h5AdBreakTestMode);

  useEffect(() => {
    if (!clientId) return;
    const adWindow = window as AdPlacementWindow;
    adWindow.adsbygoogle = adWindow.adsbygoogle || [];

    const adPlacementApiShim = (config: unknown) => {
      adWindow.adsbygoogle = adWindow.adsbygoogle || [];
      adWindow.adsbygoogle?.push(config);
    };
    const ensureAdPlacementApi = () => {
      adWindow.adBreak = adWindow.adBreak || adPlacementApiShim;
      adWindow.adConfig =
        adWindow.adConfig ||
        (adPlacementApiShim as (config: Record<string, unknown>) => void);
    };

    ensureAdPlacementApi();

    if (document.getElementById(ADSENSE_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = "anonymous";
    script.dataset.adClient = clientId;
    script.dataset.adFrequencyHint = "30s";
    if (adBreakTestMode) script.dataset.adbreakTest = "on";
    script.addEventListener("load", ensureAdPlacementApi);
    document.head.appendChild(script);
  }, [clientId, adBreakTestMode]);

  return null;
}
