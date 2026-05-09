import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  enhanceWeaponServer,
  GameActionError,
} from "@/lib/server/gameActionService";
import type { EnhanceActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;
    const payload = (await request.json()) as EnhanceActionRequest;
    return NextResponse.json(await enhanceWeaponServer(auth.user, payload));
  } catch (error) {
    const status = error instanceof GameActionError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Enhance failed",
        code: error instanceof GameActionError ? error.code : "server_error",
      },
      { status },
    );
  }
}
