/**
 * SFX 키·경로·기본 게인(0~1).
 * 최종 볼륨 = baseVolume × masterVolume × (UI 계열 ? uiVolume : effectVolume) × 옵션 배수.
 */

export const SOUND_BASE_PATH = "/assets/blacksmith/sounds";

export const SOUND_PATHS = {
  uiClick: `${SOUND_BASE_PATH}/ui_click.mp3`,
  uiModalOpen: `${SOUND_BASE_PATH}/ui_modal_open.mp3`,
  uiModalClose: `${SOUND_BASE_PATH}/ui_modal_close.mp3`,
  uiError: `${SOUND_BASE_PATH}/ui_error.mp3`,
  enhanceStart: `${SOUND_BASE_PATH}/enhance_start.mp3`,
  enhanceHammerHit: `${SOUND_BASE_PATH}/enhance_hammer_hit.mp3`,
  enhanceSuccess: `${SOUND_BASE_PATH}/enhance_success.mp3`,
  enhanceFail: `${SOUND_BASE_PATH}/enhance_fail.mp3`,
  durabilityDamage: `${SOUND_BASE_PATH}/durability_damage.mp3`,
  weaponDestroyed: `${SOUND_BASE_PATH}/weapon_destroyed.mp3`,
  transcendStart: `${SOUND_BASE_PATH}/transcend_start.mp3`,
  transcendSuccess: `${SOUND_BASE_PATH}/transcend_success.mp3`,
  transcendFail: `${SOUND_BASE_PATH}/transcend_fail.mp3`,
  weaponPurchase: `${SOUND_BASE_PATH}/weapon_purchase.mp3`,
  weaponSell: `${SOUND_BASE_PATH}/weapon_sell.mp3`,
  forgeCollect: `${SOUND_BASE_PATH}/forge_collect.mp3`,
  recordNew: `${SOUND_BASE_PATH}/record_new.mp3`,
} as const;

export type SoundKey = keyof typeof SOUND_PATHS;

/** 에셋별 추천 게인 (마스터·카테고리 볼륨 적용 전) */
export const BASE_VOLUME: Record<SoundKey, number> = {
  uiClick: 0.35,
  uiModalOpen: 0.4,
  uiModalClose: 0.35,
  uiError: 0.45,
  enhanceStart: 0.5,
  enhanceHammerHit: 0.55,
  enhanceSuccess: 0.65,
  enhanceFail: 0.55,
  durabilityDamage: 0.5,
  weaponDestroyed: 0.75,
  transcendStart: 0.55,
  transcendSuccess: 0.7,
  transcendFail: 0.6,
  weaponPurchase: 0.55,
  weaponSell: 0.55,
  forgeCollect: 0.5,
  recordNew: 0.75,
};

/** UI 계열 — uiVolume 승수 적용 */
export const UI_SOUND_KEYS = new Set<SoundKey>([
  "uiClick",
  "uiModalOpen",
  "uiModalClose",
  "uiError",
]);
