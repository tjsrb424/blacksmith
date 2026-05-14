import "server-only";

import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import {
  BootstrapError,
  bootstrapGuestPlayer,
  getAuthenticatedPlayerIdentity,
  verifyGuestPlayerIdentity,
  type PlayerIdentity,
} from "@/lib/server/playerRepository";
import type { GuestRequestContext } from "@/types/server";

export type PlayerIdentityResult =
  | { ok: true; identity: PlayerIdentity }
  | { ok: false; response: NextResponseType<{ error: string; code?: string; message?: string }> };

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

function guestIdentityErrorResponse(error: BootstrapError) {
  return NextResponse.json(
    {
      error: error.errorCode,
      code: error.errorCode,
      message: error.message,
    },
    { status: error.status },
  );
}

export async function resolveRequestPlayerForHotMutation(
  payload: GuestRequestContext,
): Promise<PlayerIdentityResult> {
  if (payload.mode === "guest") {
    try {
      return {
        ok: true,
        identity: await verifyGuestPlayerIdentity(payload),
      };
    } catch (error) {
      if (error instanceof BootstrapError) {
        return { ok: false, response: guestIdentityErrorResponse(error) };
      }
      throw error;
    }
  }

  const auth = await requireSupabaseUser();
  if (!auth.ok) return auth;

  return {
    ok: true,
    identity: await getAuthenticatedPlayerIdentity(auth.user),
  };
}
