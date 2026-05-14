import { NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { confirmGuestLink } from "@/lib/server/playerRepository";
import type { LinkGuestConfirmRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiLatency("api/player/link-guest/confirm", async () => {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as LinkGuestConfirmRequest;
    return NextResponse.json(
      await confirmGuestLink(auth.user, {
        guestId: body.guestId,
        guestSecret: body.guestSecret,
        choice: body.choice ?? "cancel",
      }),
    );
  });
}
