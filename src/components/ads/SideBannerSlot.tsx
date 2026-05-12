"use client";

export function SideBannerSlot({
  slotName,
}: {
  slotName: "side-banner-left" | "side-banner-right";
}) {
  return (
    <aside
      className="relative mx-auto flex h-[280px] w-[160px] items-center justify-center overflow-hidden rounded-lg border border-amber-500/18 bg-black/28 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-white/5 backdrop-blur-[1px]"
      data-ad-slot={slotName}
      aria-label="광고 영역"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),transparent_36%,rgba(248,113,113,0.05)_70%,transparent)]" />
      <div className="pointer-events-none absolute inset-3 rounded-md border border-dashed border-amber-300/14" />
      <div className="relative text-center">
        <div className="font-mono text-xs font-bold tracking-[0.32em] text-amber-100/38">
          AD
        </div>
        <div className="mt-2 text-[10px] font-semibold text-zinc-500">
          광고 영역
        </div>
      </div>
    </aside>
  );
}
