"use client";

import type { ReactNode } from "react";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { TopResourceBar } from "@/components/layout/TopResourceBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#08080a] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.08),transparent_34%)]" />
      <TopResourceBar />
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <BottomTabs />
    </div>
  );
}
