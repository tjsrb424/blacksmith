import type { WeaponDefinition, WeaponGrade, WeaponType } from "@/types/game";
import { weaponPortraitPath } from "@/data/assets";
import { roundNicePrice, rawWeaponPriceAtTier } from "@/data/balance";

export const STARTER_WEAPON_ID = "w_rusty_dagger";

function def(
  id: string,
  name: string,
  grade: WeaponGrade,
  type: WeaponType,
  tier: number,
): WeaponDefinition {
  return {
    id,
    name,
    grade,
    type,
    tier,
    basePrice: roundNicePrice(rawWeaponPriceAtTier(tier)),
    imagePath: weaponPortraitPath(name),
  };
}

/** 30종 — ID 유지(저장 호환), 표시명·등급·타입 Sprint9 기준 */
const rows: Array<[string, string, WeaponGrade, WeaponType, number]> = [
  ["w_rusty_dagger", "녹슨 단검", "D", "dagger", 1],
  ["w_trainee_blade", "이 빠진 철검", "D", "sword", 2],
  ["w_oak_staff", "금 간 손도끼", "D", "axe", 3],
  ["w_hunter_bow", "굽은 창", "D", "spear", 4],
  ["w_iron_spear", "금 간 나무망치", "D", "hammer", 5],
  ["w_miner_pickaxe", "견습 철검", "C", "sword", 6],
  ["w_knight_saber", "단련된 전투도끼", "C", "axe", 7],
  ["w_guard_halberd", "병사의 장창", "C", "spear", 8],
  ["w_highlander_claymore", "묵직한 철퇴", "C", "hammer", 9],
  ["w_ember_axe", "사냥꾼의 강궁", "C", "bow", 10],
  ["w_silver_sabre", "푸른강철 장검", "B", "sword", 11],
  ["w_shadow_knife", "서리날 쌍검", "B", "dagger", 12],
  ["w_rune_gavel", "번개문양 창", "B", "spear", 13],
  ["w_starfall_bow", "흑철 파쇄도", "B", "axe", 14],
  ["w_arcane_spire", "룬 각인 전투망치", "B", "hammer", 15],
  ["w_drake_fang", "적염의 대검", "A", "greatsword", 16],
  ["w_storm_glaive", "폭풍궁", "A", "bow", 17],
  ["w_inferno_greataxe", "심연의 흑창", "A", "spear", 18],
  ["w_frostbrand", "용사의 성검", "A", "sword", 19],
  ["w_thunder_hammer", "거암 분쇄망치", "A", "hammer", 20],
  ["w_eclipse_bow", "광결의 검", "S", "sword", 21],
  ["w_void_rapier", "일식 파쇄도", "S", "dagger", 22],
  ["w_moonlit_staff", "녹명의 사냥낫", "S", "axe", 23],
  ["w_soul_reaver", "성위의 집행망치", "S", "hammer", 24],
  ["w_world_splitter", "용염의 전투창", "S", "spear", 25],
  ["w_stellar_lance", "천공을 가르는 신검", "SS", "sword", 26],
  ["w_dawn_breaker", "종말의 흑월대도", "SS", "greatsword", 27],
  ["w_cosmos_maul", "세계수의 생명창", "SS", "spear", 28],
  ["w_serpent_fang", "별무리의 심판활", "SS", "bow", 29],
  ["w_worldtree_blade", "신왕의 창세망치", "SS", "hammer", 30],
];

export const WEAPON_DEFINITIONS: WeaponDefinition[] = rows.map((r) =>
  def(r[0], r[1], r[2], r[3], r[4]),
);

export const WEAPONS_BY_ID: Record<string, WeaponDefinition> = Object.fromEntries(
  WEAPON_DEFINITIONS.map((w) => [w.id, w]),
);
