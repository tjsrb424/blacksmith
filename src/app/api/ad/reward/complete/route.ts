import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { AdRewardError, completeAdReward } from "@/lib/server/adRewardService";
import type { AdRewardCompleteRequest } from "@/types/ads";

export const dynamic = "force-dynamic";

function adRewardErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof AdRewardError ? error.status : 500;
  const code =
    error instanceof AdRewardError ? error.code : "ad_reward_server_error";
  const message =
    code === "ad_not_completed"
      ? "광고 시청이 완료되지 않아 보상이 지급되지 않았습니다."
      : code === "reward_expired"
        ? "광고 보상 시간이 만료되었습니다. 다시 시도해주세요."
        : code === "reward_not_pending"
          ? "이미 처리 중이거나 완료된 광고 보상입니다."
          : code === "provider_mismatch"
            ? "광고 제공자 정보가 일치하지 않습니다. 새로고침 후 다시 시도해주세요."
            : code === "stale_reward_intent"
              ? "서버 저장 데이터와 현재 화면 데이터가 일치하지 않습니다. 새로고침 후 다시 시도해주세요."
              : code === "weapon_not_found"
                ? "무기를 찾을 수 없습니다. 서버 데이터를 다시 불러와주세요."
                : fallback;

  if (status >= 500) {
    console.error("[ad.reward.complete] failed", error);
  }

  return NextResponse.json(
    {
      error: code,
      code,
      message,
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { details: error.message }
        : {}),
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  return withApiLatency("api/ad/reward/complete", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as AdRewardCompleteRequest;
      return NextResponse.json(await completeAdReward(auth.user, payload));
    } catch (error) {
      return adRewardErrorResponse(error, "광고 보상 지급에 실패했습니다.");
    }
  });
}
