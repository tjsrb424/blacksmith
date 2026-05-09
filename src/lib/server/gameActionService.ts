import "server-only";

import type { User } from "@supabase/supabase-js";
import { DEFAULT_DURABILITY, durabilityLossOnFail } from "@/data/balance";
import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateAdSaleGold, calculateSaleGold } from "@/lib/economy";
import { clampDurability } from "@/lib/enhancement";
import { getCurrentSeasonInfo } from "@/lib/season";
import {
  beginActionLog,
  finishActionLog,
} from "@/lib/server/actionLogService";
import {
  defaultPlayerRecords,
  defaultWeeklySeasonStats,
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
import type { EnhanceResult, PlayerRecords, WeeklySeasonStats } from "@/types/game";
import type {
  BuyActionRequest,
  EnhanceActionRequest,
  ForgeCollectActionRequest,
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
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerState(userId: string): Promise<PlayerStateRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_states")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerRecord(userId: string): Promise<PlayerRecordRow> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_records")
    .select("*")
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
    .select("*")
    .eq("id", weaponInstanceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameActionError("Weapon not found", 404, "weapon_not_found");
  if (data.user_id !== userId) {
    throw new GameActionError("Weapon does not belong to the current user", 403, "forbidden");
  }
  return data;
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

async function runLoggedAction(args: {
  user: User;
  actionType: ServerGameActionResponse["actionType"];
  actionId: string;
  payload: unknown;
  run: () => Promise<Omit<ServerGameActionResponse, "status">>;
}): Promise<ServerGameActionResponse> {
  const actionId = requireActionId(args.actionId);
  const begin = await beginActionLog({
    userId: args.user.id,
    actionType: args.actionType,
    actionId,
    payload: args.payload,
  });

  if (begin.status === "replayed") return begin.response;
  if (begin.status === "conflict") {
    throw new GameActionError(begin.message, 409, "action_conflict");
  }

  const response: ServerGameActionResponse = {
    ...(await args.run()),
    status: "applied",
  };
  await finishActionLog({ actionId, response });
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
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "enhance",
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
      if (owned.enhanceLevel >= 15) throw new GameActionError("Already max enhance", 409, "max_enhance");
      if (owned.durability <= 0) throw new GameActionError("Weapon is destroyed", 409, "destroyed_weapon");

      const targetLevel = owned.enhanceLevel + 1;
      const cost = getEnhanceCostEmber(def, targetLevel);
      if (Number(state.forge_ember) < cost) {
        throw new GameActionError("Not enough forge ember", 409, "insufficient_ember");
      }

      const records = currentRecords(record);
      let nextRecords: PlayerRecords = {
        ...records,
        totalEnhanceAttempts: records.totalEnhanceAttempts + 1,
      };
      let weekly = defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state);
      const beforeValue = calculateSaleGold(def, owned);
      let result: EnhanceResult;
      let updatedWeapon: OwnedWeaponRow | null = weapon;
      let recordBreak: { previousBest: number; newBest: number } | undefined;
      const nextEmber = Number(state.forge_ember) - cost;

      if (rollServerChance(getEnhanceSuccessRate(targetLevel))) {
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
        const { data, error } = await admin
          .from("owned_weapons")
          .update({ enhance_level: targetLevel })
          .eq("id", weapon.id)
          .select("*")
          .single();
        if (error) throw error;
        updatedWeapon = data;
        await upsertStrongestWeaponRanking({ userId: user.id, profile, weapon: data });
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
          const { error } = await admin.from("owned_weapons").delete().eq("id", weapon.id);
          if (error) throw error;
          updatedWeapon = null;
          await updatePlayerState(state.id, {
            forge_ember: nextEmber + scrap.ember,
            gold: Number(state.gold) + scrap.gold,
            transcend_stone: Number(state.transcend_stone) + scrap.transcendStone,
            stats: weeklyStatsJson(weekly),
          });
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
          forge_ember: nextEmber,
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
        category: "weeklyEnhancementKing",
        score: nextRecords.totalEnhanceSuccesses,
      });

      return {
        actionId: payload.actionId,
        actionType: "enhance",
        snapshot: await getPlayerSnapshot(user),
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
): Promise<ServerGameActionResponse> {
  return runLoggedAction({
    user,
    actionType: "sell",
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
      if (owned.locked) throw new GameActionError("Locked weapon cannot be sold", 409, "locked_weapon");
      if (owned.durability <= 0) throw new GameActionError("Destroyed weapon cannot be sold", 409, "destroyed_weapon");

      const saleGold = calculateSaleGold(def, owned);
      const usedAdBonus =
        payload.sellMode === "adBonus" || payload.adBonusRequested === true;
      const finalGold = usedAdBonus ? calculateAdSaleGold(saleGold) : saleGold;
      const rankingValue = calculateRankingValue(def, owned);
      const records = currentRecords(record);
      const nextRecords: PlayerRecords = {
        ...records,
        totalSalesGold: records.totalSalesGold + finalGold,
        bestSaleGold: Math.max(records.bestSaleGold, finalGold),
        soldWeaponCount: records.soldWeaponCount + 1,
      };
      const weekly = {
        ...defaultWeeklySeasonStats(getCurrentSeasonInfo().seasonId, state),
      };
      weekly.salesGoldThisSeason += finalGold;

      const admin = getSupabaseAdminClient();
      const { error: deleteError } = await admin
        .from("owned_weapons")
        .delete()
        .eq("id", weapon.id);
      if (deleteError) throw deleteError;
      await updatePlayerState(state.id, {
        gold: Number(state.gold) + finalGold,
        stats: weeklyStatsJson(weekly),
      });
      await updatePlayerRecord(record.id, {
        ...updateBestWeaponRecord(record, nextRecords, weapon),
        best_sale_gold: Math.max(Number(record.best_sale_gold ?? 0), finalGold),
        total_sales_gold: Number(record.total_sales_gold ?? 0) + finalGold,
      });
      await upsertWeeklyScore({
        userId: user.id,
        profile,
        seasonId: weekly.seasonId,
        category: "weeklySalesKing",
        score: weekly.salesGoldThisSeason,
      });
      await upsertWorldRecord({
        category: "worldRecordSale",
        userId: user.id,
        nickname: profile.nickname,
        weaponName: def.name,
        weaponId: def.id,
        enhanceLevel: owned.enhanceLevel,
        transcendLevel: owned.transcendLevel,
        value: finalGold,
      });

      return {
        actionId: payload.actionId,
        actionType: "sell",
        snapshot: await getPlayerSnapshot(user),
        display: {
          kind: "sell",
          rankingValue,
          info: {
            weaponName: def.name,
            enhanceLevel: owned.enhanceLevel,
            transcendLevel: owned.transcendLevel,
            baseSaleGold: saleGold,
            finalSaleGold: finalGold,
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
