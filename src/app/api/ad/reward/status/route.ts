import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { AdRewardError, getAdRewardStatus } from "@/lib/server/adRewardService";

export const dynamic = "force-dynamic";

function adRewardErrorResponse(error: unknown) {
  const status = error instanceof AdRewardError ? error.status : 500;
  const code =
    error instanceof AdRewardError ? error.code : "ad_reward_server_error";

  if (status >= 500) {
    console.error("[ad.reward.status] failed", error);
  }

  return NextResponse.json(
    {
      error: code,
      code,
      message: "추가 보상 상태를 불러오지 못했습니다.",
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { details: error.message }
        : {}),
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  return withApiLatency("api/ad/reward/status", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const relatedActionId = request.nextUrl.searchParams.get("relatedActionId");
      return NextResponse.json(
        await getAdRewardStatus(auth.user, { relatedActionId }),
      );
    } catch (error) {
      return adRewardErrorResponse(error);
    }
  });
}
