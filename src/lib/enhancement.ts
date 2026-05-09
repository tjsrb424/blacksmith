import type { EnhanceResult, OwnedWeapon, ScrapRewards, WeaponDefinition } from "@/types/game";
import {
  DEFAULT_DURABILITY,
  durabilityLossOnFail,
  enhanceCostCoefficient,
  ENHANCE_SUCCESS_RATE_BY_TARGET,
  SCRAP_EMBER_RATIO_OF_BASE_PRICE,
  SCRAP_GOLD_MAX_RATIO,
  SCRAP_GOLD_MIN_RATIO,
  SCRAP_TRANSCEND_STONE_AMOUNT,
  SCRAP_TRANSCEND_STONE_CHANCE,
} from "@/data/balance";
import { calculateSaleGold, computeWeaponBasePrice } from "@/lib/economy";
import { calculateRankingValue } from "@/lib/ranking";

export function getEnhanceCostEmber(def: WeaponDefinition, targetLevel: number): number {
  const base = computeWeaponBasePrice(def);
  const coef = enhanceCostCoefficient(targetLevel);
  return Math.max(1, Math.round(base * coef));
}

export function getEnhanceSuccessRate(targetLevel: number): number {
  return ENHANCE_SUCCESS_RATE_BY_TARGET[targetLevel] ?? 0;
}

export function rollEnhancement(args: {
  def: WeaponDefinition;
  weapon: OwnedWeapon;
  rng: () => number;
}): EnhanceResult {
  const { def, weapon, rng } = args;
  const currentLevel = weapon.enhanceLevel;
  const targetLevel = currentLevel + 1;

  const beforeValue = calculateSaleGold(def, weapon);

  if (targetLevel > 15) {
    throw new Error("일반 강화는 +15까지만 가능합니다.");
  }

  const rate = getEnhanceSuccessRate(targetLevel);
  const roll = rng();

  if (roll < rate) {
    const updated = { ...weapon, enhanceLevel: targetLevel };
    const rankingAfter = calculateRankingValue(def, updated);
    const nextWeapon: OwnedWeapon = {
      ...updated,
      bestValue: Math.max(weapon.bestValue, rankingAfter),
    };
    const afterValue = calculateSaleGold(def, nextWeapon);
    return {
      type: "success",
      beforeLevel: currentLevel,
      afterLevel: targetLevel,
      beforeValue,
      afterValue,
    };
  }

  const loseDur = durabilityLossOnFail(targetLevel);
  const nextDur = loseDur ? weapon.durability - 1 : weapon.durability;

  if (loseDur && nextDur <= 0) {
    const scrap = computeScrapRewards(def);
    return {
      type: "destroyed",
      level: currentLevel,
      scrapRewards: scrap,
      weaponName: def.name,
    };
  }

  return {
    type: "fail",
    level: currentLevel,
    beforeDurability: weapon.durability,
    afterDurability: loseDur ? nextDur : weapon.durability,
    destroyed: false,
  };
}

export function computeScrapRewards(def: WeaponDefinition): ScrapRewards {
  const base = computeWeaponBasePrice(def);
  const goldRatio =
    SCRAP_GOLD_MIN_RATIO + Math.random() * (SCRAP_GOLD_MAX_RATIO - SCRAP_GOLD_MIN_RATIO);
  const gold = Math.max(0, Math.round(base * goldRatio));
  const ember = Math.max(0, Math.round(base * SCRAP_EMBER_RATIO_OF_BASE_PRICE));
  const transcendStone =
    Math.random() < SCRAP_TRANSCEND_STONE_CHANCE ? SCRAP_TRANSCEND_STONE_AMOUNT : 0;
  return { gold, ember, transcendStone };
}

export function shouldConfirmEnhance(args: {
  targetLevel: number;
  durability: number;
}): boolean {
  const { targetLevel, durability } = args;
  if (targetLevel >= 8) return true;
  if (durability <= 1) return true;
  return false;
}

export function clampDurability(n: number): number {
  return Math.max(0, Math.min(DEFAULT_DURABILITY, Math.floor(n)));
}
