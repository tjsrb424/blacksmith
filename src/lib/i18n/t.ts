import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import zhTW from "@/locales/zh-TW.json";
import { DEFAULT_LOCALE, type SupportedLocale } from "./locales";

type LocaleMessages = Record<string, unknown>;

const MESSAGES: Record<SupportedLocale, LocaleMessages> = {
  ko,
  en,
  ja,
  "zh-TW": zhTW,
};

function readDotPath(messages: LocaleMessages, key: string): string | null {
  let current: unknown = messages;

  for (const segment of key.split(".")) {
    if (!segment || typeof current !== "object" || current === null || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : null;
}

export function t(locale: SupportedLocale, key: string): string {
  return (
    readDotPath(MESSAGES[locale], key) ??
    readDotPath(MESSAGES[DEFAULT_LOCALE], key) ??
    key
  );
}
