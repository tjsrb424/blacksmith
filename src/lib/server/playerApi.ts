import { requestJson } from "@/lib/server/http";
import type { ServerPlayerProfile } from "@/types/server";

export async function getCurrentPlayer(): Promise<ServerPlayerProfile> {
  return requestJson<ServerPlayerProfile>("/api/player/me");
}
