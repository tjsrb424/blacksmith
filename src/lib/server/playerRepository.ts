import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import {
  DEFAULT_DURABILITY,
  FORGE_START_LEVEL,
  INITIAL_EMBER,
  INITIAL_GOLD,
  INITIAL_TRANSCEND_STONE,
} from "@/data/balance";
import { STARTER_WEAPON_ID, WEAPONS_BY_ID } from "@/data/weapons";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MissingSupabaseAdminEnvError } from "@/lib/supabase/admin";
import {
  getNicknameSearchKey,
  nicknameValidationMessage,
  type NicknameValidationReason,
} from "@/lib/player/nickname";
import { validateNicknamePolicy } from "@/lib/server/nicknamePolicy";
import { getCurrentSeasonInfo } from "@/lib/season";
import type {
  BestWeaponSnapshot,
  PlayerRecords,
  WeeklySeasonStats,
} from "@/types/game";
import type {
  BetaPlayerSnapshot,
  GuestRequestContext,
  LinkGuestCheckResponse,
  LinkGuestConfirmChoice,
  LinkGuestConfirmResponse,
  PlayerLifecycleSummary,
  NicknameUpdateResponse,
} from "@/types/server";
import type {
  OwnedWeaponRow,
  PlayerRecordRow,
  PlayerStateRow,
  ProfileRow,
} from "@/types/supabase";

type BootstrapErrorCode =
  | "guest_credentials_invalid"
  | "guest_secret_mismatch"
  | "missing_admin_env"
  | "profile_insert_failed"
  | "player_state_insert_failed"
  | "starter_weapon_insert_failed"
  | "player_record_insert_failed"
  | "starter_weapon_definition_missing"
  | "schema_mismatch"
  | "bootstrap_failed";

export type PlayerIdentity = {
  id: string;
  email?: string | null;
};

export class NicknameUpdateError extends Error {
  constructor(
    readonly reason: NicknameValidationReason,
    message = nicknameValidationMessage(reason),
    readonly status = reason === "cooldown" ? 429 : 400,
    readonly cooldownRemainingMs?: number,
  ) {
    super(message);
  }
}

const NICKNAME_COOLDOWN_MS = 10 * 60 * 1000;

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

const PROFILE_SELECT =
  "id,auth_user_id,guest_id,guest_secret_hash,nickname,normalized_nickname,nickname_updated_at,play_mode,status,linked_at,archived_at,deleted_at,created_at,updated_at";
const PLAYER_STATE_SELECT =
  "id,user_id,gold,forge_ember,transcend_stone,forge_level,forge_last_collected_at,current_season_id,stats,created_at,updated_at";
const OWNED_WEAPON_SELECT =
  "id,user_id,weapon_id,enhance_level,transcend_level,durability,is_locked,created_at,updated_at";
const PLAYER_RECORD_SELECT =
  "id,user_id,best_weapon_name,best_weapon_id,best_weapon_value,best_weapon_enhance_level,best_weapon_transcend_level,best_sale_gold,total_sales_gold,max_transcend_level,stats,created_at,updated_at";

type GuestIdentityProfile = Pick<
  ProfileRow,
  "id" | "guest_secret_hash" | "status"
>;

export class BootstrapError extends Error {
  constructor(
    message: string,
    readonly errorCode: BootstrapErrorCode,
    readonly step: string,
    readonly status = 500,
    readonly details?: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

function isSupabaseErrorLike(error: unknown): error is SupabaseErrorLike {
  return Boolean(error && typeof error === "object" && "message" in error);
}

function isUniqueViolation(error: unknown) {
  return isSupabaseErrorLike(error) && error.code === "23505";
}

function isSchemaMismatch(error: unknown) {
  if (!isSupabaseErrorLike(error)) return false;
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function errorDetails(error: unknown) {
  if (!isSupabaseErrorLike(error)) {
    return error instanceof Error ? error.message : undefined;
  }

  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

function bootstrapFailure(
  step: string,
  errorCode: Exclude<
    BootstrapErrorCode,
    "schema_mismatch" | "missing_admin_env" | "starter_weapon_definition_missing"
  >,
  error: unknown,
): BootstrapError {
  if (error instanceof MissingSupabaseAdminEnvError) {
    return new BootstrapError(
      error.message,
      "missing_admin_env",
      step,
      500,
      error.message,
      error,
    );
  }

  if (isSchemaMismatch(error)) {
    return new BootstrapError(
      "Failed to bootstrap player",
      "schema_mismatch",
      step,
      500,
      errorDetails(error),
      error,
    );
  }

  return new BootstrapError(
    "Failed to bootstrap player",
    errorCode,
    step,
    500,
    errorDetails(error),
    error,
  );
}

async function selectProfile(userId: string): Promise<ProfileRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectProfileByGuestId(
  guestId: string,
): Promise<ProfileRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectGuestIdentityByGuestId(
  guestId: string,
): Promise<GuestIdentityProfile | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,guest_secret_hash,status")
    .eq("guest_id", guestId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectActiveProfileByAuthUserId(
  authUserId: string,
): Promise<ProfileRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", authUserId)
    .in("status", ["active", "linked"])
    .order("linked_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectProfileByNormalizedNickname(
  normalizedNickname: string,
): Promise<ProfileRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("normalized_nickname", normalizedNickname)
    .not("status", "in", "(archived,deleted)")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectPlayerState(userId: string): Promise<PlayerStateRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_states")
    .select(PLAYER_STATE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function selectOwnedWeapons(userId: string): Promise<OwnedWeaponRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("owned_weapons")
    .select(OWNED_WEAPON_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function selectPlayerRecord(userId: string): Promise<PlayerRecordRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_records")
    .select(PLAYER_RECORD_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function hidePlayerRankings(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error: weeklyError } = await admin
    .from("weekly_rankings")
    .delete()
    .eq("user_id", userId);
  if (weeklyError) throw weeklyError;

  const { error: worldError } = await admin
    .from("world_records")
    .delete()
    .eq("user_id", userId);
  if (worldError) throw worldError;
}

async function resetPlayerProgress(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  await hidePlayerRankings(userId);

  const tables = ["ad_reward_logs", "game_action_logs", "owned_weapons", "player_records", "player_states"] as const;
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
}

async function validateGuestProfileForSecret(input: {
  guestId?: string;
  guestSecret?: string;
}): Promise<ProfileRow> {
  if (!isUuid(input.guestId) || !input.guestSecret) {
    throw new BootstrapError(
      "Invalid guest credentials",
      "guest_credentials_invalid",
      "validate_guest",
      400,
    );
  }

  const profile = await selectProfileByGuestId(input.guestId);
  const nextHash = guestSecretHash(input.guestSecret);
  if (
    !profile ||
    !profile.guest_secret_hash ||
    !safeEqualHash(profile.guest_secret_hash, nextHash)
  ) {
    throw new BootstrapError(
      "Guest secret mismatch",
      "guest_secret_mismatch",
      "validate_guest",
      401,
    );
  }

  if (profile.status === "archived" || profile.status === "deleted") {
    throw new BootstrapError(
      "Guest player is no longer active",
      "guest_credentials_invalid",
      "validate_guest",
      410,
    );
  }

  return profile;
}

async function validateGuestIdentityForSecret(input: {
  guestId?: string;
  guestSecret?: string;
}): Promise<GuestIdentityProfile> {
  if (!isUuid(input.guestId) || !input.guestSecret) {
    throw new BootstrapError(
      "Invalid guest credentials",
      "guest_credentials_invalid",
      "validate_guest",
      400,
    );
  }

  const profile = await selectGuestIdentityByGuestId(input.guestId);
  const nextHash = guestSecretHash(input.guestSecret);
  if (
    !profile ||
    !profile.guest_secret_hash ||
    !safeEqualHash(profile.guest_secret_hash, nextHash)
  ) {
    throw new BootstrapError(
      "Guest secret mismatch",
      "guest_secret_mismatch",
      "validate_guest",
      401,
    );
  }

  if (profile.status === "archived" || profile.status === "deleted") {
    throw new BootstrapError(
      "Guest player is no longer active",
      "guest_credentials_invalid",
      "validate_guest",
      410,
    );
  }

  return profile;
}

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

export function bestWeaponSnapshotFromRecord(
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

async function playerSummaryFromProfile(
  profile: ProfileRow,
): Promise<PlayerLifecycleSummary> {
  const [playerState, playerRecord] = await Promise.all([
    selectPlayerState(profile.id),
    selectPlayerRecord(profile.id),
  ]);

  return {
    playerId: profile.id,
    nickname: profile.nickname,
    playMode: profile.play_mode,
    status: profile.status,
    highestEnhance: Number(playerRecord?.best_weapon_enhance_level ?? 0),
    gold: Number(playerState?.gold ?? 0),
    bestWeaponValue: Number(playerRecord?.best_weapon_value ?? 0),
    rankingScore: Number(playerRecord?.best_weapon_value ?? 0),
    updatedAt: profile.updated_at ?? playerRecord?.updated_at ?? playerState?.updated_at ?? null,
  };
}

function guestSecretHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function safeEqualHash(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function isUuid(value: string | undefined | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function normalizeGuestContext(
  input: GuestRequestContext,
): {
  guestId: string;
  guestSecret: string;
  nickname: string;
  normalizedNickname: string;
} {
  const nicknameResult = validateNicknamePolicy(input.nickname ?? "");
  if (!isUuid(input.guestId) || !input.guestSecret || !nicknameResult.ok) {
    throw new BootstrapError(
      "Invalid guest credentials",
      "guest_credentials_invalid",
      "validate_guest",
      400,
      nicknameResult.ok ? undefined : nicknameResult.message,
    );
  }

  return {
    guestId: input.guestId,
    guestSecret: input.guestSecret,
    nickname: nicknameResult.nickname,
    normalizedNickname: nicknameResult.normalizedNickname,
  };
}

async function ensureProfile(user: PlayerIdentity): Promise<ProfileRow> {
  const step = "ensure_profile";
  try {
    const active = await selectActiveProfileByAuthUserId(user.id);
    if (active) return active;

    const existing = await selectProfile(user.id);
    if (existing && existing.status !== "deleted" && existing.status !== "archived") {
      return existing;
    }

    if (existing && (existing.status === "deleted" || existing.status === "archived")) {
      const admin = getSupabaseAdminClient();
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("profiles")
        .update({
          auth_user_id: user.id,
          guest_id: null,
          guest_secret_hash: null,
          nickname: null,
          normalized_nickname: null,
          nickname_updated_at: null,
          play_mode: "auth",
          status: "active",
          linked_at: null,
          archived_at: null,
          deleted_at: null,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select(PROFILE_SELECT)
        .single();
      if (error) throw error;
      await resetPlayerProgress(existing.id);
      return data;
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        auth_user_id: user.id,
        nickname: null,
        play_mode: "auth",
        status: "active",
      })
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const raced = await selectProfile(user.id);
        if (raced) return raced;
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw bootstrapFailure(step, "profile_insert_failed", error);
  }
}

async function ensureGuestProfile(
  input: GuestRequestContext,
): Promise<ProfileRow> {
  const step = "ensure_guest_profile";
  const guest = normalizeGuestContext(input);
  const nextHash = guestSecretHash(guest.guestSecret);

  try {
    const existing = await selectProfileByGuestId(guest.guestId);
    if (existing) {
      if (existing.status === "deleted" || existing.status === "archived") {
        throw new BootstrapError(
          "Guest player is no longer active",
          "guest_credentials_invalid",
          step,
          410,
        );
      }

      if (
        !existing.guest_secret_hash ||
        !safeEqualHash(existing.guest_secret_hash, nextHash)
      ) {
        throw new BootstrapError(
          "Guest secret mismatch",
          "guest_secret_mismatch",
          step,
          401,
        );
      }

      if (!existing.nickname) {
        const admin = getSupabaseAdminClient();
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from("profiles")
          .update({
            nickname: guest.nickname,
            normalized_nickname: guest.normalizedNickname,
            nickname_updated_at: now,
            updated_at: now,
          })
          .eq("id", existing.id)
          .select(PROFILE_SELECT)
          .single();
        if (error) throw error;
        return data;
      }

      return existing;
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .insert({
        id: guest.guestId,
        guest_id: guest.guestId,
        guest_secret_hash: nextHash,
        nickname: guest.nickname,
        normalized_nickname: guest.normalizedNickname,
        nickname_updated_at: new Date().toISOString(),
        play_mode: "guest",
        status: "guest",
      })
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const raced = await selectProfileByGuestId(guest.guestId);
        if (raced) return ensureGuestProfile(input);
        throw new BootstrapError(
          "Nickname already in use",
          "guest_credentials_invalid",
          step,
          409,
          "duplicate",
          error,
        );
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw bootstrapFailure(step, "profile_insert_failed", error);
  }
}

async function ensurePlayerState(user: PlayerIdentity): Promise<PlayerStateRow> {
  const step = "ensure_player_state";
  try {
    const existing = await selectPlayerState(user.id);
    if (existing) return existing;

    const admin = getSupabaseAdminClient();
    const season = getCurrentSeasonInfo();
    const now = new Date().toISOString();
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
      .select(PLAYER_STATE_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const raced = await selectPlayerState(user.id);
        if (raced) return raced;
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw bootstrapFailure(step, "player_state_insert_failed", error);
  }
}

async function ensureOwnedWeapons(user: PlayerIdentity): Promise<OwnedWeaponRow[]> {
  const step = "ensure_starter_weapon";
  try {
    if (!WEAPONS_BY_ID[STARTER_WEAPON_ID]) {
      throw new BootstrapError(
        "Starter weapon definition missing",
        "starter_weapon_definition_missing",
        step,
        409,
        `STARTER_WEAPON_ID=${STARTER_WEAPON_ID}`,
      );
    }

    const existing = await selectOwnedWeapons(user.id);
    if (existing.length > 0) {
      return existing;
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("owned_weapons").insert({
      user_id: user.id,
      weapon_id: STARTER_WEAPON_ID,
      enhance_level: 0,
      transcend_level: 0,
      durability: DEFAULT_DURABILITY,
      is_locked: false,
    });

    if (error) {
      if (isUniqueViolation(error)) return selectOwnedWeapons(user.id);
      throw error;
    }

    return selectOwnedWeapons(user.id);
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw bootstrapFailure(step, "starter_weapon_insert_failed", error);
  }
}

async function ensurePlayerRecord(user: PlayerIdentity): Promise<PlayerRecordRow> {
  const step = "ensure_player_record";
  try {
    const existing = await selectPlayerRecord(user.id);
    if (existing) return existing;

    const admin = getSupabaseAdminClient();
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
      .select(PLAYER_RECORD_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const raced = await selectPlayerRecord(user.id);
        if (raced) return raced;
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw bootstrapFailure(step, "player_record_insert_failed", error);
  }
}

function snapshotForUser(params: {
  user: PlayerIdentity;
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

export function snapshotFromRows(params: {
  user: PlayerIdentity;
  profile: ProfileRow;
  playerState: PlayerStateRow;
  ownedWeapons: OwnedWeaponRow[];
  playerRecord: PlayerRecordRow;
}): BetaPlayerSnapshot {
  return snapshotForUser(params);
}

export async function getOwnedWeaponsForSnapshot(
  userId: string,
): Promise<OwnedWeaponRow[]> {
  return selectOwnedWeapons(userId);
}

export async function bootstrapPlayer(user: User): Promise<BetaPlayerSnapshot> {
  const profile = await ensureProfile({
    id: user.id,
    email: user.email ?? null,
  });
  return bootstrapPlayerIdentity(
    {
      id: profile.id,
      email: user.email ?? null,
    },
    profile,
  );
}

export async function bootstrapGuestPlayer(
  input: GuestRequestContext,
): Promise<BetaPlayerSnapshot> {
  const profile = await ensureGuestProfile(input);
  const identity: PlayerIdentity = { id: profile.id, email: null };
  return bootstrapPlayerIdentity(identity, profile);
}

export async function verifyGuestPlayerIdentity(
  input: GuestRequestContext,
): Promise<PlayerIdentity> {
  const profile = await validateGuestIdentityForSecret(input);
  return { id: profile.id, email: null };
}

async function bootstrapPlayerIdentity(
  identity: PlayerIdentity,
  knownProfile?: ProfileRow,
): Promise<BetaPlayerSnapshot> {
  const [existingProfile, existingPlayerState, existingOwnedWeapons, existingPlayerRecord] =
    await Promise.all([
      knownProfile ? Promise.resolve(knownProfile) : selectProfile(identity.id),
      selectPlayerState(identity.id),
      selectOwnedWeapons(identity.id),
      selectPlayerRecord(identity.id),
    ]);

  if (
    existingProfile &&
    existingPlayerState &&
    existingOwnedWeapons.length > 0 &&
    existingPlayerRecord
  ) {
    return snapshotForUser({
      user: identity,
      profile: existingProfile,
      playerState: existingPlayerState,
      ownedWeapons: existingOwnedWeapons,
      playerRecord: existingPlayerRecord,
    });
  }

  const [profile, playerState, ownedWeapons, playerRecord] = await Promise.all([
    existingProfile ?? ensureProfile(identity),
    existingPlayerState ?? ensurePlayerState(identity),
    existingOwnedWeapons.length > 0
      ? existingOwnedWeapons
      : ensureOwnedWeapons(identity),
    existingPlayerRecord ?? ensurePlayerRecord(identity),
  ]);

  return snapshotForUser({
    user: identity,
    profile,
    playerState,
    ownedWeapons,
    playerRecord,
  });
}

export async function getPlayerSnapshot(
  user: PlayerIdentity,
): Promise<BetaPlayerSnapshot> {
  const profile = await ensureProfile(user);
  return bootstrapPlayerIdentity(
    { id: profile.id, email: user.email ?? null },
    profile,
  );
}

export async function getAuthenticatedPlayerIdentity(
  user: User,
): Promise<PlayerIdentity> {
  const profile = await ensureProfile({
    id: user.id,
    email: user.email ?? null,
  });
  return {
    id: profile.id,
    email: user.email ?? null,
  };
}

export async function validateNicknameAvailability(
  input: string,
  currentPlayerId?: string | null,
): Promise<
  | { ok: true; nickname: string; normalizedNickname: string }
  | { ok: false; reason: NicknameValidationReason; message: string }
> {
  const validation = validateNicknamePolicy(input);
  if (!validation.ok) return validation;

  const existing = await selectProfileByNormalizedNickname(
    validation.normalizedNickname,
  );
  if (existing && existing.id !== currentPlayerId) {
    return {
      ok: false,
      reason: "duplicate",
      message: nicknameValidationMessage("duplicate"),
    };
  }

  return validation;
}

async function updateRankingNicknames(userId: string, nickname: string) {
  const admin = getSupabaseAdminClient();
  const { error: weeklyError } = await admin
    .from("weekly_rankings")
    .update({ nickname })
    .eq("user_id", userId);
  if (weeklyError) throw weeklyError;

  const { error: worldError } = await admin
    .from("world_records")
    .update({ nickname, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (worldError) throw worldError;
}

async function updateProfileNickname(
  profile: ProfileRow,
  nickname: string,
): Promise<ProfileRow> {
  const validation = await validateNicknameAvailability(nickname, profile.id);
  if (!validation.ok) {
    throw new NicknameUpdateError(validation.reason, validation.message);
  }

  const currentNormalized =
    profile.normalized_nickname ?? getNicknameSearchKey(profile.nickname ?? "");
  const normalizedChanged =
    Boolean(currentNormalized) &&
    currentNormalized !== validation.normalizedNickname;
  if (normalizedChanged && profile.nickname_updated_at) {
    const elapsed = Date.now() - new Date(profile.nickname_updated_at).getTime();
    if (elapsed < NICKNAME_COOLDOWN_MS) {
      throw new NicknameUpdateError(
        "cooldown",
        nicknameValidationMessage("cooldown"),
        429,
        NICKNAME_COOLDOWN_MS - elapsed,
      );
    }
  }

  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({
      nickname: validation.nickname,
      normalized_nickname: validation.normalizedNickname,
      nickname_updated_at: normalizedChanged || !profile.nickname ? now : profile.nickname_updated_at,
      updated_at: now,
    })
    .eq("id", profile.id)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new NicknameUpdateError("duplicate");
    }
    throw error;
  }

  await updateRankingNicknames(profile.id, data.nickname ?? validation.nickname);
  return data;
}

export async function updatePlayerNickname(
  user: User,
  nickname: string,
): Promise<NicknameUpdateResponse> {
  const profile = await ensureProfile({
    id: user.id,
    email: user.email ?? null,
  });
  const updatedProfile = await updateProfileNickname(profile, nickname);
  const snapshot = await bootstrapPlayerIdentity(
    { id: user.id, email: user.email ?? null },
    updatedProfile,
  );
  return { profile: updatedProfile, snapshot };
}

export async function updateGuestPlayerNickname(
  input: GuestRequestContext,
): Promise<NicknameUpdateResponse> {
  if (!isUuid(input.guestId) || !input.guestSecret) {
    throw new NicknameUpdateError("invalid_characters", "Invalid guest credentials.");
  }

  const profile = await selectProfileByGuestId(input.guestId);
  const nextHash = guestSecretHash(input.guestSecret);
  if (
    !profile ||
    !profile.guest_secret_hash ||
    !safeEqualHash(profile.guest_secret_hash, nextHash)
  ) {
    throw new NicknameUpdateError("invalid_characters", "Invalid guest credentials.");
  }

  const updatedProfile = await updateProfileNickname(
    profile,
    input.nickname ?? "",
  );
  const snapshot = await bootstrapPlayerIdentity(
    { id: updatedProfile.id, email: null },
    updatedProfile,
  );
  return { profile: updatedProfile, snapshot };
}

export async function archiveGuestPlayer(input: {
  guestId?: string;
  guestSecret?: string;
}): Promise<void> {
  const profile = await validateGuestProfileForSecret(input);
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();

  await resetPlayerProgress(profile.id);
  const { error } = await admin
    .from("profiles")
    .update({
      status: "deleted",
      guest_secret_hash: null,
      normalized_nickname: null,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", profile.id);
  if (error) throw error;
}

export async function deleteAuthenticatedAccountData(user: User): Promise<void> {
  const profile = await ensureProfile({
    id: user.id,
    email: user.email ?? null,
  });
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();

  await resetPlayerProgress(profile.id);
  const { error } = await admin
    .from("profiles")
    .update({
      status: "deleted",
      nickname: null,
      normalized_nickname: null,
      nickname_updated_at: null,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", profile.id);
  if (error) throw error;
}

export async function checkGuestLink(
  user: User,
  input: { guestId?: string; guestSecret?: string },
): Promise<LinkGuestCheckResponse> {
  let guestProfile: ProfileRow;
  try {
    guestProfile = await validateGuestProfileForSecret(input);
  } catch {
    return {
      status: "invalid_guest",
      message: "게스트 기록을 확인하지 못했습니다. 다시 시작해주세요.",
    };
  }

  const guestSummary = await playerSummaryFromProfile(guestProfile);
  const authProfile = await selectActiveProfileByAuthUserId(user.id);

  if (authProfile?.id === guestProfile.id) {
    return {
      status: "already_linked",
      guestSummary,
      snapshot: await bootstrapPlayer(user),
    };
  }

  if (!authProfile) {
    return {
      status: "can_link",
      guestSummary,
      authSummary: null,
    };
  }

  return {
    status: "conflict",
    guestSummary,
    authSummary: await playerSummaryFromProfile(authProfile),
  };
}

async function attachGuestProfileToAuthUser(
  guestProfile: ProfileRow,
  user: User,
): Promise<ProfileRow> {
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({
      auth_user_id: user.id,
      play_mode: "auth",
      status: "linked",
      linked_at: guestProfile.linked_at ?? now,
      archived_at: null,
      deleted_at: null,
      updated_at: now,
    })
    .eq("id", guestProfile.id)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

async function archiveAuthProfile(profile: ProfileRow): Promise<void> {
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  await hidePlayerRankings(profile.id);
  const { error } = await admin
    .from("profiles")
    .update({
      status: "archived",
      normalized_nickname: null,
      archived_at: now,
      updated_at: now,
    })
    .eq("id", profile.id);
  if (error) throw error;
}

export async function confirmGuestLink(
  user: User,
  input: {
    guestId?: string;
    guestSecret?: string;
    choice: LinkGuestConfirmChoice;
  },
): Promise<LinkGuestConfirmResponse> {
  if (input.choice === "cancel") {
    return {
      status: "cancelled",
      message: "계정 연동을 취소했습니다.",
    };
  }

  let guestProfile: ProfileRow;
  try {
    guestProfile = await validateGuestProfileForSecret(input);
  } catch {
    return {
      status: "invalid_guest",
      message: "게스트 기록을 확인하지 못했습니다. 다시 시작해주세요.",
    };
  }

  const authProfile = await selectActiveProfileByAuthUserId(user.id);
  const guestSummary = await playerSummaryFromProfile(guestProfile);

  if (input.choice === "use_auth") {
    const snapshot = await bootstrapPlayer(user);
    return {
      status: "use_auth",
      message: "Google 계정 기록으로 계속합니다. 게스트 기록은 이 기기에 남아 있습니다.",
      snapshot,
      guestSummary,
      authSummary: authProfile ? await playerSummaryFromProfile(authProfile) : undefined,
    };
  }

  if (authProfile && authProfile.id !== guestProfile.id) {
    if (input.choice !== "use_guest") {
      return {
        status: "conflict",
        message: "이 Google 계정에 이미 저장된 게임 기록이 있습니다.",
        guestSummary,
        authSummary: await playerSummaryFromProfile(authProfile),
      };
    }
    await archiveAuthProfile(authProfile);
  }

  const linkedProfile = await attachGuestProfileToAuthUser(guestProfile, user);
  const snapshot = await bootstrapPlayerIdentity(
    { id: linkedProfile.id, email: user.email ?? null },
    linkedProfile,
  );

  return {
    status: authProfile ? "use_guest" : "linked",
    message: "계정 연동 완료! 이제 다른 기기에서도 진행 정보를 이어서 플레이할 수 있습니다.",
    snapshot,
    guestSummary: await playerSummaryFromProfile(linkedProfile),
    authSummary: authProfile ? await playerSummaryFromProfile(authProfile) : undefined,
  };
}
