import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { sellWeaponServer } from "@/lib/server/gameActionService";
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
      const auth = await timer.time("auth user 조회", () => requireSupabaseUser());
      if (!auth.ok) {
        return attachServerTiming(auth.response, timer.finish("sell total"));
      }

      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as SellActionRequest;
      const result = await sellWeaponServer(auth.user, payload, { timer });
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      return attachServerTiming(response, timer.finish("sell total"));
    } catch (error) {
      timer.finish("sell total");
      return actionErrorResponse(error, "판매에 실패했습니다.");
    }
  });
}
