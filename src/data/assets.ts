import type { WeaponGrade } from "@/types/game";
import { cn } from "@/lib/cn";

export const BLACKSMITH_ASSET_BASE = "/assets/blacksmith";

export const BACKGROUND_ASSETS = {
  forge: `${BLACKSMITH_ASSET_BASE}/backgrounds/forge_main_bg.png`,
  shop: `${BLACKSMITH_ASSET_BASE}/backgrounds/weapon_shop_bg.png`,
  forgeMachine: `${BLACKSMITH_ASSET_BASE}/backgrounds/auto_forge_bg.png`,
  inventory: `${BLACKSMITH_ASSET_BASE}/backgrounds/inventory_bg.png`,
  ranking: `${BLACKSMITH_ASSET_BASE}/backgrounds/ranking_hall_bg.png`,
} as const;

export const TAB_ICONS = {
  blacksmith: `${BLACKSMITH_ASSET_BASE}/bottom_tab_icons/tab_blacksmith_on.png`,
  shop: `${BLACKSMITH_ASSET_BASE}/bottom_tab_icons/tab_shop_on.png`,
  forge: `${BLACKSMITH_ASSET_BASE}/bottom_tab_icons/tab_forge_on.png`,
  inventory: `${BLACKSMITH_ASSET_BASE}/bottom_tab_icons/tab_inventory_on.png`,
  ranking: `${BLACKSMITH_ASSET_BASE}/bottom_tab_icons/tab_ranking_on.png`,
} as const;

export const CARD_FRAMES: Record<WeaponGrade, string> = {
  D: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_d.png`,
  C: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_c.png`,
  B: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_b.png`,
  A: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_a.png`,
  S: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_s.png`,
  SS: `${BLACKSMITH_ASSET_BASE}/card_frames/card_frame_ss.png`,
};

export const CURRENCY_ICONS = {
  gold: `${BLACKSMITH_ASSET_BASE}/currency/currency_gold.png`,
  ember: `${BLACKSMITH_ASSET_BASE}/currency/currency_ember.png`,
  transcendStone: `${BLACKSMITH_ASSET_BASE}/currency/currency_transcend_stone.png`,
} as const;

export const MODAL_FRAMES = {
  common: `${BLACKSMITH_ASSET_BASE}/modals/modal_frame_bg.png`,
  record: `${BLACKSMITH_ASSET_BASE}/modals/record_modal_bg.png`,
  forge: `${BLACKSMITH_ASSET_BASE}/modals/title_bg.png`,
} as const;

export const EFFECT_ASSETS = {
  destructionCrack: `${BLACKSMITH_ASSET_BASE}/effects/effect_destruction_crack.png`,
  /** 보상/제련 연출용 — 파일명이 burst여도 동일 스프라이트 매핑 가능 */
  emberBurst: `${BLACKSMITH_ASSET_BASE}/effects/effect_ember_particle.png`,
  emberParticle: `${BLACKSMITH_ASSET_BASE}/effects/effect_ember_particle.png`,
  failSmoke: `${BLACKSMITH_ASSET_BASE}/effects/effect_fail_smoke.png`,
  forgeGlow: `${BLACKSMITH_ASSET_BASE}/effects/effect_forge_glow.png`,
  successFlash: `${BLACKSMITH_ASSET_BASE}/effects/effect_success_flash.png`,
  transcendAura: `${BLACKSMITH_ASSET_BASE}/effects/effect_transcend_aura.png`,
  transcendStar: `${BLACKSMITH_ASSET_BASE}/effects/effect_transcend_star.png`,
} as const;

export const PLACEHOLDER_ASSETS = {
  weapon: "/assets/placeholders/weapon_placeholder.svg",
} as const;

export type ScreenKey =
  | "blacksmith"
  | "shop"
  | "forge"
  | "inventory"
  | "ranking";

export function weaponPortraitPath(displayName: string): string {
  return `${BLACKSMITH_ASSET_BASE}/weapons/${encodeURIComponent(`${displayName}.png`)}`;
}

export function getWeaponFallbackImagePath(): string {
  return PLACEHOLDER_ASSETS.weapon;
}

export function getCardFramePath(grade: WeaponGrade): string {
  return CARD_FRAMES[grade];
}

export function getBackgroundImagePath(screen: ScreenKey): string {
  switch (screen) {
    case "blacksmith":
      return BACKGROUND_ASSETS.forge;
    case "shop":
      return BACKGROUND_ASSETS.shop;
    case "forge":
      return BACKGROUND_ASSETS.forgeMachine;
    case "inventory":
      return BACKGROUND_ASSETS.inventory;
    case "ranking":
      return BACKGROUND_ASSETS.ranking;
    default:
      return BACKGROUND_ASSETS.forge;
  }
}

/** 배경 이미지 위 어두운 마스크 — 화면별로 조금씩 다르게 (배경이 은은히 보이도록) */
export function getScreenBackgroundOverlayClass(screen: ScreenKey): string {
  switch (screen) {
    case "blacksmith":
      return "bg-gradient-to-b from-black/30 via-black/8 to-black/42";
    case "shop":
      return "bg-gradient-to-b from-black/28 via-black/10 to-black/40";
    case "forge":
      return "bg-gradient-to-b from-black/24 via-black/6 to-black/38";
    case "inventory":
      return "bg-gradient-to-b from-black/34 via-black/12 to-black/46";
    case "ranking":
      return "bg-gradient-to-b from-slate-950/38 via-slate-950/12 to-black/48";
    default:
      return "bg-gradient-to-b from-black/32 via-black/12 to-black/44";
  }
}

export function getScreenFallbackGradientClass(screen: ScreenKey): string {
  switch (screen) {
    case "blacksmith":
      return "bg-[radial-gradient(ellipse_at_50%_20%,rgba(234,88,12,0.12),transparent_50%),linear-gradient(180deg,#0c0a09_0%,#050506_100%)]";
    case "shop":
      return "bg-[linear-gradient(165deg,#12100c_0%,#080706_45%,#050505_100%)]";
    case "forge":
      return "bg-[radial-gradient(ellipse_at_50%_60%,rgba(234,88,12,0.2),transparent_55%),linear-gradient(180deg,#1a0a08_0%,#060302_100%)]";
    case "inventory":
      return "bg-[linear-gradient(180deg,#0f0f12_0%,#050506_100%)]";
    case "ranking":
      return "bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)]";
    default:
      return "bg-zinc-950";
  }
}

export function getRarityFrameClass(grade: WeaponGrade): string {
  const map: Record<WeaponGrade, string> = {
    D: "ring-zinc-600/25 shadow-[0_0_0_1px_rgba(82,82,91,0.15)]",
    C: "ring-slate-500/25 shadow-[0_0_12px_rgba(148,163,184,0.08)]",
    B: "ring-sky-600/25 shadow-[0_0_14px_rgba(56,189,248,0.1)]",
    A: "ring-violet-600/25 shadow-[0_0_14px_rgba(167,139,250,0.1)]",
    S: "ring-amber-600/30 shadow-[0_0_16px_rgba(245,158,11,0.12)]",
    SS: "ring-rose-500/30 shadow-[0_0_18px_rgba(251,113,133,0.12)]",
  };
  return map[grade];
}

export function getRarityArtBackdropClass(grade: WeaponGrade): string {
  const map: Record<WeaponGrade, string> = {
    D: "from-zinc-900/90 via-zinc-950 to-black",
    C: "from-slate-900/85 via-zinc-950 to-black",
    B: "from-sky-950/40 via-zinc-950 to-black",
    A: "from-violet-950/35 via-zinc-950 to-black",
    S: "from-amber-950/30 via-zinc-950 to-black",
    SS: "from-rose-950/35 via-zinc-950 to-black",
  };
  return cn("bg-gradient-to-b", map[grade]);
}
