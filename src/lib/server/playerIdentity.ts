import "server-only";

import type { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  bootstrapGuestPlayer,
  getAuthenticatedPlayerIdentity,
  type PlayerIdentity,
} from "@/lib/server/playerRepository";
import type { GuestRequestContext } from "@/types/server";

export type PlayerIdentityResult =
  | { ok: true; identity: PlayerIdentity }
  | { ok: false; response: NextResponse<{ error: string }> };

export async function resolveRequestPlayer(
  payload: GuestRequestContext,
): Promise<PlayerIdentityResult> {
  if (payload.mode === "guest") {
    const snapshot = await bootstrapGuestPlayer(payload);
    return {
      ok: true,
      identity: {
        id: snapshot.userId,
        email: null,
      },
    };
  }

  const auth = await requireSupabaseUser();
  if (!auth.ok) return auth;

  return {
    ok: true,
    identity: await getAuthenticatedPlayerIdentity(auth.user),
  };
}
