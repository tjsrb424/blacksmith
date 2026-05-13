"use client";

import { useEffect, useState } from "react";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { ForgeEmberParticles } from "@/components/effects/ForgeEmberParticles";
import { CURRENCY_ICONS } from "@/data/assets";
import { forgeUpgradeCostGold } from "@/data/balance";
import {
  computePendingForgeEmber,
  getForgeEmberPerMinute,
  getForgeSnapshot,
} from "@/lib/forge";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { AdRewardStatusText } from "@/components/ads/AdRewardStatusText";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { useGameStore } from "@/store/gameStore";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

function formatMaxAccumLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${minutes}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function ForgeProgressBar({
  pct,
  full,
  warnBand,
}: {
  pct: number;
  full: boolean;
  warnBand: boolean;
}) {
  const barTint = full
    ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]"
    : warnBand
      ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
      : "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300 shadow-[0_0_12px_rgba(251,146,60,0.36)]";

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/45 ring-1 ring-amber-800/35">
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", barTint)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function AutoForgeScreen() {
  useRenderDiagnostics("AutoForgeScreen");
  const forgeLevel = useGameStore((s) => s.forgeLevel);
  const forgeLastCollectAt = useGameStore((s) => s.forgeLastCollectAt);
  const ember = useGameStore((s) => s.ember);
  const gold = useGameStore((s) => s.gold);
  const collect = useGameStore((s) => s.collectForge);
  const requestUpgrade = useGameStore((s) => s.requestForgeUpgrade);
  const serverActionPending = useGameStore((s) => s.serverActionPending);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const snap = getForgeSnapshot({
    forgeLevel,
    forgeLastCollectAt,
    now,
  });

  const pending = computePendingForgeEmber({
    forgeLevel,
    forgeLastCollectAt,
    now,
  });

  const nextRate =
    forgeLevel < 10
      ? getForgeEmberPerMinute(forgeLevel + 1)
      : snap.ratePerMinute;
  const upgradeCost = forgeUpgradeCostGold(forgeLevel);
  const canAffordUpgrade = forgeLevel < 10 && gold >= upgradeCost;
  const isRewardAdDisabled = getConfiguredAdProvider() === "disabled";

  const pct = Math.round(snap.fillRatio * 100);
  const warnBand = snap.fillRatio >= 0.8 && snap.fillRatio < 1;
  const full = snap.isFull;

  return (
    <div className="relative mx-auto w-full flex-1 space-y-5 px-3 pb-5 pt-6">
      <ScreenBackground screen="forge" />
      <header className="relative z-10">
        <h2 className="text-xl font-bold text-amber-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
          제련로
        </h2>
        <p className="mt-1 text-sm text-zinc-300 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
          시간이 지나면 제련의 불씨가 쌓입니다. 최대 누적{" "}
          <span className="text-amber-200/90">{formatMaxAccumLabel(snap.maxAccumulateMinutes)}</span>
        </p>
      </header>

      <section className="relative z-10 overflow-hidden rounded-[1.4rem] border border-amber-700/35 bg-[linear-gradient(180deg,rgba(31,18,10,0.45),rgba(5,6,10,0.56)_42%,rgba(5,6,10,0.68))] p-4 shadow-[0_20px_52px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.16)] ring-1 ring-inset ring-amber-500/15 backdrop-blur-[1px] sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(249,115,22,0.38),transparent_42%),linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.18)_72%,rgba(0,0,0,0.35)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-orange-500/18 via-amber-500/6 to-transparent" />
        <ForgeEmberParticles className="opacity-45 mask-[linear-gradient(to_top,transparent,black_20%,black_84%,transparent)]" />

        <div className="relative z-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                Auto Forge
              </div>
              <div className="mt-1 text-lg font-bold text-amber-50">
                제련로 Lv.{forgeLevel}
              </div>
            </div>
            <div className="rounded-lg bg-black/28 px-3 py-2 text-right ring-1 ring-amber-700/25">
              <div className="text-[10px] text-zinc-500">분당</div>
              <div className="font-mono text-sm text-amber-200">
                {formatInt(snap.ratePerMinute)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-800/30 bg-black/22 p-4 text-center shadow-[inset_0_0_38px_rgba(251,146,60,0.08)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/30 bg-linear-to-b from-amber-500/16 to-orange-950/28 shadow-[0_0_28px_rgba(251,146,60,0.24)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CURRENCY_ICONS.ember}
                alt=""
                className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]"
              />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              미수령 불씨
            </div>
            <div className="mt-1 font-mono text-5xl font-bold tabular-nums text-orange-200 drop-shadow-[0_0_24px_rgba(251,146,60,0.42)]">
              {formatInt(pending)}
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-black/24 p-3 ring-1 ring-amber-900/24">
            <div className="flex justify-between gap-2 text-sm text-zinc-300">
              <span>보관량</span>
              <span
                className={cn(
                  "font-mono",
                  full ? "text-red-300" : warnBand ? "text-amber-200" : "text-zinc-100",
                )}
              >
                {formatInt(pending)} / {formatInt(snap.storageCap)}
              </span>
            </div>
            <ForgeProgressBar pct={pct} full={full} warnBand={warnBand} />
            <p className="text-[11px] text-zinc-500">
              최대 누적 {formatMaxAccumLabel(snap.maxAccumulateMinutes)} · 가득 차면 추가 생산이 중단됩니다.
            </p>
            {full ? (
              <p className="rounded-lg bg-red-950/35 p-2.5 text-xs leading-relaxed text-red-100 ring-1 ring-red-500/25">
                제련로가 가득 찼습니다. 지금 수령하면 생산 손실을 막을 수 있습니다.
              </p>
            ) : warnBand ? (
              <p className="text-xs text-amber-300/95">보관량이 높습니다. 수령을 권장합니다.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <FantasyButton
              className="min-h-[52px] w-full text-base shadow-[0_0_22px_rgba(245,158,11,0.18)]"
              disabled={pending <= 0 || serverActionPending}
              onClick={() => collect(false)}
            >
              수령하기
            </FantasyButton>
            <FantasyButton
              variant="promo"
              className="min-h-[52px] w-full"
              disabled={pending <= 0 || isRewardAdDisabled || serverActionPending}
              onClick={() => collect(true)}
            >
              {isRewardAdDisabled ? "광고 보상 준비 중" : "광고 보고 2배 수령"}
            </FantasyButton>
          </div>
          {isRewardAdDisabled ? (
            <p className="text-center text-[11px] leading-relaxed text-zinc-500">
              광고 보상은 준비 중입니다. 기본 수령은 정상 이용할 수 있습니다.
            </p>
          ) : (
            <AdRewardStatusText rewardType="forgeCollectDouble" />
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div className="rounded-xl bg-black/24 p-3 ring-1 ring-zinc-700/50">
              <div className="text-zinc-500">기본 수령</div>
              <div className="mt-1 font-mono text-amber-100">{formatInt(pending)}</div>
            </div>
            <div className="rounded-xl bg-violet-950/16 p-3 ring-1 ring-violet-700/30">
              <div className="text-zinc-500">광고 2배</div>
              <div className="mt-1 font-mono text-violet-100">{formatInt(pending * 2)}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 grid gap-3">
        <FantasyPanel title="생산 정보" className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">분당 생산</span>
            <span className="font-mono text-amber-100">{formatInt(snap.ratePerMinute)} / 분</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">시간당 생산</span>
            <span className="font-mono text-amber-100">{formatInt(snap.ratePerHour)} / 시</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">보유 불씨</span>
            <span className="font-mono text-zinc-200">{formatInt(ember)}</span>
          </div>
        </FantasyPanel>

        <FantasyPanel title="업그레이드" className="space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">다음 레벨 분당 생산</span>
            <span className="font-mono text-amber-100">
              {forgeLevel >= 10 ? "MAX" : `${formatInt(nextRate)} / 분`}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">비용</span>
            <span className="font-mono text-amber-200">
              {forgeLevel >= 10 ? "—" : `${formatInt(upgradeCost)} G`}
            </span>
          </div>
          <FantasyButton
            variant="secondary"
            className="w-full"
            disabled={forgeLevel >= 10 || serverActionPending}
            onClick={() => requestUpgrade()}
          >
            {forgeLevel >= 10 ? "최대 레벨" : "제련로 업그레이드"}
          </FantasyButton>
          {!canAffordUpgrade && forgeLevel < 10 ? (
            <p className="text-center text-xs text-red-400/95">골드가 부족합니다</p>
          ) : null}
        </FantasyPanel>
      </div>
    </div>
  );
}
