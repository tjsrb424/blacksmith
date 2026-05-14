import { NextRequest, NextResponse } from "next/server";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import { getWeeklyRankingRows } from "@/lib/server/rankingService";
import type { RankingCategory } from "@/types/game";

export const dynamic = "force-dynamic";

const WEEKLY_CATEGORIES: readonly RankingCategory[] = [
  "weeklyStrongestWeapon",
  "weeklyEnhancementKing",
  "weeklyTranscendKing",
  "weeklySalesKing",
];

function isWeeklyCategory(value: string | null): value is RankingCategory {
  return WEEKLY_CATEGORIES.includes(value as RankingCategory);
}

export async function GET(request: NextRequest) {
  return withApiLatency("api/ranking/weekly", async () => {
    const timer = createServerStepTimer("rankingWeekly", { slowStepMs: 700 });

    try {
      const { seasonId, category, playerId } = timer.timeSync(
        "request parse",
        () => {
          const url = new URL(request.url);
          return {
            seasonId: url.searchParams.get("seasonId")?.trim(),
            category: url.searchParams.get("category"),
            playerId: url.searchParams.get("playerId")?.trim() || null,
          };
        },
      );

      if (!seasonId) {
        const response = NextResponse.json(
          {
            error: "missing_season_id",
            message: "error.missingSeasonId",
          },
          { status: 400 },
        );
        return attachServerTiming(response, timer.finish());
      }

      if (!isWeeklyCategory(category)) {
        const response = NextResponse.json(
          {
            error: "invalid_ranking_category",
            message: "error.invalidRankingCategory",
          },
          { status: 400 },
        );
        return attachServerTiming(response, timer.finish());
      }

      const result = await timer.time("weekly_rankings query", () =>
        getWeeklyRankingRows({
          seasonId,
          category,
          playerId,
        }),
      );
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      console.error("[ranking.weekly] failed", error);
      return NextResponse.json(
        {
          error: "weekly_ranking_failed",
          message: "error.weeklyRankingLoadFailed",
        },
        { status: 500 },
      );
    }
  });
}
