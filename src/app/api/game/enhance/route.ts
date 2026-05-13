import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { enhanceWeaponServer } from "@/lib/server/gameActionService";
import { enhanceWeaponRpc } from "@/lib/server/hotMutationRpc";
import { attachMutationDebugHeaders } from "@/lib/server/mutationResponse";
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
      const auth = await timer.time("auth user 조회", () => requireSupabaseUser());
      if (!auth.ok) {
        return attachServerTiming(auth.response, timer.finish("enhance total"));
      }

      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as EnhanceActionRequest;
      const result = await enhanceWeaponRpc(
        auth.user,
        payload,
        () => enhanceWeaponServer(auth.user, payload, { timer }),
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
