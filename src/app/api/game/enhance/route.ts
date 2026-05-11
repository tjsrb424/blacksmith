import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { enhanceWeaponServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { EnhanceActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/enhance", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as EnhanceActionRequest;
      return NextResponse.json(await enhanceWeaponServer(auth.user, payload));
    } catch (error) {
      return actionErrorResponse(error, "강화에 실패했습니다.");
    }
  });
}
