"use client";

import type { ReactNode } from "react";
import type { WeaponDefinition } from "@/types/game";
import { gradeLabel, weaponTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { formatGold } from "@/lib/format";
import { WeaponImage } from "@/components/ui/WeaponImage";
import {
  getCardFramePath,
  getRarityArtBackdropClass,
  getRarityFrameClass,
} from "@/data/assets";

export function WeaponCard({
  def,
  footer,
  className,
  variant = "default",
  owned,
  equipped,
  locked,
  durability,
  enhanceLevel,
  transcendLevel,
  rankingCandidate,
  transcendReady,
  maxEnhanceHighlight,
}: {
  def: WeaponDefinition;
  footer?: ReactNode;
  className?: string;
  variant?: "default" | "compact";
  owned?: boolean;
  equipped?: boolean;
  locked?: boolean;
  durability?: number;
  enhanceLevel?: number;
  transcendLevel?: number;
  rankingCandidate?: boolean;
  transcendReady?: boolean;
  maxEnhanceHighlight?: boolean;
}) {
  const compact = variant === "compact";
  const el = enhanceLevel ?? 0;
  const tl = transcendLevel ?? 0;
  const dur = durability;

  return (
    <article
      className={cn(
        "group flex select-none flex-col overflow-hidden rounded-xl border border-zinc-800/85 bg-[rgba(8,8,12,0.86)]",
        getRarityFrameClass(def.grade),
        locked && "opacity-75",
        equipped && "ring-2 ring-amber-500/45",
        maxEnhanceHighlight && el >= 15 && "shadow-[0_0_28px_rgba(245,158,11,0.2)]",
        compact && "border-zinc-800/75",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full ring-1 ring-inset ring-white/5",
          compact ? "aspect-5/3 max-h-[128px]" : "aspect-4/3",
          getRarityArtBackdropClass(def.grade),
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,rgba(0,0,0,0.2),transparent_60%)]" />
        {rankingCandidate ? (
          <span className="absolute left-1.5 top-1.5 z-30 rounded bg-indigo-600/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-50 ring-1 ring-indigo-400/50 sm:left-2 sm:top-2 sm:text-[10px]">
            기록 후보
          </span>
        ) : null}
        {transcendReady ? (
          <span className="absolute right-1.5 top-1.5 z-30 rounded bg-violet-600/40 px-1.5 py-0.5 text-[9px] font-bold text-violet-50 ring-1 ring-violet-400/45 sm:right-2 sm:top-2 sm:text-[10px]">
            초월 가능
          </span>
        ) : null}
        {equipped ? (
          <span className="absolute bottom-1.5 left-1.5 z-30 rounded bg-amber-600/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-50 ring-1 ring-amber-300/50 sm:bottom-2 sm:left-2 sm:text-[10px]">
            장착 중
          </span>
        ) : null}
        {owned ? (
          <span className="absolute bottom-1.5 right-1.5 z-30 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[9px] font-medium text-zinc-300 ring-1 ring-zinc-600/50 sm:bottom-2 sm:right-2 sm:text-[10px]">
            보유
          </span>
        ) : null}
        {locked ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
            <span className="rounded-full bg-red-950/80 px-3 py-1 text-xs font-bold text-red-200 ring-1 ring-red-500/45">
              잠금
            </span>
          </div>
        ) : null}
        {dur !== undefined && dur <= 1 && dur > 0 ? (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-red-950/70 to-transparent py-1.5 text-center sm:py-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-red-200 sm:text-[10px]">
              위험
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "relative flex h-full w-full items-center justify-center",
            compact ? "p-2" : "p-4",
          )}
        >
          <WeaponArt
            path={def.imagePath}
            name={def.name}
            highlight={tl >= 1}
            compact={compact}
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getCardFramePath(def.grade)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-18 h-full w-full object-contain p-0.5 opacity-[0.88]"
          onDragStart={(e) => e.preventDefault()}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <div className={cn("flex flex-1 flex-col gap-1.5", compact ? "p-2 pt-1.5" : "gap-2 p-3")}>
        <div className="min-w-0">
          <div
            className={cn(
              "text-amber-200/70",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {gradeLabel(def.grade)} · {weaponTypeLabel(def.type)}
          </div>
          <div
            className={cn(
              "min-w-0 font-semibold leading-snug text-zinc-100",
              compact ? "line-clamp-2 text-xs" : "wrap-break-word text-base",
            )}
          >
            {def.name}
          </div>
        </div>
        <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[10px]" : "text-xs")}>
          <span className="rounded bg-zinc-900/80 px-1.5 py-0.5 font-mono text-zinc-400 ring-1 ring-zinc-700">
            티어 {def.tier}
          </span>
          {el > 0 || tl > 0 ? (
            <span className="font-mono text-amber-200/95">
              +{el}
              {tl >= 1 ? ` ★${tl}` : ""}
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            "font-mono text-amber-300",
            compact ? "text-[11px]" : "text-sm",
          )}
        >
          기본가 {formatGold(def.basePrice)}
        </div>
        {footer ? <div className="mt-auto pt-0.5">{footer}</div> : null}
      </div>
    </article>
  );
}

function WeaponArt({
  path,
  name,
  highlight,
  compact,
}: {
  path: string;
  name: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-1">
      <WeaponImage
        src={path}
        alt={name}
        className={cn(
          "relative z-10 w-auto object-contain",
          compact ? "max-h-[56%] max-w-[92%]" : "max-h-[72%]",
          highlight
            ? "drop-shadow-[0_0_22px_rgba(167,139,250,0.45)]"
            : "drop-shadow-[0_0_18px_rgba(251,146,60,0.35)]",
        )}
      />
    </div>
  );
}
