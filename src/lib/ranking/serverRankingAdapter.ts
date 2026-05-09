import {
  getPlayerRecord as fetchPlayerRecord,
  getWeeklyRanking as fetchWeeklyRanking,
  getWorldRecords as fetchWorldRecords,
  submitRankingCandidate as postRankingCandidate,
} from "@/lib/server/rankingApi";
import type {
  PlayerRecordAdapterResult,
  RankingAdapter,
  RankingAdapterContext,
  RankingAdapterSource,
  RankingSubmissionAdapterResult,
  WeeklyRankingAdapterResult,
  WorldRecordsAdapterResult,
} from "@/lib/ranking/rankingAdapter";
import { mockRankingAdapter } from "@/lib/ranking/mockRankingAdapter";
import type { RankingCategory } from "@/types/game";
import type { RankingCandidateSubmitPayload } from "@/types/server";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown ranking API error";
}

function withFallbackSource<T extends { source: RankingAdapterSource; error?: string }>(
  result: T,
  error: unknown,
): T {
  return {
    ...result,
    source: "fallback",
    error: errorMessage(error),
  };
}

export class ServerRankingAdapter implements RankingAdapter {
  readonly id = "server" as const;

  constructor(private readonly fallback: RankingAdapter = mockRankingAdapter) {}

  async getWeeklyRanking(
    category: RankingCategory,
    seasonId: string,
    context: RankingAdapterContext,
  ): Promise<WeeklyRankingAdapterResult> {
    try {
      const response = await fetchWeeklyRanking({
        category,
        seasonId,
        playerId: context.playerId,
      });
      return {
        source: this.id,
        category: response.category,
        seasonId: response.seasonId,
        rows: response.rows,
        playerRank: response.playerRank,
      };
    } catch (error) {
      const fallback = await this.fallback.getWeeklyRanking(
        category,
        seasonId,
        context,
      );
      return withFallbackSource(fallback, error);
    }
  }

  async getWorldRecords(
    context: RankingAdapterContext,
  ): Promise<WorldRecordsAdapterResult> {
    try {
      return {
        source: this.id,
        records: await fetchWorldRecords(context.playerId),
      };
    } catch (error) {
      const fallback = await this.fallback.getWorldRecords(context);
      return withFallbackSource(fallback, error);
    }
  }

  async getPlayerRecord(
    playerId: string,
    seasonId: string,
    context: RankingAdapterContext,
  ): Promise<PlayerRecordAdapterResult> {
    try {
      return {
        source: this.id,
        record: await fetchPlayerRecord(playerId, seasonId),
      };
    } catch (error) {
      const fallback = await this.fallback.getPlayerRecord(
        playerId,
        seasonId,
        context,
      );
      return withFallbackSource(fallback, error);
    }
  }

  async submitRankingCandidate(
    payload: RankingCandidateSubmitPayload,
    context: RankingAdapterContext,
  ): Promise<RankingSubmissionAdapterResult> {
    try {
      return {
        source: this.id,
        submission: await postRankingCandidate(payload),
      };
    } catch (error) {
      const fallback = await this.fallback.submitRankingCandidate(
        payload,
        context,
      );
      return withFallbackSource(fallback, error);
    }
  }
}

export const serverRankingAdapter = new ServerRankingAdapter();
