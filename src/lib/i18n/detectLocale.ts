import { DEFAULT_LOCALE, type SupportedLocale } from "./locales";
import { getSavedLocale } from "./localeStorage";

export function normalizeLocale(locale: string): SupportedLocale {
  const normalized = locale.trim().replace("_", "-");
  const lowerLocale = normalized.toLowerCase();

  if (lowerLocale === "ko" || lowerLocale.startsWith("ko-")) {
    return "ko";
  }

  if (lowerLocale === "ja" || lowerLocale.startsWith("ja-")) {
    return "ja";
  }

  if (
    lowerLocale === "zh-tw" ||
    lowerLocale === "zh-hk" ||
    lowerLocale === "zh-mo" ||
    lowerLocale === "zh-hant" ||
    lowerLocale.startsWith("zh-hant-")
  ) {
    return "zh-TW";
  }

  if (lowerLocale === "en" || lowerLocale.startsWith("en-")) {
    return "en";
  }

  return DEFAULT_LOCALE;
}

function getNavigatorLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}

export function detectInitialLocale(): SupportedLocale {
  const savedLocale = getSavedLocale();
  if (savedLocale) {
    return savedLocale;
  }

  for (const language of getNavigatorLanguages()) {
    const detectedLocale = normalizeLocale(language);
    if (detectedLocale !== DEFAULT_LOCALE || language.toLowerCase().startsWith("en")) {
      return detectedLocale;
    }
  }

  return DEFAULT_LOCALE;
}
