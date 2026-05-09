import "server-only";

import {
  SCRAP_EMBER_RATIO_OF_BASE_PRICE,
  SCRAP_GOLD_MAX_RATIO,
  SCRAP_GOLD_MIN_RATIO,
  SCRAP_TRANSCEND_STONE_AMOUNT,
  SCRAP_TRANSCEND_STONE_CHANCE,
} from "@/data/balance";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateAdSaleGold, calculateSaleGold, computeWeaponBasePrice } from "@/lib/economy";
import { getEnhanceCostEmber, getEnhanceSuccessRate } from "@/lib/enhancement";
import { computePendingForgeEmber } from "@/lib/forge";
import { calculateRankingValue } from "@/lib/ranking";
import {
  getTranscendStoneCost,
  getTranscendSuccessRate,
} from "@/lib/transcend";
import type { OwnedWeapon, ScrapRewards } from "@/types/game";
import type { OwnedWeaponRow } from "@/types/supabase";

export function rowToOwnedWeapon(row: OwnedWeaponRow): OwnedWeapon {
  return {
    instanceId: row.id,
    weaponId: row.weapon_id,
    enhanceLevel: Number(row.enhance_level),
    transcendLevel: Number(row.transcend_level),
    durability: Number(row.durability),
    locked: Boolean(row.is_locked),
    createdAt: new Date(row.created_at).getTime(),
    bestValue: 0,
  };
}

export function withBestValue(row: OwnedWeaponRow): OwnedWeapon {
  const owned = rowToOwnedWeapon(row);
  const def = WEAPONS_BY_ID[owned.weaponId];
  return {
    ...owned,
    bestValue: def ? calculateRankingValue(def, owned) : 0,
  };
}

export function computeServerScrapRewards(
  weaponId: string,
  randomUnit: () => number,
): ScrapRewards {
  const def = WEAPONS_BY_ID[weaponId];
  if (!def) return { gold: 0, ember: 0, transcendStone: 0 };

  const base = computeWeaponBasePrice(def);
  const goldRatio =
    SCRAP_GOLD_MIN_RATIO +
    randomUnit() * (SCRAP_GOLD_MAX_RATIO - SCRAP_GOLD_MIN_RATIO);

  return {
    gold: Math.max(0, Math.round(base * goldRatio)),
    ember: Math.max(0, Math.round(base * SCRAP_EMBER_RATIO_OF_BASE_PRICE)),
    transcendStone:
      randomUnit() < SCRAP_TRANSCEND_STONE_CHANCE
        ? SCRAP_TRANSCEND_STONE_AMOUNT
        : 0,
  };
}

export {
  calculateAdSaleGold,
  calculateRankingValue,
  calculateSaleGold,
  computePendingForgeEmber,
  getEnhanceCostEmber,
  getEnhanceSuccessRate,
  getTranscendStoneCost,
  getTranscendSuccessRate,
};
