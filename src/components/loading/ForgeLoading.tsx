"use client";

import { useLocale } from "@/lib/i18n/useLocale";

type ForgeLoadingProps = {
  title?: string;
  description?: string;
};

export function ForgeLoading({
  title,
  description,
}: ForgeLoadingProps) {
  const { t } = useLocale();
  const loadingTitle = title ?? t("loading.forgePreparing");
  const loadingDescription = description ?? t("loading.progressLoading");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-center text-zinc-300">
      <div className="w-full max-w-xs rounded-lg border border-amber-900/35 bg-black/46 px-5 py-7 shadow-2xl ring-1 ring-amber-700/15">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-[radial-gradient(circle,rgba(245,158,11,0.32),rgba(24,24,27,0.88)_58%,rgba(0,0,0,0.92))] shadow-[0_0_34px_rgba(245,158,11,0.2)]">
          <span className="forge-loader-hammer text-2xl" aria-hidden>
            ⚒
          </span>
        </div>
        <p className="mt-5 text-sm font-black text-amber-50">{loadingTitle}</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{loadingDescription}</p>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-amber-900/20">
          <div className="forge-loader-bar h-full w-1/3 rounded-full bg-gradient-to-r from-amber-700 via-amber-300 to-orange-600" />
        </div>
      </div>
    </div>
  );
}
