import type {
  BestWeaponSnapshot,
  OwnedWeapon,
  WeeklySeasonStats,
  WeaponDefinition,
} from "@/types/game";
import {
  DEFAULT_DURABILITY,
  getEnhancementSaleMultiplier,
  getTranscendValueMultiplier,
  roundNicePrice,
} from "@/data/balance";

function durabilityRankingMultiplier(durability: number): number {
  if (durability >= 3) return 1;
  if (durability === 2) return 0.9;
  if (durability === 1) return 0.75;
  return 0;
}

/**
 * 랭킹 가치 — 광고·판매 보너스와 무관.
 * 기본가 × 강화 판매 배율 × 초월 배율 × 내구도 보정
 */
export function calculateRankingValue(
  def: WeaponDefinition,
  owned: OwnedWeapon,
): number {
  const base = def.basePrice;
  const enh = getEnhancementSaleMultiplier(owned.enhanceLevel);
  const trans = getTranscendValueMultiplier(owned.transcendLevel);
  const dur = durabilityRankingMultiplier(
    Math.min(DEFAULT_DURABILITY, Math.max(0, owned.durability)),
  );
  return roundNicePrice(base * enh * trans * dur);
}

/** 보유 무기 중 랭킹 가치 최고 instanceId */
export function getBestWeaponForRanking(
  owned: OwnedWeapon[],
  getDef: (weaponId: string) => WeaponDefinition | undefined,
): string | null {
  if (owned.length === 0) return null;
  let best = owned[0];
  let bestScore = -1;
  for (const w of owned) {
    const def = getDef(w.weaponId);
    if (!def) continue;
    const s = calculateRankingValue(def, w);
    if (s > bestScore) {
      bestScore = s;
      best = w;
    }
  }
  return best.instanceId;
}

/** 주간 랭킹 후보 가치 (서버 미연동, 로컬 최고 무기 가치) */
export function getWeeklyRankingCandidateValue(
  owned: OwnedWeapon[],
  getDef: (weaponId: string) => WeaponDefinition | undefined,
): number {
  if (owned.length === 0) return 0;
  let max = 0;
  for (const w of owned) {
    const def = getDef(w.weaponId);
    if (!def) continue;
    max = Math.max(max, calculateRankingValue(def, w));
  }
  return max;
}

/** 역대 최고 무기 스냅샷 갱신 — 판매·파괴 직전에도 호출 */
export function maybeUpdateBestWeaponSnapshot(
  def: WeaponDefinition,
  owned: OwnedWeapon,
  prev: BestWeaponSnapshot | null,
): BestWeaponSnapshot | null {
  const rv = calculateRankingValue(def, owned);
  if (!prev || rv > prev.rankingValue) {
    return {
      weaponId: def.id,
      weaponName: def.name,
      enhanceLevel: owned.enhanceLevel,
      transcendLevel: owned.transcendLevel,
      durability: owned.durability,
      rankingValue: rv,
      achievedAt: Date.now(),
    };
  }
  return prev;
}

export function bumpWeeklySeasonStrongest(
  stats: WeeklySeasonStats,
  seasonId: string,
  def: WeaponDefinition,
  owned: OwnedWeapon,
): WeeklySeasonStats {
  if (stats.seasonId !== seasonId) return stats;
  const rv = calculateRankingValue(def, owned);
  if (rv <= stats.weeklyStrongestWeaponValue) return stats;
  return {
    ...stats,
    weeklyStrongestWeaponValue: rv,
    weeklyStrongestWeaponName: def.name,
    weeklyStrongestEnhanceLevel: owned.enhanceLevel,
    weeklyStrongestTranscendLevel: owned.transcendLevel,
  };
}
