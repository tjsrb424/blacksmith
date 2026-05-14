import { NextResponse } from "next/server";

import { withApiLatency } from "@/lib/server/apiLatency";
import { archiveGuestPlayer } from "@/lib/server/playerRepository";
import type { GuestResetRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiLatency("api/player/guest/reset", async () => {
    try {
      const body = (await request.json().catch(() => ({}))) as GuestResetRequest;
      await archiveGuestPlayer(body);
      return NextResponse.json({
        ok: true,
        message: "게스트 기록을 초기화했습니다.",
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "guest_reset_failed",
          message:
            error instanceof Error
              ? error.message
              : "게스트 기록 초기화에 실패했습니다.",
        },
        { status: 400 },
      );
    }
  });
}
