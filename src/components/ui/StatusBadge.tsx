import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatusBadgeTone =
  | "equipped"
  | "locked"
  | "ranking"
  | "danger"
  | "recommended"
  | "empty"
  | "pending"
  | "shortage"
  | "transcend"
  | "owned"
  | "neutral";

const toneClass: Record<StatusBadgeTone, string> = {
  equipped: "border-amber-400/35 bg-amber-500/18 text-amber-100 ring-amber-500/24",
  locked: "border-slate-500/28 bg-slate-950/58 text-slate-300 ring-slate-600/22",
  ranking: "border-violet-400/32 bg-violet-600/18 text-violet-100 ring-violet-500/24",
  danger: "border-red-400/35 bg-red-950/48 text-red-200 ring-red-500/24",
  recommended: "border-amber-400/35 bg-orange-600/16 text-amber-100 ring-amber-500/24",
  empty: "border-zinc-600/35 bg-zinc-950/52 text-zinc-400 ring-zinc-700/25",
  pending: "border-orange-400/30 bg-orange-950/38 text-orange-200 ring-orange-500/20",
  shortage: "border-red-400/30 bg-red-950/35 text-red-200 ring-red-500/20",
  transcend: "border-fuchsia-400/30 bg-violet-700/18 text-violet-100 ring-violet-500/24",
  owned: "border-emerald-400/25 bg-emerald-950/28 text-emerald-200 ring-emerald-500/18",
  neutral: "border-zinc-600/35 bg-zinc-950/55 text-zinc-300 ring-zinc-700/25",
};

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusBadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-4 tracking-wide ring-1 backdrop-blur-[1px]",
        toneClass[tone],
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
