"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBackgroundImagePath,
  getScreenBackgroundOverlayClass,
  getScreenFallbackGradientClass,
  type ScreenKey,
} from "@/data/assets";
import { cn } from "@/lib/cn";
import { updatePerformanceMetric } from "@/lib/performanceMetrics";

/**
 * 화면별 배경 — 파일 없거나 로드 실패 시 CSS 그라데이션만 사용
 */
export function ScreenBackground({
  screen,
  className,
}: {
  screen: ScreenKey;
  className?: string;
}) {
  const path = getBackgroundImagePath(screen);
  const [imgFailed, setImgFailed] = useState(false);
  const requestedAtRef = useRef(0);

  useEffect(() => {
    requestedAtRef.current = performance.now();
  }, [path]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div className={cn("absolute inset-0", getScreenFallbackGradientClass(screen))} />
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={path}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[center_35%] opacity-[0.68] saturate-[1.02] mix-blend-normal sm:object-center sm:opacity-[0.74] sm:saturate-[1.08]"
          onDragStart={(e) => e.preventDefault()}
          onLoad={() => {
            const entry = performance
              .getEntriesByName(path)
              .find((item) => item.entryType === "resource") as
              | PerformanceResourceTiming
              | undefined;
            const requestedAt = requestedAtRef.current || performance.now();
            updatePerformanceMetric({
              backgroundLoadedFromCache:
                entry != null
                  ? entry.transferSize === 0 || entry.duration < 8
                  : performance.now() - requestedAt < 8,
            });
          }}
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <div
        className={cn("absolute inset-0", getScreenBackgroundOverlayClass(screen))}
      />
    </div>
  );
}
