import "server-only";

import { WEAPONS_BY_ID } from "@/data/weapons";
import { calculateRankingValue, rowToOwnedWeapon } from "@/lib/server/serverGameMath";
import { getCurrentSeasonInfo } from "@/lib/season";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OwnedWeaponRow, ProfileRow } from "@/types/supabase";

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
    .select("*")
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
