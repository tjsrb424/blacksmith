import { STARTER_WEAPON_ID, WEAPONS_BY_ID } from "@/data/weapons";
import { AD_SALE_MULT, FORGE_EMBER_PER_MINUTE } from "@/data/balance";
import { calculateSaleGold } from "@/lib/economy";
import { getEnhanceCostEmber, getEnhanceSuccessRate } from "@/lib/enhancement";
import type { OwnedWeapon } from "@/types/game";

export type BetaBalanceSimSummary = {
  minutes: number;
  starterEnhanceAttemptsFromForgeOnly: number;
  starterCostToPlus8: number;
  starterExpectedAttemptsToPlus8: number;
  starterExpectedAttemptsToPlus15: number;
  starterFirstSaleGoldAtPlus3: number;
  starterFirstSaleGoldAtPlus5: number;
  starterAdSaleGoldAtPlus5: number;
  forgeEmberByCollectMinute: Record<number, number>;
};

function starterWeaponAt(enhanceLevel: number): OwnedWeapon {
  return {
    instanceId: "sim",
    weaponId: STARTER_WEAPON_ID,
    enhanceLevel,
    transcendLevel: 0,
    durability: 3,
    locked: false,
    createdAt: 0,
    bestValue: 0,
  };
}

function sumCostToLevel(targetLevel: number): number {
  const def = WEAPONS_BY_ID[STARTER_WEAPON_ID];
  if (!def) return 0;
  let total = 0;
  for (let level = 1; level <= targetLevel; level += 1) {
    total += getEnhanceCostEmber(def, level);
  }
  return total;
}

function expectedAttemptsToLevel(targetLevel: number): number {
  let total = 0;
  for (let level = 1; level <= targetLevel; level += 1) {
    const rate = getEnhanceSuccessRate(level);
    total += rate > 0 ? 1 / rate : Number.POSITIVE_INFINITY;
  }
  return Number(total.toFixed(1));
}

export function summarizeBetaBalance(minutes = 10): BetaBalanceSimSummary {
  const def = WEAPONS_BY_ID[STARTER_WEAPON_ID];
  if (!def) {
    throw new Error("Starter weapon is missing.");
  }

  const forgeRate = FORGE_EMBER_PER_MINUTE[1];
  const forgeEmber = Math.floor(minutes * forgeRate);
  const avgStarterAttemptCostToPlus5 = sumCostToLevel(5) / 5;
  const plus5Sale = calculateSaleGold(def, starterWeaponAt(5));

  return {
    minutes,
    starterEnhanceAttemptsFromForgeOnly: Math.floor(
      forgeEmber / avgStarterAttemptCostToPlus5,
    ),
    starterCostToPlus8: sumCostToLevel(8),
    starterExpectedAttemptsToPlus8: expectedAttemptsToLevel(8),
    starterExpectedAttemptsToPlus15: expectedAttemptsToLevel(15),
    starterFirstSaleGoldAtPlus3: calculateSaleGold(def, starterWeaponAt(3)),
    starterFirstSaleGoldAtPlus5: plus5Sale,
    starterAdSaleGoldAtPlus5: Math.floor(plus5Sale * AD_SALE_MULT),
    forgeEmberByCollectMinute: {
      3: Math.floor(3 * forgeRate),
      5: Math.floor(5 * forgeRate),
      10: Math.floor(10 * forgeRate),
      30: Math.floor(30 * forgeRate),
    },
  };
}
