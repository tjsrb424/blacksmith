"use client";

import type { NavTab } from "@/types/game";
import { TAB_ICONS } from "@/data/assets";
import { cn } from "@/lib/cn";
import {
  diagnosticLog,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { navTabToScreenKey, preloadScreenBackground } from "@/lib/preloadAssets";
import { playUiClick } from "@/lib/sound";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { useGameStore } from "@/store/gameStore";
import { startTransition, useState } from "react";

const TABS: Array<{
  id: NavTab;
  label: string;
  iconKey: keyof typeof TAB_ICONS;
  emoji: string;
}> = [
  { id: "blacksmith", label: "대장간", iconKey: "blacksmith", emoji: "⚒️" },
  { id: "shop", label: "무기상점", iconKey: "shop", emoji: "🛒" },
  { id: "forge", label: "제련로", iconKey: "forge", emoji: "🔥" },
  { id: "inventory", label: "보관함", iconKey: "inventory", emoji: "🎒" },
  { id: "ranking", label: "랭킹", iconKey: "ranking", emoji: "🏆" },
];

export function BottomTabs() {
  useRenderDiagnostics("BottomTabs");
  const tab = useGameStore((s) => s.activeTab);
  const setTab = useGameStore((s) => s.setActiveTab);
  const isEnhancing = useGameStore((s) => s.isEnhancing);

  return (
    <nav className="bottom-nav relative z-40 shrink-0 border-t border-amber-900/30 bg-[rgba(5,5,8,0.8)] backdrop-blur-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1 px-1 py-2">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={tab === t.id}
            disabled={isEnhancing}
            label={t.label}
            iconSrc={TAB_ICONS[t.iconKey]}
            emoji={t.emoji}
            onClick={() => {
              if (tab === t.id) return;
              const startedAt = performance.now();
              diagnosticLog("tab", "click", { from: tab, to: t.id });
              updatePerformanceMetric({
                tabTarget: t.id,
                currentScreen: t.id,
              });
              preloadScreenBackground(navTabToScreenKey(t.id));
              startTransition(() => setTab(t.id));
              requestAnimationFrame(() => {
                updatePerformanceMetric({
                  tabSwitchElapsedMs: Math.round(performance.now() - startedAt),
                });
              });
            }}
          />
        ))}
      </div>
    </nav>
  );
}

function TabButton({
  active,
  disabled,
  label,
  iconSrc,
  emoji,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  iconSrc: string;
  emoji: string;
  onClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        if (e.button === 0) playUiClick();
      }}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold transition",
        disabled && "cursor-not-allowed opacity-35",
        active
          ? "bg-amber-600/25 text-amber-50 ring-1 ring-amber-500/40"
          : "text-zinc-500 hover:text-zinc-200",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center",
          !active && "opacity-[0.42] grayscale-[0.35] brightness-[0.85] scale-[0.94]",
        )}
        aria-hidden
      >
        {imgFailed ? (
          <span className="text-base">{emoji}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt=""
            draggable={false}
            className="h-full w-full object-contain"
            onDragStart={(e) => e.preventDefault()}
            onError={() => setImgFailed(true)}
          />
        )}
      </span>
      <span className="leading-none">{label}</span>
    </button>
  );
}
