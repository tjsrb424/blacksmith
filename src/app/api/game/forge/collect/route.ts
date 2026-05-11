import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { actionErrorResponse } from "@/lib/server/gameActionErrorResponse";
import { collectForgeServer } from "@/lib/server/gameActionService";
import { withApiLatency } from "@/lib/server/apiLatency";
import type { ForgeCollectActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiLatency("api/game/forge/collect", async () => {
    try {
      const auth = await requireSupabaseUser();
      if (!auth.ok) return auth.response;
      const payload = (await request.json()) as ForgeCollectActionRequest;
      return NextResponse.json(await collectForgeServer(auth.user, payload));
    } catch (error) {
      return actionErrorResponse(error, "제련로 수령에 실패했습니다.");
    }
  });
}
