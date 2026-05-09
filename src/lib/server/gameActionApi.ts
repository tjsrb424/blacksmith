import { requestJson } from "@/lib/server/http";
import type {
  BuyActionRequest,
  EnhanceActionRequest,
  ForgeCollectActionRequest,
  SellActionRequest,
  ServerGameActionResponse,
  TranscendActionRequest,
} from "@/types/server";

export async function enhanceWeapon(
  payload: EnhanceActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/enhance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transcendWeapon(
  payload: TranscendActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/transcend", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sellWeapon(
  payload: SellActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/sell", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function buyWeapon(
  payload: BuyActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/buy", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function collectForge(
  payload: ForgeCollectActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/forge/collect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
