import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { buyWeaponServer } from "@/lib/server/gameActionService";
import { buyWeaponRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
import { resolveRequestPlayerForHotMutation } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import type { BuyActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/buy", async () => {
    const timer = createServerStepTimer("buy", { slowStepMs: 700 });

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as BuyActionRequest;
      const player = await timer.time("player identity", () =>
        resolveRequestPlayerForHotMutation(payload),
      );
      if (!player.ok) return attachServerTiming(player.response, timer.finish());

      const result = await buyWeaponRpc(
        player.identity,
        payload,
        () => buyWeaponServer(player.identity, payload, { timer }),
        timer,
      );
      const response = timer.timeSync("response serialize", () =>
        attachMutationDebugHeaders(NextResponse.json(result), result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "구매에 실패했습니다.");
    }
  });
}
