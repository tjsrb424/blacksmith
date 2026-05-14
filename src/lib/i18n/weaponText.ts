import { t } from "@/lib/i18n/t";
import type { SupportedLocale } from "@/lib/i18n/locales";
import type { WeaponDefinition, WeaponGrade, WeaponType } from "@/types/game";

type WeaponDisplaySource =
  | Pick<WeaponDefinition, "id" | "name">
  | {
      id?: string | null;
      weaponId?: string | null;
      name?: string | null;
      weaponName?: string | null;
    }
  | null
  | undefined;

function translatedOrNull(locale: SupportedLocale, key: string) {
  const value = t(locale, key);
  return value === key ? null : value;
}

export function getWeaponDisplayName(
  locale: SupportedLocale,
  weapon: WeaponDisplaySource,
): string {
  const weaponId =
    weapon && "weaponId" in weapon ? weapon.weaponId : weapon?.id;
  const fallback =
    weapon && "weaponName" in weapon ? weapon.weaponName : weapon?.name;

  if (weaponId) {
    const translated = translatedOrNull(locale, `weapons.names.${weaponId}`);
    if (translated) return translated;
  }

  return fallback?.trim() || t(locale, "weapon.unknown");
}

export function getWeaponDisplayNameById(
  locale: SupportedLocale,
  weaponId?: string | null,
  fallback?: string | null,
): string {
  return getWeaponDisplayName(locale, {
    weaponId,
    weaponName: fallback,
  });
}

export function getWeaponGradeLabel(
  locale: SupportedLocale,
  grade: WeaponGrade,
): string {
  return translatedOrNull(locale, `grade.${grade}`) ?? grade;
}

export function getWeaponTypeLabel(
  locale: SupportedLocale,
  type: WeaponType,
): string {
  return translatedOrNull(locale, `weaponType.${type}`) ?? type;
}
