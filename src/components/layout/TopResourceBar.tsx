"use client";

import { useState } from "react";
import { ResourcePill } from "@/components/ui/ResourcePill";
import { CURRENCY_ICONS } from "@/data/assets";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
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
    return <span className="text-base">{emoji}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-6 w-6 object-contain"
      title={label}
      onError={() => setFailed(true)}
    />
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
    <header className="resource-header relative z-40 shrink-0 border-b border-amber-900/25 bg-[rgba(5,5,8,0.82)] backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-2.5 py-1.5">
        <div className="grid min-w-0 grid-cols-3 gap-1.5">
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.gold} emoji="G" label="골드" />}
            label="골드"
            value={gold}
            onPlus={showMockHint ? () => mockAdReward("gold") : undefined}
          />
          <ResourcePill
            icon={<CurrencyIcon src={CURRENCY_ICONS.ember} emoji="E" label="제련의 불씨" />}
            label="제련의 불씨"
            shortLabel="불씨"
            value={ember}
            onPlus={showMockHint ? () => mockAdReward("ember") : undefined}
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
            shortLabel="초월"
            value={stone}
            onPlus={showMockHint ? () => mockAdReward("stone") : undefined}
          />
        </div>
        {showMockHint ? (
          <p className="mt-1 min-w-0 truncate text-[10px] leading-none text-zinc-600">
            {showMockHint ? "+ 버튼은 광고 SDK 대신 Mock 보상입니다." : ""}
          </p>
        ) : null}
      </div>
    </header>
  );
}
