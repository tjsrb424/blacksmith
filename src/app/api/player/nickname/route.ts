import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  NicknameUpdateError,
  updateGuestPlayerNickname,
  updatePlayerNickname,
} from "@/lib/server/playerRepository";
import type { NicknameUpdateRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | NicknameUpdateRequest
      | null;
    if (!body?.nickname) {
      throw new NicknameUpdateError("too_short");
    }

    const response =
      body.mode === "guest"
        ? await updateGuestPlayerNickname({
            mode: "guest",
            guestId: body.guestId,
            guestSecret: body.guestSecret,
            nickname: body.nickname,
          })
        : null;

    if (response) return NextResponse.json(response);

    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;
    const authResponse = await updatePlayerNickname(auth.user, body.nickname);

    return NextResponse.json(authResponse);
  } catch (error) {
    if (error instanceof NicknameUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          reason: error.reason,
          message: error.message,
          cooldownRemainingMs: error.cooldownRemainingMs,
          cooldownRemainingSeconds:
            error.cooldownRemainingMs == null
              ? undefined
              : Math.ceil(error.cooldownRemainingMs / 1000),
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update nickname",
      },
      { status: 500 },
    );
  }
}
