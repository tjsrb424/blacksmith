import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { bootstrapPlayer } from "@/lib/server/playerRepository";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;

    const snapshot = await bootstrapPlayer(auth.user);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to bootstrap player",
      },
      { status: 500 },
    );
  }
}
