import type {
  BestWeaponSnapshot,
  EnhanceResult,
  OwnedWeapon,
  PlayerRecords,
  RankingCategory,
  RankingRowDisplay,
  RecordBreakInfo,
  SaleCompleteInfo,
  ScrapRewards,
  WeeklySeasonStats,
} from "@/types/game";
import type { TranscendAttemptResult } from "@/lib/transcend";
import type {
  OwnedWeaponRow,
  PlayerRecordRow,
  PlayerStateRow,
  ProfileRow,
} from "@/types/supabase";

export type GameMode = "local" | "beta";

export type ApiErrorResponse = {
  ok: false;
  code: string;
  message: string;
  retryable?: boolean;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type BetaPlayerSnapshot = {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  playerState: PlayerStateRow;
  ownedWeapons: OwnedWeaponRow[];
  playerRecord: PlayerRecordRow;
  records: PlayerRecords;
  weeklySeasonStats: WeeklySeasonStats;
  bestWeaponSnapshot: BestWeaponSnapshot | null;
  serverTime: string;
  currentSeason: {
    seasonId: string;
    startsAt: number;
    endsAt: number;
  };
};

export type PlayerMeResponse = BetaPlayerSnapshot;

export type PlayerBootstrapResponse = BetaPlayerSnapshot;

export type GuestRequestContext = {
  mode?: "guest";
  guestId?: string;
  guestSecret?: string;
  nickname?: string;
};

export type NicknameUpdateRequest = {
  nickname: string;
  mode?: "guest" | "authenticated";
  guestId?: string;
  guestSecret?: string;
};

export type NicknameUpdateResponse = {
  profile: ProfileRow;
  snapshot?: BetaPlayerSnapshot;
};

export type NicknameUpdateErrorResponse = {
  ok: false;
  error: string;
  message: string;
  reason:
    | "too_short"
    | "too_long"
    | "invalid_characters"
    | "profanity"
    | "reserved"
    | "duplicate"
    | "cooldown";
  cooldownRemainingMs?: number;
  cooldownRemainingSeconds?: number;
};

export type NicknameValidateRequest = {
  nickname: string;
};

export type NicknameValidateResponse =
  | {
      ok: true;
      nickname: string;
      normalizedNickname: string;
    }
  | {
      ok: false;
      reason:
        | "too_short"
        | "too_long"
        | "invalid_characters"
        | "profanity"
        | "reserved"
        | "duplicate"
        | "cooldown";
      message: string;
    };

export type PlayerLifecycleStatus =
  | "active"
  | "guest"
  | "linked"
  | "archived"
  | "deleted";

export type PlayerLifecycleSummary = {
  playerId: string;
  nickname: string | null;
  playMode: "auth" | "guest";
  status: PlayerLifecycleStatus;
  highestEnhance: number;
  gold: number;
  bestWeaponValue: number;
  rankingScore: number;
  updatedAt: string | null;
};

export type LinkGuestCheckRequest = {
  guestId?: string;
  guestSecret?: string;
};

export type LinkGuestCheckResponse =
  | {
      status: "can_link";
      guestSummary: PlayerLifecycleSummary;
      authSummary?: null;
    }
  | {
      status: "conflict";
      guestSummary: PlayerLifecycleSummary;
      authSummary: PlayerLifecycleSummary;
    }
  | {
      status: "already_linked";
      guestSummary: PlayerLifecycleSummary;
      snapshot: BetaPlayerSnapshot;
    }
  | {
      status: "invalid_guest";
      message: string;
    };

export type LinkGuestConfirmChoice = "link_guest" | "use_auth" | "use_guest" | "cancel";

export type LinkGuestConfirmRequest = LinkGuestCheckRequest & {
  choice: LinkGuestConfirmChoice;
};

export type LinkGuestConfirmResponse =
  | {
      status: "linked" | "use_auth" | "use_guest";
      message: string;
      snapshot: BetaPlayerSnapshot;
      guestSummary?: PlayerLifecycleSummary;
      authSummary?: PlayerLifecycleSummary;
    }
  | {
      status: "conflict";
      message: string;
      guestSummary: PlayerLifecycleSummary;
      authSummary: PlayerLifecycleSummary;
    }
  | {
      status: "cancelled";
      message: string;
    }
  | {
      status: "invalid_guest";
      message: string;
    };

export type GuestResetRequest = {
  guestId?: string;
  guestSecret?: string;
};

export type LifecycleActionResponse = {
  ok: true;
  message: string;
};

export type ServerPlayerProfile = {
  playerId: string;
  displayName: string;
  createdAt: string;
  seasonId: string;
  resources: {
    gold: number;
    ember: number;
    transcendStone: number;
  };
  records: PlayerRecords;
  weeklySeasonStats: WeeklySeasonStats;
  bestWeaponSnapshot: BestWeaponSnapshot | null;
};

export type ServerOwnedWeapon = OwnedWeapon & {
  serverUpdatedAt: string;
};

export type UntrustedRankingCandidateDisplay = {
  weaponName?: string;
  enhanceLevel?: number;
  transcendLevel?: number;
  durability?: number;
  rankingValue?: number;
};

export type RankingCandidateSubmitPayload = GuestRequestContext & {
  playerId: string;
  weaponInstanceId: string;
  seasonId: string;
  actionId: string;
  clientCreatedAt: string;
  display?: UntrustedRankingCandidateDisplay;
};

export type RankingSubmissionStatus =
  | "accepted"
  | "duplicate"
  | "rejected"
  | "queued";

export type RankingSubmissionResponse = {
  status: RankingSubmissionStatus;
  seasonId: string;
  actionId: string;
  serverRankingValue?: number;
  serverRank?: number;
  reason?: string;
};

export type WeeklyRankingRequest = {
  category: RankingCategory;
  seasonId: string;
  playerId?: string;
};

export type WeeklyRankingResponse = {
  category: RankingCategory;
  seasonId: string;
  rows: RankingRowDisplay[];
  playerRank: number | null;
  serverCalculatedAt: string;
};

export type WorldWeaponRecord = {
  weaponName: string;
  weaponId?: string;
  enhanceLevel: number;
  transcendLevel: number;
  rankingValue: number;
  holderName: string;
  isPlayer: boolean;
};

export type WorldSaleRecord = {
  gold: number;
  weaponName: string;
  weaponId?: string;
  holderName: string;
  isPlayer: boolean;
};

export type WorldCountRecord = {
  value: number;
  holderName: string;
  isPlayer: boolean;
};

export type DestroyedLegendRecord = WorldWeaponRecord;

export type WorldRecordsResponse = {
  highestWeapon: WorldWeaponRecord;
  bestTranscend: WorldWeaponRecord;
  bestSale: WorldSaleRecord;
  mostEnhanceAttempts: WorldCountRecord;
  mostTranscendSuccesses: WorldCountRecord;
  destroyedLegend: DestroyedLegendRecord;
  serverCalculatedAt: string;
};

export type PlayerRecordResponse = {
  playerId: string;
  seasonId: string;
  records: PlayerRecords;
  weeklySeasonStats: WeeklySeasonStats;
  bestWeaponSnapshot: BestWeaponSnapshot | null;
  serverCalculatedAt: string;
};

export type GameActionBaseRequest = GuestRequestContext & {
  playerId?: string;
  actionId: string;
  clientCreatedAt: string;
};

export type EnhanceActionRequest = GameActionBaseRequest & {
  weaponInstanceId: string;
};

export type TranscendActionRequest = GameActionBaseRequest & {
  weaponInstanceId: string;
};

export type SellActionRequest = GameActionBaseRequest & {
  weaponInstanceId: string;
  adBonusRequested?: boolean;
  sellMode?: "normal" | "adBonus";
};

export type BuyActionRequest = GameActionBaseRequest & {
  weaponId: string;
};

export type ForgeCollectActionRequest = GameActionBaseRequest & {
  adBonusRequested?: boolean;
  collectMode?: "normal" | "adBonus";
};

export type ForgeUpgradeActionRequest = GameActionBaseRequest;

export type ServerActionDisplay =
  | {
      kind: "buy";
      weaponId?: string;
      weaponName: string;
    }
  | {
      kind: "enhance";
      weaponId?: string;
      weaponName: string;
      result: EnhanceResult;
      recordBreak?: RecordBreakInfo;
    }
  | {
      kind: "transcend";
      weaponId?: string;
      weaponName: string;
      weaponImagePath: string;
      result: TranscendAttemptResult;
      recordBreak?: RecordBreakInfo;
    }
  | {
      kind: "sell";
      info: SaleCompleteInfo;
      rankingValue: number;
    }
  | {
      kind: "forgeCollect";
      gained: number;
      basePending: number;
      usedAd: boolean;
      bonusAmount: number;
    }
  | {
      kind: "forgeUpgrade";
      previousLevel: number;
      newLevel: number;
      costGold: number;
    };

export type ServerActionPatch = {
  currentGold?: number;
  currentEmber?: number;
  currentStone?: number;
  forgeLevel?: number;
  forgeLastCollectedAt?: string;
  changedWeapon?: OwnedWeaponRow;
  removedWeaponId?: string;
  equippedWeaponId?: string | null;
  records?: PlayerRecords;
  weeklySeasonStats?: WeeklySeasonStats;
  bestWeaponSnapshot?: BestWeaponSnapshot | null;
};

export type ServerGameActionResponse = {
  actionId: string;
  actionType:
    | "ad_reward"
    | "buy"
    | "enhance"
    | "transcend"
    | "sell"
    | "forge_collect"
    | "forge_upgrade"
    | "ranking_submit";
  status: "applied" | "replayed";
  snapshot?: BetaPlayerSnapshot;
  patch?: ServerActionPatch;
  display?: ServerActionDisplay;
  debug?: {
    mutationPath: "rpc" | "legacy";
    rpcName:
      | "apply_buy_action_v1"
      | "apply_enhance_action_v1"
      | "apply_sell_action_v1"
      | "apply_forge_collect_action_v1"
      | "apply_forge_upgrade_action_v1";
    rpcApplied: boolean;
    fallbackAllowed: boolean;
  };
};

export type GameActionResult = {
  actionId: string;
  player: ServerPlayerProfile;
  ownedWeapons: ServerOwnedWeapon[];
  serverCreatedAt: string;
};

export type EnhanceActionResponse = GameActionResult & {
  result:
    | {
        type: "success";
        beforeLevel: number;
        afterLevel: number;
      }
    | {
        type: "fail";
        beforeDurability: number;
        afterDurability: number;
      }
    | {
        type: "destroyed";
        scrapRewards: ScrapRewards;
      };
};

export type TranscendActionResponse = GameActionResult & {
  result:
    | {
        type: "success";
        beforeLevel: number;
        afterLevel: number;
      }
    | {
        type: "fail";
        beforeDurability: number;
        afterDurability: number;
      }
    | {
        type: "destroyed";
        scrapRewards: ScrapRewards;
      };
};

export type SellActionResponse = GameActionResult & {
  saleGold: number;
  rankingValue: number;
};

export type BuyActionResponse = GameActionResult & {
  weapon: ServerOwnedWeapon;
};

export type ForgeCollectActionResponse = GameActionResult & {
  gainedEmber: number;
  basePending: number;
  adBonusGranted: boolean;
};
