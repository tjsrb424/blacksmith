import "server-only";

import { WEAPON_DEFINITIONS } from "@/data/weapons";
import { getCurrentSeasonInfo } from "@/lib/season";
import { GameActionError } from "@/lib/server/gameActionService";
import type { PlayerIdentity } from "@/lib/server/playerRepository";
import { serverRandomUnit } from "@/lib/server/serverRandom";
import type { ServerStepTimer } from "@/lib/server/stepLatency";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  BuyActionRequest,
  EnhanceActionRequest,
  ForgeCollectActionRequest,
  ForgeUpgradeActionRequest,
  SellActionRequest,
  ServerGameActionResponse,
} from "@/types/server";
import type { Json } from "@/types/supabase";

export type HotMutationRpcName =
  | "apply_buy_action_v1"
  | "apply_enhance_action_v1"
  | "apply_sell_action_v1"
  | "apply_forge_collect_action_v1"
  | "apply_forge_upgrade_action_v1";

export type MutationPathDebug = {
  mutationPath: "rpc" | "legacy";
  rpcName: HotMutationRpcName;
  rpcApplied: boolean;
  fallbackAllowed: boolean;
};

type RpcArgs = Record<string, Json | undefined>;

type UntypedRpcClient = {
  rpc: (
    fn: string,
    args: RpcArgs,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export function legacyHotMutationFallbackAllowed() {
  return process.env.HOT_MUTATION_RPC_FALLBACK_LEGACY === "true";
}

function weaponDefinitionsJson(): Json {
  return JSON.parse(JSON.stringify(WEAPON_DEFINITIONS)) as Json;
}

function payloadJson(payload: unknown): Json {
  return JSON.parse(JSON.stringify(payload)) as Json;
}

function withMutationDebug(
  response: ServerGameActionResponse,
  debug: MutationPathDebug,
): ServerGameActionResponse {
  return {
    ...response,
    debug,
  };
}

async function callRpc(
  rpcName: HotMutationRpcName,
  args: RpcArgs,
  timer?: ServerStepTimer,
): Promise<ServerGameActionResponse> {
  const admin = getSupabaseAdminClient() as unknown as UntypedRpcClient;
  const invoke = async () => {
    const { data, error } = await admin.rpc(rpcName, args);
    if (error) {
      throw new GameActionError(
        error.message ?? `Failed to apply ${rpcName}`,
        500,
        "mutation_rpc_not_applied",
      );
    }
    if (!data || typeof data !== "object") {
      throw new GameActionError(
        `${rpcName} returned an empty response`,
        500,
        "mutation_rpc_not_applied",
      );
    }
    return data as ServerGameActionResponse;
  };

  return timer ? timer.time(`rpc ${rpcName}`, invoke) : invoke();
}

async function rpcOrLegacy(
  rpcName: HotMutationRpcName,
  args: RpcArgs,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
): Promise<ServerGameActionResponse> {
  const fallbackAllowed = legacyHotMutationFallbackAllowed();
  const debug: MutationPathDebug = {
    mutationPath: "rpc",
    rpcName,
    rpcApplied: true,
    fallbackAllowed,
  };

  try {
    const response = await callRpc(rpcName, args, timer);
    return withMutationDebug(response, debug);
  } catch (error) {
    if (!fallbackAllowed) throw error;
    const response = await (timer
      ? timer.time("legacy fallback", legacy)
      : legacy());
    return withMutationDebug(response, {
      ...debug,
      mutationPath: "legacy",
      rpcApplied: false,
    });
  }
}

export async function buyWeaponRpc(
  user: PlayerIdentity,
  payload: BuyActionRequest,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
) {
  return rpcOrLegacy(
    "apply_buy_action_v1",
    {
      p_user_id: user.id,
      p_action_id: payload.actionId,
      p_payload: payloadJson(payload),
      p_weapon_id: payload.weaponId,
      p_weapon_definitions: weaponDefinitionsJson(),
    },
    legacy,
    timer,
  );
}

export async function enhanceWeaponRpc(
  user: PlayerIdentity,
  payload: EnhanceActionRequest,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
) {
  return rpcOrLegacy(
    "apply_enhance_action_v1",
    {
      p_user_id: user.id,
      p_action_id: payload.actionId,
      p_payload: payloadJson(payload),
      p_weapon_instance_id: payload.weaponInstanceId,
      p_season_id: getCurrentSeasonInfo().seasonId,
      p_weapon_definitions: weaponDefinitionsJson(),
      p_rng: serverRandomUnit(),
      p_scrap_gold_rng: serverRandomUnit(),
      p_scrap_stone_rng: serverRandomUnit(),
    },
    legacy,
    timer,
  );
}

export async function sellWeaponRpc(
  user: PlayerIdentity,
  payload: SellActionRequest,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
) {
  return rpcOrLegacy(
    "apply_sell_action_v1",
    {
      p_user_id: user.id,
      p_action_id: payload.actionId,
      p_payload: payloadJson(payload),
      p_weapon_instance_id: payload.weaponInstanceId,
      p_season_id: getCurrentSeasonInfo().seasonId,
      p_weapon_definitions: weaponDefinitionsJson(),
    },
    legacy,
    timer,
  );
}

export async function collectForgeRpc(
  user: PlayerIdentity,
  payload: ForgeCollectActionRequest,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
) {
  return rpcOrLegacy(
    "apply_forge_collect_action_v1",
    {
      p_user_id: user.id,
      p_action_id: payload.actionId,
      p_payload: payloadJson(payload),
      p_season_id: getCurrentSeasonInfo().seasonId,
      p_now: new Date().toISOString(),
    },
    legacy,
    timer,
  );
}

export async function upgradeForgeRpc(
  user: PlayerIdentity,
  payload: ForgeUpgradeActionRequest,
  legacy: () => Promise<ServerGameActionResponse>,
  timer?: ServerStepTimer,
) {
  return rpcOrLegacy(
    "apply_forge_upgrade_action_v1",
    {
      p_user_id: user.id,
      p_action_id: payload.actionId,
      p_payload: payloadJson(payload),
    },
    legacy,
    timer,
  );
}
