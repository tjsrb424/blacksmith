import { NextRequest, NextResponse } from "next/server";
import { withApiLatency } from "@/lib/server/apiLatency";
import { AdRewardError, getAdRewardStatus } from "@/lib/server/adRewardService";
import { resolveRequestPlayerForHotMutation } from "@/lib/server/playerIdentity";
import type { GuestRequestContext } from "@/types/server";

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
      const relatedActionId = request.nextUrl.searchParams.get("relatedActionId");
      const playerContext: GuestRequestContext = {
        mode:
          request.nextUrl.searchParams.get("mode") === "guest"
            ? "guest"
            : undefined,
        guestId: request.nextUrl.searchParams.get("guestId") ?? undefined,
        guestSecret:
          request.nextUrl.searchParams.get("guestSecret") ?? undefined,
        nickname: request.nextUrl.searchParams.get("nickname") ?? undefined,
      };
      const player = await resolveRequestPlayerForHotMutation(playerContext);
      if (!player.ok) return player.response;

      return NextResponse.json(
        await getAdRewardStatus(player.identity, { relatedActionId }),
      );
    } catch (error) {
      return adRewardErrorResponse(error);
    }
  });
}
