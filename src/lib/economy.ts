import type { OwnedWeapon, WeaponDefinition } from "@/types/game";
import {
  AD_SALE_MULT,
  DEFAULT_DURABILITY,
  getEnhancementSaleMultiplier,
  getTranscendValueMultiplier,
} from "@/data/balance";

export { getTranscendValueMultiplier };

/** @deprecated 호환 — ranking 등 기존 import용 */
export function getTranscendMultiplier(star: number): number {
  return getTranscendValueMultiplier(star);
}

/** 내구도 판매가 보정 (3→100%, 2→90%, 1→75%) */
export function getDurabilitySaleMultiplier(durability: number): number {
  if (durability >= 3) return 1;
  if (durability === 2) return 0.9;
  if (durability === 1) return 0.75;
  return 0;
}

export function computeWeaponBasePrice(def: WeaponDefinition): number {
  return def.basePrice;
}

/**
 * 기본 판매 골드 — Math.floor
 * 기본가 × 강화 배율 × 초월 배율 × 내구도 보정 → 광고는 별도 곱
 */
export function calculateSaleGold(def: WeaponDefinition, owned: OwnedWeapon): number {
  const base = computeWeaponBasePrice(def);
  const enh = getEnhancementSaleMultiplier(owned.enhanceLevel);
  const trans = getTranscendValueMultiplier(owned.transcendLevel);
  const dur = getDurabilitySaleMultiplier(
    Math.min(DEFAULT_DURABILITY, Math.max(0, owned.durability)),
  );
  return Math.floor(base * enh * trans * dur);
}

/** 광고 Mock +30% 판매가 (내림) — 초월·내구도 반영 후 판매가에 적용 */
export function calculateAdSaleGold(saleGold: number): number {
  return Math.floor(saleGold * AD_SALE_MULT);
}

/** @deprecated 호환 — calculateSaleGold와 동일 */
export function computeSellPrice(def: WeaponDefinition, owned: OwnedWeapon): number {
  return calculateSaleGold(def, owned);
}
