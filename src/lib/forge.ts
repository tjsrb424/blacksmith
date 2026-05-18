import {
  FORGE_EMBER_PER_MINUTE,
  getForgeMaxAccumulateMinutes,
} from "@/data/balance";

export function getForgeEmberPerMinute(level: number): number {
  const lv = Math.max(1, Math.min(10, Math.floor(level)));
  return FORGE_EMBER_PER_MINUTE[lv] ?? FORGE_EMBER_PER_MINUTE[1];
}

/** 분당 생산 × 최대 누적 분 = 보관 한도(제련 불씨 정량 상한) */
export function getForgeStorageCapEmber(level: number): number {
  const rate = getForgeEmberPerMinute(level);
  const maxMin = getForgeMaxAccumulateMinutes(level);
  return rate * maxMin;
}

export type ForgePendingDetail = {
  pending: number;
  elapsedMs: number;
  appliedMs: number;
  maxAccumulateMs: number;
  hitTimeCap: boolean;
};

export function computeOfflineForgeReward(args: {
  forgeLevel: number;
  forgeLastCollectAt: number;
  now: number;
}): ForgePendingDetail {
  const rate = getForgeEmberPerMinute(args.forgeLevel);
  const maxMinutes = getForgeMaxAccumulateMinutes(args.forgeLevel);
  const maxMs = maxMinutes * 60 * 1000;
  const elapsedMs = Math.max(0, args.now - args.forgeLastCollectAt);
  const appliedMs = Math.min(elapsedMs, maxMs);
  const hitTimeCap = elapsedMs >= maxMs && maxMs > 0;
  const minutes = appliedMs / 60000;
  const pending = Math.floor(minutes * rate);
  return {
    pending,
    elapsedMs,
    appliedMs,
    maxAccumulateMs: maxMs,
    hitTimeCap,
  };
}

/** 미수령 불씨 — 경과 시간에 비례, 최대 누적 시간으로 클램프 */
export function computePendingForgeEmber(args: {
  forgeLevel: number;
  forgeLastCollectAt: number;
  now: number;
}): number {
  return computeOfflineForgeReward(args).pending;
}

/** 스펙 문서 예시명과의 호환용 별칭 */
export const calculateForgeProduction = computeOfflineForgeReward;
export const calculateOfflineForgeReward = computeOfflineForgeReward;

export function isForgeStorageFull(pending: number, storageCap: number): boolean {
  if (storageCap <= 0) return false;
  return pending >= storageCap;
}

export type ForgeSnapshot = {
  forgeLevel: number;
  ratePerMinute: number;
  ratePerHour: number;
  maxAccumulateMinutes: number;
  storageCap: number;
  pending: number;
  elapsedMs: number;
  appliedMs: number;
  maxAccumulateMs: number;
  hitTimeCap: boolean;
  fillRatio: number;
  isFull: boolean;
};

export function getForgeSnapshot(args: {
  forgeLevel: number;
  forgeLastCollectAt: number;
  now: number;
}): ForgeSnapshot {
  const lv = args.forgeLevel;
  const detail = computeOfflineForgeReward(args);
  const rate = getForgeEmberPerMinute(lv);
  const maxMinutes = getForgeMaxAccumulateMinutes(lv);
  const storageCap = getForgeStorageCapEmber(lv);
  const fillRatio =
    storageCap > 0 ? Math.min(1, detail.pending / storageCap) : 0;
  const isFull = isForgeStorageFull(detail.pending, storageCap);

  return {
    forgeLevel: lv,
    ratePerMinute: rate,
    ratePerHour: rate * 60,
    maxAccumulateMinutes: maxMinutes,
    storageCap,
    pending: detail.pending,
    elapsedMs: detail.elapsedMs,
    appliedMs: detail.appliedMs,
    maxAccumulateMs: detail.maxAccumulateMs,
    hitTimeCap: detail.hitTimeCap,
    fillRatio,
    isFull,
  };
}
