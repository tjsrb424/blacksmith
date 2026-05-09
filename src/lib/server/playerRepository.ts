import "server-only";

import type { User } from "@supabase/supabase-js";
import {
  DEFAULT_DURABILITY,
  FORGE_START_LEVEL,
  INITIAL_EMBER,
  INITIAL_GOLD,
  INITIAL_TRANSCEND_STONE,
} from "@/data/balance";
import { STARTER_WEAPON_ID } from "@/data/weapons";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSeasonInfo } from "@/lib/season";
import type {
  BestWeaponSnapshot,
  PlayerRecords,
  WeeklySeasonStats,
} from "@/types/game";
import type {
  BetaPlayerSnapshot,
  NicknameUpdateResponse,
} from "@/types/server";
import type {
  OwnedWeaponRow,
  PlayerRecordRow,
  PlayerStateRow,
  ProfileRow,
} from "@/types/supabase";

export function defaultPlayerRecords(record?: PlayerRecordRow | null): PlayerRecords {
  const stats =
    record?.stats && typeof record.stats === "object" && !Array.isArray(record.stats)
      ? (record.stats as Partial<PlayerRecords>)
      : {};
  return {
    weeklyBestValue: Number(record?.best_weapon_value ?? 0),
    totalEnhanceAttempts: Number(stats.totalEnhanceAttempts ?? 0),
    totalEnhanceSuccesses: Number(stats.totalEnhanceSuccesses ?? 0),
    totalSalesGold: Number(record?.total_sales_gold ?? 0),
    bestSaleGold: Number(record?.best_sale_gold ?? 0),
    soldWeaponCount: Number(stats.soldWeaponCount ?? 0),
    totalForgeCollected: Number(stats.totalForgeCollected ?? 0),
    totalForgeAdBonusCollected: Number(stats.totalForgeAdBonusCollected ?? 0),
    forgeCollectCount: Number(stats.forgeCollectCount ?? 0),
    forgeAdCollectCount: Number(stats.forgeAdCollectCount ?? 0),
    personalBestRankingValue: Number(record?.best_weapon_value ?? 0),
    transcendAttemptCount: Number(stats.transcendAttemptCount ?? 0),
    transcendSuccessCount: Number(stats.transcendSuccessCount ?? 0),
    transcendFailCount: Number(stats.transcendFailCount ?? 0),
    maxTranscendLevel: Number(record?.max_transcend_level ?? 0),
    bestTranscendedWeaponValue: Number(stats.bestTranscendedWeaponValue ?? 0),
    transcendDestroyedCount: Number(stats.transcendDestroyedCount ?? 0),
    enhanceFailCount: Number(stats.enhanceFailCount ?? 0),
    enhanceDestroyedCount: Number(stats.enhanceDestroyedCount ?? 0),
    destroyedWeaponCount: Number(stats.destroyedWeaponCount ?? 0),
    maxEnhanceLevel: Number(record?.best_weapon_enhance_level ?? 0),
  };
}

export function defaultWeeklySeasonStats(
  seasonId: string,
  playerState?: PlayerStateRow | null,
): WeeklySeasonStats {
  const stats =
    playerState?.stats &&
    typeof playerState.stats === "object" &&
    !Array.isArray(playerState.stats)
      ? (playerState.stats as { weeklySeasonStats?: Partial<WeeklySeasonStats> })
      : {};
  const saved = stats.weeklySeasonStats;
  return {
    seasonId,
    weeklyStrongestWeaponValue:
      saved?.seasonId === seasonId ? Number(saved.weeklyStrongestWeaponValue ?? 0) : 0,
    weeklyStrongestWeaponName:
      saved?.seasonId === seasonId ? String(saved.weeklyStrongestWeaponName ?? "") : "",
    weeklyStrongestEnhanceLevel:
      saved?.seasonId === seasonId ? Number(saved.weeklyStrongestEnhanceLevel ?? 0) : 0,
    weeklyStrongestTranscendLevel:
      saved?.seasonId === seasonId ? Number(saved.weeklyStrongestTranscendLevel ?? 0) : 0,
    enhanceSuccessesThisSeason:
      saved?.seasonId === seasonId ? Number(saved.enhanceSuccessesThisSeason ?? 0) : 0,
    transcendSuccessesThisSeason:
      saved?.seasonId === seasonId ? Number(saved.transcendSuccessesThisSeason ?? 0) : 0,
    salesGoldThisSeason:
      saved?.seasonId === seasonId ? Number(saved.salesGoldThisSeason ?? 0) : 0,
  };
}

function bestWeaponSnapshotFromRecord(
  record: PlayerRecordRow,
): BestWeaponSnapshot | null {
  if (!record.best_weapon_id || !record.best_weapon_name) return null;
  if (Number(record.best_weapon_value) <= 0) return null;

  return {
    weaponId: record.best_weapon_id,
    weaponName: record.best_weapon_name,
    enhanceLevel: Number(record.best_weapon_enhance_level),
    transcendLevel: Number(record.best_weapon_transcend_level),
    durability: DEFAULT_DURABILITY,
    rankingValue: Number(record.best_weapon_value),
    achievedAt: new Date(record.updated_at).getTime(),
  };
}

async function ensureProfile(user: User): Promise<ProfileRow> {
  const admin = getSupabaseAdminClient();
  const { data: existing, error: selectError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await admin
    .from("profiles")
    .insert({ id: user.id, nickname: null })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function ensurePlayerState(user: User): Promise<PlayerStateRow> {
  const admin = getSupabaseAdminClient();
  const season = getCurrentSeasonInfo();
  const now = new Date().toISOString();
  const { data: existing, error: selectError } = await admin
    .from("player_states")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await admin
    .from("player_states")
    .insert({
      user_id: user.id,
      gold: INITIAL_GOLD,
      forge_ember: INITIAL_EMBER,
      transcend_stone: INITIAL_TRANSCEND_STONE,
      forge_level: FORGE_START_LEVEL,
      forge_last_collected_at: now,
      current_season_id: season.seasonId,
      stats: {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function ensureOwnedWeapons(user: User): Promise<OwnedWeaponRow[]> {
  const admin = getSupabaseAdminClient();
  const { data: existing, error: selectError } = await admin
    .from("owned_weapons")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (selectError) throw selectError;
  if (existing && existing.length > 0) return existing;

  const { data, error } = await admin
    .from("owned_weapons")
    .insert({
      user_id: user.id,
      weapon_id: STARTER_WEAPON_ID,
      enhance_level: 0,
      transcend_level: 0,
      durability: DEFAULT_DURABILITY,
      is_locked: false,
    })
    .select("*");

  if (error) throw error;
  return data ?? [];
}

async function ensurePlayerRecord(user: User): Promise<PlayerRecordRow> {
  const admin = getSupabaseAdminClient();
  const { data: existing, error: selectError } = await admin
    .from("player_records")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await admin
    .from("player_records")
    .insert({
      user_id: user.id,
      best_weapon_name: null,
      best_weapon_id: null,
      best_weapon_value: 0,
      best_weapon_enhance_level: 0,
      best_weapon_transcend_level: 0,
      best_sale_gold: 0,
      total_sales_gold: 0,
      max_transcend_level: 0,
      stats: {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

function snapshotForUser(params: {
  user: User;
  profile: ProfileRow;
  playerState: PlayerStateRow;
  ownedWeapons: OwnedWeaponRow[];
  playerRecord: PlayerRecordRow;
}): BetaPlayerSnapshot {
  const season = getCurrentSeasonInfo();

  return {
    userId: params.user.id,
    email: params.user.email ?? null,
    profile: params.profile,
    playerState: params.playerState,
    ownedWeapons: params.ownedWeapons,
    playerRecord: params.playerRecord,
    records: defaultPlayerRecords(params.playerRecord),
    weeklySeasonStats: defaultWeeklySeasonStats(
      season.seasonId,
      params.playerState,
    ),
    bestWeaponSnapshot: bestWeaponSnapshotFromRecord(params.playerRecord),
    serverTime: new Date().toISOString(),
    currentSeason: {
      seasonId: season.seasonId,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
    },
  };
}

export async function bootstrapPlayer(user: User): Promise<BetaPlayerSnapshot> {
  const profile = await ensureProfile(user);
  const playerState = await ensurePlayerState(user);
  const ownedWeapons = await ensureOwnedWeapons(user);
  const playerRecord = await ensurePlayerRecord(user);

  return snapshotForUser({
    user,
    profile,
    playerState,
    ownedWeapons,
    playerRecord,
  });
}

export async function getPlayerSnapshot(
  user: User,
): Promise<BetaPlayerSnapshot> {
  return bootstrapPlayer(user);
}

export async function updatePlayerNickname(
  user: User,
  nickname: string,
): Promise<NicknameUpdateResponse> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        nickname,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return { profile: data };
}
