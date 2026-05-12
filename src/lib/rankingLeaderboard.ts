import type {
  BestWeaponSnapshot,
  PlayerRecords,
  RankingCategory,
  RankingRowDisplay,
  RecordBreakInfo,
  WeeklyRankingEntry,
  WeeklySeasonStats,
} from "@/types/game";
import {
  MOCK_WEEKLY_ENHANCE_KING,
  MOCK_WEEKLY_SALES_KING,
  MOCK_WEEKLY_STRONGEST_WEAPON,
  MOCK_WEEKLY_TRANSCEND_KING,
  MOCK_WORLD_HIGHEST_WEAPON_VALUE,
  MOCK_WORLD_MOST_ENHANCE_ATTEMPTS,
  MOCK_WORLD_MOST_TRANSCEND_SUCCESSES,
  MOCK_WORLD_SALE_LEADER,
  MOCK_WORLD_TRANSCEND_LEADER,
  MOCK_WORLD_WEAPON_LEADER,
} from "@/data/mockRankings";

export function weeklyMockToPlayerRows(
  mock: WeeklyRankingEntry[],
): Omit<RankingRowDisplay, "rank">[] {
  return mock.map((m) => ({
    playerName: m.playerName,
    weaponName: m.weaponName,
    enhanceLevel: m.enhanceLevel,
    transcendLevel: m.transcendLevel,
    value: m.value,
    score: m.value,
    isPlayer: false,
    createdAt: undefined,
  }));
}

export function mergePlayerIntoWeeklyRanking(
  mock: WeeklyRankingEntry[],
  player: Omit<RankingRowDisplay, "rank"> | null,
): RankingRowDisplay[] {
  const rows: RankingRowDisplay[] = weeklyMockToPlayerRows(mock).map((r) => ({
    rank: 0,
    ...r,
  }));
  if (player && player.score > 0) {
    rows.push({ rank: 0, ...player });
  }
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.createdAt ?? 0;
    const tb = b.createdAt ?? 0;
    if (ta !== tb) return ta - tb;
    return a.isPlayer ? 1 : -1;
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

export function getPlayerWeeklyRank(
  merged: RankingRowDisplay[],
): number | null {
  const row = merged.find((r) => r.isPlayer);
  return row ? row.rank : null;
}

/** 주간 최강 무기 부문 — 내 순위 계산 */
export function calculateWeeklyStrongestRank(playerValue: number): number {
  const merged = mergePlayerIntoWeeklyRanking(MOCK_WEEKLY_STRONGEST_WEAPON, {
    playerName: "나",
    weaponName: "(내 무기)",
    enhanceLevel: 15,
    transcendLevel: 0,
    value: playerValue,
    score: playerValue,
    isPlayer: true,
    createdAt: Date.now(),
  });
  return getPlayerWeeklyRank(merged) ?? merged.length + 1;
}

export function enrichRecordBreakUi(rb: RecordBreakInfo): RecordBreakInfo {
  return {
    ...rb,
    delta: rb.delta ?? rb.newBest - rb.previousBest,
    isPersonalBest: rb.isPersonalBest ?? rb.newBest > rb.previousBest,
    isWeeklyTop100:
      rb.isWeeklyTop100 ??
      (rb.estimatedWeeklyRank != null && rb.estimatedWeeklyRank <= 100),
  };
}

export function buildLocalRecordBreakInfo(args: {
  previousBest: number;
  newBest: number;
  previousWeeklyBest: number;
}): RecordBreakInfo | undefined {
  const estimatedWeeklyRank = calculateWeeklyStrongestRank(args.newBest);
  const previousWeeklyRank =
    args.previousWeeklyBest > 0
      ? calculateWeeklyStrongestRank(args.previousWeeklyBest)
      : null;
  const isPersonalBest = args.newBest > args.previousBest;
  const isWeeklyTop100 =
    estimatedWeeklyRank <= 100 &&
    (previousWeeklyRank == null ||
      previousWeeklyRank > 100 ||
      args.newBest > args.previousWeeklyBest);

  if (!isPersonalBest && !isWeeklyTop100) return undefined;

  return enrichRecordBreakUi({
    previousBest: args.previousBest,
    newBest: args.newBest,
    isPersonalBest,
    isWeeklyTop100,
    estimatedWeeklyRank: isWeeklyTop100 ? estimatedWeeklyRank : undefined,
  });
}

export function mergeWorldHighestWeaponValue(localBest: number): number {
  return Math.max(MOCK_WORLD_HIGHEST_WEAPON_VALUE, localBest);
}

export function getWeeklyMockByCategory(
  cat: RankingCategory,
): WeeklyRankingEntry[] {
  switch (cat) {
    case "weeklyStrongestWeapon":
      return MOCK_WEEKLY_STRONGEST_WEAPON;
    case "weeklyEnhancementKing":
      return MOCK_WEEKLY_ENHANCE_KING;
    case "weeklyTranscendKing":
      return MOCK_WEEKLY_TRANSCEND_KING;
    case "weeklySalesKing":
      return MOCK_WEEKLY_SALES_KING;
    default:
      return MOCK_WEEKLY_STRONGEST_WEAPON;
  }
}

export function buildPlayerWeeklyRow(
  cat: RankingCategory,
  stats: WeeklySeasonStats,
): Omit<RankingRowDisplay, "rank"> | null {
  switch (cat) {
    case "weeklyStrongestWeapon": {
      if (stats.weeklyStrongestWeaponValue <= 0) return null;
      return {
        playerName: "나",
        weaponName: stats.weeklyStrongestWeaponName || "(무기)",
        enhanceLevel: stats.weeklyStrongestEnhanceLevel,
        transcendLevel: stats.weeklyStrongestTranscendLevel,
        value: stats.weeklyStrongestWeaponValue,
        score: stats.weeklyStrongestWeaponValue,
        isPlayer: true,
      };
    }
    case "weeklyEnhancementKing": {
      const n = stats.enhanceSuccessesThisSeason;
      if (n <= 0) return null;
      return {
        playerName: "나",
        weaponName: "이번 시즌 강화 성공",
        enhanceLevel: 0,
        transcendLevel: 0,
        value: n,
        score: n,
        isPlayer: true,
      };
    }
    case "weeklyTranscendKing": {
      const n = stats.transcendSuccessesThisSeason;
      if (n <= 0) return null;
      return {
        playerName: "나",
        weaponName: "이번 시즌 초월 성공",
        enhanceLevel: 15,
        transcendLevel: Math.min(10, stats.weeklyStrongestTranscendLevel),
        value: n,
        score: n,
        isPlayer: true,
      };
    }
    case "weeklySalesKing": {
      const n = stats.salesGoldThisSeason;
      if (n <= 0) return null;
      return {
        playerName: "나",
        weaponName: "시즌 누적 판매",
        enhanceLevel: 0,
        transcendLevel: 0,
        value: n,
        score: n,
        isPlayer: true,
      };
    }
    default:
      return null;
  }
}

export type WorldLeaderResolved = {
  weaponName: string;
  enhanceLevel: number;
  transcendLevel: number;
  rankingValue: number;
  holderName: string;
  isPlayer: boolean;
};

export function resolveWorldHighestWeapon(
  snapshot: BestWeaponSnapshot | null,
): WorldLeaderResolved {
  const mock = MOCK_WORLD_WEAPON_LEADER;
  const localVal = snapshot?.rankingValue ?? 0;
  if (snapshot && localVal >= mock.rankingValue) {
    return {
      weaponName: snapshot.weaponName,
      enhanceLevel: snapshot.enhanceLevel,
      transcendLevel: snapshot.transcendLevel,
      rankingValue: snapshot.rankingValue,
      holderName: "나",
      isPlayer: true,
    };
  }
  return {
    weaponName: mock.weaponName,
    enhanceLevel: mock.enhanceLevel,
    transcendLevel: mock.transcendLevel,
    rankingValue: mock.rankingValue,
    holderName: mock.holderName,
    isPlayer: false,
  };
}

export function resolveWorldBestTranscend(
  snapshot: BestWeaponSnapshot | null,
  records: PlayerRecords,
): WorldLeaderResolved {
  const mock = MOCK_WORLD_TRANSCEND_LEADER;
  const playerStar = records.maxTranscendLevel;
  const playerVal =
    snapshot && snapshot.transcendLevel === playerStar
      ? snapshot.rankingValue
      : records.bestTranscendedWeaponValue;

  const mockScore = mock.transcendLevel * 1e15 + mock.rankingValue;
  const playerScore = playerStar * 1e15 + playerVal;

  if (playerScore > mockScore) {
    const aligned = snapshot && snapshot.transcendLevel === playerStar;
    return {
      weaponName: aligned ? snapshot.weaponName : "(역대 최고 초월)",
      enhanceLevel: aligned ? snapshot.enhanceLevel : 15,
      transcendLevel: playerStar,
      rankingValue: playerVal,
      holderName: "나",
      isPlayer: true,
    };
  }
  return {
    weaponName: mock.weaponName,
    enhanceLevel: 15,
    transcendLevel: mock.transcendLevel,
    rankingValue: mock.rankingValue,
    holderName: mock.holderName,
    isPlayer: false,
  };
}

export type WorldSaleResolved = {
  gold: number;
  weaponName: string;
  holderName: string;
  isPlayer: boolean;
};

export function resolveWorldBestSale(records: PlayerRecords): WorldSaleResolved {
  const mock = MOCK_WORLD_SALE_LEADER;
  if (records.bestSaleGold >= mock.gold) {
    return {
      gold: records.bestSaleGold,
      weaponName: "(내 최고 판매)",
      holderName: "나",
      isPlayer: true,
    };
  }
  return {
    gold: mock.gold,
    weaponName: mock.weaponName,
    holderName: mock.holderName,
    isPlayer: false,
  };
}

export function resolveWorldMostEnhanceAttempts(records: PlayerRecords): {
  value: number;
  holderName: string;
  isPlayer: boolean;
} {
  const mock = MOCK_WORLD_MOST_ENHANCE_ATTEMPTS;
  const p = records.totalEnhanceAttempts;
  if (p > mock) return { value: p, holderName: "나", isPlayer: true };
  return { value: mock, holderName: "대장장이K", isPlayer: false };
}

export function resolveWorldMostTranscendSuccesses(records: PlayerRecords): {
  value: number;
  holderName: string;
  isPlayer: boolean;
} {
  const mock = MOCK_WORLD_MOST_TRANSCEND_SUCCESSES;
  const p = records.transcendSuccessCount;
  if (p > mock) return { value: p, holderName: "나", isPlayer: true };
  return { value: mock, holderName: "별철장", isPlayer: false };
}
