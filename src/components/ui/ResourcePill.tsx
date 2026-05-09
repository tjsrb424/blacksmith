"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatInt } from "@/lib/format";
import { playUiClick } from "@/lib/sound";

export function ResourcePill({
  icon,
  label,
  value,
  onPlus,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onPlus?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-700/30 bg-black/32 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]",
      )}
      title={label}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black/35 ring-1 ring-amber-600/30">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="truncate font-mono text-sm text-amber-100">{formatInt(value)}</div>
      </div>
      {onPlus ? (
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button === 0) playUiClick();
          }}
          onClick={onPlus}
          className="shrink-0 rounded-md bg-amber-600/20 px-2 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
