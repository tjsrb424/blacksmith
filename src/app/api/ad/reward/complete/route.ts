import { NextRequest, NextResponse } from "next/server";

import { withApiLatency } from "@/lib/server/apiLatency";
import { AdRewardError, completeAdReward } from "@/lib/server/adRewardService";
import { resolveRequestPlayerForHotMutation } from "@/lib/server/playerIdentity";
import { createServerStepTimer } from "@/lib/server/stepLatency";
import type { AdRewardCompleteRequest } from "@/types/ads";

export const dynamic = "force-dynamic";

const USER_MESSAGES: Record<string, string> = {
  ad_not_completed: "추가 보상 확인이 완료되지 않았습니다.",
  reward_expired: "추가 보상 시간이 만료되었습니다. 다시 시도해주세요.",
  reward_not_pending: "이미 처리 중이거나 완료된 추가 보상입니다.",
  provider_mismatch:
    "보상 제공 정보가 일치하지 않습니다. 새로고침 후 다시 시도해주세요.",
  stale_reward_intent:
    "저장된 진행 정보와 현재 화면 정보가 일치하지 않습니다. 새로고침 후 다시 시도해주세요.",
  weapon_not_found: "무기를 찾을 수 없습니다. 진행 정보를 다시 불러와 주세요.",
  last_weapon_cannot_sell:
    "마지막 무기는 판매할 수 없습니다. 상점에서 다른 무기를 구매한 뒤 판매해 주세요.",
};

function adRewardErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof AdRewardError ? error.status : 500;
  const code =
    error instanceof AdRewardError ? error.code : "ad_reward_server_error";
  const message = USER_MESSAGES[code] ?? fallback;

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
    const timer = createServerStepTimer("ad reward complete", {
      slowStepMs: 700,
    });

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as AdRewardCompleteRequest;
      const player = await timer.time("player identity lookup", () =>
        resolveRequestPlayerForHotMutation(payload),
      );
      if (!player.ok) {
        timer.finish("ad reward complete total");
        return player.response;
      }

      const result = await completeAdReward(player.identity, payload, { timer });
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      timer.finish("ad reward complete total");
      return response;
    } catch (error) {
      timer.finish("ad reward complete total");
      return adRewardErrorResponse(error, "추가 보상 지급에 실패했습니다.");
    }
  });
}
