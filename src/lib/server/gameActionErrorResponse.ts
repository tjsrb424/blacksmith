import "server-only";

import { NextResponse } from "next/server";

import { GameActionError } from "@/lib/server/gameActionService";

const USER_MESSAGES: Record<string, string> = {
  invalid_request: "error.invalidRequestState",
  missing_action_id: "error.invalidActionRequest",
  action_conflict: "error.actionConflict",
  weapon_not_found: "error.weaponNotFound",
  weapon_def_not_found: "error.weaponDataInvalid",
  forbidden: "error.forbiddenWeapon",
  insufficient_gold: "error.notEnoughGold",
  insufficient_ember: "error.notEnoughEmber",
  insufficient_stone: "error.notEnoughStone",
  destroyed_weapon: "error.destroyedWeapon",
  locked_weapon: "error.lockedWeapon",
  last_weapon_cannot_sell: "inventory.lastWeaponCannotSellLong",
  ad_reward_required: "ads.rewardRequired",
  max_enhance: "enhance.maxLevel",
  max_transcend: "transcend.maxLevel",
  not_eligible: "transcend.requirement",
  no_forge_reward: "forge.notReady",
  max_forge_level: "forge.maxLevel",
  mutation_rpc_not_applied: "error.mutationNotApplied",
  server_error: "error.generic",
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
