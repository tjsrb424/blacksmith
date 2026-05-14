"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SideBannerSlot } from "@/components/ads/SideBannerSlot";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { TopResourceBar } from "@/components/layout/TopResourceBar";
import { BACKGROUND_ASSETS } from "@/data/assets";

function useDesktopSideRails() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1200px)");
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return enabled;
}

function SideRail({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  const backgroundImage = isLeft
    ? BACKGROUND_ASSETS.forge
    : BACKGROUND_ASSETS.ranking;

  return (
    <aside
      className="desktop-side-rail relative min-h-dvh w-full min-w-[180px] overflow-hidden"
      aria-hidden
      data-side-rail={side}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22] saturate-[0.82]"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundPosition: isLeft ? "58% center" : "44% center",
          backgroundSize: "cover",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,3,5,0.88),rgba(7,7,9,0.62)_42%,rgba(3,3,5,0.9))]" />
      <div
        className={
          isLeft
            ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_38%,rgba(249,115,22,0.2),transparent_30%),radial-gradient(circle_at_55%_78%,rgba(251,191,36,0.1),transparent_26%)]"
            : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_26%,rgba(250,204,21,0.18),transparent_30%),radial-gradient(circle_at_48%_72%,rgba(245,158,11,0.12),transparent_28%)]"
        }
      />
      <div
        className={
          isLeft
            ? "pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-amber-500/18 to-transparent"
            : "pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-amber-500/18 to-transparent"
        }
      />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-2">
        <div className="space-y-5">
          <SideBannerSlot
            slotName={isLeft ? "side-banner-left" : "side-banner-right"}
          />
          <div className="pointer-events-none mx-auto h-24 w-[190px] rounded-full bg-amber-500/5 blur-2xl" />
        </div>
      </div>
    </aside>
  );
}

export function AppShell({
  children,
  onOpenSettings,
}: {
  children: ReactNode;
  onOpenSettings?: () => void;
}) {
  const showDesktopSideRails = useDesktopSideRails();

  return (
    <div className="app-shell overflow-hidden bg-[#050506] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.08),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.72),transparent_38%,transparent_62%,rgba(0,0,0,0.72))]" />
      <div className="app-shell-layout relative z-10 mx-auto">
        {showDesktopSideRails ? <SideRail side="left" /> : null}
        <div className="game-no-select game-viewport relative mx-auto flex min-h-0 flex-col overflow-hidden bg-[#08080a] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_0_60px_rgba(0,0,0,0.72)]">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.08),transparent_34%)]" />
          <TopResourceBar onOpenSettings={onOpenSettings} />
          <main className="main-scroll relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </main>
          <BottomTabs />
        </div>
        {showDesktopSideRails ? <SideRail side="right" /> : null}
      </div>
    </div>
  );
}
