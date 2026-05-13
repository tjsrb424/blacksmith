"use client";

import { useEffect, useRef, useState } from "react";

import type { SideBannerSlotName } from "@/lib/ads/sideAds";

const ADFIT_SCRIPT_ID = "kakao-adfit-ba-script";
const ADFIT_SCRIPT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";

let mountedAdFitBannerCount = 0;
let cleanupTimer: number | undefined;
let scriptLoadPromise: Promise<void> | undefined;

type AdFitApi = {
  render?: (element: HTMLElement) => void;
  destroy?: (element: HTMLElement) => void;
};

declare global {
  interface Window {
    adfit?: AdFitApi;
  }
}

function getAdFitScript() {
  return document.getElementById(ADFIT_SCRIPT_ID) as HTMLScriptElement | null;
}

function loadAdFitScript() {
  if (window.adfit?.render) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  const existingScript = getAdFitScript();
  if (existingScript) {
    if (existingScript.dataset.loaded === "true") return Promise.resolve();
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => {
          existingScript.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
      existingScript.addEventListener("error", reject, { once: true });
    });
    return scriptLoadPromise;
  }

  const script = document.createElement("script");
  script.id = ADFIT_SCRIPT_ID;
  script.async = true;
  script.src = ADFIT_SCRIPT_SRC;
  script.dataset.adfitSideRail = "true";
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", reject, { once: true });
  });
  document.head.appendChild(script);

  return scriptLoadPromise;
}

function scheduleScriptCleanup() {
  cleanupTimer = window.setTimeout(() => {
    cleanupTimer = undefined;
    if (mountedAdFitBannerCount > 0) return;
    getAdFitScript()?.remove();
    scriptLoadPromise = undefined;
  }, 0);
}

function clearScriptCleanup() {
  if (cleanupTimer === undefined) return;
  window.clearTimeout(cleanupTimer);
  cleanupTimer = undefined;
}

type AdFitBannerProps = {
  slotName: SideBannerSlotName;
  unitId?: string;
  width: 160;
  height: 600;
};

export function AdFitBanner({
  slotName,
  unitId,
  width,
  height,
}: AdFitBannerProps) {
  const insRef = useRef<HTMLModElement>(null);
  const [failedUnitId, setFailedUnitId] = useState<string>();
  const scriptFailed = failedUnitId === unitId;

  useEffect(() => {
    const adElement = insRef.current;
    if (!unitId || !adElement) return;

    mountedAdFitBannerCount += 1;
    clearScriptCleanup();
    let mounted = true;

    loadAdFitScript()
      .then(() => {
        if (!mounted) return;
        window.adfit?.render?.(adElement);
      })
      .catch(() => {
        if (mounted) setFailedUnitId(unitId);
      });

    return () => {
      mounted = false;
      window.adfit?.destroy?.(adElement);
      mountedAdFitBannerCount = Math.max(0, mountedAdFitBannerCount - 1);
      scheduleScriptCleanup();
    };
  }, [unitId]);

  if (!unitId) {
    return (
      <div
        className="relative mx-auto flex h-[600px] w-[160px] items-center justify-center overflow-hidden rounded-md border border-amber-500/16 bg-black/20 px-4 text-center text-[11px] font-semibold leading-5 text-amber-100/56 ring-1 ring-white/5"
        data-adfit-slot={slotName}
        style={{ width, height }}
      >
        베타 기간에는 제련로와 랭킹 기록이 수시로 조정될 수 있습니다.
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto flex h-[600px] w-[160px] items-center justify-center overflow-hidden rounded-md border border-amber-500/16 bg-black/20 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-white/5"
      data-adfit-slot={slotName}
      style={{ width, height }}
    >
      <ins
        ref={insRef}
        key={`${slotName}-${unitId}`}
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={unitId}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
      {scriptFailed ? (
        <div className="pointer-events-none px-4 text-center text-[11px] font-semibold leading-5 text-amber-100/56">
          베타 기간에는 제련로와 랭킹 기록이 수시로 조정될 수 있습니다.
        </div>
      ) : null}
    </div>
  );
}
