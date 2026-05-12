"use client";

import { FantasyButton } from "@/components/ui/FantasyButton";
import { FantasyPanel } from "@/components/ui/FantasyPanel";
import { DurabilityIcons } from "@/components/ui/DurabilityIcons";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { WeaponImage } from "@/components/ui/WeaponImage";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateRankingValue } from "@/lib/ranking";
import { calculateSaleGold } from "@/lib/economy";
import { formatGold } from "@/lib/format";
import { gradeLabel } from "@/lib/labels";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/cn";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

export function InventoryScreen() {
  useRenderDiagnostics("InventoryScreen");
  const owned = useGameStore((s) => s.ownedWeapons);
  const equippedId = useGameStore((s) => s.equippedWeaponId);
  const serverActionPending = useGameStore((s) => s.serverActionPending);
  const pendingSellWeaponIds = useGameStore((s) => s.pendingSellWeaponIds);
  const equip = useGameStore((s) => s.equipWeapon);
  const requestSellWeapon = useGameStore((s) => s.requestSellWeapon);
  const toggleWeaponLock = useGameStore((s) => s.toggleWeaponLock);

  const sorted = [...owned].sort(
    (a, b) =>
      calculateRankingValue(WEAPONS_BY_ID[b.weaponId], b) -
      calculateRankingValue(WEAPONS_BY_ID[a.weaponId], a),
  );
  const isLastWeapon = owned.length <= 1;

  return (
    <div className="relative mx-auto w-full flex-1 space-y-5 px-3 pb-5 pt-6">
      <ScreenBackground screen="inventory" />
      <header className="relative z-10">
        <h2 className="text-xl font-bold text-amber-50">보관함</h2>
        <p className="mt-1 text-sm text-zinc-400">
          가치 높은 순으로 정렬했습니다. 잠금 시 판매할 수 없습니다.
        </p>
      </header>

      <ul className="relative z-10 grid grid-cols-1 gap-3">
        {sorted.map((w) => {
          const def = WEAPONS_BY_ID[w.weaponId];
          if (!def) return null;
          const sell = calculateSaleGold(def, w);
          const rankVal = calculateRankingValue(def, w);
          const isEquipped = w.instanceId === equippedId;
          const isPendingSell = pendingSellWeaponIds.includes(w.instanceId);
          const isActionBlocked = serverActionPending || isPendingSell;
          return (
            <li key={w.instanceId}>
              <FantasyPanel
                className={cn(
                  "relative max-w-full overflow-hidden p-3 transition",
                  isEquipped && "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.12)]",
                  isPendingSell && "opacity-70 ring-1 ring-orange-400/35",
                )}
              >
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-3">
                    <div className="relative h-28 w-full min-w-0 overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-700/80">
                        <WeaponImage
                          src={def.imagePath}
                          alt={def.name}
                          className={cn(
                            "h-full w-full object-contain p-2 transition",
                            isPendingSell && "scale-95 opacity-55",
                          )}
                        />
                        {isPendingSell ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                            <div className="h-7 w-7 animate-spin rounded-full border-2 border-orange-200/25 border-t-orange-200" />
                          </div>
                        ) : null}
                      </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words font-semibold leading-snug text-zinc-100">{def.name}</span>
                        {w.locked ? (
                          <span className="rounded-full bg-red-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/40">
                            잠금
                          </span>
                        ) : null}
                        {isEquipped ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-500/40">
                            장착 중
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {gradeLabel(def.grade)} · 티어 {def.tier}
                      </div>
                      <div className="font-mono text-sm text-amber-100">
                        +{w.enhanceLevel}
                        {w.transcendLevel >= 1 ? ` ★${w.transcendLevel}` : ""} · 판매가{" "}
                        {formatGold(sell)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {w.enhanceLevel >= 15 && w.transcendLevel === 0 && w.durability > 0 ? (
                          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200 ring-1 ring-violet-500/40">
                            초월 가능
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>내구도</span>
                        <DurabilityIcons value={w.durability} emphasizeCritical />
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        랭킹 가치 {formatGold(rankVal)}
                      </div>
                      {isPendingSell ? (
                        <div className="rounded-md bg-orange-950/35 px-2 py-1 text-xs font-semibold text-orange-200 ring-1 ring-orange-500/25">
                          판매 처리 중...
                        </div>
                      ) : null}
                    </div>
                    <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2">
                      <FantasyButton
                        variant={isEquipped ? "ghost" : "secondary"}
                        disabled={isEquipped || isActionBlocked}
                        className="min-h-11 w-full min-w-0 px-2 text-xs"
                        onClick={() => equip(w.instanceId)}
                      >
                        {isEquipped ? "장착됨" : "장착"}
                      </FantasyButton>
                      <FantasyButton
                        variant="muted"
                        className="min-h-11 w-full min-w-0 px-2 text-xs"
                        disabled={isActionBlocked}
                        onClick={() => toggleWeaponLock(w.instanceId)}
                      >
                        {w.locked ? "잠금 해제" : "잠금"}
                      </FantasyButton>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2 border-t border-zinc-800 pt-3">
                    <FantasyButton
                      variant="accent"
                      className="min-h-12 w-full min-w-0"
                      disabled={w.durability <= 0 || isLastWeapon || isActionBlocked}
                      title={
                        isLastWeapon
                          ? "마지막 무기는 판매할 수 없습니다. 상점에서 다른 무기를 구매한 뒤 판매해주세요."
                          : undefined
                      }
                      onClick={() => requestSellWeapon(w.instanceId)}
                    >
                      {isPendingSell ? "판매 중..." : "판매"}
                    </FantasyButton>
                  </div>
                </div>
              </FantasyPanel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
