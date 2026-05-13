import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { buyWeaponServer } from "@/lib/server/gameActionService";
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
      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) {
        return attachServerTiming(auth.response, timer.finish());
      }

      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as BuyActionRequest;
      const result = await buyWeaponServer(auth.user, payload, { timer });
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      return attachServerTiming(response, timer.finish());
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "구매에 실패했습니다.");
    }
  });
}
