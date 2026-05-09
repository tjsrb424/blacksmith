import type { WeeklyRankingEntry } from "@/types/game";

const NAMES = [
  "대장장이K",
  "BladeMaster",
  "은빛장인",
  "노루쟁이",
  "거북이",
  "화염룡",
  "별철장",
  "아칸소드",
  "그림자단검",
  "천공창",
  "얼음장인",
  "붉은망치",
  "세계수활",
  "유령검",
  "폭풍도끼",
];

function weaponLabel(i: number): string {
  const w = ["심연의 대검", "태양의 검", "별무리 활", "천둥 망치", "용아단검", "화염검", "달빛 창"];
  return w[i % w.length];
}

/** 주간 최강 무기 — 값 분포: 성장형 유저가 상위권 진입 가능하도록 중간대 집중 */
export const MOCK_WEEKLY_STRONGEST_WEAPON: WeeklyRankingEntry[] = NAMES.map(
  (playerName, i) => ({
    rank: i + 1,
    playerName,
    weaponName: weaponLabel(i),
    enhanceLevel: i < 8 ? 15 : 14,
    transcendLevel: Math.max(0, 5 - Math.floor(i / 3)),
    value: Math.round(118_000_000 - i * 6_200_000 + (i % 3) * 400_000),
  }),
);

/** 주간 강화왕 — 시즌 내 강화 성공 횟수 Mock */
export const MOCK_WEEKLY_ENHANCE_KING: WeeklyRankingEntry[] = NAMES.map(
  (playerName, i) => ({
    rank: i + 1,
    playerName,
    weaponName: "—",
    enhanceLevel: 0,
    transcendLevel: 0,
    value: 520 - i * 28 + (i % 4) * 7,
  }),
);

/** 주간 초월왕 — 초월 성공 횟수 Mock */
export const MOCK_WEEKLY_TRANSCEND_KING: WeeklyRankingEntry[] = NAMES.map(
  (playerName, i) => ({
    rank: i + 1,
    playerName,
    weaponName: "—",
    enhanceLevel: 15,
    transcendLevel: Math.min(10, 8 - Math.floor(i / 4)),
    value: 42 - i * 2 + (i % 3),
  }),
);

/** 주간 판매왕 — 시즌 판매 골드 Mock */
export const MOCK_WEEKLY_SALES_KING: WeeklyRankingEntry[] = NAMES.map(
  (playerName, i) => ({
    rank: i + 1,
    playerName,
    weaponName: "—",
    enhanceLevel: 0,
    transcendLevel: 0,
    value: 85_000_000 - i * 4_100_000 + i * 50_000,
  }),
);

/** 월드레코드 Mock 상수 — 로컬 기록과 합성 */
export const MOCK_WORLD_HIGHEST_WEAPON_VALUE = 220_000_000;
export const MOCK_WORLD_HIGHEST_TRANSCEND_STAR = 10;
export const MOCK_WORLD_HIGHEST_SALE_GOLD = 195_000_000;
export const MOCK_WORLD_MOST_ENHANCE_ATTEMPTS = 50_000;
export const MOCK_WORLD_MOST_TRANSCEND_SUCCESSES = 12_000;

/** 월드 탭 카드용 — 세계 최고가 무기 (Mock 베이스) */
export const MOCK_WORLD_WEAPON_LEADER = {
  weaponName: "태양의 검",
  enhanceLevel: 15,
  transcendLevel: 10,
  rankingValue: MOCK_WORLD_HIGHEST_WEAPON_VALUE,
  holderName: "은빛장인",
};

/** 최고 초월 무기 (Mock 베이스) — 동률 시 가치 비교용 */
export const MOCK_WORLD_TRANSCEND_LEADER = {
  weaponName: "심연의 대검",
  transcendLevel: MOCK_WORLD_HIGHEST_TRANSCEND_STAR,
  rankingValue: 218_000_000,
  holderName: "별철장",
};

/** 단일 최고 판매가 (Mock 베이스) */
export const MOCK_WORLD_SALE_LEADER = {
  gold: MOCK_WORLD_HIGHEST_SALE_GOLD,
  weaponName: "달빛 창",
  holderName: "거북이",
};

/** 파괴된 전설 — Mock만 */
export const MOCK_WORLD_DESTROYED_LEGEND = {
  weaponName: "심연의 대검",
  enhanceLevel: 15,
  transcendLevel: 8,
  rankingValue: 142_000_000,
  holderName: "실종된 장인",
};

/** 하위 호환 — 주간 최강 무기 단일 목록 */
export const MOCK_WEEKLY_WEAPON_RANKINGS = MOCK_WEEKLY_STRONGEST_WEAPON;
