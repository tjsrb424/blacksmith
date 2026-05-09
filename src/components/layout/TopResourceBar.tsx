"use client";

import { useState } from "react";
import { ResourcePill } from "@/components/ui/ResourcePill";
import { CURRENCY_ICONS } from "@/data/assets";
import { getSoundSettings, setSfxEnabled } from "@/lib/sound";
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
    return <span className="text-lg">{emoji}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-7 w-7 object-contain"
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
      className="ml-auto shrink-0 rounded-lg border border-amber-800/45 bg-zinc-950/85 px-3 py-2 text-[11px] font-semibold leading-none text-amber-100/95 ring-1 ring-amber-700/25 backdrop-blur-sm transition hover:bg-zinc-900/90 active:scale-[0.98]"
      aria-pressed={on}
      title={on ? "효과음 켜짐 — 탭하여 끄기" : "효과음 꺼짐 — 탭하여 켜기"}
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
  const gold = useGameStore((s) => s.gold);
  const ember = useGameStore((s) => s.ember);
  const stone = useGameStore((s) => s.transcendStone);
  const mockAdReward = useGameStore((s) => s.mockAdReward);

  return (
    <header className="sticky top-0 z-40 border-b border-amber-900/25 bg-[rgba(5,5,8,0.78)] pb-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-3 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:gap-3">
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.gold} emoji="🪙" label="골드" />}
            label="골드"
            value={gold}
            onPlus={() => mockAdReward("gold")}
          />
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.ember} emoji="🔥" label="제련의 불씨" />}
            label="제련의 불씨"
            value={ember}
            onPlus={() => mockAdReward("ember")}
          />
          <ResourcePill
            icon={
              <CurrencyIcon src={CURRENCY_ICONS.transcendStone} emoji="💎" label="초월석" />
            }
            label="초월석"
            value={stone}
            onPlus={() => mockAdReward("stone")}
          />
        </div>
        <SfxToggle />
      </div>
      <div className="mx-auto max-w-6xl px-3 pb-2 text-[10px] text-zinc-600 sm:px-6">
        + 버튼은 광고 SDK 대신 Mock 보상입니다.
      </div>
    </header>
  );
}
