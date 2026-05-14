import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server/auth";
import { withApiLatency } from "@/lib/server/apiLatency";
import {
  attachServerTiming,
  createServerStepTimer,
} from "@/lib/server/stepLatency";
import {
  BootstrapError,
  bootstrapGuestPlayer,
  bootstrapPlayer,
} from "@/lib/server/playerRepository";
import type { GuestRequestContext } from "@/types/server";

export const dynamic = "force-dynamic";

type ErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  stack?: string;
};

function isErrorLike(error: unknown): error is ErrorLike {
  return Boolean(error && typeof error === "object");
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isErrorLike(error) && error.message) return error.message;
  return "Failed to bootstrap player";
}

function errorCode(error: unknown) {
  if (error instanceof BootstrapError) return error.errorCode;
  if (isErrorLike(error) && error.code) return error.code;
  return undefined;
}

function errorDetails(error: unknown) {
  if (error instanceof BootstrapError) return error.details;
  if (isErrorLike(error)) return error.details ?? error.hint ?? error.message;
  return undefined;
}

function logBootstrapError(error: unknown, userId?: string) {
  const cause = error instanceof BootstrapError ? error.cause : error;
  const causeLike = isErrorLike(cause) ? cause : null;

  console.error("[bootstrap] failed", {
    step: error instanceof BootstrapError ? error.step : "bootstrap",
    userId,
    errorCode: errorCode(error),
    message: errorMessage(error),
    code: causeLike?.code,
    details: causeLike?.details ?? errorDetails(error),
    hint: causeLike?.hint,
    stack:
      error instanceof Error
        ? error.stack
        : causeLike?.stack,
  });
}

export async function POST(request: Request) {
  return withApiLatency("api/player/bootstrap", async () => {
    const timer = createServerStepTimer("playerBootstrap", { slowStepMs: 700 });
    let userId: string | undefined;

    try {
      const payload = (await timer.time("request parse", async () =>
        request.json().catch(() => ({})),
      )) as GuestRequestContext;

      if (payload.mode === "guest") {
        const snapshot = await timer.time("bootstrap guest player", () =>
          bootstrapGuestPlayer(payload),
        );
        const response = timer.timeSync("response serialize", () =>
          NextResponse.json(snapshot),
        );
        return attachServerTiming(response, timer.finish());
      }

      const auth = await timer.time("auth", () => requireSupabaseUser());
      if (!auth.ok) return attachServerTiming(auth.response, timer.finish());

      userId = auth.user.id;
      const snapshot = await timer.time("bootstrap player", () =>
        bootstrapPlayer(auth.user),
      );
      const response = timer.timeSync("response serialize", () =>
        NextResponse.json(snapshot),
      );
      return attachServerTiming(response, timer.finish());
    } catch (error) {
      logBootstrapError(error, userId);

      const isBootstrapError = error instanceof BootstrapError;
      const status = isBootstrapError ? error.status : 500;
      const isDevelopment = process.env.NODE_ENV === "development";

      const response = NextResponse.json(
        {
          error: "bootstrap_failed",
          message: "Failed to bootstrap player",
          errorCode: isBootstrapError ? error.errorCode : "bootstrap_failed",
          ...(isDevelopment
            ? {
                details: errorDetails(error) ?? errorMessage(error),
              }
            : {}),
        },
        { status },
      );
      return attachServerTiming(response, timer.finish());
    }
  });
}
