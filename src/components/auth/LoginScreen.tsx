"use client";

import { FormEvent, useState } from "react";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

type LoginScreenProps = {
  error?: string | null;
};

export function LoginScreen({ error }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(error ?? null);
  const env = getSupabaseBrowserEnv();
  const envError = env.ok ? null : env.message;

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

    setStatus("sending");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setStatus("idle");
      setMessage(signInError.message);
      return;
    }

    setStatus("sent");
    setMessage("로그인 링크를 보냈습니다. 이메일을 확인해주세요.");
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-xl border border-amber-900/45 bg-[rgba(8,8,12,0.92)] p-6 shadow-2xl ring-1 ring-amber-800/25">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">
            Beta Server Mode
          </p>
          <h1 className="text-2xl font-bold text-amber-50">
            세계 최강의 대장장이
          </h1>
          <p className="text-sm text-zinc-400">
            베타 랭킹 테스트를 위해 이메일 로그인 후 프로필을 생성합니다.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-zinc-300">이메일</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={status === "sending" || Boolean(envError)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-100 outline-none ring-amber-500/0 transition placeholder:text-zinc-600 focus:border-amber-600/70 focus:ring-2 focus:ring-amber-500/20"
              placeholder="you@example.com"
            />
          </label>

          <FantasyButton
            type="submit"
            className="w-full"
            disabled={status === "sending" || Boolean(envError)}
          >
            {status === "sending" ? "전송 중..." : "로그인 링크 받기"}
          </FantasyButton>
        </form>

        {envError ? (
          <p className="mt-4 rounded-lg border border-red-800/60 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {envError}
          </p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
