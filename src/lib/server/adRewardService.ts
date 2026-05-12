import "server-only";

import type { User } from "@supabase/supabase-js";
import {
  AD_REWARD_COOLDOWNS,
  AD_REWARD_DAILY_LIMITS,
  AD_REWARD_EXPIRY_MINUTES,
} from "@/data/balance";
import {
  getGoogleRewardedAdUnitId,
  getServerRewardProvider,
} from "@/lib/ads/adConfig";
import { calculateAdSaleGold, calculateSaleGold } from "@/lib/economy";
import { computePendingForgeEmber } from "@/lib/forge";
import { calculateRankingValue } from "@/lib/ranking";
import {
  bestWeaponSnapshotFromRecord,
  defaultPlayerRecords,
  defaultWeeklySeasonStats,
  getOwnedWeaponsForSnapshot,
} from "@/lib/server/playerRepository";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerStepTimer } from "@/lib/server/stepLatency";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { getCurrentSeasonInfo } from "@/lib/season";
import { upsertWeeklyScore, upsertWorldRecord } from "@/lib/server/rankingService";
import type {
  AdProviderId,
  AdRewardCompleteRequest,
  AdRewardCompleteResponse,
  AdRewardIntent,
  AdRewardRequest,
  AdRewardStatusResponse,
  AdRewardType,
} from "@/types/ads";
import type { PlayerRecords, SaleCompleteInfo } from "@/types/game";
import type { AdRewardLogRow, Json, OwnedWeaponRow, PlayerRecordRow, PlayerStateRow, ProfileRow } from "@/types/supabase";

const INTENT_TTL_MS = AD_REWARD_EXPIRY_MINUTES * 60 * 1000;
const AD_REWARD_TYPES: AdRewardType[] = [
  "forgeCollectDouble",
  "sellBonus",
  "destructionScrapDouble",
  "dailyTranscendStoneBox",
];
const AD_REWARD_LOG_SELECT =
  "id,user_id,reward_type,reward_status,provider,provider_reward_id,action_id,related_action_id,payload,reward_result,requested_at,completed_at,expires_at,created_at,updated_at";
const PLAYER_STATE_SELECT =
  "id,user_id,gold,forge_ember,transcend_stone,forge_level,forge_last_collected_at,current_season_id,stats,created_at,updated_at";
const PLAYER_RECORD_SELECT =
  "id,user_id,best_weapon_name,best_weapon_id,best_weapon_value,best_weapon_enhance_level,best_weapon_transcend_level,best_sale_gold,total_sales_gold,max_transcend_level,stats,created_at,updated_at";
const OWNED_WEAPON_SELECT =
  "id,user_id,weapon_id,enhance_level,transcend_level,durability,is_locked,created_at,updated_at";

export class AdRewardError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "ad_reward_error",
  ) {
    super(message);
  }
}

function providerFromEnv(): AdProviderId {
  return getServerRewardProvider();
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRewardType(value: unknown): value is AdRewardType {
  return (
    value === "forgeCollectDouble" ||
    value === "sellBonus" ||
    value === "destructionScrapDouble" ||
    value === "dailyTranscendStoneBox"
  );
}

function isRewardEnabledForBeta(rewardType: AdRewardType): boolean {
  return rewardType === "forgeCollectDouble" || rewardType === "sellBonus";
}

function assertActionId(actionId: string | undefined) {
  const id = actionId?.trim();
  if (!id) throw new AdRewardError("Missing actionId", 400, "missing_action_id");
  return id;
}

function todayUtcRange(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function relatedActionIdForRequest(request: AdRewardRequest): string | null {
  if (request.rewardType === "sellBonus") {
    return request.targetWeaponInstanceId ?? null;
  }
  if (request.rewardType === "destructionScrapDouble") {
    return request.relatedActionId ?? null;
  }
  return request.relatedActionId ?? null;
}

async function expireStalePendingIntents(userId: string, rewardType?: AdRewardType) {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("ad_reward_logs")
    .update({ reward_status: "expired" })
    .eq("user_id", userId)
    .eq("reward_status", "pending")
    .lt("expires_at", new Date().toISOString());

  if (rewardType) query = query.eq("reward_type", rewardType);
  const { error } = await query;
  if (error) throw error;
}

async function countCompletedToday(userId: string, rewardType: AdRewardType) {
  const admin = getSupabaseAdminClient();
  const { startIso, endIso } = todayUtcRange();
  const { count, error } = await admin
    .from("ad_reward_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reward_type", rewardType)
    .eq("reward_status", "completed")
    .gte("completed_at", startIso)
    .lt("completed_at", endIso);

  if (error) throw error;
  return count ?? 0;
}

async function getLatestAttempt(userId: string, rewardType: AdRewardType) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("ad_reward_logs")
    .select(AD_REWARD_LOG_SELECT)
    .eq("user_id", userId)
    .eq("reward_type", rewardType)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findActivePendingIntent(args: {
  userId: string;
  rewardType: AdRewardType;
  relatedActionId: string | null;
}) {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("ad_reward_logs")
    .select(AD_REWARD_LOG_SELECT)
    .eq("user_id", args.userId)
    .eq("reward_type", args.rewardType)
    .eq("reward_status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("requested_at", { ascending: false })
    .limit(1);

  if (args.relatedActionId) {
    query = query.eq("related_action_id", args.relatedActionId);
  } else if (args.rewardType === "forgeCollectDouble") {
    query = query.is("related_action_id", null);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function findRelatedRewardLog(args: {
  userId: string;
  rewardType: AdRewardType;
  relatedActionId: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("ad_reward_logs")
    .select(AD_REWARD_LOG_SELECT)
    .eq("user_id", args.userId)
    .eq("reward_type", args.rewardType)
    .eq("related_action_id", args.relatedActionId)
    .in("reward_status", ["pending", "processing", "completed"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function cooldownRemainingMs(latest: AdRewardLogRow | null, rewardType: AdRewardType) {
  const cooldown = AD_REWARD_COOLDOWNS[rewardType] ?? 0;
  if (!latest || cooldown <= 0) return 0;
  const elapsed = Date.now() - new Date(latest.requested_at).getTime();
  return Math.max(0, cooldown - elapsed);
}

async function assertAdRewardAvailability(args: {
  userId: string;
  rewardType: AdRewardType;
  relatedActionId: string | null;
}) {
  const dailyLimit = AD_REWARD_DAILY_LIMITS[args.rewardType] ?? 0;
  if (dailyLimit <= 0 || !isRewardEnabledForBeta(args.rewardType)) {
    throw new AdRewardError(
      "Reward type is not available",
      409,
      "reward_type_not_ready",
    );
  }

  const used = await countCompletedToday(args.userId, args.rewardType);
  if (used >= dailyLimit) {
    throw new AdRewardError("Daily ad reward limit exceeded", 429, "ad_daily_limit");
  }

  const latest = await getLatestAttempt(args.userId, args.rewardType);
  const remaining = cooldownRemainingMs(latest, args.rewardType);
  if (remaining > 0) {
    throw new AdRewardError(
      `Ad reward cooldown active:${remaining}`,
      429,
      "ad_cooldown",
    );
  }

  if (args.relatedActionId) {
    const related = await findRelatedRewardLog({
      userId: args.userId,
      rewardType: args.rewardType,
      relatedActionId: args.relatedActionId,
    });
    if (related) {
      if (related.reward_status === "pending") return logToIntent(related);
      throw new AdRewardError(
        "Related ad reward is already used or processing",
        409,
        "ad_related_reward_exists",
      );
    }
  }

  return null;
}

async function getProfile(userId: string): Promise<ProfileRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,nickname,created_at,updated_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerState(userId: string): Promise<PlayerStateRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_states")
    .select(PLAYER_STATE_SELECT)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerRecord(userId: string): Promise<PlayerRecordRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_records")
    .select(PLAYER_RECORD_SELECT)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function getOwnedWeapon(userId: string, weaponInstanceId: string): Promise<OwnedWeaponRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("owned_weapons")
    .select(OWNED_WEAPON_SELECT)
    .eq("id", weaponInstanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new AdRewardError("Weapon not found", 404, "weapon_not_found");
  }
  return data;
}

async function countOwnedWeapons(userId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("owned_weapons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

function assertCanSellOwnedWeaponCount(count: number) {
  if (count <= 1) {
    throw new AdRewardError(
      "Last weapon cannot be sold",
      409,
      "last_weapon_cannot_sell",
    );
  }
}

function currentRecords(record: PlayerRecordRow): PlayerRecords {
  return defaultPlayerRecords(record);
}

function displayReward(rewardType: AdRewardType, payload: Record<string, unknown>) {
  if (rewardType === "forgeCollectDouble") {
    return `제련의 불씨 ${Number(payload.expectedBaseAmount ?? 0) * 2}개`;
  }
  if (rewardType === "sellBonus") {
    return `판매 보상 ${Number(payload.finalGold ?? 0)} 골드`;
  }
  if (rewardType === "destructionScrapDouble") return "파괴 잔해 보상 2배";
  return "초월석 광고 상자";
}

async function buildPayload(
  user: User,
  request: AdRewardRequest,
): Promise<Record<string, unknown>> {
  if (request.rewardType === "forgeCollectDouble") {
    const state = await getPlayerState(user.id);
    const now = Date.now();
    const last = new Date(state.forge_last_collected_at).getTime();
    const expectedBaseAmount = computePendingForgeEmber({
      forgeLevel: Number(state.forge_level),
      forgeLastCollectAt: last,
      now,
    });
    if (expectedBaseAmount <= 0) {
      throw new AdRewardError("No forge reward to collect", 409, "no_forge_reward");
    }
    return {
      expectedBaseAmount,
      finalAmount: expectedBaseAmount * 2,
      bonusAmount: expectedBaseAmount,
      forgeLevel: Number(state.forge_level),
      forgeLastCollectedAt: state.forge_last_collected_at,
      requestedAtMs: now,
    };
  }

  if (request.rewardType === "sellBonus") {
    if (!request.targetWeaponInstanceId) {
      throw new AdRewardError("Missing target weapon", 400, "missing_target_weapon");
    }
    const [weapon, ownedWeaponCount] = await Promise.all([
      getOwnedWeapon(user.id, request.targetWeaponInstanceId),
      countOwnedWeapons(user.id),
    ]);
    assertCanSellOwnedWeaponCount(ownedWeaponCount);
    const def = WEAPONS_BY_ID[weapon.weapon_id];
    if (!def) throw new AdRewardError("Weapon definition not found", 404, "weapon_def_not_found");
    if (weapon.is_locked) throw new AdRewardError("Locked weapon cannot be sold", 409, "locked_weapon");
    if (Number(weapon.durability) <= 0) throw new AdRewardError("Destroyed weapon cannot be sold", 409, "destroyed_weapon");
    const owned = {
      instanceId: weapon.id,
      weaponId: weapon.weapon_id,
      enhanceLevel: Number(weapon.enhance_level),
      transcendLevel: Number(weapon.transcend_level),
      durability: Number(weapon.durability),
      locked: Boolean(weapon.is_locked),
      createdAt: new Date(weapon.created_at).getTime(),
      bestValue: 0,
    };
    const baseSaleGold = calculateSaleGold(def, owned);
    const finalGold = calculateAdSaleGold(baseSaleGold);
    return {
      weaponInstanceId: weapon.id,
      weaponId: def.id,
      weaponName: def.name,
      enhanceLevel: owned.enhanceLevel,
      transcendLevel: owned.transcendLevel,
      durability: owned.durability,
      baseSaleGold,
      finalGold,
      bonusGold: finalGold - baseSaleGold,
      rankingValue: calculateRankingValue(def, owned),
      weaponUpdatedAt: weapon.updated_at,
    };
  }

  throw new AdRewardError(
    "Reward type is not implemented yet",
    409,
    "reward_type_not_ready",
  );
}

export async function requestAdReward(
  user: User,
  request: AdRewardRequest,
): Promise<AdRewardIntent> {
  const actionId = assertActionId(request.actionId);
  if (!isRewardType(request.rewardType)) {
    throw new AdRewardError("Invalid reward type", 400, "invalid_reward_type");
  }
  const provider = providerFromEnv();
  if (provider === "disabled") {
    throw new AdRewardError("Ad provider is disabled", 503, "ad_provider_disabled");
  }

  await expireStalePendingIntents(user.id, request.rewardType);
  const relatedActionId = relatedActionIdForRequest(request);
  const activePending = await findActivePendingIntent({
    userId: user.id,
    rewardType: request.rewardType,
    relatedActionId,
  });
  if (activePending) return logToIntent(activePending);

  const admin = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("ad_reward_logs")
    .select(AD_REWARD_LOG_SELECT)
    .eq("user_id", user.id)
    .eq("action_id", actionId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (
      existing.reward_status === "pending" &&
      new Date(existing.expires_at).getTime() < Date.now()
    ) {
      await admin
        .from("ad_reward_logs")
        .update({ reward_status: "expired" })
        .eq("id", existing.id);
      throw new AdRewardError(
        "Reward intent expired. Retry with a new actionId.",
        409,
        "reward_expired",
      );
    }
    return logToIntent(existing);
  }

  const reusableIntent = await assertAdRewardAvailability({
    userId: user.id,
    rewardType: request.rewardType,
    relatedActionId,
  });
  if (reusableIntent) return reusableIntent;

  const payload = await buildPayload(user, request);
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();
  const { data, error } = await admin
    .from("ad_reward_logs")
    .insert({
      user_id: user.id,
      reward_type: request.rewardType,
      reward_status: "pending",
      provider,
      action_id: actionId,
      related_action_id: relatedActionId,
      payload: toJson(payload),
      expires_at: expiresAt,
    })
    .select(AD_REWARD_LOG_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      if (relatedActionId) {
        const related = await findRelatedRewardLog({
          userId: user.id,
          rewardType: request.rewardType,
          relatedActionId,
        });
        if (related?.reward_status === "pending") return logToIntent(related);
        if (related) {
          throw new AdRewardError(
            "Related ad reward is already used or processing",
            409,
            "ad_related_reward_exists",
          );
        }
      }
      const { data: raced, error: racedError } = await admin
        .from("ad_reward_logs")
        .select(AD_REWARD_LOG_SELECT)
        .eq("user_id", user.id)
        .eq("action_id", actionId)
        .single();
      if (racedError) throw racedError;
      return logToIntent(raced);
    }
    throw error;
  }

  return logToIntent(data);
}

function logToIntent(log: AdRewardLogRow): AdRewardIntent {
  if (log.reward_status !== "pending") {
    throw new AdRewardError("Reward intent is not pending", 409, "reward_not_pending");
  }
  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const provider = log.provider as AdProviderId;
  return {
    rewardIntentId: log.id,
    rewardType: log.reward_type as AdRewardType,
    provider,
    expiresAt: log.expires_at,
    displayReward: displayReward(log.reward_type as AdRewardType, payload),
    clientAdConfig: {
      provider,
      adUnitId: getGoogleRewardedAdUnitId(),
      mockDelayMs: 150,
    },
  };
}

export async function getAdRewardStatus(
  user: User,
  params?: {
    relatedActionId?: string | null;
  },
): Promise<AdRewardStatusResponse> {
  const { startIso, endIso } = todayUtcRange();
  const admin = getSupabaseAdminClient();
  const { data: logs, error } = await admin
    .from("ad_reward_logs")
    .select(AD_REWARD_LOG_SELECT)
    .eq("user_id", user.id)
    .gte("requested_at", startIso)
    .order("requested_at", { ascending: false })
    .limit(80);

  if (error) throw error;

  const now = Date.now();
  const recentLogs = logs ?? [];
  const entries = AD_REWARD_TYPES.map((rewardType) => {
      const dailyLimit = AD_REWARD_DAILY_LIMITS[rewardType] ?? 0;
      const rewardLogs = recentLogs.filter(
        (log) => log.reward_type === rewardType,
      );
      const dailyUsed = rewardLogs.filter((log) => {
        const completedAt = log.completed_at;
        return (
          log.reward_status === "completed" &&
          Boolean(completedAt) &&
          completedAt! >= startIso &&
          completedAt! < endIso
        );
      }).length;
      const latest = rewardLogs[0] ?? null;
      const cooldown = cooldownRemainingMs(latest, rewardType);
      const relatedActionId =
        rewardType === "sellBonus" || rewardType === "destructionScrapDouble"
          ? (params?.relatedActionId ?? null)
          : null;
      const activePending = rewardLogs.find((log) => {
        if (log.reward_status !== "pending") return false;
        if (new Date(log.expires_at).getTime() < now) return false;
        if (relatedActionId) return log.related_action_id === relatedActionId;
        if (rewardType === "forgeCollectDouble") return !log.related_action_id;
        return false;
      });
      const available =
        isRewardEnabledForBeta(rewardType) &&
        dailyLimit > 0 &&
        dailyUsed < dailyLimit &&
        cooldown <= 0;
      const message =
        !isRewardEnabledForBeta(rewardType) || dailyLimit <= 0
          ? "아직 사용할 수 없는 광고 보상입니다."
          : dailyUsed >= dailyLimit
            ? "오늘 광고 보상을 모두 사용했습니다."
            : cooldown > 0
              ? `${Math.ceil(cooldown / 60000)}분 후 다시 이용 가능`
              : activePending
                ? "진행 중인 광고 보상이 있습니다."
                : undefined;

      return {
        rewardType,
        dailyUsed,
        dailyLimit,
        cooldownRemainingMs: cooldown,
        available,
        message,
        activePendingIntent: activePending ? logToIntent(activePending) : undefined,
      };
    });

  return {
    serverTime: new Date().toISOString(),
    rewards: Object.fromEntries(
      entries.map((entry) => [entry.rewardType, entry]),
    ) as AdRewardStatusResponse["rewards"],
  };
}

// Retained temporarily as a parity reference while the fast path is validated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function completeForgeCollect(
  user: User,
  log: AdRewardLogRow,
  timer?: ServerStepTimer,
): Promise<AdRewardCompleteResponse> {
  const payload = log.payload as Record<string, unknown>;
  const [state, record] = await Promise.all([
    timer
      ? timer.time("player_state 조회", () => getPlayerState(user.id))
      : getPlayerState(user.id),
    timer
      ? timer.time("player_records 조회", () => getPlayerRecord(user.id))
      : getPlayerRecord(user.id),
  ]);
  if (state.forge_last_collected_at !== payload.forgeLastCollectedAt) {
    throw new AdRewardError("Forge reward already changed", 409, "stale_reward_intent");
  }
  const { basePending, gained, bonusAmount, nextRecords, collectAt } = timer
    ? timer.timeSync("reward 지급 계산", () => {
        const basePending = Number(payload.expectedBaseAmount ?? 0);
        const gained = Number(payload.finalAmount ?? basePending * 2);
        const bonusAmount = Number(payload.bonusAmount ?? basePending);
        const records = currentRecords(record);
        return {
          basePending,
          gained,
          bonusAmount,
          nextRecords: {
            ...records,
            totalForgeCollected: records.totalForgeCollected + gained,
            totalForgeAdBonusCollected:
              records.totalForgeAdBonusCollected + bonusAmount,
            forgeCollectCount: records.forgeCollectCount + 1,
            forgeAdCollectCount: records.forgeAdCollectCount + 1,
          },
          collectAt: new Date(Number(payload.requestedAtMs ?? Date.now())).toISOString(),
        };
      })
    : (() => {
        const basePending = Number(payload.expectedBaseAmount ?? 0);
        const gained = Number(payload.finalAmount ?? basePending * 2);
        const bonusAmount = Number(payload.bonusAmount ?? basePending);
        const records = currentRecords(record);
        return {
          basePending,
          gained,
          bonusAmount,
          nextRecords: {
            ...records,
            totalForgeCollected: records.totalForgeCollected + gained,
            totalForgeAdBonusCollected:
              records.totalForgeAdBonusCollected + bonusAmount,
            forgeCollectCount: records.forgeCollectCount + 1,
            forgeAdCollectCount: records.forgeAdCollectCount + 1,
          },
          collectAt: new Date(Number(payload.requestedAtMs ?? Date.now())).toISOString(),
        };
      })();
  const nextState: PlayerStateRow = {
    ...state,
    forge_ember: Number(state.forge_ember) + gained,
    forge_last_collected_at: collectAt,
  };
  const nextRecord: PlayerRecordRow = {
    ...record,
    stats: toJson(nextRecords),
  };
  const admin = getSupabaseAdminClient();
  await (timer
    ? timer.time("player_state/player_records update", async () => {
        const [stateResult, recordResult] = await Promise.all([
          admin
            .from("player_states")
            .update({
              forge_ember: nextState.forge_ember,
              forge_last_collected_at: nextState.forge_last_collected_at,
            })
            .eq("id", state.id),
          admin
            .from("player_records")
            .update({ stats: nextRecord.stats })
            .eq("id", record.id),
        ]);
        if (stateResult.error) throw stateResult.error;
        if (recordResult.error) throw recordResult.error;
      })
    : Promise.all([
        admin
          .from("player_states")
          .update({
            forge_ember: nextState.forge_ember,
            forge_last_collected_at: nextState.forge_last_collected_at,
          })
          .eq("id", state.id),
        admin
          .from("player_records")
          .update({ stats: nextRecord.stats })
          .eq("id", record.id),
      ]).then(([stateResult, recordResult]) => {
        if (stateResult.error) throw stateResult.error;
        if (recordResult.error) throw recordResult.error;
      }));
  return {
    actionId: log.action_id,
    actionType: "ad_reward",
    status: "applied",
    rewardIntentId: log.id,
    rewardType: "forgeCollectDouble",
    patch: timer
      ? timer.timeSync("server result/patch 생성", () => ({
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          forgeLastCollectedAt: nextState.forge_last_collected_at,
          records: defaultPlayerRecords(nextRecord),
          weeklySeasonStats: defaultWeeklySeasonStats(
            getCurrentSeasonInfo().seasonId,
            nextState,
          ),
          bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
        }))
      : {
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          forgeLastCollectedAt: nextState.forge_last_collected_at,
          records: defaultPlayerRecords(nextRecord),
          weeklySeasonStats: defaultWeeklySeasonStats(
            getCurrentSeasonInfo().seasonId,
            nextState,
          ),
          bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
        },
    display: {
      kind: "forgeCollect",
      gained,
      basePending,
      usedAd: true,
      bonusAmount,
    },
  };
}

// Retained temporarily as a parity reference while the fast path is validated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function completeSellBonus(
  user: User,
  log: AdRewardLogRow,
  timer?: ServerStepTimer,
): Promise<AdRewardCompleteResponse> {
  const payload = log.payload as Record<string, unknown>;
  const [profile, state, record, weapon, ownedWeaponsBefore] = await Promise.all([
    timer ? timer.time("profile 조회", () => getProfile(user.id)) : getProfile(user.id),
    timer
      ? timer.time("player_state 조회", () => getPlayerState(user.id))
      : getPlayerState(user.id),
    timer
      ? timer.time("player_records 조회", () => getPlayerRecord(user.id))
      : getPlayerRecord(user.id),
    timer
      ? timer.time("owned_weapon 조회", () =>
          getOwnedWeapon(user.id, String(payload.weaponInstanceId)),
        )
      : getOwnedWeapon(user.id, String(payload.weaponInstanceId)),
    timer
      ? timer.time("마지막 무기 여부 확인", () => getOwnedWeaponsForSnapshot(user.id))
      : getOwnedWeaponsForSnapshot(user.id),
  ]);
  assertCanSellOwnedWeaponCount(ownedWeaponsBefore.length);
  if (
    weapon.weapon_id !== payload.weaponId ||
    Number(weapon.enhance_level) !== Number(payload.enhanceLevel) ||
    Number(weapon.transcend_level) !== Number(payload.transcendLevel) ||
    Number(weapon.durability) !== Number(payload.durability)
  ) {
    throw new AdRewardError("Weapon changed after ad request", 409, "stale_reward_intent");
  }

  const calculation = timer
    ? timer.timeSync("reward 지급 계산", () => {
        const baseSaleGold = Number(payload.baseSaleGold ?? 0);
        const finalGold = Number(payload.finalGold ?? 0);
        const rankingValue = Number(payload.rankingValue ?? 0);
        const records = currentRecords(record);
        const weekly = {
          ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
        };
        weekly.salesGoldThisSeason += finalGold;
        return {
          baseSaleGold,
          finalGold,
          rankingValue,
          nextRecords: {
            ...records,
            totalSalesGold: records.totalSalesGold + finalGold,
            bestSaleGold: Math.max(records.bestSaleGold, finalGold),
            soldWeaponCount: records.soldWeaponCount + 1,
          },
          weekly,
        };
      })
    : (() => {
        const baseSaleGold = Number(payload.baseSaleGold ?? 0);
        const finalGold = Number(payload.finalGold ?? 0);
        const rankingValue = Number(payload.rankingValue ?? 0);
        const records = currentRecords(record);
        const weekly = {
          ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
        };
        weekly.salesGoldThisSeason += finalGold;
        return {
          baseSaleGold,
          finalGold,
          rankingValue,
          nextRecords: {
            ...records,
            totalSalesGold: records.totalSalesGold + finalGold,
            bestSaleGold: Math.max(records.bestSaleGold, finalGold),
            soldWeaponCount: records.soldWeaponCount + 1,
          },
          weekly,
        };
      })();
  const { baseSaleGold, finalGold, rankingValue, nextRecords, weekly } = calculation;
  const nextState: PlayerStateRow = {
    ...state,
    gold: Number(state.gold) + finalGold,
    stats: toJson({ weeklySeasonStats: weekly }),
  };
  const nextRecord: PlayerRecordRow = {
    ...record,
    ...(rankingValue > Number(record.best_weapon_value ?? 0)
      ? {
          best_weapon_name: payload.weaponName as string,
          best_weapon_id: payload.weaponId as string,
          best_weapon_value: rankingValue,
          best_weapon_enhance_level: Number(payload.enhanceLevel ?? 0),
          best_weapon_transcend_level: Number(payload.transcendLevel ?? 0),
          max_transcend_level: Math.max(
            Number(record.max_transcend_level ?? 0),
            Number(payload.transcendLevel ?? 0),
          ),
        }
      : {}),
    best_sale_gold: Math.max(Number(record.best_sale_gold ?? 0), finalGold),
    total_sales_gold: Number(record.total_sales_gold ?? 0) + finalGold,
    stats: toJson(nextRecords),
  };
  const admin = getSupabaseAdminClient();
  const { error: deleteError } = await (timer
    ? timer.time("owned_weapon delete", async () =>
        await admin.from("owned_weapons").delete().eq("id", weapon.id),
      )
    : admin.from("owned_weapons").delete().eq("id", weapon.id));
  if (deleteError) throw deleteError;
  const recordUpdate = {
    ...(rankingValue > Number(record.best_weapon_value ?? 0)
      ? {
          best_weapon_name: nextRecord.best_weapon_name,
          best_weapon_id: nextRecord.best_weapon_id,
          best_weapon_value: nextRecord.best_weapon_value,
          best_weapon_enhance_level: nextRecord.best_weapon_enhance_level,
          best_weapon_transcend_level: nextRecord.best_weapon_transcend_level,
          max_transcend_level: nextRecord.max_transcend_level,
        }
      : {}),
    best_sale_gold: nextRecord.best_sale_gold,
    total_sales_gold: nextRecord.total_sales_gold,
    stats: nextRecord.stats,
  };
  const shouldCheckWorldSale = baseSaleGold > Number(record.best_sale_gold ?? 0);
  await (timer
    ? timer.time("state/record/ranking update", async () => {
        const results = await Promise.all([
          admin
            .from("player_states")
            .update({
              gold: nextState.gold,
              stats: nextState.stats,
            })
            .eq("id", state.id),
          admin.from("player_records").update(recordUpdate).eq("id", record.id),
          upsertWeeklyScore({
            userId: user.id,
            profile,
            seasonId: weekly.seasonId,
            category: "weeklySalesKing",
            score: weekly.salesGoldThisSeason,
          }).then(() => ({ error: null })),
          shouldCheckWorldSale
            ? upsertWorldRecord({
                category: "worldRecordSale",
                userId: user.id,
                nickname: profile.nickname,
                weaponName: String(payload.weaponName ?? "-"),
                weaponId: String(payload.weaponId ?? ""),
                enhanceLevel: Number(payload.enhanceLevel ?? 0),
                transcendLevel: Number(payload.transcendLevel ?? 0),
                value: baseSaleGold,
              }).then(() => ({ error: null }))
            : Promise.resolve({ error: null }),
        ]);
        for (const result of results) {
          if (result.error) throw result.error;
        }
      })
    : Promise.all([
        admin
          .from("player_states")
          .update({
            gold: nextState.gold,
            stats: nextState.stats,
          })
          .eq("id", state.id),
        admin.from("player_records").update(recordUpdate).eq("id", record.id),
        upsertWeeklyScore({
          userId: user.id,
          profile,
          seasonId: weekly.seasonId,
          category: "weeklySalesKing",
          score: weekly.salesGoldThisSeason,
        }).then(() => ({ error: null })),
        shouldCheckWorldSale
          ? upsertWorldRecord({
              category: "worldRecordSale",
              userId: user.id,
              nickname: profile.nickname,
              weaponName: String(payload.weaponName ?? "-"),
              weaponId: String(payload.weaponId ?? ""),
              enhanceLevel: Number(payload.enhanceLevel ?? 0),
              transcendLevel: Number(payload.transcendLevel ?? 0),
              value: baseSaleGold,
            }).then(() => ({ error: null }))
          : Promise.resolve({ error: null }),
      ]).then((results) => {
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }));
  const info: SaleCompleteInfo = {
    saleType: "adBonus",
    soldWeaponId: weapon.id,
    weaponId: String(payload.weaponId ?? ""),
    weaponName: String(payload.weaponName ?? "-"),
    enhanceLevel: Number(payload.enhanceLevel ?? 0),
    transcendLevel: Number(payload.transcendLevel ?? 0),
    baseSaleGold,
    bonusGold: finalGold - baseSaleGold,
    finalSaleGold: finalGold,
    rankingValue,
    usedAdBonus: true,
    wasEquipped: false,
  };

  return {
    actionId: log.action_id,
    actionType: "ad_reward",
    status: "applied",
    rewardIntentId: log.id,
    rewardType: "sellBonus",
    patch: timer
      ? timer.timeSync("server result/patch 생성", () => ({
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          removedWeaponId: weapon.id,
          records: defaultPlayerRecords(nextRecord),
          weeklySeasonStats: defaultWeeklySeasonStats(weekly.seasonId, nextState),
          bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
        }))
      : {
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          removedWeaponId: weapon.id,
          records: defaultPlayerRecords(nextRecord),
          weeklySeasonStats: defaultWeeklySeasonStats(weekly.seasonId, nextState),
          bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
        },
    display: {
      kind: "sell",
      rankingValue,
      info,
    },
  };
}

async function completeForgeCollectFast(
  user: User,
  log: AdRewardLogRow,
  timer?: ServerStepTimer,
): Promise<AdRewardCompleteResponse> {
  const payload = log.payload as Record<string, unknown>;
  const state = await (timer
    ? timer.time("forgeCollectDouble: player_state forge_ember lookup", () =>
        getPlayerState(user.id),
      )
    : getPlayerState(user.id));

  const assertFreshForgeState = () => {
    if (state.forge_last_collected_at !== payload.forgeLastCollectedAt) {
      throw new AdRewardError(
        "Forge reward already changed",
        409,
        "stale_reward_intent",
      );
    }
  };
  if (timer) {
    timer.timeSync(
      "forgeCollectDouble: relatedActionId/target validation",
      assertFreshForgeState,
    );
  } else {
    assertFreshForgeState();
  }

  const { basePending, gained, bonusAmount, collectAt } = timer
    ? timer.timeSync("forgeCollectDouble: reward amount calculation", () => {
        const basePending = Number(payload.expectedBaseAmount ?? 0);
        const gained = Number(payload.finalAmount ?? basePending * 2);
        const bonusAmount = Number(payload.bonusAmount ?? basePending);
        return {
          basePending,
          gained,
          bonusAmount,
          collectAt: new Date(
            Number(payload.requestedAtMs ?? Date.now()),
          ).toISOString(),
        };
      })
    : (() => {
        const basePending = Number(payload.expectedBaseAmount ?? 0);
        const gained = Number(payload.finalAmount ?? basePending * 2);
        const bonusAmount = Number(payload.bonusAmount ?? basePending);
        return {
          basePending,
          gained,
          bonusAmount,
          collectAt: new Date(
            Number(payload.requestedAtMs ?? Date.now()),
          ).toISOString(),
        };
      })();

  const nextState: PlayerStateRow = {
    ...state,
    forge_ember: Number(state.forge_ember) + gained,
    forge_last_collected_at: collectAt,
  };
  const admin = getSupabaseAdminClient();
  await (timer
    ? timer.time("forgeCollectDouble: player_state forge_ember update", async () => {
        const { error } = await admin
          .from("player_states")
          .update({
            forge_ember: nextState.forge_ember,
            forge_last_collected_at: nextState.forge_last_collected_at,
          })
          .eq("id", state.id);
        if (error) throw error;
      })
    : admin
        .from("player_states")
        .update({
          forge_ember: nextState.forge_ember,
          forge_last_collected_at: nextState.forge_last_collected_at,
        })
        .eq("id", state.id)
        .then(({ error }) => {
          if (error) throw error;
        }));

  return {
    actionId: log.action_id,
    actionType: "ad_reward",
    status: "applied",
    rewardIntentId: log.id,
    rewardType: "forgeCollectDouble",
    patch: timer
      ? timer.timeSync("response result/patch create", () => ({
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          forgeLastCollectedAt: nextState.forge_last_collected_at,
        }))
      : {
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          forgeLastCollectedAt: nextState.forge_last_collected_at,
        },
    display: {
      kind: "forgeCollect",
      gained,
      basePending,
      usedAd: true,
      bonusAmount,
    },
  };
}

async function completeSellBonusFast(
  user: User,
  log: AdRewardLogRow,
  timer?: ServerStepTimer,
): Promise<AdRewardCompleteResponse> {
  const payload = log.payload as Record<string, unknown>;
  const [state, record, weapon, ownedWeaponCount] = await Promise.all([
    timer
      ? timer.time("sellBonus: player_state lookup", () => getPlayerState(user.id))
      : getPlayerState(user.id),
    timer
      ? timer.time("sellBonus: player_records lookup", () => getPlayerRecord(user.id))
      : getPlayerRecord(user.id),
    timer
      ? timer.time("sellBonus: target weapon lookup", () =>
          getOwnedWeapon(user.id, String(payload.weaponInstanceId)),
        )
      : getOwnedWeapon(user.id, String(payload.weaponInstanceId)),
    timer
      ? timer.time("sellBonus: last weapon count check", () =>
          countOwnedWeapons(user.id),
        )
      : countOwnedWeapons(user.id),
  ]);

  if (timer) {
    timer.timeSync("sellBonus: last weapon validation", () =>
      assertCanSellOwnedWeaponCount(ownedWeaponCount),
    );
  } else {
    assertCanSellOwnedWeaponCount(ownedWeaponCount);
  }

  const validateWeapon = () => {
    if (
      weapon.weapon_id !== payload.weaponId ||
      Number(weapon.enhance_level) !== Number(payload.enhanceLevel) ||
      Number(weapon.transcend_level) !== Number(payload.transcendLevel) ||
      Number(weapon.durability) !== Number(payload.durability)
    ) {
      throw new AdRewardError(
        "Weapon changed after ad request",
        409,
        "stale_reward_intent",
      );
    }
  };
  if (timer) {
    timer.timeSync("sellBonus: reward type/target weapon validation", validateWeapon);
  } else {
    validateWeapon();
  }

  const calculation = timer
    ? timer.timeSync("sellBonus: sale price/bonus calculation", () => {
        const baseSaleGold = Number(payload.baseSaleGold ?? 0);
        const finalGold = Number(payload.finalGold ?? 0);
        const rankingValue = Number(payload.rankingValue ?? 0);
        const records = currentRecords(record);
        const weekly = {
          ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
        };
        weekly.salesGoldThisSeason += finalGold;
        return {
          baseSaleGold,
          finalGold,
          rankingValue,
          nextRecords: {
            ...records,
            totalSalesGold: records.totalSalesGold + finalGold,
            bestSaleGold: Math.max(records.bestSaleGold, finalGold),
            soldWeaponCount: records.soldWeaponCount + 1,
          },
          weekly,
        };
      })
    : (() => {
        const baseSaleGold = Number(payload.baseSaleGold ?? 0);
        const finalGold = Number(payload.finalGold ?? 0);
        const rankingValue = Number(payload.rankingValue ?? 0);
        const records = currentRecords(record);
        const weekly = {
          ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
        };
        weekly.salesGoldThisSeason += finalGold;
        return {
          baseSaleGold,
          finalGold,
          rankingValue,
          nextRecords: {
            ...records,
            totalSalesGold: records.totalSalesGold + finalGold,
            bestSaleGold: Math.max(records.bestSaleGold, finalGold),
            soldWeaponCount: records.soldWeaponCount + 1,
          },
          weekly,
        };
      })();

  const { baseSaleGold, finalGold, rankingValue, nextRecords, weekly } =
    calculation;
  const nextState: PlayerStateRow = {
    ...state,
    gold: Number(state.gold) + finalGold,
    stats: toJson({ weeklySeasonStats: weekly }),
  };
  const nextRecord: PlayerRecordRow = {
    ...record,
    ...(rankingValue > Number(record.best_weapon_value ?? 0)
      ? {
          best_weapon_name: payload.weaponName as string,
          best_weapon_id: payload.weaponId as string,
          best_weapon_value: rankingValue,
          best_weapon_enhance_level: Number(payload.enhanceLevel ?? 0),
          best_weapon_transcend_level: Number(payload.transcendLevel ?? 0),
          max_transcend_level: Math.max(
            Number(record.max_transcend_level ?? 0),
            Number(payload.transcendLevel ?? 0),
          ),
        }
      : {}),
    best_sale_gold: Math.max(Number(record.best_sale_gold ?? 0), finalGold),
    total_sales_gold: Number(record.total_sales_gold ?? 0) + finalGold,
    stats: toJson(nextRecords),
  };
  const recordUpdate = {
    ...(rankingValue > Number(record.best_weapon_value ?? 0)
      ? {
          best_weapon_name: nextRecord.best_weapon_name,
          best_weapon_id: nextRecord.best_weapon_id,
          best_weapon_value: nextRecord.best_weapon_value,
          best_weapon_enhance_level: nextRecord.best_weapon_enhance_level,
          best_weapon_transcend_level: nextRecord.best_weapon_transcend_level,
          max_transcend_level: nextRecord.max_transcend_level,
        }
      : {}),
    best_sale_gold: nextRecord.best_sale_gold,
    total_sales_gold: nextRecord.total_sales_gold,
    stats: nextRecord.stats,
  };

  const admin = getSupabaseAdminClient();
  await (timer
    ? timer.time("sellBonus: gold/weapon/record update", async () => {
        const results = await Promise.all([
          admin.from("owned_weapons").delete().eq("id", weapon.id),
          admin
            .from("player_states")
            .update({
              gold: nextState.gold,
              stats: nextState.stats,
            })
            .eq("id", state.id),
          admin.from("player_records").update(recordUpdate).eq("id", record.id),
        ]);
        for (const result of results) {
          if (result.error) throw result.error;
        }
      })
    : Promise.all([
        admin.from("owned_weapons").delete().eq("id", weapon.id),
        admin
          .from("player_states")
          .update({
            gold: nextState.gold,
            stats: nextState.stats,
          })
          .eq("id", state.id),
        admin.from("player_records").update(recordUpdate).eq("id", record.id),
      ]).then((results) => {
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }));

  const info: SaleCompleteInfo = {
    saleType: "adBonus",
    soldWeaponId: weapon.id,
    weaponId: String(payload.weaponId ?? ""),
    weaponName: String(payload.weaponName ?? "-"),
    enhanceLevel: Number(payload.enhanceLevel ?? 0),
    transcendLevel: Number(payload.transcendLevel ?? 0),
    baseSaleGold,
    bonusGold: finalGold - baseSaleGold,
    finalSaleGold: finalGold,
    rankingValue,
    usedAdBonus: true,
    wasEquipped: false,
  };

  return {
    actionId: log.action_id,
    actionType: "ad_reward",
    status: "applied",
    rewardIntentId: log.id,
    rewardType: "sellBonus",
    patch: timer
      ? timer.timeSync("response result/patch create", () => ({
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          removedWeaponId: weapon.id,
        }))
      : {
          currentGold: Number(nextState.gold),
          currentEmber: Number(nextState.forge_ember),
          currentStone: Number(nextState.transcend_stone),
          removedWeaponId: weapon.id,
        },
    display: {
      kind: "sell",
      rankingValue,
      info,
    },
  };
}

export async function completeAdReward(
  user: User,
  request: AdRewardCompleteRequest,
  options: { timer?: ServerStepTimer } = {},
): Promise<AdRewardCompleteResponse> {
  const timer = options.timer;
  const admin = getSupabaseAdminClient();
  const { data: log, error } = await (timer
    ? timer.time("reward intent 조회", async () =>
        await admin
          .from("ad_reward_logs")
          .select(AD_REWARD_LOG_SELECT)
          .eq("id", request.rewardIntentId)
          .maybeSingle(),
      )
    : admin
        .from("ad_reward_logs")
        .select(AD_REWARD_LOG_SELECT)
        .eq("id", request.rewardIntentId)
        .maybeSingle());
  if (error) throw error;
  if (!log || log.user_id !== user.id) {
    throw new AdRewardError("Reward intent not found", 404, "reward_intent_not_found");
  }
  const isCompletedReplay = timer
    ? timer.timeSync(
        "completed replay check",
        () => log.reward_status === "completed" && Boolean(log.reward_result),
      )
    : log.reward_status === "completed" && Boolean(log.reward_result);
  if (isCompletedReplay && log.reward_result) {
    return {
      ...(log.reward_result as unknown as AdRewardCompleteResponse),
      status: "replayed",
    };
  }
  if (timer) {
    timer.timeSync("reward type validation", () => {
      if (!isRewardType(log.reward_type)) {
        throw new AdRewardError(
          "Invalid reward type",
          400,
          "invalid_reward_type",
        );
      }
    });
  } else if (!isRewardType(log.reward_type)) {
    throw new AdRewardError("Invalid reward type", 400, "invalid_reward_type");
  }
  if (log.reward_status !== "pending") {
    throw new AdRewardError("Reward intent is not pending", 409, "reward_not_pending");
  }
  const providerMatches = timer
    ? timer.timeSync(
        "provider result validation",
        () => request.providerResult.provider === log.provider,
      )
    : request.providerResult.provider === log.provider;
  if (!providerMatches) {
    await admin
      .from("ad_reward_logs")
      .update({
        reward_status: "failed",
        reward_result: toJson({
          providerResult: request.providerResult,
          error: "provider_mismatch",
        }),
      })
      .eq("id", log.id);
    throw new AdRewardError("Ad provider mismatch", 409, "provider_mismatch");
  }
  const isExpired = timer
    ? timer.timeSync(
        "reward intent expiry validation",
        () => new Date(log.expires_at).getTime() < Date.now(),
      )
    : new Date(log.expires_at).getTime() < Date.now();
  if (isExpired) {
    await admin
      .from("ad_reward_logs")
      .update({ reward_status: "expired" })
      .eq("id", log.id);
    throw new AdRewardError("Reward intent expired", 409, "reward_expired");
  }
  const wasRewarded = timer
    ? timer.timeSync(
        "provider rewarded validation",
        () => request.providerResult.rewarded,
      )
    : request.providerResult.rewarded;
  if (!wasRewarded) {
    const status =
      request.providerResult.outcome === "canceled" ? "canceled" : "failed";
    await admin
      .from("ad_reward_logs")
      .update({
        reward_status: status,
        reward_result: toJson({ providerResult: request.providerResult }),
      })
      .eq("id", log.id);
    throw new AdRewardError("Ad was not completed", 409, "ad_not_completed");
  }

  const { data: claimed, error: claimError } = await (timer
    ? timer.time("pending/processing/completed 상태 claim", async () =>
        await admin
          .from("ad_reward_logs")
          .update({ reward_status: "processing" })
          .eq("id", log.id)
          .eq("reward_status", "pending")
          .select("id")
          .maybeSingle(),
      )
    : admin
        .from("ad_reward_logs")
        .update({ reward_status: "processing" })
        .eq("id", log.id)
        .eq("reward_status", "pending")
        .select("id")
        .maybeSingle());
  if (claimError) throw claimError;
  if (!claimed) {
    throw new AdRewardError("Reward intent is already being completed", 409, "reward_not_pending");
  }

  const response =
    log.reward_type === "forgeCollectDouble"
      ? await completeForgeCollectFast(user, log, timer)
      : log.reward_type === "sellBonus"
        ? await completeSellBonusFast(user, log, timer)
        : (() => {
            throw new AdRewardError(
              "Reward type is not implemented yet",
              409,
              "reward_type_not_ready",
            );
          })();

  const { error: updateError } = await (timer
    ? timer.time("ad_reward_logs completed update", async () =>
        await admin
          .from("ad_reward_logs")
          .update({
            reward_status: "completed",
            provider_reward_id: request.providerResult.providerRewardId ?? null,
            reward_result: toJson(response),
            completed_at: new Date().toISOString(),
          })
          .eq("id", log.id)
          .eq("reward_status", "processing"),
      )
    : admin
        .from("ad_reward_logs")
        .update({
          reward_status: "completed",
          provider_reward_id: request.providerResult.providerRewardId ?? null,
          reward_result: toJson(response),
          completed_at: new Date().toISOString(),
        })
        .eq("id", log.id)
        .eq("reward_status", "processing"));

  if (updateError) throw updateError;
  return response;
}
