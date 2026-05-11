import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { transcendWeaponServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { TranscendActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/transcend", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as TranscendActionRequest;
      return NextResponse.json(await transcendWeaponServer(auth.user, payload));
    } catch (error) {
      return actionErrorResponse(error, "초월에 실패했습니다.");
    }
  });
}
