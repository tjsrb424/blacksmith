"use client";

import { cn } from "@/lib/cn";

/** 제련로 화면용 가벼운 불씨 점 — CSS만 사용 */
export function ForgeEmberParticles({ className }: { className?: string }) {
  const dots = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className,
      )}
      aria-hidden
    >
      {dots.map((i) => (
        <span
          key={i}
          className="animate-forge-ember absolute h-1 w-1 rounded-full bg-orange-300/70 shadow-[0_0_6px_rgba(251,146,60,0.75)]"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23 + 7) % 100}%`,
            animationDelay: `${(i % 5) * 0.15}s`,
            animationDuration: `${2.2 + (i % 4) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
