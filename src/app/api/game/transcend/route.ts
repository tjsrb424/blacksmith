import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { transcendWeaponServer } from "@/lib/server/gameActionService";
import { resolveRequestPlayer } from "@/lib/server/playerIdentity";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { TranscendActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/transcend", async () => {
    try {
      const payload = (await request.json()) as TranscendActionRequest;
      const player = await resolveRequestPlayer(payload);
      if (!player.ok) return player.response;
      return NextResponse.json(
        await transcendWeaponServer(player.identity, payload),
      );
    } catch (error) {
      return actionErrorResponse(error, "초월에 실패했습니다.");
    }
  });
}
