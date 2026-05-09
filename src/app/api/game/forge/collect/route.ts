import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  collectForgeServer,
  GameActionError,
} from "@/lib/server/gameActionService";
import type { ForgeCollectActionRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;
    const payload = (await request.json()) as ForgeCollectActionRequest;
    return NextResponse.json(await collectForgeServer(auth.user, payload));
  } catch (error) {
    const status = error instanceof GameActionError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Forge collect failed",
        code: error instanceof GameActionError ? error.code : "server_error",
      },
      { status },
    );
  }
}
