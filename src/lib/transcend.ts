import type { OwnedWeapon, ScrapRewards, WeaponDefinition } from "@/types/game";
import {
  getTranscendStoneCostForNextStar,
  getTranscendSuccessRateForNextStar,
} from "@/data/balance";
import { computeScrapRewards } from "@/lib/enhancement";
import { calculateSaleGold } from "@/lib/economy";
import { calculateRankingValue } from "@/lib/ranking";

export function canTranscendWeapon(
  def: WeaponDefinition | undefined,
  owned: OwnedWeapon | null | undefined,
  transcendStoneOwned: number,
): boolean {
  if (!def || !owned) return false;
  if (owned.enhanceLevel !== 15) return false;
  if (owned.transcendLevel >= 10) return false;
  if (owned.durability <= 0) return false;
  const nextStar = owned.transcendLevel + 1;
  const cost = getTranscendStoneCostForNextStar(nextStar);
  return transcendStoneOwned >= cost;
}

export function getTranscendSuccessRate(currentTranscendLevel: number): number {
  const nextStar = currentTranscendLevel + 1;
  if (nextStar < 1 || nextStar > 10) return 0;
  return getTranscendSuccessRateForNextStar(nextStar);
}

export function getTranscendStoneCost(currentTranscendLevel: number): number {
  const nextStar = currentTranscendLevel + 1;
  if (nextStar < 1 || nextStar > 10) return 0;
  return getTranscendStoneCostForNextStar(nextStar);
}

export type TranscendAttemptResult =
  | {
      type: "success";
      beforeTranscend: number;
      afterTranscend: number;
      beforeRankingValue: number;
      afterRankingValue: number;
      beforeSaleGold: number;
      afterSaleGold: number;
    }
  | {
      type: "fail";
      transcendLevel: number;
      beforeDurability: number;
      afterDurability: number;
      stoneCost: number;
    }
  | {
      type: "destroyed";
      transcendLevel: number;
      enhanceLevel: number;
      scrapRewards: ScrapRewards;
      weaponId?: string;
      weaponName: string;
      stoneCost: number;
    };

/**
 * 초월 시도 1회 롤 — 소모석 차감 전에 호출 (상점에서 비용 검증 후)
 */
export function rollTranscendAttempt(args: {
  def: WeaponDefinition;
  weapon: OwnedWeapon;
  rng: () => number;
}): TranscendAttemptResult {
  const { def, weapon, rng } = args;
  if (weapon.enhanceLevel !== 15) {
    throw new Error("초월은 +15 무기만 가능합니다.");
  }
  if (weapon.transcendLevel >= 10) {
    throw new Error("최대 초월 단계입니다.");
  }

  const nextStar = weapon.transcendLevel + 1;
  const stoneCost = getTranscendStoneCostForNextStar(nextStar);
  const rate = getTranscendSuccessRateForNextStar(nextStar);
  const roll = rng();

  const beforeRankingValue = calculateRankingValue(def, weapon);
  const beforeSaleGold = calculateSaleGold(def, weapon);

  if (roll < rate) {
    const updated: OwnedWeapon = {
      ...weapon,
      transcendLevel: nextStar,
    };
    const afterRankingValue = calculateRankingValue(def, updated);
    const afterSaleGold = calculateSaleGold(def, updated);
    return {
      type: "success",
      beforeTranscend: weapon.transcendLevel,
      afterTranscend: nextStar,
      beforeRankingValue,
      afterRankingValue,
      beforeSaleGold,
      afterSaleGold,
    };
  }

  const nextDur = weapon.durability - 1;
  if (nextDur <= 0) {
    const scrap = computeScrapRewards(def);
    return {
      type: "destroyed",
      transcendLevel: weapon.transcendLevel,
      enhanceLevel: weapon.enhanceLevel,
      scrapRewards: scrap,
      weaponName: def.name,
      stoneCost,
    };
  }

  return {
    type: "fail",
    transcendLevel: weapon.transcendLevel,
    beforeDurability: weapon.durability,
    afterDurability: nextDur,
    stoneCost,
  };
}
