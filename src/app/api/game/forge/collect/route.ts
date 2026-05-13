import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { collectForgeServer } from "@/lib/server/gameActionService";
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
      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) {
        return attachServerTiming(auth.response, timer.finish());
      }

      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as ForgeCollectActionRequest;
      const result = await collectForgeServer(auth.user, payload, { timer });
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "제련로 수령에 실패했습니다.");
    }
  });
}
