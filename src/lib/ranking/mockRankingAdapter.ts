import { MOCK_WORLD_DESTROYED_LEGEND } from "@/data/mockRankings";
import {
  buildPlayerWeeklyRow,
  getPlayerWeeklyRank,
  getWeeklyMockByCategory,
  mergePlayerIntoWeeklyRanking,
  resolveWorldBestSale,
  resolveWorldBestTranscend,
  resolveWorldHighestWeapon,
  resolveWorldMostEnhanceAttempts,
  resolveWorldMostTranscendSuccesses,
} from "@/lib/rankingLeaderboard";
import type {
  PlayerRecordAdapterResult,
  RankingAdapter,
  RankingAdapterContext,
  RankingSubmissionAdapterResult,
  WeeklyRankingAdapterResult,
  WorldRecordsAdapterResult,
} from "@/lib/ranking/rankingAdapter";
import type { RankingCategory } from "@/types/game";
import type { RankingCandidateSubmitPayload } from "@/types/server";

function serverNow(): string {
  return new Date().toISOString();
}

export class MockRankingAdapter implements RankingAdapter {
  readonly id = "mock" as const;

  async getWeeklyRanking(
    category: RankingCategory,
    seasonId: string,
    context: RankingAdapterContext,
  ): Promise<WeeklyRankingAdapterResult> {
    const mock = getWeeklyMockByCategory(category);
    const player = buildPlayerWeeklyRow(category, context.weeklySeasonStats);
    const rows = mergePlayerIntoWeeklyRanking(mock, player);
    return {
      source: this.id,
      category,
      seasonId,
      rows,
      playerRank: getPlayerWeeklyRank(rows),
    };
  }

  async getWorldRecords(
    context: RankingAdapterContext,
  ): Promise<WorldRecordsAdapterResult> {
    return {
      source: this.id,
      records: {
        highestWeapon: resolveWorldHighestWeapon(context.bestWeaponSnapshot),
        bestTranscend: resolveWorldBestTranscend(
          context.bestWeaponSnapshot,
          context.records,
        ),
        bestSale: resolveWorldBestSale(context.records),
        mostEnhanceAttempts: resolveWorldMostEnhanceAttempts(context.records),
        mostTranscendSuccesses: resolveWorldMostTranscendSuccesses(
          context.records,
        ),
        destroyedLegend: {
          ...MOCK_WORLD_DESTROYED_LEGEND,
          isPlayer: false,
        },
        serverCalculatedAt: serverNow(),
      },
    };
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
        serverCalculatedAt: serverNow(),
      },
    };
  }

  async submitRankingCandidate(
    payload: RankingCandidateSubmitPayload,
  ): Promise<RankingSubmissionAdapterResult> {
    return {
      source: this.id,
      submission: {
        status: "queued",
        seasonId: payload.seasonId,
        actionId: payload.actionId,
        reason: "localMode uses LocalStorage and mock ranking only.",
      },
    };
  }
}

export const mockRankingAdapter = new MockRankingAdapter();
