"use client";

import { useState } from "react";
import {
  getBackgroundImagePath,
  getScreenBackgroundOverlayClass,
  getScreenFallbackGradientClass,
  type ScreenKey,
} from "@/data/assets";
import { cn } from "@/lib/cn";

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
          className="absolute inset-0 h-full w-full object-cover object-[center_35%] opacity-[0.74] saturate-[1.08] mix-blend-normal sm:object-center"
          onDragStart={(e) => e.preventDefault()}
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <div
        className={cn("absolute inset-0", getScreenBackgroundOverlayClass(screen))}
      />
    </div>
  );
}
