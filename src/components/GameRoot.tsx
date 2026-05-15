"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/modals/ModalRoot";
import { BlacksmithScreen } from "@/components/screens/BlacksmithScreen";
import { WeaponShopScreen } from "@/components/screens/WeaponShopScreen";
import { AutoForgeScreen } from "@/components/screens/AutoForgeScreen";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { RankingScreen } from "@/components/screens/RankingScreen";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { EnhanceAnimationOrchestrator } from "@/components/effects/EnhanceAnimationOrchestrator";
import { navTabToScreenKey, preloadBootstrapAssets } from "@/lib/preloadAssets";
import {
  clearPerfEvents,
  createPerfExportBundle,
  getPerfEventsSnapshot,
  isPerfToolsEnabled,
  perfEventsToCsv,
  perfExportFilename,
  subscribePerfEvents,
  summarizePerfEvents,
} from "@/lib/perfRecorder";
import {
  getPerformanceMetricSnapshot,
  subscribePerformanceMetrics,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { getCurrentSeasonInfo } from "@/lib/season";
import { preloadSounds, unlockAudio } from "@/lib/sound";
import { getGameMode } from "@/lib/supabase/env";
import { useLocale } from "@/lib/i18n/useLocale";
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
  const runDevPerfSmoke = useGameStore((s) => s.runDevPerfSmoke);
  const reset = useGameStore((s) => s.resetProgress);
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("blacksmith.devtools.open") === "true"
      : false,
  );
  const [tab, setTab] = useState<"metrics" | "logs" | "summary" | "cheats">(
    "metrics",
  );
  const [copyStatus, setCopyStatus] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const metrics = useSyncExternalStore(
    subscribePerformanceMetrics,
    getPerformanceMetricSnapshot,
    getPerformanceMetricSnapshot,
  );
  const perfEvents = useSyncExternalStore(
    subscribePerfEvents,
    getPerfEventsSnapshot,
    getPerfEventsSnapshot,
  );
  const enabled = isPerfToolsEnabled();

  if (!enabled) return null;

  const summary = summarizePerfEvents(perfEvents);
  const summaryRows = Object.values(summary).sort((a, b) => {
    const hot = [
      "enhance",
      "buy",
      "sell",
      "forge_collect",
      "forge_upgrade",
      "player_me",
      "ranking_weekly",
      "ranking_world",
      "ad_fetch",
      "bootstrap",
    ];
    const ai = hot.indexOf(a.key);
    const bi = hot.indexOf(b.key);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.key.localeCompare(b.key);
  });

  const exportBundle = () => createPerfExportBundle(perfEvents);
  const setStatus = (message: string) => {
    setCopyStatus(message);
    window.setTimeout(() => setCopyStatus(""), 1800);
  };
  const copyText = async (text: string, successMessage: string) => {
    setCopyFallback("");
    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
    } catch {
      setCopyFallback(text);
      setStatus("복사 실패 - 아래 텍스트를 직접 복사하세요");
    }
  };
  const downloadText = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("다운로드 생성 완료");
  };
  const copyLogs = () => {
    void copyText(JSON.stringify(exportBundle(), null, 2), "복사 완료");
  };
  const copySummary = () => {
    void copyText(
      JSON.stringify(
        {
          sessionId: exportBundle().sessionId,
          createdAt: new Date().toISOString(),
          summary,
        },
        null,
        2,
      ),
      "Summary 복사 완료",
    );
  };
  const downloadJson = () => {
    downloadText(
      JSON.stringify(exportBundle(), null, 2),
      perfExportFilename("json"),
      "application/json",
    );
  };
  const downloadCsv = () => {
    downloadText(
      perfEventsToCsv(perfEvents),
      perfExportFilename("csv"),
      "text/csv;charset=utf-8",
    );
  };

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
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200"
            onClick={copyLogs}
          >
            Copy
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-950/55 px-2 py-1 text-xs font-semibold text-emerald-200"
            onClick={() => {
              void runDevPerfSmoke().then(() => setStatus("Perf smoke 완료"));
            }}
          >
            Smoke
          </button>
          <button
            type="button"
            className="rounded-md bg-red-950/55 px-2 py-1 text-xs font-semibold text-red-200"
            onClick={() => {
              clearPerfEvents();
              setStatus("로그 삭제 완료");
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200"
            onClick={() => setOpenPersisted(false)}
          >
            닫기
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 border-b border-zinc-800 text-xs font-semibold">
        <button
          type="button"
          className={`py-2 ${tab === "metrics" ? "bg-zinc-800 text-amber-100" : "text-zinc-500"}`}
          onClick={() => setTab("metrics")}
        >
          Metrics
        </button>
        <button
          type="button"
          className={`py-2 ${tab === "logs" ? "bg-zinc-800 text-amber-100" : "text-zinc-500"}`}
          onClick={() => setTab("logs")}
        >
          Logs
        </button>
        <button
          type="button"
          className={`py-2 ${tab === "summary" ? "bg-zinc-800 text-amber-100" : "text-zinc-500"}`}
          onClick={() => setTab("summary")}
        >
          Summary
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
          <div className="space-y-3">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px] leading-4">
              {metricRows.map(([label, value]) => (
                <div key={label} className="contents">
                  <span className="text-zinc-500">{label}</span>
                  <span className="truncate text-zinc-200">{value}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold">
              <button
                type="button"
                className="col-span-2 rounded bg-emerald-950/55 px-2 py-2 text-emerald-200"
                onClick={() => {
                  void runDevPerfSmoke().then(() => setStatus("Perf smoke 완료"));
                }}
              >
                Run Perf Smoke
              </button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={copyLogs}>
                Copy Logs
              </button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={copySummary}>
                Summary Copy
              </button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={downloadJson}>
                Download JSON
              </button>
              <button type="button" className="rounded bg-zinc-800 px-2 py-2" onClick={downloadCsv}>
                Download CSV
              </button>
              <button
                type="button"
                className="col-span-2 rounded bg-red-950/55 px-2 py-2 text-red-200"
                onClick={() => {
                  clearPerfEvents();
                  setStatus("로그 삭제 완료");
                }}
              >
                Clear Logs ({perfEvents.length})
              </button>
            </div>
            {copyStatus ? (
              <p className="rounded bg-amber-950/40 px-2 py-1 text-[11px] text-amber-100">
                {copyStatus}
              </p>
            ) : null}
            {copyFallback ? (
              <textarea
                className="h-24 w-full resize-none rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300 ring-1 ring-zinc-700"
                readOnly
                value={copyFallback}
              />
            ) : null}
          </div>
        ) : null}
        {tab === "logs" ? (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-100">
                Recent Events ({perfEvents.length})
              </span>
              <button
                type="button"
                className="rounded bg-zinc-800 px-2 py-1 text-[11px]"
                onClick={() => setTab("metrics")}
              >
                Actions
              </button>
            </div>
            {perfEvents.slice(-80).reverse().map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="rounded-lg bg-zinc-950/70 p-2 ring-1 ring-zinc-800"
              >
                <div className="flex justify-between gap-2 text-zinc-200">
                  <span className="truncate">
                    {event.eventType}/{event.actionName ?? event.api ?? "-"}
                  </span>
                  <span className={event.error ? "text-red-300" : "text-emerald-300"}>
                    {event.elapsedMs}ms
                  </span>
                </div>
                <div className="mt-1 truncate text-zinc-500">
                  {new Date(event.timestamp).toLocaleTimeString()} · {event.screen}
                  {event.api ? ` · ${event.api}` : ""}
                </div>
                {event.adStatusApiCalled || event.adFetchSkippedReason ? (
                  <div className="mt-1 truncate text-violet-300/90">
                    ad={event.adProvider ?? "-"} statusApi=
                    {String(Boolean(event.adStatusApiCalled))} skip=
                    {event.adFetchSkippedReason ?? "-"}
                  </div>
                ) : null}
                {event.error ? (
                  <div className="mt-1 truncate text-red-300">{event.error}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {tab === "summary" ? (
          <div className="space-y-2 text-[11px]">
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,auto)] gap-x-2 border-b border-zinc-800 pb-1 font-mono text-zinc-500">
              <span>name</span>
              <span>n</span>
              <span>avg</span>
              <span>p50</span>
              <span>p95</span>
              <span>max</span>
            </div>
            {summaryRows.length === 0 ? (
              <p className="text-zinc-500">아직 누적 로그가 없습니다.</p>
            ) : null}
            {summaryRows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_repeat(5,auto)] gap-x-2 rounded bg-zinc-950/55 px-2 py-1.5 font-mono"
              >
                <span className="truncate text-zinc-200">
                  {row.key}
                  {row.baseline ? (
                    <span className="ml-1 text-[9px] text-amber-400/80">
                      base {row.baseline}
                    </span>
                  ) : null}
                  {row.errorCount ? (
                    <span className="ml-1 text-[9px] text-red-300">
                      err {row.errorCount}
                    </span>
                  ) : null}
                </span>
                <span>{row.count}</span>
                <span>{row.avg}</span>
                <span>{row.p50}</span>
                <span>{row.p95}</span>
                <span>{row.max}</span>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "cheats" ? (
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
        ) : null}
      </div>
    </div>
  );
}

function ServerActionOverlay() {
  const { t } = useLocale();
  const pending = useGameStore((s) => s.serverActionPending);
  const message = useGameStore((s) => s.serverActionMessage);
  const isEnhancing = useGameStore((s) => s.isEnhancing);

  if (!pending || !message || isEnhancing) return null;

  return (
    <div className="game-no-select game-fixed-overlay pointer-events-auto fixed left-1/2 top-1/2 z-[45] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-black/25 px-4 backdrop-blur-[1px]">
      <div className="rounded-lg border border-amber-500/30 bg-zinc-950/90 px-4 py-3 text-center text-sm font-semibold text-amber-100 shadow-2xl">
        {message.includes(".") ? t(message) : message}
      </div>
    </div>
  );
}

export function GameRoot({
  isCrazyGamesMode = false,
}: {
  isCrazyGamesMode?: boolean;
}) {
  useRenderDiagnostics("GameRoot");
  const { t } = useLocale();
  const [hydrated, setHydrated] = useState(false);
  const [hydrateSlow, setHydrateSlow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          <p>{t("loading.savedData")}</p>
          {hydrateSlow ? (
            <button
              type="button"
              className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300"
              onClick={() => setHydrated(true)}
            >
              {t("loading.continueWithoutSavedData")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        onOpenSettings={() => setSettingsOpen(true)}
        showAds={!isCrazyGamesMode}
      >
        {tab === "blacksmith" ? <BlacksmithScreen /> : null}
        {tab === "shop" ? <WeaponShopScreen /> : null}
        {tab === "forge" ? <AutoForgeScreen /> : null}
        {tab === "inventory" ? <InventoryScreen /> : null}
        {tab === "ranking" ? <RankingScreen /> : null}
      </AppShell>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isCrazyGamesMode={isCrazyGamesMode}
      />
      <ModalRoot />
      <EnhanceAnimationOrchestrator />
      <ServerActionOverlay />
      <DevToolsPanel screen={tab} />
    </>
  );
}
