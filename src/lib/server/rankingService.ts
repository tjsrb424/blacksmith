import "server-only";

import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateRankingValue, rowToOwnedWeapon } from "@/lib/server/serverGameMath";
import { getCurrentSeasonInfo } from "@/lib/season";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RankingCategory } from "@/types/game";
import type {
  WeeklyRankingResponse,
  WorldRecordsResponse,
  WorldSaleRecord,
  WorldWeaponRecord,
  WorldCountRecord,
} from "@/types/server";
import type { OwnedWeaponRow, ProfileRow, WeeklyRankingRow, WorldRecordRow } from "@/types/supabase";

const EMPTY_HOLDER = "아직 기록 없음";

function displayName(nickname: string | null | undefined, userId: string) {
  return nickname?.trim() || `Player ${userId.slice(0, 8)}`;
}

function toMillis(value?: string | null) {
  return value ? new Date(value).getTime() : undefined;
}

function weeklyRowToDisplay(
  row: WeeklyRankingRow,
  rank: number,
  playerId?: string | null,
) {
  const score = Number(row.score ?? row.ranking_value ?? 0);
  return {
    rank,
    userId: row.user_id,
    nickname: row.nickname,
    playerName: displayName(row.nickname, row.user_id),
    weaponName: row.weapon_name ?? "-",
    weaponId: row.weapon_id,
    enhanceLevel: Number(row.enhance_level ?? 0),
    transcendLevel: Number(row.transcend_level ?? 0),
    value: Number(row.ranking_value ?? score),
    rankingValue: Number(row.ranking_value ?? score),
    score,
    isPlayer: Boolean(playerId && row.user_id === playerId),
    createdAt: toMillis(row.created_at),
  };
}

function emptyWeaponRecord(): WorldWeaponRecord {
  return {
    weaponName: "-",
    enhanceLevel: 0,
    transcendLevel: 0,
    rankingValue: 0,
    holderName: EMPTY_HOLDER,
    isPlayer: false,
  };
}

function worldWeaponRecord(
  row: WorldRecordRow | null | undefined,
  playerId?: string | null,
): WorldWeaponRecord {
  if (!row) return emptyWeaponRecord();
  return {
    weaponName: row.weapon_name ?? "-",
    weaponId: row.weapon_id ?? undefined,
    enhanceLevel: Number(row.enhance_level ?? 0),
    transcendLevel: Number(row.transcend_level ?? 0),
    rankingValue: Number(row.value ?? 0),
    holderName: displayName(row.nickname, row.user_id),
    isPlayer: Boolean(playerId && row.user_id === playerId),
  };
}

function worldSaleRecord(
  row: WorldRecordRow | null | undefined,
  playerId?: string | null,
): WorldSaleRecord {
  return {
    gold: Number(row?.value ?? 0),
    weaponName: row?.weapon_name ?? "-",
    holderName: row ? displayName(row.nickname, row.user_id) : EMPTY_HOLDER,
    isPlayer: Boolean(row && playerId && row.user_id === playerId),
  };
}

function worldCountRecord(
  row: WorldRecordRow | null | undefined,
  playerId?: string | null,
): WorldCountRecord {
  return {
    value: Number(row?.value ?? 0),
    holderName: row ? displayName(row.nickname, row.user_id) : EMPTY_HOLDER,
    isPlayer: Boolean(row && playerId && row.user_id === playerId),
  };
}

export async function upsertStrongestWeaponRanking(args: {
  userId: string;
  profile: ProfileRow;
  weapon: OwnedWeaponRow;
}): Promise<number> {
  const def = WEAPONS_BY_ID[args.weapon.weapon_id];
  if (!def) return 0;
  const owned = rowToOwnedWeapon(args.weapon);
  const rankingValue = calculateRankingValue(def, owned);
  const season = getCurrentSeasonInfo();
  const admin = getSupabaseAdminClient();

  const { error } = await admin.from("weekly_rankings").upsert(
    {
      season_id: season.seasonId,
      category: "weeklyStrongestWeapon",
      user_id: args.userId,
      nickname: args.profile.nickname,
      weapon_instance_id: args.weapon.id,
      weapon_name: def.name,
      weapon_id: def.id,
      enhance_level: owned.enhanceLevel,
      transcend_level: owned.transcendLevel,
      ranking_value: rankingValue,
      score: rankingValue,
    },
    { onConflict: "season_id,category,user_id" },
  );
  if (error) throw error;

  await upsertWorldRecord({
    category: "worldRecordWeapon",
    userId: args.userId,
    nickname: args.profile.nickname,
    weaponName: def.name,
    weaponId: def.id,
    enhanceLevel: owned.enhanceLevel,
    transcendLevel: owned.transcendLevel,
    value: rankingValue,
  });

  return rankingValue;
}

export async function upsertWeeklyScore(args: {
  userId: string;
  profile: ProfileRow;
  seasonId: string;
  category: string;
  score: number;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("weekly_rankings").upsert(
    {
      season_id: args.seasonId,
      category: args.category,
      user_id: args.userId,
      nickname: args.profile.nickname,
      ranking_value: args.score,
      score: args.score,
    },
    { onConflict: "season_id,category,user_id" },
  );
  if (error) throw error;
}

export async function upsertWorldRecord(args: {
  category: string;
  userId: string;
  nickname: string | null;
  weaponName?: string | null;
  weaponId?: string | null;
  enhanceLevel?: number;
  transcendLevel?: number;
  value: number;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data: current, error } = await admin
    .from("world_records")
    .select("value")
    .eq("category", args.category)
    .maybeSingle();

  if (error) throw error;
  if (current && Number(current.value) >= args.value) return;

  const { error: upsertError } = await admin.from("world_records").upsert(
    {
      category: args.category,
      user_id: args.userId,
      nickname: args.nickname,
      weapon_name: args.weaponName ?? null,
      weapon_id: args.weaponId ?? null,
      enhance_level: args.enhanceLevel ?? 0,
      transcend_level: args.transcendLevel ?? 0,
      value: args.value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "category" },
  );
  if (upsertError) throw upsertError;
}

export async function getWeeklyRankingRows(args: {
  seasonId: string;
  category: RankingCategory;
  playerId?: string | null;
  limit?: number;
}): Promise<WeeklyRankingResponse> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("weekly_rankings")
    .select("*")
    .eq("season_id", args.seasonId)
    .eq("category", args.category)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(args.limit ?? 50);

  if (error) throw error;

  const rows = (data ?? []).map((row, index) =>
    weeklyRowToDisplay(row, index + 1, args.playerId),
  );
  const playerRank = args.playerId
    ? rows.find((row) => row.userId === args.playerId)?.rank
    : undefined;

  return {
    seasonId: args.seasonId,
    category: args.category,
    rows,
    playerRank: playerRank ?? null,
    serverCalculatedAt: new Date().toISOString(),
  };
}

export async function getWorldRecordRows(
  playerId?: string | null,
): Promise<WorldRecordsResponse> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("world_records").select("*");

  if (error) throw error;

  const byCategory = new Map(
    (data ?? []).map((record) => [record.category, record]),
  );
  const strongest = byCategory.get("worldRecordWeapon");
  const transcend =
    byCategory.get("worldRecordTranscend") ??
    byCategory.get("worldRecordWeapon");

  return {
    highestWeapon: worldWeaponRecord(strongest, playerId),
    bestTranscend: worldWeaponRecord(transcend, playerId),
    bestSale: worldSaleRecord(byCategory.get("worldRecordSale"), playerId),
    mostEnhanceAttempts: worldCountRecord(
      byCategory.get("worldRecordEnhanceAttempts"),
      playerId,
    ),
    mostTranscendSuccesses: worldCountRecord(
      byCategory.get("worldRecordTranscendSuccesses"),
      playerId,
    ),
    destroyedLegend: worldWeaponRecord(
      byCategory.get("worldRecordDestroyedWeapon"),
      playerId,
    ),
    serverCalculatedAt: new Date().toISOString(),
  };
}
