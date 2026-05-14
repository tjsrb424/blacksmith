import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { sellWeaponServer } from "@/lib/server/gameActionService";
import { sellWeaponRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
import { resolveRequestPlayerForHotMutation } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import type { SellActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/sell", async () => {
    const timer = createServerStepTimer("sell", { slowStepMs: 700 });

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as SellActionRequest;
      const player = await timer.time("player identity", () =>
        resolveRequestPlayerForHotMutation(payload),
      );
      if (!player.ok) {
        return attachServerTiming(player.response, timer.finish("sell total"));
      }

      const result = await sellWeaponRpc(
        player.identity,
        payload,
        () => sellWeaponServer(player.identity, payload, { timer }),
        timer,
      );
      const response = timer.timeSync("response serialize", () =>
        attachMutationDebugHeaders(NextResponse.json(result), result),
      );

      return attachServerTiming(response, timer.finish("sell total"));
    } catch (error) {
      timer.finish("sell total");
      return actionErrorResponse(error, "판매에 실패했습니다.");
    }
  });
}
