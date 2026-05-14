import {
  getWeeklyRanking as fetchWeeklyRanking,
  getWorldRecords as fetchWorldRecords,
  submitRankingCandidate as postRankingCandidate,
} from "@/lib/server/rankingApi";
import { updatePerformanceMetric } from "@/lib/performanceMetrics";
import type {
  PlayerRecordAdapterResult,
  RankingAdapter,
  RankingAdapterContext,
  RankingFetchOptions,
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

const RANKING_CACHE_TTL_MS = 90_000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  options?: RankingFetchOptions,
): Promise<T> {
  const now = Date.now();
  if (options?.force) {
    cache.delete(key);
    inFlight.delete(key);
  }

  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    updatePerformanceMetric({ rankingCacheStatus: "hit" });
    return entry.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    updatePerformanceMetric({ rankingCacheStatus: "hit" });
    return pending as Promise<T>;
  }

  updatePerformanceMetric({ rankingCacheStatus: "miss" });
  const startedAt = Date.now();
  const request = loader()
    .then((value) => {
      updatePerformanceMetric({
        rankingFetchMs: Date.now() - startedAt,
      });
      cache.set(key, {
        value,
        expiresAt: Date.now() + RANKING_CACHE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
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
    options?: RankingFetchOptions,
  ): Promise<WeeklyRankingAdapterResult> {
    try {
      const response = await cached(
        `weekly:${seasonId}:${category}:${context.playerId ?? "guest"}`,
        () =>
          fetchWeeklyRanking({
            category,
            seasonId,
            playerId: context.playerId,
          }),
        options,
      );
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
    options?: RankingFetchOptions,
  ): Promise<WorldRecordsAdapterResult> {
    try {
      return {
        source: this.id,
        records: await cached(
          `world:${context.playerId ?? "guest"}`,
          () => fetchWorldRecords(context.playerId),
          options,
        ),
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
    return {
      source: this.id,
      record: {
        playerId,
        seasonId,
        records: context.records,
        weeklySeasonStats: context.weeklySeasonStats,
        bestWeaponSnapshot: context.bestWeaponSnapshot,
        serverCalculatedAt: new Date().toISOString(),
      },
    };
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
