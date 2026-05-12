/** 무기 등급 — 카드 프레임·표시용 (D~SS) */
export type WeaponGrade = "D" | "C" | "B" | "A" | "S" | "SS";

export type WeaponType =
  | "sword"
  | "greatsword"
  | "dagger"
  | "spear"
  | "axe"
  | "hammer"
  | "bow"
  | "staff";

export type AdRewardProgressPhase =
  | "preparing"
  | "loading"
  | "showing"
  | "completing"
  | "completed"
  | "unavailable"
  | "notCompleted";

export type WeaponDefinition = {
  id: string;
  name: string;
  grade: WeaponGrade;
  type: WeaponType;
  tier: number;
  basePrice: number;
  imagePath: string;
};

export type OwnedWeapon = {
  instanceId: string;
  weaponId: string;
  enhanceLevel: number;
  transcendLevel: number;
  durability: number;
  locked: boolean;
  createdAt: number;
  bestValue: number;
};

export type ScrapRewards = {
  gold: number;
  ember: number;
  transcendStone: number;
};

export type EnhanceResult =
  | {
      type: "success";
      beforeLevel: number;
      afterLevel: number;
      beforeValue: number;
      afterValue: number;
    }
  | {
      type: "fail";
      level: number;
      beforeDurability: number;
      afterDurability: number;
      destroyed: false;
    }
  | {
      type: "destroyed";
      level: number;
      scrapRewards: ScrapRewards;
      weaponName: string;
    };

/** 강화 연출용 — persist 제외, 애니메이션 후 `finalizeEnhanceOutcome`로 반영 */
export type EnhanceAnimationTier = "fast" | "heavy";

export type EnhancePendingResolution = {
  instanceId: string;
  weaponId: string;
  result: EnhanceResult;
  enhanceRecordBreak: boolean;
  tier: EnhanceAnimationTier;
};

export type PlayerRecords = {
  weeklyBestValue: number;
  totalEnhanceAttempts: number;
  totalEnhanceSuccesses: number;
  totalSalesGold: number;
  bestSaleGold: number;
  soldWeaponCount: number;
  /** 제련로에서 실제 획득한 제련의 불씨 누적 */
  totalForgeCollected: number;
  /** 광고 Mock 2배로 추가로 받은 불씨 누적 */
  totalForgeAdBonusCollected: number;
  forgeCollectCount: number;
  forgeAdCollectCount: number;
  /** 역대 최고 랭킹 가치 (신기록 판정용, 파괴·판매 후에도 유지) */
  personalBestRankingValue: number;
  transcendAttemptCount: number;
  transcendSuccessCount: number;
  transcendFailCount: number;
  maxTranscendLevel: number;
  /** 초월 성공으로 달성한 무기 중 최고 랭킹 가치 */
  bestTranscendedWeaponValue: number;
  transcendDestroyedCount: number;
  enhanceFailCount: number;
  enhanceDestroyedCount: number;
  /** 강화·초월 등 무기 파괴 총합 */
  destroyedWeaponCount: number;
  /** 역대 달성 최고 강화 단계 */
  maxEnhanceLevel: number;
};

/** 영구 보존 — 판매·파괴 후에도 유지되는 최고 무기 스냅샷 */
export type BestWeaponSnapshot = {
  weaponId: string;
  weaponName: string;
  enhanceLevel: number;
  transcendLevel: number;
  durability: number;
  rankingValue: number;
  achievedAt: number;
};

/** 현재 주간 시즌 로컬 통계 — 시즌 바뀌면 초기화 */
export type WeeklySeasonStats = {
  seasonId: string;
  weeklyStrongestWeaponValue: number;
  weeklyStrongestWeaponName: string;
  weeklyStrongestEnhanceLevel: number;
  weeklyStrongestTranscendLevel: number;
  enhanceSuccessesThisSeason: number;
  transcendSuccessesThisSeason: number;
  salesGoldThisSeason: number;
};

export type SaveDataV1 = {
  version: 1;
  gold: number;
  ember: number;
  transcendStone: number;
  ownedWeapons: OwnedWeapon[];
  equippedWeaponId: string | null;
  forgeLevel: number;
  forgeLastCollectAt: number;
  records: PlayerRecords;
  /** 역대 최고 무기 스냅샷 (보관함과 무관) */
  bestWeaponSnapshot: BestWeaponSnapshot | null;
  weeklySeasonStats: WeeklySeasonStats;
  /** 마지막으로 시즌 통계를 맞춘 시즌 ID */
  storedSeasonId: string;
  /** 마지막으로 시즌 시작 안내를 확인한 시즌 ID */
  lastAcknowledgedSeasonId: string;
};

export type NavTab =
  | "blacksmith"
  | "shop"
  | "forge"
  | "inventory"
  | "ranking";

export type SellMode = "normal" | "adBonus";

export type RecordBreakInfo = {
  previousBest: number;
  newBest: number;
  delta?: number;
  isPersonalBest?: boolean;
  isWeeklyTop100?: boolean;
  estimatedWeeklyRank?: number;
};

/** 판매 완료 모달용 */
export type SaleCompleteInfo = {
  saleType?: "normal" | "adBonus";
  soldWeaponId?: string;
  weaponId?: string;
  weaponName: string;
  enhanceLevel: number;
  transcendLevel: number;
  baseSaleGold: number;
  bonusGold?: number;
  finalSaleGold: number;
  rankingValue?: number;
  usedAdBonus: boolean;
  wasEquipped: boolean;
};

export type ModalPayload =
  | {
      kind: "enhance_confirm";
      weaponName: string;
      targetLevel: number;
      successRatePercent: number;
      costEmber: number;
      durabilityLossOnFail: boolean;
      currentDurability: number;
    }
  | {
      kind: "enhance_success";
      result: Extract<EnhanceResult, { type: "success" }>;
      weaponName: string;
      recordBreak?: RecordBreakInfo;
    }
  | {
      kind: "enhance_fail";
      result: Extract<EnhanceResult, { type: "fail" }>;
      weaponName: string;
    }
  | {
      kind: "weapon_destroyed";
      result: Extract<EnhanceResult, { type: "destroyed" }>;
      /** 초월 실패로 파괴된 경우 UI 문구 분기 */
      destroyCause?: "enhance" | "transcend";
    }
  | {
      kind: "buy_confirm";
      weapon: WeaponDefinition;
    }
  | {
      kind: "buy_success";
      weaponName: string;
    }
  | {
      kind: "offline_forge_reward";
      offlineDurationMs: number;
      offlineDurationLabel: string;
      forgeLevel: number;
      ratePerMinute: number;
      maxAccumulateMinutes: number;
      storageCap: number;
      pendingBase: number;
      pendingAdDouble: number;
      isStorageFull: boolean;
      hitTimeCap: boolean;
    }
  | {
      kind: "forge_collect_complete";
      gained: number;
      basePending: number;
      usedAd: boolean;
    }
  | {
      kind: "forge_upgrade_confirm";
      currentLevel: number;
      nextLevel: number;
      currentRate: number;
      nextRate: number;
      currentMaxMinutes: number;
      nextMaxMinutes: number;
      costGold: number;
      playerGold: number;
    }
  | {
      kind: "forge_upgrade_success";
      newLevel: number;
    }
  | {
      kind: "sell_confirm";
      instanceId: string;
      weapon: WeaponDefinition;
      owned: OwnedWeapon;
      saleGold: number;
      adSaleGold: number;
      rankingValue: number;
    }
  | {
      kind: "sell_success";
      info: SaleCompleteInfo;
    }
  | {
      kind: "ad_reward_progress";
      phase: AdRewardProgressPhase;
      message: string;
    }
  | {
      kind: "sell_locked_notice";
    }
  | {
      kind: "transcend_confirm";
      instanceId: string;
      weapon: WeaponDefinition;
      owned: OwnedWeapon;
      nextStar: number;
      successRatePercent: number;
      stoneCost: number;
      transcendStoneOwned: number;
      currentRankingValue: number;
      expectedRankingValue: number;
      currentSaleGold: number;
      expectedSaleGold: number;
    }
  | {
      kind: "transcend_success";
      weaponName: string;
      weaponImagePath: string;
      beforeStar: number;
      afterStar: number;
      beforeRankingValue: number;
      afterRankingValue: number;
      beforeSaleGold: number;
      afterSaleGold: number;
      recordBreak?: RecordBreakInfo;
    }
  | {
      kind: "transcend_fail";
      weaponName: string;
      transcendLevel: number;
      beforeDurability: number;
      afterDurability: number;
      stoneCost: number;
    }
  | {
      kind: "season_started";
      seasonId: string;
      endsAt: number;
    }
  | {
      kind: "server_error";
      title?: string;
      message: string;
    };

export type ModalState = ModalPayload | null;

/** Mock 테이블 행 (순위는 합성 시 재계산) */
export type WeeklyRankingEntry = {
  rank: number;
  playerName: string;
  weaponName: string;
  enhanceLevel: number;
  transcendLevel: number;
  value: number;
};

/** 서버 연동 전 확장용 랭킹 항목 */
export type RankingCategory =
  | "weeklyStrongestWeapon"
  | "weeklyEnhancementKing"
  | "weeklyTranscendKing"
  | "weeklySalesKing";

export type RankingRowDisplay = {
  rank: number;
  userId?: string;
  nickname?: string | null;
  playerName: string;
  weaponName: string;
  weaponId?: string | null;
  enhanceLevel: number;
  transcendLevel: number;
  /** 주간 최강 무기 = rankingValue, 그 와 카테고리는 score */
  value: number;
  score: number;
  rankingValue?: number;
  isPlayer: boolean;
  createdAt?: number;
};
