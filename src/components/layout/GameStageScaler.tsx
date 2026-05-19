"use client";

import type { ReactNode } from "react";
import {
  GAME_STAGE_HEIGHT,
  GAME_STAGE_WIDTH,
  useGameStageScale,
} from "@/hooks/useGameStageScale";

export function GameStageScaler({ children }: { children: ReactNode }) {
  const { outerRef, scale } = useGameStageScale<HTMLDivElement>();

  return (
    <div ref={outerRef} className="game-stage-outer">
      <div
        className="game-stage-slot"
        style={{
          width: GAME_STAGE_WIDTH * scale,
          height: GAME_STAGE_HEIGHT * scale,
        }}
      >
        <div
          className="game-stage"
          style={{
            width: GAME_STAGE_WIDTH,
            height: GAME_STAGE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
