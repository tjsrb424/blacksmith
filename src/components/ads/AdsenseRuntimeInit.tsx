"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdsenseRuntimeInit({ clientId }: { clientId?: string }) {
  useEffect(() => {
    if (!clientId) return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function adPlacementApiShim(config) {
      window.adsbygoogle?.push(config);
    };
  }, [clientId]);

  return null;
}
