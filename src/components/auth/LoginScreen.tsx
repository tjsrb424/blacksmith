"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { isCrazyGamesBuild } from "@/lib/distribution";
import { useLocale } from "@/lib/i18n/useLocale";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

const CRAZY_GAMES_LABEL = ["Crazy", "Games"].join("");

type LoginScreenProps = {
  error?: string | null;
  authGateMode?: "required" | "optional" | "disabled";
  isCrazyGamesMode?: boolean;
};

function isMagicLinkRateLimit(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("email rate limit exceeded") ||
    (normalized.includes("rate limit") && normalized.includes("email"))
  );
}

function authErrorKey(error?: string | null) {
  if (!error) return null;
  if (error === "missing_code") return "error.loginMissingCode";
  if (error === "oauth_failed") return "error.googleLoginFailed";
  if (isMagicLinkRateLimit(error)) return "error.magicLinkRateLimited";
  return "error.loginFailed";
}

export function LoginScreen({
  error,
  authGateMode = "optional",
  isCrazyGamesMode = false,
}: LoginScreenProps) {
  const crazyGamesMode = isCrazyGamesMode || isCrazyGamesBuild();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(() => authErrorKey(error));
  const env = getSupabaseBrowserEnv();
  const envError = env.ok ? null : "error.loginSetupCheckFailed";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timerId = window.setInterval(() => {
      setCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [cooldown]);

  const magicButtonLabel = useMemo(() => {
    if (magicStatus === "sending") return t("login.sending");
    if (cooldown > 0) return t("login.resendCooldown", { seconds: cooldown });
    return t("login.getLink");
  }, [cooldown, magicStatus, t]);

  async function onGoogleSignIn() {
    if (crazyGamesMode) return;
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(envError);
      return;
    }

    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/play`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (signInError) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Google OAuth sign-in failed:", signInError);
      }
      setGoogleLoading(false);
      setMessage("error.googleLoginFailed");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(envError);
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("error.emailRequired");
      return;
    }

    setMagicStatus("sending");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/play`,
      },
    });

    if (signInError) {
      setMagicStatus("idle");
      setMessage(
        isMagicLinkRateLimit(signInError.message)
          ? "error.magicLinkRateLimited"
          : "error.magicLinkSendFailed",
      );
      return;
    }

    setMagicStatus("sent");
    setCooldown(60);
    setMessage("login.linkSent");
  }

  const displayMessage = message ? t(message) : null;
  const displayEnvError = envError ? t(envError) : null;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070708] px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-lg border border-amber-900/45 bg-[rgba(8,8,12,0.92)] p-6 shadow-2xl ring-1 ring-amber-800/25">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500/90">
            Account Link
          </p>
          <h1 className="text-2xl font-bold text-amber-50">
            {t("game.title")}
          </h1>
          <p className="text-sm leading-6 text-zinc-400">
            {crazyGamesMode
              ? t("login.crazyGamesSaveNotice", {
                  platform: CRAZY_GAMES_LABEL,
                })
              : authGateMode === "required"
              ? t("login.requiredDescription")
              : t("login.optionalDescription")}
          </p>
        </div>

        <div className="mt-6 space-y-5">
          {!crazyGamesMode ? (
            <>
              <FantasyButton
                type="button"
                className="w-full gap-3 bg-zinc-50 text-zinc-950 ring-zinc-200 hover:bg-white"
                disabled={
                  googleLoading || magicStatus === "sending" || Boolean(envError)
                }
                onClick={() => void onGoogleSignIn()}
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-white text-base font-bold text-blue-600 ring-1 ring-zinc-200">
                  G
                </span>
                {googleLoading ? t("start.googleMoving") : t("start.googleContinue")}
              </FantasyButton>

              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>{t("common.or")}</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-zinc-300">
                    {t("login.emailLinkLabel")}
                  </span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={
                      magicStatus === "sending" || googleLoading || Boolean(envError)
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-100 outline-none ring-amber-500/0 transition placeholder:text-zinc-600 focus:border-amber-600/70 focus:ring-2 focus:ring-amber-500/20"
                    placeholder="you@example.com"
                  />
                </label>

                <FantasyButton
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={
                    magicStatus === "sending" ||
                    cooldown > 0 ||
                    googleLoading ||
                    Boolean(envError)
                  }
                >
                  {magicButtonLabel}
                </FantasyButton>
              </form>
            </>
          ) : null}
        </div>

        {displayEnvError ? (
          <p className="mt-4 rounded-lg border border-red-800/60 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {displayEnvError}
          </p>
        ) : null}

        {displayMessage ? (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm leading-6 text-zinc-300">
            {displayMessage}
          </p>
        ) : null}
      </section>
      <div className="w-full max-w-md">
        <PublicFooter compact />
      </div>
    </main>
  );
}
