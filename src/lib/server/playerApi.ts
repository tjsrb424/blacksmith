import { requestJson } from "@/lib/server/http";
import type { BetaPlayerSnapshot, ServerPlayerProfile } from "@/types/server";

export async function getCurrentPlayer(): Promise<ServerPlayerProfile> {
  return requestJson<ServerPlayerProfile>("/api/player/me", {
    apiName: "api/player/me",
    timeoutMs: 10_000,
  });
}

export async function getCurrentPlayerSnapshot(): Promise<BetaPlayerSnapshot> {
  return requestJson<BetaPlayerSnapshot>("/api/player/me", {
    apiName: "api/player/me",
    timeoutMs: 10_000,
  });
}

export async function bootstrapPlayerSnapshot(): Promise<BetaPlayerSnapshot> {
  return requestJson<BetaPlayerSnapshot>("/api/player/bootstrap", {
    method: "POST",
    apiName: "api/player/bootstrap",
    timeoutMs: 10_000,
  });
}
