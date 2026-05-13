import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import { getPlayerSnapshot } from "@/lib/server/playerRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiLatency("api/player/me", async () => {
    const timer = createServerStepTimer("playerMe", { slowStepMs: 700 });
    try {
      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) return attachServerTiming(auth.response, timer.finish());

      const snapshot = await timer.time("player snapshot", () =>
        getPlayerSnapshot(auth.user),
      );
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(snapshot),
      );
      return attachServerTiming(response, timer.finish());
    } catch (error) {
      const response = NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to load player",
        },
        { status: 500 },
      );
      return attachServerTiming(response, timer.finish());
    }
  });
}
