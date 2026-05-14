import { NextRequest, NextResponse } from "next/server";
import { validateNicknameAvailability } from "@/lib/server/playerRepository";
import type {
  NicknameValidateRequest,
  NicknameValidateResponse,
} from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | NicknameValidateRequest
      | null;
    const result = await validateNicknameAvailability(body?.nickname ?? "");
    const response: NicknameValidateResponse = result.ok
      ? {
          ok: true,
          nickname: result.nickname,
          normalizedNickname: result.normalizedNickname,
        }
      : {
          ok: false,
          reason: result.reason,
          message: result.message,
        };

    return NextResponse.json(response, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[nickname.validate] failed", error);
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_characters",
        message: "닉네임을 확인할 수 없습니다. 잠시 후 다시 시도하세요.",
      },
      { status: 500 },
    );
  }
}
