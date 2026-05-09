import {
  getBackgroundImagePath,
  getWeaponFallbackImagePath,
  type ScreenKey,
} from "@/data/assets";
import { WEAPONS_BY_ID } from "@/data/weapons";
import type { NavTab } from "@/types/game";

export function navTabToScreenKey(tab: NavTab): ScreenKey {
  switch (tab) {
    case "blacksmith":
      return "blacksmith";
    case "shop":
      return "shop";
    case "forge":
      return "forge";
    case "inventory":
      return "inventory";
    case "ranking":
      return "ranking";
    default:
      return "blacksmith";
  }
}

function preloadUrl(url: string): void {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** 초기 로딩 — 플레이스홀더 + 현재 탭 배경 + 장착 무기 이미지만 */
export function preloadBootstrapAssets(opts: {
  screen: ScreenKey;
  equippedWeaponId?: string | null;
}): void {
  preloadUrl(getWeaponFallbackImagePath());
  preloadUrl(getBackgroundImagePath(opts.screen));
  const path = opts.equippedWeaponId
    ? WEAPONS_BY_ID[opts.equippedWeaponId]?.imagePath
    : undefined;
  if (path) preloadUrl(path);
}

/** 탭 전환 시 해당 배경만 선로드 */
export function preloadScreenBackground(screen: ScreenKey): void {
  preloadUrl(getBackgroundImagePath(screen));
}

/** 무기 미리보기(상점 첫 카드 등) — 과다 호출 금지 */
export function preloadWeaponImages(ids: string[]): void {
  const slice = ids.slice(0, 6);
  for (const id of slice) {
    const p = WEAPONS_BY_ID[id]?.imagePath;
    if (p) preloadUrl(p);
  }
}
