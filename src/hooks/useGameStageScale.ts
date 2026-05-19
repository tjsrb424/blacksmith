"use client";

import { useLayoutEffect, useRef, useState } from "react";

export const GAME_STAGE_WIDTH = 430;
export const GAME_STAGE_HEIGHT = 883;

function calculateStageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const nextScale = Math.min(
    1,
    width / GAME_STAGE_WIDTH,
    height / GAME_STAGE_HEIGHT,
  );
  return Number(Math.max(0.1, nextScale).toFixed(4));
}

export function useGameStageScale<T extends HTMLElement>() {
  const outerRef = useRef<T | null>(null);
  const lastScaleRef = useRef(1);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const target = outerRef.current;
    if (!target) return;

    let delayedMeasure: number | null = null;

    const writeScaleVars = (nextScale: number) => {
      document.documentElement.style.setProperty(
        "--game-stage-scale",
        String(nextScale),
      );
      document.documentElement.style.setProperty(
        "--game-stage-scaled-width",
        `${GAME_STAGE_WIDTH * nextScale}px`,
      );
      document.documentElement.style.setProperty(
        "--game-stage-scaled-height",
        `${GAME_STAGE_HEIGHT * nextScale}px`,
      );
    };

    const measure = () => {
      const rect = target.getBoundingClientRect();
      const fallbackWidth = window.visualViewport?.width ?? window.innerWidth;
      const fallbackHeight = window.visualViewport?.height ?? window.innerHeight;
      const availableWidth = rect.width > 0 ? rect.width : fallbackWidth;
      const availableHeight = rect.height > 0 ? rect.height : fallbackHeight;
      const nextScale = calculateStageScale(availableWidth, availableHeight);

      if (nextScale !== lastScaleRef.current) {
        lastScaleRef.current = nextScale;
        setScale(nextScale);
      }
      writeScaleVars(nextScale);
    };

    const scheduleMeasure = () => {
      measure();
      if (delayedMeasure !== null) {
        window.clearTimeout(delayedMeasure);
      }
      delayedMeasure = window.setTimeout(() => {
        delayedMeasure = null;
        measure();
      }, 80);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    resizeObserver?.observe(target);
    const fallbackInterval = window.setInterval(measure, 250);

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (delayedMeasure !== null) window.clearTimeout(delayedMeasure);
      window.clearInterval(fallbackInterval);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, []);

  return { outerRef, scale };
}
