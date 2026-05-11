import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { submitRankingCandidateServer } from "@/lib/server/gameActionService";

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
    return actionErrorResponse(error, "랭킹 제출에 실패했습니다.");
  }
}
