"use client";

import { useMemo, useState } from "react";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { WeaponCard } from "@/components/ui/WeaponCard";
import { WEAPON_DEFINITIONS } from "@/data/weapons";
import { calculateRankingValue } from "@/lib/ranking";
import { formatGold } from "@/lib/format";
import { useGameStore } from "@/store/gameStore";
import type { WeaponGrade } from "@/types/game";
import { cn } from "@/lib/cn";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";

const GRADE_FILTERS: Array<{ id: WeaponGrade | "all"; label: string }> = [
  { id: "all", label: "전체" },
  { id: "D", label: "D" },
  { id: "C", label: "C" },
  { id: "B", label: "B" },
  { id: "A", label: "A" },
  { id: "S", label: "S" },
  { id: "SS", label: "SS" },
];

export function WeaponShopScreen() {
  useRenderDiagnostics("WeaponShopScreen");
  const buyWeapon = useGameStore((s) => s.buyWeapon);
  const gold = useGameStore((s) => s.gold);
  const ownedWeapons = useGameStore((s) => s.ownedWeapons);
  const records = useGameStore((s) => s.records);
  const serverActionPending = useGameStore((s) => s.serverActionPending);

  const [gradeFilter, setGradeFilter] = useState<WeaponGrade | "all">("all");

  const ownedIds = useMemo(
    () => new Set(ownedWeapons.map((w) => w.weaponId)),
    [ownedWeapons],
  );

  const gradeCounts = useMemo(() => {
    const m: Record<WeaponGrade, number> = {
      D: 0,
      C: 0,
      B: 0,
      A: 0,
      S: 0,
      SS: 0,
    };
    for (const d of WEAPON_DEFINITIONS) {
      m[d.grade]++;
    }
    return m;
  }, []);

  const filteredDefs = useMemo(() => {
    if (gradeFilter === "all") return WEAPON_DEFINITIONS;
    return WEAPON_DEFINITIONS.filter((d) => d.grade === gradeFilter);
  }, [gradeFilter]);

  const recommendedId = useMemo(() => {
    const next = WEAPON_DEFINITIONS.find((d) => !ownedIds.has(d.id));
    return next?.id ?? WEAPON_DEFINITIONS[0]?.id;
  }, [ownedIds]);

  return (
    <div className="relative mx-auto w-full flex-1 space-y-4 px-3 pb-5 pt-6">
      <ScreenBackground screen="shop" />
      <header className="relative z-10 space-y-2">
        <h2 className="text-xl font-bold text-amber-50 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
          무기 상점
        </h2>
        <p className="text-sm text-zinc-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
          보유 골드 <span className="font-mono text-amber-200">{formatGold(gold)}</span> — 카드를 눌러 구매 확인 창을 엽니다.
        </p>
      </header>

      <div className="relative z-10 flex flex-wrap gap-1.5 rounded-2xl bg-black/18 p-2 ring-1 ring-amber-900/18 sm:gap-2">
        {GRADE_FILTERS.map((g) => {
          const active = gradeFilter === g.id;
          const countLabel =
            g.id === "all"
              ? WEAPON_DEFINITIONS.length
              : gradeCounts[g.id];
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGradeFilter(g.id)}
              className={cn(
                "min-h-[36px] shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition sm:text-sm",
                active
                  ? "bg-amber-600/35 text-amber-50 ring-amber-400/55 shadow-[0_0_18px_rgba(245,158,11,0.22)]"
                  : "bg-zinc-950/65 text-zinc-500 ring-zinc-700 hover:text-zinc-300",
              )}
            >
              {g.label}
              <span className="ml-1 font-mono text-[10px] opacity-80">
                {countLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-2 sm:gap-3">
        {filteredDefs.map((def) => {
          const affordable = gold >= def.basePrice;
          const owned = ownedIds.has(def.id);
          const shortfall = Math.max(0, def.basePrice - gold);
          const inst = ownedWeapons.find((w) => w.weaponId === def.id);
          const rankVal = inst
            ? calculateRankingValue(def, inst)
            : calculateRankingValue(def, {
                instanceId: "",
                weaponId: def.id,
                enhanceLevel: 0,
                transcendLevel: 0,
                durability: 3,
                locked: false,
                createdAt: 0,
                bestValue: 0,
              });
          const rankingCandidate =
            !!inst && rankVal >= records.personalBestRankingValue * 0.995;
          const transcendReady =
            !!inst &&
            inst.enhanceLevel >= 15 &&
            inst.transcendLevel < 10 &&
            inst.durability > 0;
          const isRecommended = def.id === recommendedId && !owned;

          return (
            <div
              key={def.id}
              className={
                isRecommended
                  ? "rounded-xl ring-2 ring-amber-500/40 ring-offset-1 ring-offset-transparent"
                  : ""
              }
            >
              <WeaponCard
                variant="compact"
                def={def}
                owned={owned}
                transcendReady={transcendReady}
                rankingCandidate={rankingCandidate}
                maxEnhanceHighlight={!!inst && inst.enhanceLevel >= 15}
                footer={
                  <div className="space-y-1.5">
                    {owned ? (
                      <p className="text-center text-[10px] font-medium text-emerald-400/90">
                        보유 중
                      </p>
                    ) : !affordable ? (
                      <p className="text-center text-[10px] text-red-400/90">
                        부족{" "}
                        <span className="font-mono">{formatGold(shortfall)}</span>
                      </p>
                    ) : null}
                    <FantasyButton
                      className="min-h-10 w-full px-2 py-2 text-xs focus-visible:ring-2 focus-visible:ring-amber-400/80"
                      disabled={!affordable || owned || serverActionPending}
                      onClick={() => buyWeapon(def.id)}
                    >
                      {owned ? "보유 중" : affordable ? "구매" : "골드 부족"}
                    </FantasyButton>
                  </div>
                }
              />
              {isRecommended ? (
                <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                  추천
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
