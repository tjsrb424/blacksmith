import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { validateNickname } from "@/lib/player/nickname";
import { updatePlayerNickname } from "@/lib/server/playerRepository";
import type { NicknameUpdateRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as
      | NicknameUpdateRequest
      | null;
    const nicknameResult = validateNickname(body?.nickname ?? "");

    if (!nicknameResult.ok) {
      return NextResponse.json(
        { error: nicknameResult.message },
        { status: 400 },
      );
    }

    const response = await updatePlayerNickname(
      auth.user,
      nicknameResult.nickname,
    );
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update nickname",
      },
      { status: 500 },
    );
  }
}
