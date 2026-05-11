import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { buyWeaponServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { BuyActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/buy", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as BuyActionRequest;
      return NextResponse.json(await buyWeaponServer(auth.user, payload));
    } catch (error) {
      return actionErrorResponse(error, "구매에 실패했습니다.");
    }
  });
}
