import "server-only";

import type { User } from "@supabase/supabase-js";
import { DEFAULT_DURABILITY, durabilityLossOnFail, forgeUpgradeCostGold } from "@/data/balance";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateSaleGold } from "@/lib/economy";
import { clampDurability } from "@/lib/enhancement";
import { getCurrentSeasonInfo } from "@/lib/season";
import {
  beginActionLog,
  finishActionLog,
} from "@/lib/server/actionLogService";
import {
  bestWeaponSnapshotFromRecord,
  defaultPlayerRecords,
  defaultWeeklySeasonStats,
  getOwnedWeaponsForSnapshot,
  getPlayerSnapshot,
} from "@/lib/server/playerRepository";
import {
  calculateRankingValue,
  computePendingForgeEmber,
  computeServerScrapRewards,
  getEnhanceCostEmber,
  getEnhanceSuccessRate,
  getTranscendStoneCost,
  getTranscendSuccessRate,
  rowToOwnedWeapon,
} from "@/lib/server/serverGameMath";
import {
  upsertStrongestWeaponRanking,
  upsertWeeklyScore,
  upsertWorldRecord,
} from "@/lib/server/rankingService";
import { rollServerChance, serverRandomUnit } from "@/lib/server/serverRandom";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ServerStepTimer } from "@/lib/server/stepLatency";
import type {
  EnhanceResult,
  OwnedWeapon,
  PlayerRecords,
  WeaponDefinition,
  WeeklySeasonStats,
} from "@/types/game";
import type {
  BuyActionRequest,
  EnhanceActionRequest,
  ForgeCollectActionRequest,
  ForgeUpgradeActionRequest,
  SellActionRequest,
  ServerGameActionResponse,
  TranscendActionRequest,
} from "@/types/server";
import type {
  Json,
  OwnedWeaponRow,
  PlayerRecordRow,
  PlayerStateRow,
  ProfileRow,
} from "@/types/supabase";

const PROFILE_SELECT = "id,nickname,created_at,updated_at";
const PLAYER_STATE_SELECT =
  "id,user_id,gold,forge_ember,transcend_stone,forge_level,forge_last_collected_at,current_season_id,stats,created_at,updated_at";
const PLAYER_RECORD_SELECT =
  "id,user_id,best_weapon_name,best_weapon_id,best_weapon_value,best_weapon_enhance_level,best_weapon_transcend_level,best_sale_gold,total_sales_gold,max_transcend_level,stats,created_at,updated_at";
const OWNED_WEAPON_SELECT =
  "id,user_id,weapon_id,enhance_level,transcend_level,durability,is_locked,created_at,updated_at";

export class GameActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "invalid_request",
  ) {
    super(message);
  }
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function requireActionId(actionId: string | undefined): string {
  const id = actionId?.trim();
  if (!id) throw new GameActionError("actionId is required", 400, "missing_action_id");
  return id;
}

async function getProfile(userId: string): Promise<ProfileRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
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

async function getOwnedWeapon(
  userId: string,
  weaponInstanceId: string,
): Promise<OwnedWeaponRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("owned_weapons")
    .select(OWNED_WEAPON_SELECT)
    .eq("id", weaponInstanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameActionError("Weapon not found", 404, "weapon_not_found");
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

async function updatePlayerState(
  id: string,
  patch: Partial<PlayerStateRow>,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("player_states").update(patch).eq("id", id);
  if (error) throw error;
}

async function updatePlayerRecord(
  id: string,
  patch: Partial<PlayerRecordRow>,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("player_records").update(patch).eq("id", id);
  if (error) throw error;
}

function weeklyStatsJson(stats: WeeklySeasonStats): Json {
  return toJson({ weeklySeasonStats: stats });
}

function currentRecords(record: PlayerRecordRow): PlayerRecords {
  return defaultPlayerRecords(record);
}

function updateBestWeaponRecord(
  record: PlayerRecordRow,
  records: PlayerRecords,
  weapon: OwnedWeaponRow,
): Partial<PlayerRecordRow> {
  const def = WEAPONS_BY_ID[weapon.weapon_id];
  if (!def) return { stats: toJson(records) };
  const owned = rowToOwnedWeapon(weapon);
  const value = calculateRankingValue(def, owned);
  if (value <= Number(record.best_weapon_value ?? 0)) {
    return { stats: toJson(records) };
  }

  return {
    best_weapon_name: def.name,
    best_weapon_id: def.id,
    best_weapon_value: value,
    best_weapon_enhance_level: owned.enhanceLevel,
    best_weapon_transcend_level: owned.transcendLevel,
    max_transcend_level: Math.max(
      Number(record.max_transcend_level ?? 0),
      owned.transcendLevel,
    ),
    stats: toJson({
      ...records,
      personalBestRankingValue: value,
      weeklyBestValue: Math.max(records.weeklyBestValue, value),
      maxEnhanceLevel: Math.max(records.maxEnhanceLevel, owned.enhanceLevel),
      maxTranscendLevel: Math.max(records.maxTranscendLevel, owned.transcendLevel),
    }),
  };
}

function assertCanSellOwnedWeaponCount(count: number) {
  if (count <= 1) {
    throw new GameActionError(
      "Last weapon cannot be sold",
      409,
      "last_weapon_cannot_sell",
    );
  }
}

/** 일반 판매: base → bonus(0) → final → ranking(무기 점수, 광고와 무관) 순으로만 참조 */
function computeNormalSellEconomy(
  def: WeaponDefinition,
  owned: OwnedWeapon,
  record: PlayerRecordRow,
  state: PlayerStateRow,
): {
  baseSaleGold: number;
  bonusGold: number;
  finalGold: number;
  rankingValue: number;
  nextRecords: PlayerRecords;
  weekly: WeeklySeasonStats;
} {
  const baseSaleGold = calculateSaleGold(def, owned);
  const bonusGold = 0;
  const finalGold = baseSaleGold + bonusGold;
  const rankingValue = calculateRankingValue(def, owned);
  const records = currentRecords(record);
  const weekly = {
    ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
  };
  weekly.salesGoldThisSeason += finalGold;
  return {
    baseSaleGold,
    bonusGold,
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
}

async function runLoggedAction(args: {
  user: User;
  actionType: ServerGameActionResponse["actionType"];
  actionId: string;
  payload: unknown;
  timer?: ServerStepTimer;
  run: () => Promise<Omit<ServerGameActionResponse, "status">>;
}): Promise<ServerGameActionResponse> {
  const actionId = requireActionId(args.actionId);
  const begin = await (args.timer
    ? args.timer.time("actionId claim / replay check", () =>
        beginActionLog({
          userId: args.user.id,
          actionType: args.actionType,
          actionId,
          payload: args.payload,
        }),
      )
    : beginActionLog({
        userId: args.user.id,
        actionType: args.actionType,
        actionId,
        payload: args.payload,
      }));

  if (begin.status === "replayed") return begin.response;
  if (begin.status === "conflict") {
    throw new GameActionError(begin.message, 409, "action_conflict");
  }

  const response: ServerGameActionResponse = {
    ...(await args.run()),
    status: "applied",
  };
  await (args.timer
    ? args.timer.time("action_log complete update", () =>
        finishActionLog({ actionId, response }),
      )
    : finishActionLog({ actionId, response }));
  return response;
}

export async function buyWeaponServer(
  user: User,
  payload: BuyActionRequest,
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "buy",
    actionId: payload.actionId,
    payload,
    run: async () => {
      const def = WEAPONS_BY_ID[payload.weaponId];
      if (!def) throw new GameActionError("Unknown weaponId", 404, "weapon_not_found");
      const state = await getPlayerState(user.id);
      if (Number(state.gold) < def.basePrice) {
        throw new GameActionError("Not enough gold", 409, "insufficient_gold");
      }

      const admin = getSupabaseAdminClient();
      const { error: stateError } = await admin
        .from("player_states")
        .update({ gold: Number(state.gold) - def.basePrice })
        .eq("id", state.id);
      if (stateError) throw stateError;

      const { error: weaponError } = await admin.from("owned_weapons").insert({
        user_id: user.id,
        weapon_id: def.id,
        enhance_level: 0,
        transcend_level: 0,
        durability: DEFAULT_DURABILITY,
        is_locked: false,
      });
      if (weaponError) throw weaponError;

      return {
        actionId: payload.actionId,
        actionType: "buy",
        snapshot: await getPlayerSnapshot(user),
        display: { kind: "buy", weaponName: def.name },
      };
    },
  });
}

export async function enhanceWeaponServer(
  user: User,
  payload: EnhanceActionRequest,
  options: { timer?: ServerStepTimer } = {},
): Promise<ServerGameActionResponse> {
  const timer = options.timer;
  return runLoggedAction({
    user,
    actionType: "enhance",
    actionId: payload.actionId,
    payload,
    timer,
    run: async () => {
      const [profile, state, record, weapon] = await Promise.all([
        timer
          ? timer.time("profile 조회", () => getProfile(user.id))
          : getProfile(user.id),
        timer
          ? timer.time("player_state 조회", () => getPlayerState(user.id))
          : getPlayerState(user.id),
        timer
          ? timer.time("player_records 조회", () => getPlayerRecord(user.id))
          : getPlayerRecord(user.id),
        timer
          ? timer.time("owned_weapon 조회", () =>
              getOwnedWeapon(user.id, payload.weaponInstanceId),
            )
          : getOwnedWeapon(user.id, payload.weaponInstanceId),
      ]);
      const def = WEAPONS_BY_ID[weapon.weapon_id];
      if (!def) throw new GameActionError("Weapon definition not found", 404, "weapon_def_not_found");
      const owned = rowToOwnedWeapon(weapon);
      if (owned.enhanceLevel >= 15) throw new GameActionError("Already max enhance", 409, "max_enhance");
      if (owned.durability <= 0) throw new GameActionError("Weapon is destroyed", 409, "destroyed_weapon");

      const calculation = timer
        ? timer.timeSync("비용/확률 계산", () => {
            const targetLevel = owned.enhanceLevel + 1;
            return {
              targetLevel,
              cost: getEnhanceCostEmber(def, targetLevel),
              successRate: getEnhanceSuccessRate(targetLevel),
              records: currentRecords(record),
              weekly: defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
              beforeValue: calculateSaleGold(def, owned),
            };
          })
        : (() => {
            const targetLevel = owned.enhanceLevel + 1;
            return {
              targetLevel,
              cost: getEnhanceCostEmber(def, targetLevel),
              successRate: getEnhanceSuccessRate(targetLevel),
              records: currentRecords(record),
              weekly: defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
              beforeValue: calculateSaleGold(def, owned),
            };
          })();
      const { targetLevel, cost, successRate, records, beforeValue } = calculation;
      let weekly = calculation.weekly;
      if (Number(state.forge_ember) < cost) {
        throw new GameActionError("Not enough forge ember", 409, "insufficient_ember");
      }

      let nextRecords: PlayerRecords = {
        ...records,
        totalEnhanceAttempts: records.totalEnhanceAttempts + 1,
      };
      let result: EnhanceResult;
      let updatedWeapon: OwnedWeaponRow | null = weapon;
      let recordBreak: { previousBest: number; newBest: number } | undefined;
      const nextEmber = Number(state.forge_ember) - cost;
      let nextState: PlayerStateRow = {
        ...state,
        forge_ember: nextEmber,
        stats: weeklyStatsJson(weekly),
      };

      const isSuccess = timer
        ? timer.timeSync("RNG", () => rollServerChance(successRate))
        : rollServerChance(successRate);

      if (isSuccess) {
        const afterOwned = { ...owned, enhanceLevel: targetLevel };
        const afterRanking = calculateRankingValue(def, afterOwned);
        result = {
          type: "success",
          beforeLevel: owned.enhanceLevel,
          afterLevel: targetLevel,
          beforeValue,
          afterValue: calculateSaleGold(def, afterOwned),
        };
        if (afterRanking > records.personalBestRankingValue) {
          recordBreak = {
            previousBest: records.personalBestRankingValue,
            newBest: afterRanking,
          };
        }
        nextRecords = {
          ...nextRecords,
          totalEnhanceSuccesses: nextRecords.totalEnhanceSuccesses + 1,
          personalBestRankingValue: Math.max(
            nextRecords.personalBestRankingValue,
            afterRanking,
          ),
          weeklyBestValue: Math.max(nextRecords.weeklyBestValue, afterRanking),
          maxEnhanceLevel: Math.max(nextRecords.maxEnhanceLevel, targetLevel),
        };
        weekly = {
          ...weekly,
          weeklyStrongestWeaponValue: Math.max(
            weekly.weeklyStrongestWeaponValue,
            afterRanking,
          ),
          weeklyStrongestWeaponName:
            afterRanking >= weekly.weeklyStrongestWeaponValue
              ? def.name
              : weekly.weeklyStrongestWeaponName,
          weeklyStrongestEnhanceLevel:
            afterRanking >= weekly.weeklyStrongestWeaponValue
              ? targetLevel
              : weekly.weeklyStrongestEnhanceLevel,
          weeklyStrongestTranscendLevel:
            afterRanking >= weekly.weeklyStrongestWeaponValue
              ? owned.transcendLevel
              : weekly.weeklyStrongestTranscendLevel,
          enhanceSuccessesThisSeason: weekly.enhanceSuccessesThisSeason + 1,
        };

        const admin = getSupabaseAdminClient();
        const { error } = await (timer
          ? timer.time("owned_weapon update/delete", async () =>
              await admin
                .from("owned_weapons")
                .update({ enhance_level: targetLevel })
                .eq("id", weapon.id),
            )
          : admin
              .from("owned_weapons")
              .update({ enhance_level: targetLevel })
              .eq("id", weapon.id));
        if (error) throw error;
        updatedWeapon = { ...weapon, enhance_level: targetLevel };
        if (afterRanking >= Math.max(records.personalBestRankingValue, weekly.weeklyStrongestWeaponValue)) {
          await (timer
            ? timer.time("weekly_rankings/world_records update", () =>
                upsertStrongestWeaponRanking({
                  userId: user.id,
                  profile,
                  weapon: updatedWeapon as OwnedWeaponRow,
                }),
              )
            : upsertStrongestWeaponRanking({
                userId: user.id,
                profile,
                weapon: updatedWeapon,
              }));
        }
      } else {
        const loseDur = durabilityLossOnFail(targetLevel);
        const nextDurability = loseDur ? owned.durability - 1 : owned.durability;
        if (loseDur && nextDurability <= 0) {
          const scrap = computeServerScrapRewards(def.id, serverRandomUnit);
          result = {
            type: "destroyed",
            level: owned.enhanceLevel,
            scrapRewards: scrap,
            weaponName: def.name,
          };
          nextRecords = {
            ...nextRecords,
            enhanceDestroyedCount: nextRecords.enhanceDestroyedCount + 1,
            destroyedWeaponCount: nextRecords.destroyedWeaponCount + 1,
          };
          const admin = getSupabaseAdminClient();
          const { error } = await (timer
            ? timer.time("owned_weapon update/delete", async () =>
                await admin.from("owned_weapons").delete().eq("id", weapon.id),
              )
            : admin.from("owned_weapons").delete().eq("id", weapon.id));
          if (error) throw error;
          await (timer
            ? timer.time("world_records update", () =>
                upsertWorldRecord({
                  category: "worldRecordDestroyedWeapon",
                  userId: user.id,
                  nickname: profile.nickname,
                  weaponName: def.name,
                  weaponId: def.id,
                  enhanceLevel: owned.enhanceLevel,
                  transcendLevel: owned.transcendLevel,
                  value: calculateRankingValue(def, owned),
                }),
              )
            : upsertWorldRecord({
                category: "worldRecordDestroyedWeapon",
                userId: user.id,
                nickname: profile.nickname,
                weaponName: def.name,
                weaponId: def.id,
                enhanceLevel: owned.enhanceLevel,
                transcendLevel: owned.transcendLevel,
                value: calculateRankingValue(def, owned),
              }));
          updatedWeapon = null;
          nextState = {
            ...state,
            forge_ember: nextEmber + scrap.ember,
            gold: Number(state.gold) + scrap.gold,
            transcend_stone: Number(state.transcend_stone) + scrap.transcendStone,
            stats: weeklyStatsJson(weekly),
          };
          await (timer
            ? timer.time("player_state update", () =>
                updatePlayerState(state.id, {
                  forge_ember: nextState.forge_ember,
                  gold: nextState.gold,
                  transcend_stone: nextState.transcend_stone,
                  stats: nextState.stats,
                }),
              )
            : updatePlayerState(state.id, {
                forge_ember: nextState.forge_ember,
                gold: nextState.gold,
                transcend_stone: nextState.transcend_stone,
                stats: nextState.stats,
              }));
        } else {
          result = {
            type: "fail",
            level: owned.enhanceLevel,
            beforeDurability: owned.durability,
            afterDurability: nextDurability,
            destroyed: false,
          };
          nextRecords = {
            ...nextRecords,
            enhanceFailCount: nextRecords.enhanceFailCount + 1,
          };
          const admin = getSupabaseAdminClient();
          const nextWeaponDurability = clampDurability(nextDurability);
          const { error } = await (timer
            ? timer.time("owned_weapon update/delete", async () =>
                await admin
                  .from("owned_weapons")
                  .update({ durability: nextWeaponDurability })
                  .eq("id", weapon.id),
              )
            : admin
                .from("owned_weapons")
                .update({ durability: nextWeaponDurability })
                .eq("id", weapon.id));
          if (error) throw error;
          updatedWeapon = { ...weapon, durability: nextWeaponDurability };
        }
      }

      if (updatedWeapon) {
        nextState = {
          ...state,
          forge_ember: nextEmber,
          stats: weeklyStatsJson(weekly),
        };
        await (timer
          ? timer.time("player_state update", () =>
              updatePlayerState(state.id, {
                forge_ember: nextState.forge_ember,
                stats: nextState.stats,
              }),
            )
          : updatePlayerState(state.id, {
              forge_ember: nextState.forge_ember,
              stats: nextState.stats,
            }));
      }

      const recordPatch = updatedWeapon
        ? updateBestWeaponRecord(record, nextRecords, updatedWeapon)
        : { stats: toJson(nextRecords) };
      const nextRecord: PlayerRecordRow = { ...record, ...recordPatch };
      await (timer
        ? timer.time("player_records update", () =>
            updatePlayerRecord(record.id, recordPatch),
          )
        : updatePlayerRecord(record.id, recordPatch));

      await (timer
        ? timer.time("ranking counters update", () =>
            Promise.all([
              isSuccess
                ? upsertWeeklyScore({
                    userId: user.id,
                    profile,
                    seasonId: weekly.seasonId,
                    category: "weeklyEnhancementKing",
                    score: nextRecords.totalEnhanceSuccesses,
                  })
                : Promise.resolve(),
              upsertWorldRecord({
                category: "worldRecordEnhanceAttempts",
                userId: user.id,
                nickname: profile.nickname,
                value: nextRecords.totalEnhanceAttempts,
              }),
            ]).then(() => undefined),
          )
        : Promise.all([
            isSuccess
              ? upsertWeeklyScore({
                  userId: user.id,
                  profile,
                  seasonId: weekly.seasonId,
                  category: "weeklyEnhancementKing",
                  score: nextRecords.totalEnhanceSuccesses,
                })
              : Promise.resolve(),
            upsertWorldRecord({
              category: "worldRecordEnhanceAttempts",
              userId: user.id,
              nickname: profile.nickname,
              value: nextRecords.totalEnhanceAttempts,
            }),
          ]).then(() => undefined));

      return {
        actionId: payload.actionId,
        actionType: "enhance",
        patch: timer
          ? timer.timeSync("response result/patch 생성", () => ({
              currentGold: Number(nextState.gold),
              currentEmber: Number(nextState.forge_ember),
              currentStone: Number(nextState.transcend_stone),
              changedWeapon: updatedWeapon ?? undefined,
              removedWeaponId: updatedWeapon ? undefined : weapon.id,
              records: defaultPlayerRecords(nextRecord),
              weeklySeasonStats: defaultWeeklySeasonStats(weekly.seasonId, nextState),
              bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
            }))
          : {
              currentGold: Number(nextState.gold),
              currentEmber: Number(nextState.forge_ember),
              currentStone: Number(nextState.transcend_stone),
              changedWeapon: updatedWeapon ?? undefined,
              removedWeaponId: updatedWeapon ? undefined : weapon.id,
              records: defaultPlayerRecords(nextRecord),
              weeklySeasonStats: defaultWeeklySeasonStats(weekly.seasonId, nextState),
              bestWeaponSnapshot: bestWeaponSnapshotFromRecord(nextRecord),
            },
        display: {
          kind: "enhance",
          weaponName: def.name,
          result,
          recordBreak,
        },
      };
    },
  });
}

export async function transcendWeaponServer(
  user: User,
  payload: TranscendActionRequest,
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "transcend",
    actionId: payload.actionId,
    payload,
    run: async () => {
      const profile = await getProfile(user.id);
      const state = await getPlayerState(user.id);
      const record = await getPlayerRecord(user.id);
      const weapon = await getOwnedWeapon(user.id, payload.weaponInstanceId);
      const def = WEAPONS_BY_ID[weapon.weapon_id];
      if (!def) throw new GameActionError("Weapon definition not found", 404, "weapon_def_not_found");
      const owned = rowToOwnedWeapon(weapon);
      if (owned.enhanceLevel !== 15) throw new GameActionError("Only +15 weapons can transcend", 409, "not_eligible");
      if (owned.transcendLevel >= 10) throw new GameActionError("Already max transcend", 409, "max_transcend");
      if (owned.durability <= 0) throw new GameActionError("Weapon is destroyed", 409, "destroyed_weapon");

      const stoneCost = getTranscendStoneCost(owned.transcendLevel);
      if (Number(state.transcend_stone) < stoneCost) {
        throw new GameActionError("Not enough transcend stone", 409, "insufficient_stone");
      }

      const records = currentRecords(record);
      let nextRecords: PlayerRecords = {
        ...records,
        transcendAttemptCount: records.transcendAttemptCount + 1,
      };
      let weekly = defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state);
      const beforeRankingValue = calculateRankingValue(def, owned);
      const beforeSaleGold = calculateSaleGold(def, owned);
      const nextStone = Number(state.transcend_stone) - stoneCost;
      let displayResult;
      let updatedWeapon: OwnedWeaponRow | null = weapon;
      let recordBreak: { previousBest: number; newBest: number } | undefined;

      if (rollServerChance(getTranscendSuccessRate(owned.transcendLevel))) {
        const afterTranscend = owned.transcendLevel + 1;
        const afterOwned = { ...owned, transcendLevel: afterTranscend };
        const afterRankingValue = calculateRankingValue(def, afterOwned);
        displayResult = {
          type: "success" as const,
          beforeTranscend: owned.transcendLevel,
          afterTranscend,
          beforeRankingValue,
          afterRankingValue,
          beforeSaleGold,
          afterSaleGold: calculateSaleGold(def, afterOwned),
        };
        if (afterRankingValue > records.personalBestRankingValue) {
          recordBreak = {
            previousBest: records.personalBestRankingValue,
            newBest: afterRankingValue,
          };
        }
        nextRecords = {
          ...nextRecords,
          transcendSuccessCount: nextRecords.transcendSuccessCount + 1,
          maxTranscendLevel: Math.max(nextRecords.maxTranscendLevel, afterTranscend),
          bestTranscendedWeaponValue: Math.max(
            nextRecords.bestTranscendedWeaponValue,
            afterRankingValue,
          ),
          personalBestRankingValue: Math.max(
            nextRecords.personalBestRankingValue,
            afterRankingValue,
          ),
          weeklyBestValue: Math.max(nextRecords.weeklyBestValue, afterRankingValue),
        };
        weekly = {
          ...weekly,
          weeklyStrongestWeaponValue: Math.max(
            weekly.weeklyStrongestWeaponValue,
            afterRankingValue,
          ),
          weeklyStrongestWeaponName:
            afterRankingValue >= weekly.weeklyStrongestWeaponValue
              ? def.name
              : weekly.weeklyStrongestWeaponName,
          weeklyStrongestEnhanceLevel:
            afterRankingValue >= weekly.weeklyStrongestWeaponValue
              ? owned.enhanceLevel
              : weekly.weeklyStrongestEnhanceLevel,
          weeklyStrongestTranscendLevel:
            afterRankingValue >= weekly.weeklyStrongestWeaponValue
              ? afterTranscend
              : weekly.weeklyStrongestTranscendLevel,
          transcendSuccessesThisSeason: weekly.transcendSuccessesThisSeason + 1,
        };
        const admin = getSupabaseAdminClient();
        const { data, error } = await admin
          .from("owned_weapons")
          .update({ transcend_level: afterTranscend })
          .eq("id", weapon.id)
          .select("*")
          .single();
        if (error) throw error;
        updatedWeapon = data;
        await upsertStrongestWeaponRanking({ userId: user.id, profile, weapon: data });
      } else {
        const nextDurability = owned.durability - 1;
        if (nextDurability <= 0) {
          const scrap = computeServerScrapRewards(def.id, serverRandomUnit);
          displayResult = {
            type: "destroyed" as const,
            transcendLevel: owned.transcendLevel,
            enhanceLevel: owned.enhanceLevel,
            scrapRewards: scrap,
            weaponName: def.name,
            stoneCost,
          };
          nextRecords = {
            ...nextRecords,
            transcendFailCount: nextRecords.transcendFailCount + 1,
            transcendDestroyedCount: nextRecords.transcendDestroyedCount + 1,
            destroyedWeaponCount: nextRecords.destroyedWeaponCount + 1,
          };
          const admin = getSupabaseAdminClient();
          const { error } = await admin.from("owned_weapons").delete().eq("id", weapon.id);
          if (error) throw error;
          await upsertWorldRecord({
            category: "worldRecordDestroyedWeapon",
            userId: user.id,
            nickname: profile.nickname,
            weaponName: def.name,
            weaponId: def.id,
            enhanceLevel: owned.enhanceLevel,
            transcendLevel: owned.transcendLevel,
            value: beforeRankingValue,
          });
          updatedWeapon = null;
          await updatePlayerState(state.id, {
            transcend_stone: nextStone + scrap.transcendStone,
            forge_ember: Number(state.forge_ember) + scrap.ember,
            gold: Number(state.gold) + scrap.gold,
            stats: weeklyStatsJson(weekly),
          });
        } else {
          displayResult = {
            type: "fail" as const,
            transcendLevel: owned.transcendLevel,
            beforeDurability: owned.durability,
            afterDurability: nextDurability,
            stoneCost,
          };
          nextRecords = {
            ...nextRecords,
            transcendFailCount: nextRecords.transcendFailCount + 1,
          };
          const admin = getSupabaseAdminClient();
          const { data, error } = await admin
            .from("owned_weapons")
            .update({ durability: clampDurability(nextDurability) })
            .eq("id", weapon.id)
            .select("*")
            .single();
          if (error) throw error;
          updatedWeapon = data;
        }
      }

      if (updatedWeapon) {
        await updatePlayerState(state.id, {
          transcend_stone: nextStone,
          stats: weeklyStatsJson(weekly),
        });
      }

      const recordPatch = updatedWeapon
        ? updateBestWeaponRecord(record, nextRecords, updatedWeapon)
        : { stats: toJson(nextRecords) };
      await updatePlayerRecord(record.id, recordPatch);
      await upsertWeeklyScore({
        userId: user.id,
        profile,
        seasonId: weekly.seasonId,
        category: "weeklyTranscendKing",
        score: nextRecords.transcendSuccessCount,
      });
      await upsertWorldRecord({
        category: "worldRecordTranscendSuccesses",
        userId: user.id,
        nickname: profile.nickname,
        value: nextRecords.transcendSuccessCount,
      });
      if (updatedWeapon) {
        const updatedOwned = rowToOwnedWeapon(updatedWeapon);
        await upsertWorldRecord({
          category: "worldRecordTranscend",
          userId: user.id,
          nickname: profile.nickname,
          weaponName: def.name,
          weaponId: def.id,
          enhanceLevel: updatedOwned.enhanceLevel,
          transcendLevel: updatedOwned.transcendLevel,
          value: calculateRankingValue(def, updatedOwned),
        });
      }

      return {
        actionId: payload.actionId,
        actionType: "transcend",
        snapshot: await getPlayerSnapshot(user),
        display: {
          kind: "transcend",
          weaponName: def.name,
          weaponImagePath: def.imagePath,
          result: displayResult,
          recordBreak,
        },
      };
    },
  });
}

export async function sellWeaponServer(
  user: User,
  payload: SellActionRequest,
  options: { timer?: ServerStepTimer } = {},
): Promise<ServerGameActionResponse> {
  const timer = options.timer;
  return runLoggedAction({
    user,
    actionType: "sell",
    actionId: payload.actionId,
    payload,
    timer,
    run: async () => {
      const [state, record, weapon, ownedWeaponCount] = await Promise.all([
        timer
          ? timer.time("player_state lookup", () => getPlayerState(user.id))
          : getPlayerState(user.id),
        timer
          ? timer.time("player_records lookup", () => getPlayerRecord(user.id))
          : getPlayerRecord(user.id),
        timer
          ? timer.time("owned_weapon lookup", () =>
              getOwnedWeapon(user.id, payload.weaponInstanceId),
            )
          : getOwnedWeapon(user.id, payload.weaponInstanceId),
        timer
          ? timer.time("owned weapon count lookup", () =>
              countOwnedWeapons(user.id),
            )
          : countOwnedWeapons(user.id),
      ]);

      if (timer) {
        timer.timeSync("last weapon validation", () =>
          assertCanSellOwnedWeaponCount(ownedWeaponCount),
        );
      } else {
        assertCanSellOwnedWeaponCount(ownedWeaponCount);
      }

      const def = WEAPONS_BY_ID[weapon.weapon_id];
      if (!def) {
        throw new GameActionError(
          "Weapon definition not found",
          404,
          "weapon_def_not_found",
        );
      }
      const owned = rowToOwnedWeapon(weapon);
      if (owned.locked) {
        throw new GameActionError(
          "Locked weapon cannot be sold",
          409,
          "locked_weapon",
        );
      }
      if (owned.durability <= 0) {
        throw new GameActionError(
          "Destroyed weapon cannot be sold",
          409,
          "destroyed_weapon",
        );
      }

      const usedAdBonus =
        payload.sellMode === "adBonus" || payload.adBonusRequested === true;
      if (usedAdBonus) {
        throw new GameActionError(
          "Ad bonus sale must use the ad reward flow",
          400,
          "ad_reward_required",
        );
      }

      const calculation = timer
        ? timer.timeSync("sale price calculation", () =>
            computeNormalSellEconomy(def, owned, record, state),
          )
        : computeNormalSellEconomy(def, owned, record, state);
      const { baseSaleGold, bonusGold, finalGold, rankingValue, nextRecords, weekly } =
        calculation;

      const nextState: PlayerStateRow = {
        ...state,
        gold: Number(state.gold) + finalGold,
        stats: weeklyStatsJson(weekly),
      };
      const recordPatch = {
        ...updateBestWeaponRecord(record, nextRecords, weapon),
        best_sale_gold: Math.max(Number(record.best_sale_gold ?? 0), finalGold),
        total_sales_gold: Number(record.total_sales_gold ?? 0) + finalGold,
      };

      const admin = getSupabaseAdminClient();
      await (timer
        ? timer.time("gold/weapon/record update", async () => {
            const results = await Promise.all([
              admin
                .from("player_states")
                .update({
                  gold: nextState.gold,
                  stats: nextState.stats,
                })
                .eq("id", state.id),
              admin.from("owned_weapons").delete().eq("id", weapon.id),
              admin.from("player_records").update(recordPatch).eq("id", record.id),
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
            admin.from("owned_weapons").delete().eq("id", weapon.id),
            admin.from("player_records").update(recordPatch).eq("id", record.id),
          ]).then((results) => {
            for (const result of results) {
              if (result.error) throw result.error;
            }
          }));

      const shouldCheckWorldSale = timer
        ? timer.timeSync(
            "ranking/world record update need check",
            () => baseSaleGold > Number(record.best_sale_gold ?? 0),
          )
        : baseSaleGold > Number(record.best_sale_gold ?? 0);
      const profile = await (timer
        ? timer.time("profile lookup for rankings", () => getProfile(user.id))
        : getProfile(user.id));
      await (timer
        ? timer.time("ranking/world record update", () =>
            Promise.all([
              upsertWeeklyScore({
                userId: user.id,
                profile,
                seasonId: weekly.seasonId,
                category: "weeklySalesKing",
                score: weekly.salesGoldThisSeason,
              }),
              shouldCheckWorldSale
                ? upsertWorldRecord({
                    category: "worldRecordSale",
                    userId: user.id,
                    nickname: profile.nickname,
                    weaponName: def.name,
                    weaponId: def.id,
                    enhanceLevel: owned.enhanceLevel,
                    transcendLevel: owned.transcendLevel,
                    value: baseSaleGold,
                  })
                : Promise.resolve(),
            ]).then(() => undefined),
          )
        : Promise.all([
            upsertWeeklyScore({
              userId: user.id,
              profile,
              seasonId: weekly.seasonId,
              category: "weeklySalesKing",
              score: weekly.salesGoldThisSeason,
            }),
            shouldCheckWorldSale
              ? upsertWorldRecord({
                  category: "worldRecordSale",
                  userId: user.id,
                  nickname: profile.nickname,
                  weaponName: def.name,
                  weaponId: def.id,
                  enhanceLevel: owned.enhanceLevel,
                  transcendLevel: owned.transcendLevel,
                  value: baseSaleGold,
                })
              : Promise.resolve(),
          ]).then(() => undefined));

      return {
        actionId: payload.actionId,
        actionType: "sell",
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
          info: {
            saleType: "normal",
            soldWeaponId: weapon.id,
            weaponId: def.id,
            weaponName: def.name,
            enhanceLevel: owned.enhanceLevel,
            transcendLevel: owned.transcendLevel,
            baseSaleGold,
            bonusGold,
            finalSaleGold: finalGold,
            rankingValue,
            usedAdBonus,
            wasEquipped: false,
          },
        },
      };
    },
  });
}

// Retained temporarily as a parity reference while the optimized sell path is validated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function sellWeaponServerLegacy(
  user: User,
  payload: SellActionRequest,
  options: { timer?: ServerStepTimer } = {},
): Promise<ServerGameActionResponse> {
  const timer = options.timer;
  return runLoggedAction({
    user,
    actionType: "sell",
    actionId: payload.actionId,
    payload,
    timer,
    run: async () => {
      const [profile, state, record, weapon, ownedWeaponsBefore] = await Promise.all([
        timer
          ? timer.time("profile 조회", () => getProfile(user.id))
          : getProfile(user.id),
        timer
          ? timer.time("player_state 조회", () => getPlayerState(user.id))
          : getPlayerState(user.id),
        timer
          ? timer.time("player_records 조회", () => getPlayerRecord(user.id))
          : getPlayerRecord(user.id),
        timer
          ? timer.time("owned_weapon 조회", () =>
              getOwnedWeapon(user.id, payload.weaponInstanceId),
            )
          : getOwnedWeapon(user.id, payload.weaponInstanceId),
        timer
          ? timer.time("마지막 무기 여부 확인", () =>
              getOwnedWeaponsForSnapshot(user.id),
            )
          : getOwnedWeaponsForSnapshot(user.id),
      ]);
      assertCanSellOwnedWeaponCount(ownedWeaponsBefore.length);
      const def = WEAPONS_BY_ID[weapon.weapon_id];
      if (!def) throw new GameActionError("Weapon definition not found", 404, "weapon_def_not_found");
      const owned = rowToOwnedWeapon(weapon);
      if (owned.locked) throw new GameActionError("Locked weapon cannot be sold", 409, "locked_weapon");
      if (owned.durability <= 0) throw new GameActionError("Destroyed weapon cannot be sold", 409, "destroyed_weapon");

      const usedAdBonus =
        payload.sellMode === "adBonus" || payload.adBonusRequested === true;
      if (usedAdBonus) {
        throw new GameActionError(
          "Ad bonus sale must use the ad reward flow",
          400,
          "ad_reward_required",
        );
      }
      const calculation = timer
        ? timer.timeSync("판매가 계산", () =>
            computeNormalSellEconomy(def, owned, record, state),
          )
        : computeNormalSellEconomy(def, owned, record, state);
      const { baseSaleGold, bonusGold, finalGold, rankingValue, nextRecords, weekly } =
        calculation;

      const admin = getSupabaseAdminClient();
      const { error: deleteError } = await (timer
        ? timer.time("owned_weapon delete", async () =>
            await admin.from("owned_weapons").delete().eq("id", weapon.id),
          )
        : admin.from("owned_weapons").delete().eq("id", weapon.id));
      if (deleteError) throw deleteError;
      const nextState: PlayerStateRow = {
        ...state,
        gold: Number(state.gold) + finalGold,
        stats: weeklyStatsJson(weekly),
      };
      await (timer
        ? timer.time("player_state gold update", () =>
            updatePlayerState(state.id, {
              gold: nextState.gold,
              stats: nextState.stats,
            }),
          )
        : updatePlayerState(state.id, {
            gold: nextState.gold,
            stats: nextState.stats,
          }));
      const recordPatch = {
        ...updateBestWeaponRecord(record, nextRecords, weapon),
        best_sale_gold: Math.max(Number(record.best_sale_gold ?? 0), finalGold),
        total_sales_gold: Number(record.total_sales_gold ?? 0) + finalGold,
      };
      const nextRecord: PlayerRecordRow = { ...record, ...recordPatch };
      await (timer
        ? timer.time("player_records update", () =>
            updatePlayerRecord(record.id, recordPatch),
          )
        : updatePlayerRecord(record.id, recordPatch));
      await (timer
        ? timer.time("ranking/world record update", () =>
            Promise.all([
              upsertWeeklyScore({
                userId: user.id,
                profile,
                seasonId: weekly.seasonId,
                category: "weeklySalesKing",
                score: weekly.salesGoldThisSeason,
              }),
              upsertWorldRecord({
                category: "worldRecordSale",
                userId: user.id,
                nickname: profile.nickname,
                weaponName: def.name,
                weaponId: def.id,
                enhanceLevel: owned.enhanceLevel,
                transcendLevel: owned.transcendLevel,
                value: baseSaleGold,
              }),
            ]).then(() => undefined),
          )
        : Promise.all([
            upsertWeeklyScore({
              userId: user.id,
              profile,
              seasonId: weekly.seasonId,
              category: "weeklySalesKing",
              score: weekly.salesGoldThisSeason,
            }),
            upsertWorldRecord({
              category: "worldRecordSale",
              userId: user.id,
              nickname: profile.nickname,
              weaponName: def.name,
              weaponId: def.id,
              enhanceLevel: owned.enhanceLevel,
              transcendLevel: owned.transcendLevel,
              value: baseSaleGold,
            }),
          ]).then(() => undefined));
      return {
        actionId: payload.actionId,
        actionType: "sell",
        patch: timer
          ? timer.timeSync("response result/patch 생성", () => ({
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
          info: {
            saleType: "normal",
            soldWeaponId: weapon.id,
            weaponId: def.id,
            weaponName: def.name,
            enhanceLevel: owned.enhanceLevel,
            transcendLevel: owned.transcendLevel,
            baseSaleGold,
            bonusGold,
            finalSaleGold: finalGold,
            rankingValue,
            usedAdBonus,
            wasEquipped: false,
          },
        },
      };
    },
  });
}

export async function collectForgeServer(
  user: User,
  payload: ForgeCollectActionRequest,
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "forge_collect",
    actionId: payload.actionId,
    payload,
    run: async () => {
      const state = await getPlayerState(user.id);
      const record = await getPlayerRecord(user.id);
      const now = Date.now();
      const last = new Date(state.forge_last_collected_at).getTime();
      const pending = computePendingForgeEmber({
        forgeLevel: Number(state.forge_level),
        forgeLastCollectAt: last,
        now,
      });
      if (pending <= 0) {
        throw new GameActionError("No forge reward to collect", 409, "no_forge_reward");
      }
      const usedAd =
        payload.collectMode === "adBonus" || payload.adBonusRequested === true;
      const gained = usedAd ? pending * 2 : pending;
      const bonusAmount = usedAd ? pending : 0;
      const records = currentRecords(record);
      const nextRecords: PlayerRecords = {
        ...records,
        totalForgeCollected: records.totalForgeCollected + gained,
        totalForgeAdBonusCollected:
          records.totalForgeAdBonusCollected + bonusAmount,
        forgeCollectCount: records.forgeCollectCount + 1,
        forgeAdCollectCount: usedAd
          ? records.forgeAdCollectCount + 1
          : records.forgeAdCollectCount,
      };

      await updatePlayerState(state.id, {
        forge_ember: Number(state.forge_ember) + gained,
        forge_last_collected_at: new Date(now).toISOString(),
      });
      await updatePlayerRecord(record.id, { stats: toJson(nextRecords) });

      return {
        actionId: payload.actionId,
        actionType: "forge_collect",
        snapshot: await getPlayerSnapshot(user),
        display: {
          kind: "forgeCollect",
          gained,
          basePending: pending,
          usedAd,
          bonusAmount,
        },
      };
    },
  });
}

export async function upgradeForgeServer(
  user: User,
  payload: ForgeUpgradeActionRequest,
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "forge_upgrade",
    actionId: payload.actionId,
    payload,
    run: async () => {
      const state = await getPlayerState(user.id);
      const currentLevel = Number(state.forge_level);
      if (currentLevel >= 10) {
        throw new GameActionError("Forge is already max level", 409, "max_forge_level");
      }

      const costGold = forgeUpgradeCostGold(currentLevel);
      if (Number(state.gold) < costGold) {
        throw new GameActionError("Not enough gold", 409, "insufficient_gold");
      }

      const newLevel = currentLevel + 1;
      await updatePlayerState(state.id, {
        gold: Number(state.gold) - costGold,
        forge_level: newLevel,
      });

      return {
        actionId: payload.actionId,
        actionType: "forge_upgrade",
        snapshot: await getPlayerSnapshot(user),
        display: {
          kind: "forgeUpgrade",
          previousLevel: currentLevel,
          newLevel,
          costGold,
        },
      };
    },
  });
}

export async function submitRankingCandidateServer(
  user: User,
  payload: { actionId: string; weaponInstanceId: string; seasonId: string },
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "ranking_submit",
    actionId: payload.actionId,
    payload,
    run: async () => {
      const profile = await getProfile(user.id);
      const weapon = await getOwnedWeapon(user.id, payload.weaponInstanceId);
      const value = await upsertStrongestWeaponRanking({
        userId: user.id,
        profile,
        weapon,
      });

      return {
        actionId: payload.actionId,
        actionType: "ranking_submit",
        snapshot: await getPlayerSnapshot(user),
        display: undefined,
        submittedRankingValue: value,
      } as Omit<ServerGameActionResponse, "status">;
    },
  });
}
