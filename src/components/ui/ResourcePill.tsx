"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatInt } from "@/lib/format";
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

  return (
    <div
      className={cn(
        "grid min-h-13 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-amber-700/30 bg-black/32 px-1.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] sm:min-h-12 sm:gap-2 sm:px-2",
      )}
      title={label}
      aria-label={`${label} ${formatInt(value)}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/35 ring-1 ring-amber-600/30 sm:h-8 sm:w-8">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold leading-none text-zinc-500 sm:text-[11px]">
          {displayLabel}
        </div>
        <div className="mt-1 truncate font-mono text-[13px] font-bold leading-none text-amber-100 sm:text-sm">
          {formatInt(value)}
        </div>
      </div>
      {onPlus ? (
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) playUiClick();
          }}
          onClick={onPlus}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-600/20 text-sm font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
          aria-label={`${label} mock reward`}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
