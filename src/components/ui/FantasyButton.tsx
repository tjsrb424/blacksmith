"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { playUiClick } from "@/lib/sound";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "ghost"
    | "muted"
    | "accent"
    | "promo";
  /** true면 ui_click SFX 생략 */
  muteClickSound?: boolean;
};

export function FantasyButton({
  className,
  variant = "primary",
  muteClickSound,
  onPointerDown,
  ...props
}: Props) {
  const base =
    "inline-flex min-h-12 touch-manipulation select-none items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-[0.55]";
  const styles: Record<NonNullable<Props["variant"]>, string> = {
    primary:
      "border border-amber-300/35 bg-[linear-gradient(180deg,rgba(245,158,11,0.88)_0%,rgba(180,83,9,0.96)_52%,rgba(67,20,7,0.98)_100%)] text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.25),0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,237,213,0.3),inset_0_-12px_22px_rgba(0,0,0,0.22)] ring-1 ring-amber-200/24 hover:bg-[linear-gradient(180deg,rgba(251,191,36,0.94)_0%,rgba(194,91,12,0.98)_52%,rgba(88,28,8,1)_100%)]",
    secondary:
      "border border-amber-700/28 bg-[rgba(8,6,4,0.72)] text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.07)] ring-1 ring-black/25 hover:bg-[rgba(28,18,10,0.78)] hover:text-amber-50",
    danger:
      "border border-red-400/30 bg-[linear-gradient(180deg,rgba(153,47,20,0.86)_0%,rgba(91,30,17,0.96)_54%,rgba(35,12,10,0.98)_100%)] text-red-50 shadow-[0_0_22px_rgba(185,28,28,0.18),0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(254,202,202,0.16)] ring-1 ring-red-300/18 hover:bg-[linear-gradient(180deg,rgba(185,64,28,0.9)_0%,rgba(127,39,18,0.98)_54%,rgba(55,16,12,1)_100%)]",
    ghost:
      "bg-transparent text-amber-100/82 ring-1 ring-transparent hover:bg-zinc-950/45 hover:text-amber-50 hover:ring-amber-800/22",
    muted:
      "border border-zinc-700/50 bg-zinc-950/72 text-zinc-400 ring-1 ring-black/25 hover:bg-zinc-900/82 hover:text-zinc-200 disabled:border-zinc-800 disabled:bg-zinc-950/45 disabled:text-zinc-500",
    accent:
      "border border-sky-400/30 bg-[linear-gradient(180deg,rgba(14,116,144,0.84)_0%,rgba(30,64,175,0.92)_58%,rgba(15,23,42,0.98)_100%)] text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.18),0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(186,230,253,0.2)] ring-1 ring-sky-300/20 hover:from-sky-600 hover:to-blue-900",
    promo:
      "border border-orange-300/35 bg-[linear-gradient(180deg,rgba(249,115,22,0.86)_0%,rgba(180,83,9,0.96)_52%,rgba(67,20,7,0.98)_100%)] text-amber-50 shadow-[0_0_24px_rgba(251,146,60,0.24),0_10px_24px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,237,213,0.24)] ring-1 ring-orange-200/24 hover:from-orange-400 hover:to-amber-800",
  };
  return (
    <button
      type="button"
      className={cn(base, styles[variant], className)}
      onPointerDown={(e) => {
        if (!muteClickSound && e.button === 0) playUiClick();
        onPointerDown?.(e);
      }}
      {...props}
    />
  );
}
