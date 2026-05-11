import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { getWorldRecordRows } from "@/lib/server/rankingService";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiLatency("api/ranking/world", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;

      return NextResponse.json(await getWorldRecordRows(auth.user.id));
    } catch (error) {
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
