import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  GameActionError,
  submitRankingCandidateServer,
} from "@/lib/server/gameActionService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;
    const payload = (await request.json()) as {
      actionId: string;
      weaponInstanceId: string;
      seasonId: string;
    };
    return NextResponse.json(
      await submitRankingCandidateServer(auth.user, payload),
    );
  } catch (error) {
    const status = error instanceof GameActionError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ranking submit failed",
        code: error instanceof GameActionError ? error.code : "server_error",
      },
      { status },
    );
  }
}
