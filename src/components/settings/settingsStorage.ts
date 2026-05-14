"use client";

import { detectInitialLocale } from "@/lib/i18n/detectLocale";
import { saveLocale } from "@/lib/i18n/localeStorage";
import {
  isSupportedLocale,
  LOCALE_LABELS,
  type SupportedLocale,
} from "@/lib/i18n/locales";

export const SETTINGS_LANGUAGE_STORAGE_KEY = "blacksmith.settings.language";

export const SETTINGS_LANGUAGE_OPTIONS: Array<{
  value: SupportedLocale;
  label: string;
}> = [
  { value: "ko", label: LOCALE_LABELS.ko },
  { value: "en", label: LOCALE_LABELS.en },
  { value: "ja", label: LOCALE_LABELS.ja },
  { value: "zh-TW", label: LOCALE_LABELS["zh-TW"] },
];

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getSettingsLanguage(): SupportedLocale {
  const storage = getStorage();
  const saved = storage?.getItem(SETTINGS_LANGUAGE_STORAGE_KEY);
  if (saved && isSupportedLocale(saved)) return saved;
  return detectInitialLocale();
}

export function setSettingsLanguage(locale: SupportedLocale): void {
  const storage = getStorage();
  if (!storage || !isSupportedLocale(locale)) return;
  storage.setItem(SETTINGS_LANGUAGE_STORAGE_KEY, locale);
  saveLocale(locale);
}
