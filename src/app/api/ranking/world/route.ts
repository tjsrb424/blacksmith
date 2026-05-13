import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import { getWorldRecordRows } from "@/lib/server/rankingService";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiLatency("api/ranking/world", async () => {
    const timer = createServerStepTimer("rankingWorld", { slowStepMs: 700 });

    try {
      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) {
        return attachServerTiming(auth.response, timer.finish());
      }

      const result = await timer.time("world_records query", () =>
        getWorldRecordRows(auth.user.id),
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
