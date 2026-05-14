import { isSupportedLocale, type SupportedLocale } from "./locales";

export const LOCALE_STORAGE_KEY = "blacksmith_locale";
export const LEGACY_LOCALE_STORAGE_KEY = "blacksmith.settings.language";

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getSavedLocale(): SupportedLocale | null {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return null;
  }

  const savedLocale =
    storage.getItem(LOCALE_STORAGE_KEY) ??
    storage.getItem(LEGACY_LOCALE_STORAGE_KEY);
  if (!savedLocale || !isSupportedLocale(savedLocale)) return null;

  return savedLocale;
}

export function saveLocale(locale: SupportedLocale): void {
  const storage = getBrowserLocalStorage();
  if (!storage || !isSupportedLocale(locale)) {
    return;
  }

  storage.setItem(LOCALE_STORAGE_KEY, locale);
  storage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
}
