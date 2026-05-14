import { NextResponse } from "next/server";

import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import { checkGuestLink } from "@/lib/server/playerRepository";
import type { LinkGuestCheckRequest } from "@/types/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiLatency("api/player/link-guest/check", async () => {
    const auth = await requireSupabaseUser();
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as LinkGuestCheckRequest;
    return NextResponse.json(await checkGuestLink(auth.user, body));
  });
}
