import "server-only";

import { NextResponse } from "next/server";
import { GameActionError } from "@/lib/server/gameActionService";

const USER_MESSAGES: Record<string, string> = {
  invalid_request:
    "서버 저장 데이터와 현재 화면 데이터가 일치하지 않습니다. 새로고침 후 다시 시도해주세요.",
  missing_action_id: "요청 정보가 올바르지 않습니다. 다시 시도해주세요.",
  action_conflict:
    "이미 처리 중인 요청입니다. 잠시 후 서버 데이터를 다시 불러와주세요.",
  weapon_not_found:
    "무기를 찾을 수 없습니다. 서버 데이터 다시 불러오기를 눌러주세요.",
  weapon_def_not_found:
    "무기 정보가 올바르지 않습니다. 새로고침 후 다시 시도해주세요.",
  forbidden: "이 무기는 현재 계정의 서버 데이터와 일치하지 않습니다.",
  insufficient_gold: "골드가 부족합니다.",
  insufficient_ember: "제련의 불씨가 부족합니다. 제련로에서 수령해보세요.",
  insufficient_stone: "초월석이 부족합니다.",
  destroyed_weapon: "이미 파괴된 무기입니다. 서버 데이터를 다시 불러와주세요.",
  locked_weapon: "잠긴 무기는 판매할 수 없습니다.",
  last_weapon_cannot_sell:
    "마지막 무기는 판매할 수 없습니다. 상점에서 다른 무기를 구매한 뒤 판매해주세요.",
  ad_reward_required: "광고 보너스 판매는 광고 보상 절차로만 처리할 수 있습니다.",
  max_enhance: "이미 최대 강화 단계입니다.",
  max_transcend: "이미 최대 초월 단계입니다.",
  not_eligible: "+15 무기만 초월할 수 있습니다.",
  no_forge_reward: "아직 수령할 제련의 불씨가 없습니다.",
  max_forge_level: "제련로가 이미 최대 레벨입니다.",
  mutation_rpc_not_applied:
    "서버 최적화 처리 경로가 적용되지 않았습니다. 관리자에게 문의해주세요.",
  server_error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

export function actionErrorResponse(error: unknown, fallback: string) {
  const status = error instanceof GameActionError ? error.status : 500;
  const code = error instanceof GameActionError ? error.code : "server_error";
  const message = USER_MESSAGES[code] ?? fallback;

  if (status >= 500) {
    console.error("[game.action] failed", {
      code,
      message: error instanceof Error ? error.message : fallback,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return NextResponse.json(
    {
      error: code,
      code,
      message,
      ...(process.env.NODE_ENV === "development"
        ? {
            details: error instanceof Error ? error.message : fallback,
          }
        : {}),
    },
    { status },
  );
}
