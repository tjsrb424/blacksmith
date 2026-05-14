import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { enhanceWeaponServer } from "@/lib/server/gameActionService";
import { enhanceWeaponRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
import { resolveRequestPlayer } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import type { EnhanceActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/enhance", async () => {
    const timer = createServerStepTimer("enhance");

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as EnhanceActionRequest;
      const player = await timer.time("player identity", () =>
        resolveRequestPlayer(payload),
      );
      if (!player.ok) {
        return attachServerTiming(player.response, timer.finish("enhance total"));
      }

      const result = await enhanceWeaponRpc(
        player.identity,
        payload,
        () => enhanceWeaponServer(player.identity, payload, { timer }),
        timer,
      );
      const response = timer.timeSync("response serialize", () =>
        attachMutationDebugHeaders(NextResponse.json(result), result),
      );

      return attachServerTiming(response, timer.finish("enhance total"));
    } catch (error) {
      timer.finish("enhance total");
      return actionErrorResponse(error, "강화에 실패했습니다.");
    }
  });
}
