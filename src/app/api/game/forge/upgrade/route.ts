import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { upgradeForgeServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import { createServerStepTimer } from "@/lib/server/stepLatency";
import type { ForgeUpgradeActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/forge/upgrade", async () => {
    const timer = createServerStepTimer("forgeUpgrade", { slowStepMs: 700 });

    try {
      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) {
        timer.finish();
        return auth.response;
      }

      const payload = (await timer.time("request parse", () =>
        request.json(),
      )) as ForgeUpgradeActionRequest;
      const result = await upgradeForgeServer(auth.user, payload, { timer });
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(result),
      );

      timer.finish();
      return response;
    } catch (error) {
      timer.finish();
      return actionErrorResponse(error, "제련로 업그레이드에 실패했습니다.");
    }
  });
}
