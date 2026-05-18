"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { detectInitialLocale, getDefaultLocale } from "@/lib/i18n/detectLocale";
import { saveLocale } from "@/lib/i18n/localeStorage";
import {
  isSupportedLocale,
  type SupportedLocale,
} from "@/lib/i18n/locales";
import { t as translate } from "@/lib/i18n/t";

type TranslationParams = Record<string, string | number>;

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: TranslationParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getDefaultLocale);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      const detected = detectInitialLocale();
      setLocaleState(detected);
      saveLocale(detected);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    const safeLocale = isSupportedLocale(nextLocale)
      ? nextLocale
      : getDefaultLocale();
    setLocaleState(safeLocale);
    saveLocale(safeLocale);
  }, []);

  const translateWithLocale = useCallback(
    (key: string, params?: TranslationParams) =>
      translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: translateWithLocale,
    }),
    [locale, setLocale, translateWithLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
