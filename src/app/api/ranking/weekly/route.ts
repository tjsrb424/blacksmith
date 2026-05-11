import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
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
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;

      const url = new URL(request.url);
      const seasonId = url.searchParams.get("seasonId")?.trim();
      const category = url.searchParams.get("category");

      if (!seasonId) {
        return NextResponse.json(
          {
            error: "missing_season_id",
            message: "seasonId is required.",
          },
          { status: 400 },
        );
      }

      if (!isWeeklyCategory(category)) {
        return NextResponse.json(
          {
            error: "invalid_ranking_category",
            message: "Unknown weekly ranking category.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await getWeeklyRankingRows({
          seasonId,
          category,
          playerId: auth.user.id,
        }),
      );
    } catch (error) {
      console.error("[ranking.weekly] failed", error);
      return NextResponse.json(
        {
          error: "weekly_ranking_failed",
          message: "서버 랭킹을 불러오지 못했습니다.",
        },
        { status: 500 },
      );
    }
  });
}
