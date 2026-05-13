"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { PublicFooter } from "@/components/public/PublicFooter";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

type LoginScreenProps = {
  error?: string | null;
  authGateMode?: "required" | "optional" | "disabled";
};

const MAGIC_LINK_RATE_LIMIT_MESSAGE =
  "이메일 발송 제한에 걸렸습니다. 잠시 후 다시 시도하거나 Google 로그인을 이용해주세요.";

function isMagicLinkRateLimit(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("email rate limit exceeded") ||
    (normalized.includes("rate limit") && normalized.includes("email"))
  );
}

function formatAuthError(error?: string | null) {
  if (!error) return null;
  if (error === "missing_code") {
    return "로그인 인증 코드가 없습니다. 다시 시도해주세요.";
  }
  if (error === "oauth_failed") {
    return "Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (isMagicLinkRateLimit(error)) {
    return MAGIC_LINK_RATE_LIMIT_MESSAGE;
  }
  return error;
}

export function LoginScreen({ error, authGateMode = "optional" }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(() =>
    formatAuthError(error),
  );
  const env = getSupabaseBrowserEnv();
  const envError = env.ok ? null : env.message;

  useEffect(() => {
    if (cooldown <= 0) return;

    const timerId = window.setInterval(() => {
      setCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [cooldown]);

  const magicButtonLabel = useMemo(() => {
    if (magicStatus === "sending") return "전송 중...";
    if (cooldown > 0) return `다시 보내기까지 ${cooldown}초`;
    return "로그인 링크 받기";
  }, [cooldown, magicStatus]);

  async function onGoogleSignIn() {
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(envError ?? "Supabase env is missing.");
      return;
    }

    if (typeof window === "undefined") {
      setMessage("Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
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
      setMessage("Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(envError ?? "Supabase env is missing.");
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("이메일을 입력해주세요.");
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
          ? MAGIC_LINK_RATE_LIMIT_MESSAGE
          : signInError.message,
      );
      return;
    }

    setMagicStatus("sent");
    setCooldown(60);
    setMessage("로그인 링크를 보냈습니다. 이메일을 확인해주세요.");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#070708] px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-lg border border-amber-900/45 bg-[rgba(8,8,12,0.92)] p-6 shadow-2xl ring-1 ring-amber-800/25">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-amber-500/90">
            Beta Server Mode
          </p>
          <h1 className="text-2xl font-bold text-amber-50">
            세계 최강의 대장장이
          </h1>
          <p className="text-sm leading-6 text-zinc-400">
            {authGateMode === "required"
              ? "베타 랭킹 테스트를 위해 로그인 후 프로필을 생성합니다."
              : "로그인 없이 공개 페이지를 먼저 둘러볼 수 있습니다. Google 로그인 시 진행 상황 저장, 랭킹 등록, 월드레코드 기록이 가능합니다."}
          </p>
        </div>

        <div className="mt-6 space-y-5">
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
            {googleLoading ? "Google로 이동 중..." : "Google로 계속하기"}
          </FantasyButton>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <div className="h-px flex-1 bg-zinc-800" />
            <span>또는</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-zinc-300">
                이메일로 로그인 링크 받기
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
        </div>

        {envError ? (
          <p className="mt-4 rounded-lg border border-red-800/60 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {envError}
          </p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm leading-6 text-zinc-300">
            {message}
          </p>
        ) : null}
      </section>
      <div className="w-full max-w-md">
        <PublicFooter compact />
      </div>
    </main>
  );
}
