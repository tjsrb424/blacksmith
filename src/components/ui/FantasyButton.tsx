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
    "inline-flex min-h-12 touch-manipulation select-none items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
  const styles: Record<NonNullable<Props["variant"]>, string> = {
    primary:
      "bg-gradient-to-b from-amber-500 to-amber-700 text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] ring-1 ring-amber-300/40 hover:from-amber-400 hover:to-amber-600",
    secondary:
      "bg-zinc-900/80 text-amber-100 ring-1 ring-amber-600/40 hover:bg-zinc-800",
    danger:
      "bg-gradient-to-b from-red-700 to-red-900 text-amber-50 ring-1 ring-red-400/40",
    ghost: "bg-transparent text-amber-100/90 hover:bg-zinc-900/60",
    muted:
      "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800 hover:text-zinc-200",
    accent:
      "bg-gradient-to-b from-sky-600 to-blue-800 text-white shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/40 hover:from-sky-500 hover:to-blue-700",
    promo:
      "bg-gradient-to-b from-orange-500 to-amber-700 text-black shadow-[0_0_24px_rgba(251,146,60,0.35)] ring-1 ring-orange-300/50 hover:from-orange-400 hover:to-amber-600",
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
