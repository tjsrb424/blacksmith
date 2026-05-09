"use client";

import { useEffect, useRef } from "react";
import {
  playEnhanceHammerHitOnce,
  playEnhanceStartOnly,
} from "@/lib/sound";
import { useGameStore } from "@/store/gameStore";

/** +0~+7 구간(+1~+7 시도): 빠른 연출 */
const FAST_HAMMER_MS = 200;
const FAST_FINALIZE_MS = 600;

/** +8 이상: 3타 후 결과 */
const HEAVY_HAMMER_MS = [250, 750, 1250] as const;
const HEAVY_FINALIZE_MS = 1650;

/**
 * 강화 연출 타이머·사운드·망치 단계.
 * finalize는 세션(runId)으로 오래된 타이머와 겹치지 않게 함.
 */
export function EnhanceAnimationOrchestrator() {
  const pending = useGameStore((s) => s.enhancePending);
  const isEnhancing = useGameStore((s) => s.isEnhancing);
  const finalizeEnhanceOutcome = useGameStore((s) => s.finalizeEnhanceOutcome);
  const setEnhanceHammerPhase = useGameStore((s) => s.setEnhanceHammerPhase);

  const runIdRef = useRef(0);

  useEffect(() => {
    if (!pending || !isEnhancing) return;

    const myRun = ++runIdRef.current;
    const timers: number[] = [];

    const arm = (delayMs: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (myRun !== runIdRef.current) return;
          fn();
        }, delayMs),
      );
    };

    playEnhanceStartOnly();

    if (pending.tier === "fast") {
      arm(FAST_HAMMER_MS, () => {
        setEnhanceHammerPhase(2);
        playEnhanceHammerHitOnce();
      });
      arm(FAST_FINALIZE_MS, () => {
        setEnhanceHammerPhase(0);
        finalizeEnhanceOutcome();
      });
    } else {
      HEAVY_HAMMER_MS.forEach((delayMs, index) => {
        arm(delayMs, () => {
          setEnhanceHammerPhase((index + 1) as 1 | 2 | 3);
          playEnhanceHammerHitOnce();
        });
      });
      arm(HEAVY_FINALIZE_MS, () => {
        setEnhanceHammerPhase(0);
        finalizeEnhanceOutcome();
      });
    }

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [pending, isEnhancing, finalizeEnhanceOutcome, setEnhanceHammerPhase]);

  return null;
}
