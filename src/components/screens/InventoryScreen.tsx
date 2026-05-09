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

export function InventoryScreen() {
  const owned = useGameStore((s) => s.ownedWeapons);
  const equippedId = useGameStore((s) => s.equippedWeaponId);
  const equip = useGameStore((s) => s.equipWeapon);
  const requestSellWeapon = useGameStore((s) => s.requestSellWeapon);
  const toggleWeaponLock = useGameStore((s) => s.toggleWeaponLock);

  const sorted = [...owned].sort(
    (a, b) =>
      calculateRankingValue(WEAPONS_BY_ID[b.weaponId], b) -
      calculateRankingValue(WEAPONS_BY_ID[a.weaponId], a),
  );

  return (
    <div className="relative mx-auto w-full max-w-6xl flex-1 space-y-5 px-3 pb-28 pt-6 lg:pb-10 lg:px-6">
      <ScreenBackground screen="inventory" />
      <header className="relative z-10">
        <h2 className="text-xl font-bold text-amber-50">보관함</h2>
        <p className="mt-1 text-sm text-zinc-400">
          가치 높은 순으로 정렬했습니다. 잠금 시 판매할 수 없습니다.
        </p>
      </header>

      <ul className="relative z-10 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {sorted.map((w) => {
          const def = WEAPONS_BY_ID[w.weaponId];
          if (!def) return null;
          const sell = calculateSaleGold(def, w);
          const rankVal = calculateRankingValue(def, w);
          const isEquipped = w.instanceId === equippedId;
          return (
            <li key={w.instanceId}>
              <FantasyPanel
                className={cn(
                  "p-3 transition sm:p-4",
                  isEquipped && "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.12)]",
                )}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="relative h-28 w-32 shrink-0 overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-700/80 sm:h-32 sm:w-36">
                        <WeaponImage
                          src={def.imagePath}
                          alt={def.name}
                          className="h-full w-full object-contain p-2"
                        />
                      </div>
                      <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-100">{def.name}</span>
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
                    </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:w-40">
                      <FantasyButton
                        variant={isEquipped ? "ghost" : "secondary"}
                        disabled={isEquipped}
                        className="min-h-12 w-full"
                        onClick={() => equip(w.instanceId)}
                      >
                        {isEquipped ? "장착됨" : "장착"}
                      </FantasyButton>
                      <FantasyButton
                        variant="muted"
                        className="min-h-11 w-full text-xs"
                        onClick={() => toggleWeaponLock(w.instanceId)}
                      >
                        {w.locked ? "잠금 해제" : "잠금"}
                      </FantasyButton>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                    <FantasyButton
                      variant="accent"
                      className="min-h-12 flex-1 sm:max-w-xs"
                      disabled={w.durability <= 0}
                      onClick={() => requestSellWeapon(w.instanceId)}
                    >
                      판매
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
