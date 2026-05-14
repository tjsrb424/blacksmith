import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { upgradeForgeServer } from "@/lib/server/gameActionService";
import { upgradeForgeRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
import { resolveRequestPlayer } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import type { ForgeUpgradeActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/forge/upgrade", async () => {
    const timer = createServerStepTimer("forgeUpgrade", { slowStepMs: 700 });

    try {
      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as ForgeUpgradeActionRequest;
      const player = await timer.time("player identity", () =>
        resolveRequestPlayer(payload),
      );
      if (!player.ok) return attachServerTiming(player.response, timer.finish());

      const result = await upgradeForgeRpc(
        player.identity,
        payload,
        () => upgradeForgeServer(player.identity, payload, { timer }),
        timer,
      );
      const response = timer.timeSync("response serialize", () =>
        attachMutationDebugHeaders(NextResponse.json(result), result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "제련로 업그레이드에 실패했습니다.");
    }
  });
}
