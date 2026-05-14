import type {
  BestWeaponSnapshot,
  PlayerRecords,
  RankingCategory,
  RankingRowDisplay,
  WeeklySeasonStats,
} from "@/types/game";
import type {
  GameMode,
  PlayerRecordResponse,
  RankingCandidateSubmitPayload,
  RankingSubmissionResponse,
  WorldRecordsResponse,
} from "@/types/server";

export type RankingAdapterSource = "mock" | "server" | "fallback";

export type RankingAdapterContext = {
  playerId: string;
  records: PlayerRecords;
  bestWeaponSnapshot: BestWeaponSnapshot | null;
  weeklySeasonStats: WeeklySeasonStats;
};

export type RankingFetchOptions = {
  force?: boolean;
};

export type WeeklyRankingAdapterResult = {
  source: RankingAdapterSource;
  category: RankingCategory;
  seasonId: string;
  rows: RankingRowDisplay[];
  playerRank: number | null;
  error?: string;
};

export type WorldRecordsAdapterResult = {
  source: RankingAdapterSource;
  records: WorldRecordsResponse;
  error?: string;
};

export type PlayerRecordAdapterResult = {
  source: RankingAdapterSource;
  record: PlayerRecordResponse;
  error?: string;
};

export type RankingSubmissionAdapterResult = {
  source: RankingAdapterSource;
  submission: RankingSubmissionResponse;
  error?: string;
};

export interface RankingAdapter {
  readonly id: RankingAdapterSource;
  getWeeklyRanking(
    category: RankingCategory,
    seasonId: string,
    context: RankingAdapterContext,
    options?: RankingFetchOptions,
  ): Promise<WeeklyRankingAdapterResult>;
  getWorldRecords(
    context: RankingAdapterContext,
    options?: RankingFetchOptions,
  ): Promise<WorldRecordsAdapterResult>;
  getPlayerRecord(
    playerId: string,
    seasonId: string,
    context: RankingAdapterContext,
  ): Promise<PlayerRecordAdapterResult>;
  submitRankingCandidate(
    payload: RankingCandidateSubmitPayload,
    context: RankingAdapterContext,
  ): Promise<RankingSubmissionAdapterResult>;
}

export function getGameMode(): GameMode {
  return process.env.NEXT_PUBLIC_GAME_MODE === "beta" ? "beta" : "local";
}
