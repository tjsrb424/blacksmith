"use client";

import { useState } from "react";
import { ResourcePill } from "@/components/ui/ResourcePill";
import { CURRENCY_ICONS } from "@/data/assets";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { getSoundSettings, setSfxEnabled } from "@/lib/sound";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { useGameStore } from "@/store/gameStore";

function CurrencyIcon({
  src,
  emoji,
  label,
}: {
  src: string;
  emoji: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="text-base sm:text-lg">{emoji}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-6 w-6 object-contain sm:h-7 sm:w-7"
      title={label}
      onError={() => setFailed(true)}
    />
  );
}

function SfxToggle() {
  const [on, setOn] = useState(() =>
    typeof window !== "undefined" ? getSoundSettings().sfxEnabled : true,
  );

  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-amber-800/45 bg-zinc-950/85 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-amber-100/95 ring-1 ring-amber-700/25 backdrop-blur-sm transition hover:bg-zinc-900/90 active:scale-[0.98]"
      aria-pressed={on}
      title={on ? "효과음 끄기" : "효과음 켜기"}
      onClick={() => {
        const next = !on;
        setSfxEnabled(next);
        setOn(next);
      }}
    >
      {on ? "소리 ON" : "소리 OFF"}
    </button>
  );
}

export function TopResourceBar() {
  useRenderDiagnostics("TopResourceBar");
  const gold = useGameStore((s) => s.gold);
  const ember = useGameStore((s) => s.ember);
  const stone = useGameStore((s) => s.transcendStone);
  const mockAdReward = useGameStore((s) => s.mockAdReward);
  const showMockHint =
    process.env.NODE_ENV !== "production" && getConfiguredAdProvider() === "mock";

  return (
    <header className="sticky top-0 z-40 border-b border-amber-900/25 bg-[rgba(5,5,8,0.82)] backdrop-blur-sm">
      <div className="mx-auto max-w-6xl space-y-2 px-2.5 py-2 pt-[calc(0.55rem+env(safe-area-inset-top))] sm:px-6 sm:py-3 sm:pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-3">
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.gold} emoji="G" label="골드" />}
            label="골드"
            value={gold}
            onPlus={() => mockAdReward("gold")}
          />
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.ember} emoji="E" label="제련의 불씨" />}
            label="제련의 불씨"
            shortLabel="불씨"
            value={ember}
            onPlus={() => mockAdReward("ember")}
          />
          <ResourcePill
            icon={
              <CurrencyIcon
                src={CURRENCY_ICONS.transcendStone}
                emoji="S"
                label="초월석"
              />
            }
            label="초월석"
            value={stone}
            onPlus={() => mockAdReward("stone")}
          />
        </div>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] leading-none text-zinc-600 sm:text-[11px]">
            {showMockHint ? "+ 버튼은 광고 SDK 대신 Mock 보상입니다." : ""}
          </p>
          <SfxToggle />
        </div>
      </div>
    </header>
  );
}
