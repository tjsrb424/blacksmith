"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatCompactKoreanNumber, formatInt } from "@/lib/format";
import { playUiClick } from "@/lib/sound";

export function ResourcePill({
  icon,
  label,
  shortLabel,
  value,
  onPlus,
}: {
  icon: ReactNode;
  label: string;
  shortLabel?: string;
  value: number;
  onPlus?: () => void;
}) {
  const displayLabel = shortLabel ?? label;
  const fullValue = formatInt(value);
  const displayValue = formatCompactKoreanNumber(value);

  return (
    <div
      className={cn(
        "grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-amber-700/28 bg-[rgba(8,6,4,0.62)] px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-black/20 backdrop-blur-[1px]",
      )}
      title={`${label} ${fullValue}`}
      aria-label={`${label} ${fullValue}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/35 ring-1 ring-amber-600/30">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold leading-none text-zinc-500">
          {displayLabel}
        </div>
        <div className="numeric-value mt-1 truncate font-mono text-[12px] font-black leading-none text-amber-100 sm:text-[13px]">
          {displayValue}
        </div>
      </div>
      {onPlus ? (
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) playUiClick();
          }}
          onClick={onPlus}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/24 bg-amber-600/18 text-sm font-black text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.14)] ring-1 ring-black/20 hover:bg-amber-500/28"
          aria-label={`${label} mock reward`}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
