/** 모든 튜닝 가능한 상수 — GDD `03`, `04`, `05` 기준 */

export const SAVE_STORAGE_KEY = "world-best-blacksmith-save-v1";

export const INITIAL_GOLD = 5_000;
export const INITIAL_EMBER = 2_000;
export const INITIAL_TRANSCEND_STONE = 0;

export const BASE_WEAPON_PRICE_FORMULA = {
  multiplierPerTier: 1.35,
  base: 100,
} as const;

export function rawWeaponPriceAtTier(tier: number): number {
  const t = Math.max(1, tier);
  return BASE_WEAPON_PRICE_FORMULA.base * Math.pow(BASE_WEAPON_PRICE_FORMULA.multiplierPerTier, t - 1);
}

/** 보기 좋은 정수로 반올림 (GDD: 계산값보다 보기 좋은 숫자) */
export function roundNicePrice(n: number): number {
  if (n < 100) return Math.round(n / 10) * 10;
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 10000) return Math.round(n / 100) * 100;
  if (n < 100000) return Math.round(n / 500) * 500;
  return Math.round(n / 1000) * 1000;
}

/** 강화 비용 = 기본 가격 × 계수 (목표 단계 기준) */
export function enhanceCostCoefficient(targetLevel: number): number {
  if (targetLevel >= 1 && targetLevel <= 3) return 0.05;
  if (targetLevel <= 6) return 0.08;
  if (targetLevel <= 9) return 0.12;
  if (targetLevel <= 12) return 0.18;
  return 0.28;
}

/** 강화 성공률 표 — 목표 단계(+n) */
export const ENHANCE_SUCCESS_RATE_BY_TARGET: Record<number, number> = {
  1: 1,
  2: 1,
  3: 0.95,
  4: 0.9,
  5: 0.85,
  6: 0.78,
  7: 0.7,
  8: 0.6,
  9: 0.5,
  10: 0.4,
  11: 0.32,
  12: 0.25,
  13: 0.18,
  14: 0.12,
  15: 0.08,
};

/** 내구도 감소 없는 실패 구간: 목표 단계 +1 ~ +7 */
export function durabilityLossOnFail(targetLevel: number): boolean {
  return targetLevel >= 8;
}

/** 기본 내구도 */
export const DEFAULT_DURABILITY = 3;

/** 강화 단계별 판매 배율 — Sprint 4 (내구도·초월 별도 적용) */
export const ENHANCEMENT_SALE_MULTIPLIER: Record<number, number> = {
  0: 0.7,
  1: 0.9,
  2: 1.1,
  3: 1.3,
  4: 1.6,
  5: 2.0,
  6: 2.5,
  7: 3.2,
  8: 4.0,
  9: 5.0,
  10: 6.0,
  11: 8.0,
  12: 10.0,
  13: 14.0,
  14: 18.0,
  15: 25.0,
};

export function getEnhancementSaleMultiplier(level: number): number {
  const lv = Math.max(0, Math.min(15, Math.floor(level)));
  return ENHANCEMENT_SALE_MULTIPLIER[lv] ?? ENHANCEMENT_SALE_MULTIPLIER[0];
}

/** 광고 Mock 판매 보너스 (+30%) */
export const AD_SALE_MULT = 1.3;

/** 파괴 잔해 — 기본 가격 대비 골드 비율 */
export const SCRAP_GOLD_MIN_RATIO = 0.1;
export const SCRAP_GOLD_MAX_RATIO = 0.2;

/** 파괴 시 불씨 환급: 해당 무기 기본 가격 대비 */
export const SCRAP_EMBER_RATIO_OF_BASE_PRICE = 0.15;

/** 초월석 조각(정수) 드롭 확률 */
export const SCRAP_TRANSCEND_STONE_CHANCE = 0.12;
export const SCRAP_TRANSCEND_STONE_AMOUNT = 1;

/** 제련로 — GDD `05` */
export const FORGE_START_LEVEL = 1;
/** 하위 호환·표시용 — 기본 최대 누적 시간 (레벨 1) */
export const FORGE_MAX_ACCUMULATE_HOURS = 2;

/** 최대 누적 시간: 기본 2시간(120분), 레벨당 +6분 */
export const FORGE_MAX_ACCUMULATE_BASE_MINUTES = 120;
export const FORGE_MAX_ACCUMULATE_EXTRA_MINUTES_PER_LEVEL = 6;

export function getForgeMaxAccumulateMinutes(level: number): number {
  const lv = Math.max(1, Math.min(10, Math.floor(level)));
  return (
    FORGE_MAX_ACCUMULATE_BASE_MINUTES +
    (lv - 1) * FORGE_MAX_ACCUMULATE_EXTRA_MINUTES_PER_LEVEL
  );
}

export const FORGE_EMBER_PER_MINUTE: Record<number, number> = {
  1: 10,
  2: 15,
  3: 22,
  4: 32,
  5: 45,
  6: 62,
  7: 85,
  8: 115,
  9: 155,
  10: 200,
};

export function forgeUpgradeCostGold(currentLevel: number): number {
  return Math.round(2000 * Math.pow(1.8, currentLevel - 1));
}

/** 초월 성공률 — 다음 ★ 단계로 올리는 시도 기준 (★1 시도 … ★10 시도) */
export const TRANSCEND_SUCCESS_RATE_BY_NEXT_STAR: Record<number, number> = {
  1: 0.45,
  2: 0.38,
  3: 0.3,
  4: 0.23,
  5: 0.17,
  6: 0.12,
  7: 0.08,
  8: 0.05,
  9: 0.03,
  10: 0.015,
};

export function getTranscendSuccessRateForNextStar(nextStar: number): number {
  const s = Math.max(1, Math.min(10, Math.floor(nextStar)));
  return TRANSCEND_SUCCESS_RATE_BY_NEXT_STAR[s] ?? 0;
}

/** 초월석 소모 — 다음 ★ 달성 시도당 */
export const TRANSCEND_STONE_COST_BY_NEXT_STAR: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 8,
  6: 12,
  7: 18,
  8: 27,
  9: 40,
  10: 60,
};

export function getTranscendStoneCostForNextStar(nextStar: number): number {
  const s = Math.max(1, Math.min(10, Math.floor(nextStar)));
  return TRANSCEND_STONE_COST_BY_NEXT_STAR[s] ?? 0;
}

/** 초월 가치 배율 ★0 ~ ★10 — 판매가·랭킹 가치에 동일 적용 */
export const TRANSCEND_VALUE_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 1.5,
  2: 2.1,
  3: 3.0,
  4: 4.3,
  5: 6.2,
  6: 9.0,
  7: 13.0,
  8: 19.0,
  9: 28.0,
  10: 45.0,
};

export function getTranscendValueMultiplier(star: number): number {
  const s = Math.max(0, Math.min(10, Math.floor(star)));
  return TRANSCEND_VALUE_MULTIPLIER[s] ?? 1;
}
