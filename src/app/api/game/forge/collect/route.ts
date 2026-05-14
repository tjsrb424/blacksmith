import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { collectForgeServer } from "@/lib/server/gameActionService";
import { collectForgeRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
import { resolveRequestPlayer } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import type { ForgeCollectActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/forge/collect", async () => {
    const timer = createServerStepTimer("forgeCollect", { slowStepMs: 700 });

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as ForgeCollectActionRequest;
      const player = await timer.time("player identity", () =>
        resolveRequestPlayer(payload),
      );
      if (!player.ok) return attachServerTiming(player.response, timer.finish());

      const result = await collectForgeRpc(
        player.identity,
        payload,
        () => collectForgeServer(player.identity, payload, { timer }),
        timer,
      );
      const response = timer.timeSync("response serialize", () =>
        attachMutationDebugHeaders(NextResponse.json(result), result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "제련로 수령에 실패했습니다.");
    }
  });
}
