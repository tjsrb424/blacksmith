import { NextRequest, NextResponse } from "next/server";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { submitRankingCandidateServer } from "@/lib/server/gameActionService";
import { resolveRequestPlayer } from "@/lib/server/playerIdentity";
import type { RankingCandidateSubmitPayload } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RankingCandidateSubmitPayload;
    const player = await resolveRequestPlayer(payload);
    if (!player.ok) return player.response;
    return NextResponse.json(
      await submitRankingCandidateServer(player.identity, payload),
    );
  } catch (error) {
    return actionErrorResponse(error, "error.rankingSubmitFailed");
  }
}
