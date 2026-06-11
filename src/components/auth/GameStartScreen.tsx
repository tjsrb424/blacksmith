"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { BACKGROUND_ASSETS } from "@/data/assets";
import { isCrazyGamesBuild } from "@/lib/distribution";
import { useLocale } from "@/lib/i18n/useLocale";
import { areExternalAdsEnabled } from "@/lib/platform";
import type { SideBannerSlotName } from "@/lib/ads/sideAds";
import { type NicknameValidationReason, validateNickname } from "@/lib/player/nickname";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { NicknameValidateResponse } from "@/types/server";

const CRAZY_GAMES_LABEL = ["Crazy", "Games"].join("");
const SideBannerSlot = dynamic(
  areExternalAdsEnabled
    ? () =>
        import("@/components/ads/SideBannerSlot").then(
          (mod) => mod.SideBannerSlot,
        )
    : () => Promise.resolve(() => null),
  { ssr: false },
);

type GameStartScreenProps = {
  error?: string | null;
  onGuestStart: (
    nickname: string,
    options?: { serverMode?: "online" | "offline" },
  ) => void;
  isCrazyGamesMode?: boolean;
};

function useDesktopSideRails() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1200px)");
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return enabled;
}

function StartSideRail({ side }: { side: "left" | "right" }) {
  const slotName: SideBannerSlotName =
    side === "left" ? "side-banner-left" : "side-banner-right";

  return (
    <aside
      className={`fixed top-0 z-20 hidden min-h-dvh w-[220px] items-center justify-center px-3 xl:flex ${
        side === "left" ? "left-0" : "right-0"
      }`}
      aria-hidden
      data-side-rail={side}
    >
      <div className="absolute inset-0 bg-black/26" />
      <div className="relative z-10">
        <SideBannerSlot slotName={slotName} />
      </div>
    </aside>
  );
}

function nicknameReasonKey(reason: NicknameValidationReason) {
  return `nickname.${reason}`;
}

export function GameStartScreen({
  error,
  onGuestStart,
  isCrazyGamesMode = false,
}: GameStartScreenProps) {
  const crazyGamesMode = isCrazyGamesMode || isCrazyGamesBuild();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<string | null>(error ?? null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestStarting, setGuestStarting] = useState(false);
  const desktopSideRailsEnabled = useDesktopSideRails();
  const showDesktopSideRails = desktopSideRailsEnabled && !crazyGamesMode;
  const env = getSupabaseBrowserEnv();
  const { locale, t } = useLocale();
  const eyebrowTrackingClass =
    locale === "en" ? "tracking-[0.26em]" : "tracking-[0.08em]";

  async function submitGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guestStarting) return;

    const result = validateNickname(nickname);
    if (!result.ok) {
      setMessage(t(nicknameReasonKey(result.reason)));
      return;
    }

    setGuestStarting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/player/nickname/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: result.nickname }),
      });
      const body = (await response.json()) as NicknameValidateResponse;
      if (response.status >= 500) {
        onGuestStart(result.nickname, { serverMode: "offline" });
        return;
      }
      if (!response.ok || !body.ok) {
        setMessage(body.ok ? t("error.nicknameValidateFailed") : t(nicknameReasonKey(body.reason)));
        return;
      }

      onGuestStart(body.nickname);
    } catch {
      onGuestStart(result.nickname, { serverMode: "offline" });
    } finally {
      setGuestStarting(false);
    }
  }

  async function onGoogleSignIn() {
    if (crazyGamesMode) return;
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(env.ok ? t("error.googleLoginSetup") : env.message);
      return;
    }

    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/play`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (signInError) {
      setGoogleLoading(false);
      setMessage(t("error.googleLoginFailed"));
    }
  }

  return (
    <main className="game-no-select relative min-h-dvh overflow-hidden bg-[#050506] text-zinc-100">
      {showDesktopSideRails ? (
        <>
          <StartSideRail side="left" />
          <StartSideRail side="right" />
        </>
      ) : null}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BACKGROUND_ASSETS.forge}
          alt=""
          draggable={false}
          className="h-full w-full object-cover opacity-54 saturate-[0.9]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,3,4,0.62),rgba(5,5,6,0.72)_42%,rgba(3,3,4,0.95))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(245,158,11,0.26),transparent_34%),radial-gradient(circle_at_50%_76%,rgba(220,38,38,0.16),transparent_32%)]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-5 py-8 text-center">
        <div className="w-full">
          <p className={`text-xs font-bold uppercase ${eyebrowTrackingClass} text-amber-300/90`}>
            {t("login.eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-amber-50 drop-shadow-[0_3px_18px_rgba(0,0,0,0.78)] sm:text-6xl">
            {t("login.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-zinc-200/92 sm:text-base">
            {t("login.subtitle")}
          </p>

          <form
            onSubmit={submitGuest}
            className="mx-auto mt-8 w-full max-w-md rounded-lg border border-amber-500/28 bg-[rgba(6,6,8,0.78)] p-4 text-left shadow-[0_22px_70px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-black/50 backdrop-blur-[3px] sm:p-5"
          >
            <label className="block">
              <span className="text-xs font-bold text-amber-100">
                {t("start.nickname")}
              </span>
              <input
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (message) setMessage(null);
                }}
                disabled={guestStarting}
                maxLength={12}
                autoComplete="nickname"
                className="mt-2 h-13 w-full rounded-md border border-amber-700/38 bg-zinc-950/86 px-4 text-base font-bold text-amber-50 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={t("start.nicknamePlaceholder")}
              />
            </label>
            <div className="mt-2 text-xs text-zinc-500">
              <span>{t("start.nicknameRule")}</span>
            </div>

            {message ? (
              <p className="mt-3 rounded-md border border-red-700/45 bg-red-950/38 px-3 py-2 text-sm text-red-100">
                {message.includes(".") ? t(message) : message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={guestStarting}
              className="mt-4 h-13 w-full rounded-md bg-[linear-gradient(180deg,#facc15,#f59e0b_58%,#b45309)] px-4 text-base font-black text-zinc-950 shadow-[0_14px_34px_rgba(245,158,11,0.32)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guestStarting ? t("common.checking") : t("common.start")}
            </button>

            {!crazyGamesMode ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-amber-900/35" />
                  <span className="text-[11px] font-medium text-zinc-500">
                    {t("common.optional")}
                  </span>
                  <div className="h-px flex-1 bg-amber-900/35" />
                </div>

                <button
                  type="button"
                  disabled={googleLoading || !env.ok}
                  onClick={() => void onGoogleSignIn()}
                  className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-700/75 bg-zinc-950/58 px-4 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-600">
                    G
                  </span>
                  {googleLoading ? t("start.googleMoving") : t("start.googleLogin")}
                </button>
              </>
            ) : null}

            <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
              {crazyGamesMode
                ? t("login.crazyGamesSaveNotice", {
                    platform: CRAZY_GAMES_LABEL,
                  })
                : t("start.guestNotice")}
            </p>
          </form>
        </div>

        <footer className="mt-7 w-full text-xs text-zinc-500">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/how-to-play" className="hover:text-amber-200">
              {t("links.gameGuide")}
            </Link>
            <Link href="/terms" className="hover:text-amber-200">
              {t("links.terms")}
            </Link>
            <Link href="/privacy" className="hover:text-amber-200">
              {t("links.privacy")}
            </Link>
          </nav>
        </footer>
      </section>
    </main>
  );
}
