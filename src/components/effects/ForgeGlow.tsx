"use client";

import { cn } from "@/lib/cn";

export type ForgeAuraMode =
  | "neutral"
  | "danger"
  | "transcend"
  | "maxStar"
  | "idle";

type ForgeGlowProps = {
  mode?: ForgeAuraMode;
  className?: string;
  showRing?: boolean;
};

/**
 * 대장간 중앙 화로 글로우 — 모드별 색상 (과한 blur 지양)
 */
export function ForgeGlow({ mode = "neutral", className, showRing = true }: ForgeGlowProps) {
  const ring =
    mode === "danger"
      ? "ring-red-500/55 shadow-[0_0_36px_rgba(239,68,68,0.35)]"
      : mode === "transcend" || mode === "maxStar"
        ? "ring-violet-400/50 shadow-[0_0_40px_rgba(167,139,250,0.38)]"
        : "ring-amber-500/50 shadow-[0_0_32px_rgba(245,158,11,0.28)]";

  const core =
    mode === "danger"
      ? "bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.42),rgba(0,0,0,0)_65%)]"
      : mode === "transcend"
        ? "bg-[radial-gradient(circle_at_50%_50%,rgba(167,139,250,0.42),rgba(0,0,0,0)_65%)]"
        : mode === "maxStar"
          ? "bg-[radial-gradient(circle_at_50%_48%,rgba(250,204,21,0.38),rgba(139,92,246,0.22)_45%,rgba(0,0,0,0)_68%)]"
          : "bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.45),rgba(0,0,0,0)_65%)]";

  const pulse =
    mode === "danger"
      ? "bg-[radial-gradient(circle_at_50%_60%,rgba(248,113,113,0.18),transparent_60%)]"
      : mode === "transcend" || mode === "maxStar"
        ? "bg-[radial-gradient(circle_at_50%_60%,rgba(196,181,253,0.16),transparent_60%)]"
        : "bg-[radial-gradient(circle_at_50%_60%,rgba(251,191,36,0.2),transparent_60%)]";

  return (
    <div
      className={cn(
        "relative h-44 w-44 sm:h-52 sm:w-52 motion-reduce:transition-none",
        className,
      )}
    >
      <div className={cn("absolute inset-0 rounded-full blur-sm", core)} />
      {showRing ? (
        <div
          className={cn(
            "absolute inset-2 rounded-full ring-2 ring-offset-4 ring-offset-zinc-950",
            ring,
          )}
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0 animate-pulse rounded-full motion-reduce:animate-none",
          pulse,
        )}
      />
    </div>
  );
}
