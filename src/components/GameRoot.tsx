"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/modals/ModalRoot";
import { BlacksmithScreen } from "@/components/screens/BlacksmithScreen";
import { WeaponShopScreen } from "@/components/screens/WeaponShopScreen";
import { AutoForgeScreen } from "@/components/screens/AutoForgeScreen";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { RankingScreen } from "@/components/screens/RankingScreen";
import { EnhanceAnimationOrchestrator } from "@/components/effects/EnhanceAnimationOrchestrator";
import { navTabToScreenKey, preloadBootstrapAssets } from "@/lib/preloadAssets";
import {
  getPerformanceMetricSnapshot,
  subscribePerformanceMetrics,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { getCurrentSeasonInfo } from "@/lib/season";
import { preloadSounds, unlockAudio } from "@/lib/sound";
import { getGameMode } from "@/lib/supabase/env";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { useGameStore } from "@/store/gameStore";

function DevToolsPanel({ screen }: { screen: string }) {
  const addGold = useGameStore((s) => s.devAddGold);
  const addEmber = useGameStore((s) => s.devAddEmber);
  const addStone = useGameStore((s) => s.devAddStone);
  const maxEnh = useGameStore((s) => s.devMaxEnhanceEquipped);
  const restoreDur = useGameStore((s) => s.devRestoreDurability);
  const setTranscend = useGameStore((s) => s.devSetEquippedTranscendLevel);
  const forceSuccess = useGameStore((s) => s.devForceSuccess);
  const setForceSuccess = useGameStore((s) => s.devSetForceSuccess);
  const reset = useGameStore((s) => s.resetProgress);
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("blacksmith.devtools.open") === "true"
      : false,
  );
  const [tab, setTab] = useState<"metrics" | "cheats">("metrics");
  const metrics = useSyncExternalStore(
    subscribePerformanceMetrics,
    getPerformanceMetricSnapshot,
    getPerformanceMetricSnapshot,
  );
  const enabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED !== "false";

  if (!enabled) return null;

  const setOpenPersisted = (next: boolean) => {
    setOpen(next);
    window.localStorage.setItem("blacksmith.devtools.open", String(next));
  };
  const renderSummary = Object.entries(metrics.renderCounts ?? {})
    .slice(-8)
    .map(([name, count]) => `${name}:${count}`)
    .join(" ");
  const metricRows = [
    ["mode", getGameMode()],
    ["screen", metrics.currentScreen ?? screen],
    ["origin", metrics.origin ?? "-"],
    ["auth", metrics.authStage ?? "-"],
    ["auth elapsed", `${metrics.authStageElapsedMs ?? "-"}ms`],
    ["api", metrics.apiName ?? "-"],
    ["elapsed", `${metrics.elapsedMs ?? "-"}ms`],
    ["error", metrics.errorCode ?? "-"],
    ["bootstrap", `${metrics.bootstrapElapsedMs ?? "-"}ms`],
    ["player sync", `${metrics.playerSyncElapsedMs ?? "-"}ms`],
    ["store sync", `${metrics.lastStoreSyncElapsedMs ?? "-"}ms`],
    ["tab", `${metrics.tabSwitchElapsedMs ?? "-"}ms`],
    ["ranking", metrics.rankingCacheStatus ?? "-"],
    [
      "ad status",
      metrics.adStatusCacheHit == null
        ? "-"
        : metrics.adStatusCacheHit
          ? "hit"
          : "miss",
    ],
    ["ad fetch", `${metrics.adStatusFetchMs ?? "-"}ms`],
    ["ad complete", `${metrics.adRewardCompleteElapsedMs ?? "-"}ms`],
    ["ad api", `${metrics.adCompleteApiMs ?? "-"}ms`],
    ["ad modal", `${metrics.adRewardModalOpenMs ?? "-"}ms`],
    ["enhance api", `${metrics.enhanceApiMs ?? "-"}ms`],
    ["enhance modal", `${metrics.enhanceModalOpenMs ?? "-"}ms`],
    ["renders", renderSummary || "-"],
  ];

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-40 min-h-10 rounded-full border border-amber-500/35 bg-black/82 px-3 font-mono text-xs font-bold text-amber-200 shadow-xl backdrop-blur sm:bottom-5"
        onClick={() => setOpenPersisted(true)}
      >
        DEV {metrics.elapsedMs ? `${metrics.elapsedMs}ms` : ""}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 max-h-[60dvh] overflow-hidden rounded-xl border border-zinc-700/70 bg-black/88 text-zinc-300 shadow-2xl backdrop-blur sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[360px] sm:max-h-[70vh]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="font-mono text-xs font-bold text-amber-200">DEV</div>
        <button
          type="button"
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200"
          onClick={() => setOpenPersisted(false)}
        >
          닫기
        </button>
      </div>
      <div className="grid grid-cols-2 border-b border-zinc-800 text-xs font-semibold">
        <button
          type="button"
          className={`py-2 ${tab === "metrics" ? "bg-zinc-800 text-amber-100" : "text-zinc-500"}`}
          onClick={() => setTab("metrics")}
        >
          Metrics
        </button>
        <button
          type="button"
          className={`py-2 ${tab === "cheats" ? "bg-zinc-800 text-amber-100" : "text-zinc-500"}`}
          onClick={() => setTab("cheats")}
        >
          Cheats
        </button>
      </div>
      <div className="max-h-[calc(60dvh-5.5rem)] overflow-y-auto p-3 sm:max-h-[calc(70vh-5.5rem)]">
        {tab === "metrics" ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px] leading-4">
            {metricRows.map(([label, value]) => (
              <div key={label} className="contents">
                <span className="text-zinc-500">{label}</span>
                <span className="truncate text-zinc-200">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <button
              type="button"
              className={`w-full rounded px-2 py-2 font-semibold ${
                forceSuccess
                  ? "bg-emerald-900/70 text-emerald-200"
                  : "bg-zinc-800 text-zinc-400"
              }`}
              onClick={() => setForceSuccess(!forceSuccess)}
            >
              강화/초월 100% {forceSuccess ? "ON" : "OFF"}
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => addGold(100_000)}>G+100K</button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => addEmber(10_000)}>E+10K</button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => addStone(10)}>S+10</button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => addStone(100)}>S+100</button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => maxEnh()}>+15</button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={() => restoreDur()}>내구</button>
              <button type="button" className="rounded bg-violet-950/50 px-2 py-2 text-violet-200" onClick={() => setTranscend(9)}>★9</button>
              <button type="button" className="rounded bg-violet-950/50 px-2 py-2 text-violet-200" onClick={() => setTranscend(10)}>★10</button>
              <button type="button" className="rounded bg-red-950/60 px-2 py-2 text-red-300" onClick={() => reset()}>초기화</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServerActionOverlay() {
  const pending = useGameStore((s) => s.serverActionPending);
  const message = useGameStore((s) => s.serverActionMessage);
  const isEnhancing = useGameStore((s) => s.isEnhancing);

  if (!pending || !message || isEnhancing) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[45] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[1px]">
      <div className="rounded-lg border border-amber-500/30 bg-zinc-950/90 px-4 py-3 text-center text-sm font-semibold text-amber-100 shadow-2xl">
        {message}
      </div>
    </div>
  );
}

export function GameRoot() {
  useRenderDiagnostics("GameRoot");
  const [hydrated, setHydrated] = useState(false);
  const [hydrateSlow, setHydrateSlow] = useState(false);
  const tab = useGameStore((s) => s.activeTab);
  const equippedWeaponId = useGameStore((s) => {
    const row = s.ownedWeapons.find((o) => o.instanceId === s.equippedWeaponId);
    return row?.weaponId ?? null;
  });

  useEffect(() => {
    const unlock = () => setHydrated(true);
    const unsub = useGameStore.persist.onFinishHydration(unlock);

    queueMicrotask(() => {
      if (useGameStore.persist.hasHydrated()) unlock();
    });

    try {
      const pending = useGameStore.persist.rehydrate();
      if (pending && typeof (pending as Promise<void>).then === "function") {
        void (pending as Promise<void>).then(unlock).catch(unlock);
      }
    } catch {
      queueMicrotask(unlock);
    }

    const slowTimer = window.setTimeout(() => setHydrateSlow(true), 2500);
    const timer = window.setTimeout(unlock, 5000);

    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    preloadSounds();
    const onFirstGesture = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { passive: true });
    window.addEventListener("keydown", onFirstGesture);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => {
      useGameStore.getState().tryAutoOfflineForgeModal();
    });
    return () => cancelAnimationFrame(id);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const tabStartedAt = performance.now();
    updatePerformanceMetric({
      currentScreen: tab,
      tabSwitchElapsedMs: Math.round(performance.now() - tabStartedAt),
    });
    preloadBootstrapAssets({
      screen: navTabToScreenKey(tab),
      equippedWeaponId,
    });
  }, [hydrated, tab, equippedWeaponId]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      const si = getCurrentSeasonInfo();
      const st = useGameStore.getState();
      if (st.lastAcknowledgedSeasonId !== si.seasonId && st.modal === null) {
        useGameStore.setState({
          modal: {
            kind: "season_started",
            seasonId: si.seasonId,
            endsAt: si.endsAt,
          },
        });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-center text-sm text-zinc-500">
        <div>
          <p>저장 데이터를 불러오는 중...</p>
          {hydrateSlow ? (
            <button
              type="button"
              className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300"
              onClick={() => setHydrated(true)}
            >
              저장 데이터 없이 계속
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell>
        {tab === "blacksmith" ? <BlacksmithScreen /> : null}
        {tab === "shop" ? <WeaponShopScreen /> : null}
        {tab === "forge" ? <AutoForgeScreen /> : null}
        {tab === "inventory" ? <InventoryScreen /> : null}
        {tab === "ranking" ? <RankingScreen /> : null}
      </AppShell>
      <ModalRoot />
      <EnhanceAnimationOrchestrator />
      <ServerActionOverlay />
      <DevToolsPanel screen={tab} />
    </>
  );
}
