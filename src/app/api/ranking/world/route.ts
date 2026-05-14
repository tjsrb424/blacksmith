import { NextRequest, NextResponse } from "next/server";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import { getWorldRecordRows } from "@/lib/server/rankingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApiLatency("api/ranking/world", async () => {
    const timer = createServerStepTimer("rankingWorld", { slowStepMs: 700 });

    try {
      const playerId = timer.timeSync("request parse", () => {
        const url = new URL(request.url);
        return url.searchParams.get("playerId")?.trim() || null;
      });

      const result = await timer.time("world_records query", () =>
        getWorldRecordRows(playerId),
      );
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      console.error("[ranking.world] failed", error);
      return NextResponse.json(
        {
          error: "world_ranking_failed",
          message: "서버 월드 기록을 불러오지 못했습니다.",
        },
        { status: 500 },
      );
    }
  });
}
