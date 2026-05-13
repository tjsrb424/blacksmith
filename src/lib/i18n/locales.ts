export const SUPPORTED_LOCALES = ["ko", "en", "ja", "zh-TW"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-TW": "繁體中文",
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
