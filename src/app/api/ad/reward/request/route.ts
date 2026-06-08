import { NextRequest, NextResponse } from "next/server";

import { withApiLatency } from "@/lib/server/apiLatency";
import { AdRewardError, requestAdReward } from "@/lib/server/adRewardService";
import { resolveRequestPlayerForHotMutation } from "@/lib/server/playerIdentity";
import type { AdRewardRequest } from "@/types/ads";

export const dynamic = "force-dynamic";

const USER_MESSAGES: Record<string, string> = {
  ad_provider_disabled: "추가 보상을 불러올 수 없습니다.",
  ad_daily_limit: "오늘 추가 보상을 모두 사용했습니다.",
  ad_cooldown:
    "아직 추가 보상 대기 시간이 남아 있습니다. 잠시 후 다시 시도해주세요.",
  ad_related_reward_exists: "이미 처리 중이거나 완료된 추가 보상입니다.",
  no_forge_reward: "아직 수령할 제련 불씨가 없습니다.",
  weapon_not_found: "무기를 찾을 수 없습니다. 진행 정보를 다시 불러와 주세요.",
  locked_weapon: "잠긴 무기는 판매할 수 없습니다.",
  destroyed_weapon: "이미 파괴된 무기입니다.",
  last_weapon_cannot_sell:
    "마지막 무기는 판매할 수 없습니다. 상점에서 다른 무기를 구매한 뒤 판매해 주세요.",
  reward_type_not_ready: "아직 사용할 수 없는 추가 보상입니다.",
  reward_expired: "추가 보상 시간이 만료되었습니다. 다시 시도해주세요.",
};

function adRewardErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof AdRewardError ? error.status : 500;
  const code =
    error instanceof AdRewardError ? error.code : "ad_reward_server_error";
  const message = USER_MESSAGES[code] ?? fallback;

  if (status >= 500) {
    console.error("[ad.reward.request] failed", error);
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
  return withApiLatency("api/ad/reward/request", async () => {
    try {
      const payload = (await request.json()) as AdRewardRequest;
      const player = await resolveRequestPlayerForHotMutation(payload);
      if (!player.ok) return player.response;

      return NextResponse.json(await requestAdReward(player.identity, payload));
    } catch (error) {
      return adRewardErrorResponse(error, "추가 보상 준비에 실패했습니다.");
    }
  });
}
