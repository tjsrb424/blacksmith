"use client";

import { useLocale } from "@/lib/i18n/useLocale";

type SettingsButtonProps = {
  onClick: () => void;
};

export function SettingsButton({ onClick }: SettingsButtonProps) {
  const { t } = useLocale();

  return (
    <button
      type="button"
      aria-label={t("settings.open")}
      title={t("settings.title")}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-[linear-gradient(180deg,rgba(63,63,70,0.72),rgba(24,24,27,0.92))] text-lg font-black text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.18),0_8px_20px_rgba(0,0,0,0.28)] transition hover:border-amber-300/55 hover:text-amber-50 active:translate-y-px"
    >
      ⚙
    </button>
  );
}
