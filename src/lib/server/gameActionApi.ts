import { requestJson } from "@/lib/server/http";
import type {
  BuyActionRequest,
  EnhanceActionRequest,
  ForgeCollectActionRequest,
  ForgeUpgradeActionRequest,
  SellActionRequest,
  ServerGameActionResponse,
  TranscendActionRequest,
} from "@/types/server";

export async function enhanceWeapon(
  payload: EnhanceActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/enhance", {
    method: "POST",
    apiName: "api/game/enhance",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function transcendWeapon(
  payload: TranscendActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/transcend", {
    method: "POST",
    apiName: "api/game/transcend",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function sellWeapon(
  payload: SellActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/sell", {
    method: "POST",
    apiName: "api/game/sell",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function buyWeapon(
  payload: BuyActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/buy", {
    method: "POST",
    apiName: "api/game/buy",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function collectForge(
  payload: ForgeCollectActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/forge/collect", {
    method: "POST",
    apiName: "api/game/forge/collect",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}

export async function upgradeForge(
  payload: ForgeUpgradeActionRequest,
): Promise<ServerGameActionResponse> {
  return requestJson<ServerGameActionResponse>("/api/game/forge/upgrade", {
    method: "POST",
    apiName: "api/game/forge/upgrade",
    timeoutMs: 8_000,
    body: JSON.stringify(payload),
  });
}
