import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { upgradeForgeServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { ForgeUpgradeActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/forge/upgrade", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as ForgeUpgradeActionRequest;
      return NextResponse.json(await upgradeForgeServer(auth.user, payload));
    } catch (error) {
      return actionErrorResponse(error, "제련로 업그레이드에 실패했습니다.");
    }
  });
}
