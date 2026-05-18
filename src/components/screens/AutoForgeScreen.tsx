"use client";

import { useEffect, useState } from "react";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ForgeEmberParticles } from "@/components/effects/ForgeEmberParticles";
import { CURRENCY_ICONS } from "@/data/assets";
import { forgeUpgradeCostGold } from "@/data/balance";
import {
  computePendingForgeEmber,
  getForgeEmberPerMinute,
  getForgeSnapshot,
} from "@/lib/forge";
import { formatGold, formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/useLocale";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { AdRewardStatusText } from "@/components/ads/AdRewardStatusText";
import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { useIsCrazyGamesMode } from "@/lib/distributionContext";
import { useGameStore } from "@/store/gameStore";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

function formatMaxAccumLabel(
  minutes: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return t("time.minutes", { minutes });
  if (m === 0) return t("time.hours", { hours: h });
  return t("time.hoursMinutes", { hours: h, minutes: m });
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
  const { t } = useLocale();
  const isCrazyGamesMode = useIsCrazyGamesMode();
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
  const showRewardAds = !isCrazyGamesMode;

  const pct = Math.round(snap.fillRatio * 100);
  const warnBand = snap.fillRatio >= 0.8 && snap.fillRatio < 1;
  const full = snap.isFull;

  return (
    <div className="relative mx-auto w-full flex-1 space-y-5 px-3 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)] pt-6">
      <ScreenBackground screen="forge" />
      <header className="relative z-10">
        <h2 className="text-xl font-bold text-amber-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
          {t("forge.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-300 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
          {t("forge.description")}{" "}
          <span className="text-amber-200/90">{formatMaxAccumLabel(snap.maxAccumulateMinutes, t)}</span>
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
                {t("forge.level", { level: forgeLevel })}
              </div>
            </div>
            <div className="rounded-lg bg-black/28 px-3 py-2 text-right ring-1 ring-amber-700/25">
              <div className="text-[10px] text-zinc-500">{t("forge.perMinute")}</div>
              <div className="font-mono text-sm text-amber-200">
                {formatInt(snap.ratePerMinute)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-800/30 bg-black/22 px-4 py-5 text-center shadow-[inset_0_0_44px_rgba(251,146,60,0.1)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/30 bg-linear-to-b from-amber-500/16 to-orange-950/28 shadow-[0_0_28px_rgba(251,146,60,0.24)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CURRENCY_ICONS.ember}
                alt=""
                draggable={false}
                className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]"
              />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/65">
              {t("forge.pendingEmber")}
            </div>
            <div className="numeric-value mx-auto mt-1 max-w-full text-center font-mono text-5xl font-black text-orange-200 drop-shadow-[0_0_24px_rgba(251,146,60,0.42)]">
              {formatInt(pending)}
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-black/24 p-3 ring-1 ring-amber-900/24">
            <div className="flex justify-between gap-2 text-sm text-zinc-300">
              <span>{t("forge.storage")}</span>
              <span
                className={cn(
                  "numeric-value max-w-[12rem] font-mono",
                  full ? "text-red-300" : warnBand ? "text-amber-200" : "text-zinc-100",
                )}
              >
                {formatInt(pending)} / {formatInt(snap.storageCap)}
              </span>
            </div>
            <ForgeProgressBar pct={pct} full={full} warnBand={warnBand} />
            <p className="text-[11px] text-zinc-500">
              {t("forge.maxAccumNotice", { time: formatMaxAccumLabel(snap.maxAccumulateMinutes, t) })}
            </p>
            {full ? (
              <p className="rounded-lg bg-red-950/35 p-2.5 text-xs leading-relaxed text-red-100 ring-1 ring-red-500/25">
                {t("forge.fullWarning")}
              </p>
            ) : warnBand ? (
              <p className="text-xs text-amber-300/95">{t("forge.highStorageWarning")}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <FantasyButton
              className="min-h-[54px] w-full overflow-hidden rounded-xl border border-amber-300/35 bg-[linear-gradient(180deg,rgba(245,158,11,0.82)_0%,rgba(180,83,9,0.94)_48%,rgba(67,20,7,0.98)_100%)] px-3 py-2 text-base text-amber-50 shadow-[0_0_24px_rgba(251,146,60,0.28),0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,237,213,0.32),inset_0_-12px_22px_rgba(0,0,0,0.24)] ring-1 ring-amber-200/25 hover:bg-[linear-gradient(180deg,rgba(251,191,36,0.88)_0%,rgba(194,91,12,0.96)_48%,rgba(88,28,8,1)_100%)]"
              disabled={pending <= 0 || serverActionPending}
              onClick={() => collect(false)}
            >
              <span className="text-[17px] font-black leading-none tracking-wide text-amber-50 drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]">
                {t("forge.collect")}
              </span>
            </FantasyButton>
            {!showRewardAds ? null : isRewardAdDisabled ? (
              <div className="rounded-xl border border-zinc-800/80 bg-black/24 px-3 py-3 text-center ring-1 ring-zinc-900/60">
                <div className="flex justify-center">
                  <StatusBadge tone="pending">{t("reward.preparing")}</StatusBadge>
                </div>
                <div className="mt-1 text-[11px] text-zinc-600">
                  {t("reward.basicAvailable")}
                </div>
              </div>
            ) : (
              <FantasyButton
                variant="promo"
                className="min-h-[52px] w-full flex-col gap-0.5 text-amber-50"
                disabled={pending <= 0 || serverActionPending}
                onClick={() => collect(true)}
              >
                <span className="text-sm font-black">{t("forge.doubleCollect")}</span>
                <span className="numeric-value max-w-full font-mono text-[11px] text-amber-100/85">
                  {formatInt(pending * 2)}
                </span>
              </FantasyButton>
            )}
          </div>
          {showRewardAds ? (
            isRewardAdDisabled ? (
              <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                {t("reward.extraPreparing")}
              </p>
            ) : (
              <AdRewardStatusText rewardType="forgeCollectDouble" />
            )
          ) : null}

          <div
            className={
              showRewardAds
                ? "grid grid-cols-2 gap-2 text-xs text-zinc-400"
                : "grid grid-cols-1 gap-2 text-xs text-zinc-400"
            }
          >
            <div className="rounded-xl bg-black/24 p-3 ring-1 ring-zinc-700/50">
              <div className="text-zinc-500">{t("forge.basicCollect")}</div>
              <div className="numeric-value mt-1 font-mono text-amber-100">{formatInt(pending)}</div>
            </div>
            {showRewardAds ? (
              <div
                className={cn(
                  "rounded-xl p-3 ring-1",
                  isRewardAdDisabled
                    ? "bg-black/18 opacity-60 ring-zinc-800/70"
                    : "bg-violet-950/16 ring-violet-700/30",
                )}
              >
                <div className="text-zinc-500">{t("forge.adDouble")}</div>
                <div className="numeric-value mt-1 font-mono text-violet-100">{formatInt(pending * 2)}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="relative z-10 grid gap-3">
        <FantasyPanel title={t("forge.productionInfo")} className="space-y-2 text-sm">
          <div className="stat-row">
            <span className="text-zinc-500">{t("forge.productionPerMinute")}</span>
            <span className="numeric-value font-mono text-amber-100">{t("forge.perMinuteValue", { amount: formatInt(snap.ratePerMinute) })}</span>
          </div>
          <div className="stat-row">
            <span className="text-zinc-500">{t("forge.productionPerHour")}</span>
            <span className="numeric-value font-mono text-amber-100">{t("forge.perHourValue", { amount: formatInt(snap.ratePerHour) })}</span>
          </div>
          <div className="stat-row">
            <span className="text-zinc-500">{t("currency.emberOwned")}</span>
            <span className="numeric-value font-mono text-zinc-200">{formatInt(ember)}</span>
          </div>
        </FantasyPanel>

        <FantasyPanel title={t("forge.upgrade")} className="space-y-3 text-sm">
          <div className="space-y-2">
            <div className="stat-row">
              <span className="text-zinc-500">{t("forge.currentProduction")}</span>
              <span className="numeric-value font-mono text-amber-100">{t("forge.perMinuteValue", { amount: formatInt(snap.ratePerMinute) })}</span>
            </div>
            <div className="stat-row">
              <span className="text-zinc-500">{t("forge.nextProduction")}</span>
              <span className="numeric-value font-mono text-amber-100">
                {forgeLevel >= 10 ? "MAX" : t("forge.perMinuteValue", { amount: formatInt(nextRate) })}
              </span>
            </div>
            <div className="stat-row">
              <span className="text-zinc-500">{t("enhance.cost")}</span>
              <span className="numeric-value font-mono text-amber-200">
                {forgeLevel >= 10 ? "—" : formatGold(upgradeCost)}
              </span>
            </div>
          </div>
          <FantasyButton
            variant={canAffordUpgrade ? "secondary" : "muted"}
            className="w-full"
            disabled={forgeLevel >= 10 || !canAffordUpgrade || serverActionPending}
            onClick={() => requestUpgrade()}
          >
            {forgeLevel >= 10 ? t("forge.maxLevel") : t("forge.upgrade")}
          </FantasyButton>
          {!canAffordUpgrade && forgeLevel < 10 ? (
            <div className="flex justify-center">
              <StatusBadge tone="shortage">{t("shop.notEnoughGold")}</StatusBadge>
            </div>
          ) : null}
        </FantasyPanel>
      </div>
    </div>
  );
}
