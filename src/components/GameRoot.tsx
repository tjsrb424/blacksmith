"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/modals/ModalRoot";
import { BlacksmithScreen } from "@/components/screens/BlacksmithScreen";
import { WeaponShopScreen } from "@/components/screens/WeaponShopScreen";
import { AutoForgeScreen } from "@/components/screens/AutoForgeScreen";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { RankingScreen } from "@/components/screens/RankingScreen";
import { EnhanceAnimationOrchestrator } from "@/components/effects/EnhanceAnimationOrchestrator";
import { navTabToScreenKey, preloadBootstrapAssets } from "@/lib/preloadAssets";
import { getCurrentSeasonInfo } from "@/lib/season";
import { preloadSounds, unlockAudio } from "@/lib/sound";
import { useGameStore } from "@/store/gameStore";

function DevTools() {
  const addGold = useGameStore((s) => s.devAddGold);
  const addEmber = useGameStore((s) => s.devAddEmber);
  const addStone = useGameStore((s) => s.devAddStone);
  const maxEnh = useGameStore((s) => s.devMaxEnhanceEquipped);
  const restoreDur = useGameStore((s) => s.devRestoreDurability);
  const setTranscend = useGameStore((s) => s.devSetEquippedTranscendLevel);
  const forceSuccess = useGameStore((s) => s.devForceSuccess);
  const setForceSuccess = useGameStore((s) => s.devSetForceSuccess);
  const reset = useGameStore((s) => s.resetProgress);

  const enabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED !== "false";

  if (!enabled) return null;
  return (
    <div className="fixed bottom-20 right-3 z-30 max-w-[260px] rounded-xl border border-dashed border-zinc-700 bg-black/80 p-3 text-[10px] text-zinc-400 backdrop-blur-sm">
      <div className="mb-2 font-bold text-amber-600/90">DEV</div>
      <button
        type="button"
        className={`mb-2 w-full rounded px-2 py-1 font-semibold ${
          forceSuccess
            ? "bg-emerald-900/70 text-emerald-200"
            : "bg-zinc-800 text-zinc-400"
        }`}
        onClick={() => setForceSuccess(!forceSuccess)}
      >
        강화/초월 100% {forceSuccess ? "ON" : "OFF"}
      </button>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => addGold(100_000)}>
          G+100k
        </button>
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => addEmber(10_000)}>
          E+10k
        </button>
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => addStone(10)}>
          S+10
        </button>
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => addStone(100)}>
          S+100
        </button>
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => maxEnh()}>
          +15
        </button>
        <button type="button" className="rounded bg-zinc-800 px-2 py-1" onClick={() => restoreDur()}>
          내구
        </button>
        <button type="button" className="rounded bg-violet-950/50 px-2 py-1 text-violet-200" onClick={() => setTranscend(9)}>
          ★9
        </button>
        <button type="button" className="rounded bg-violet-950/50 px-2 py-1 text-violet-200" onClick={() => setTranscend(10)}>
          ★10
        </button>
        <button type="button" className="rounded bg-red-950/60 px-2 py-1 text-red-300" onClick={() => reset()}>
          초기화
        </button>
      </div>
    </div>
  );
}

export function GameRoot() {
  const [hydrated, setHydrated] = useState(false);
  const tab = useGameStore((s) => s.activeTab);
  const equippedWeaponId = useGameStore((s) => {
    const row = s.ownedWeapons.find((o) => o.instanceId === s.equippedWeaponId);
    return row?.weaponId ?? null;
  });

  /**
   * persist 리하이드가 effect 구독보다 먼저 끝나면 onFinishHydration이 안 불릴 수 있음.
   * hasHydrated는 queueMicrotask에서 확인해 레이스와 ESLint(set-state-in-effect) 모두 피함.
   */
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

    const timer = window.setTimeout(unlock, 4000);

    return () => {
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] text-sm text-zinc-500">
        저장 데이터 불러오는 중…
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
      <DevTools />
    </>
  );
}
