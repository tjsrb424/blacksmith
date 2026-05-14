import { NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { deleteAuthenticatedAccountData } from "@/lib/server/playerRepository";

export const dynamic = "force-dynamic";

export async function POST() {
  return withApiLatency("api/player/account/delete", async () => {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;

    try {
      await deleteAuthenticatedAccountData(auth.user);
      return NextResponse.json({
        ok: true,
        message: "계정 데이터를 삭제했습니다.",
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "account_delete_failed",
          message:
            error instanceof Error
              ? error.message
              : "계정 데이터 삭제에 실패했습니다.",
        },
        { status: 500 },
      );
    }
  });
}
