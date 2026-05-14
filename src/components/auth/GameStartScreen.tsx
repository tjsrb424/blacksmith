"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { SideBannerSlot } from "@/components/ads/SideBannerSlot";
import { BACKGROUND_ASSETS } from "@/data/assets";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

const NICKNAME_SUGGESTIONS = [
  "불꽃장인",
  "강철망치",
  "전설대장장이",
  "용광로왕",
  "황금모루",
] as const;

type GameStartScreenProps = {
  error?: string | null;
  onGuestStart: (nickname: string) => void;
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
        <SideBannerSlot
          slotName={side === "left" ? "side-banner-left" : "side-banner-right"}
        />
      </div>
    </aside>
  );
}

function validateStartNickname(input: string) {
  const nickname = input.trim();
  if (nickname.length < 2 || nickname.length > 12) {
    return { ok: false as const, message: "닉네임은 2~12자로 입력하세요." };
  }
  if (!/[^\s]/.test(nickname)) {
    return { ok: false as const, message: "공백만으로는 시작할 수 없습니다." };
  }
  return { ok: true as const, nickname };
}

export function GameStartScreen({ error, onGuestStart }: GameStartScreenProps) {
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<string | null>(error ?? null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const showDesktopSideRails = useDesktopSideRails();
  const env = getSupabaseBrowserEnv();
  const [suggestion, setSuggestion] = useState<string>(NICKNAME_SUGGESTIONS[0]);

  function submitGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateStartNickname(nickname || suggestion);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    onGuestStart(result.nickname);
  }

  async function onGoogleSignIn() {
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage(env.ok ? "Google 로그인 준비에 실패했습니다." : env.message);
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
      setMessage("Google 로그인에 실패했습니다. 잠시 후 다시 시도하세요.");
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050506] text-zinc-100">
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
          className="h-full w-full object-cover opacity-54 saturate-[0.9]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,3,4,0.62),rgba(5,5,6,0.72)_42%,rgba(3,3,4,0.95))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(245,158,11,0.26),transparent_34%),radial-gradient(circle_at_50%_76%,rgba(220,38,38,0.16),transparent_32%)]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-5 py-8 text-center">
        <div className="w-full">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-amber-300/90">
            Premium Forge RPG
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-amber-50 drop-shadow-[0_3px_18px_rgba(0,0,0,0.78)] sm:text-6xl">
            세계 최강의 대장장이
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-zinc-200/92 sm:text-base">
            불꽃과 강철로 무기를 벼리고, 최고가의 전설을 만들어 랭킹에 도전하세요.
          </p>

          <form
            onSubmit={submitGuest}
            className="mx-auto mt-8 w-full max-w-md rounded-lg border border-amber-500/28 bg-[rgba(6,6,8,0.78)] p-4 text-left shadow-[0_22px_70px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(251,191,36,0.08)] ring-1 ring-black/50 backdrop-blur-[3px] sm:p-5"
          >
            <label className="block">
              <span className="text-xs font-bold text-amber-100">
                닉네임
              </span>
              <input
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  if (message) setMessage(null);
                }}
                maxLength={12}
                autoComplete="nickname"
                className="mt-2 h-13 w-full rounded-md border border-amber-700/38 bg-zinc-950/86 px-4 text-base font-bold text-amber-50 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/18"
                placeholder="닉네임을 입력하세요"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="rounded px-1 py-1 font-semibold text-amber-200/86 hover:text-amber-100"
                onClick={() => {
                  const next =
                    NICKNAME_SUGGESTIONS[
                      Math.floor(Math.random() * NICKNAME_SUGGESTIONS.length)
                    ];
                  setSuggestion(next);
                  setNickname(next);
                  setMessage(null);
                }}
              >
                추천: {suggestion}
              </button>
              <span className="text-zinc-500">2~12자</span>
            </div>

            {message ? (
              <p className="mt-3 rounded-md border border-red-700/45 bg-red-950/38 px-3 py-2 text-sm text-red-100">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              className="mt-4 h-13 w-full rounded-md bg-[linear-gradient(180deg,#facc15,#f59e0b_58%,#b45309)] px-4 text-base font-black text-zinc-950 shadow-[0_14px_34px_rgba(245,158,11,0.32)] transition hover:brightness-110 active:translate-y-px"
            >
              시작하기
            </button>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-amber-900/35" />
              <span className="text-[11px] font-medium text-zinc-500">
                선택
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
              {googleLoading ? "Google로 이동 중..." : "Google 로그인"}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
              로그인 없이 바로 플레이할 수 있습니다. 계정 연동은 나중에도 가능합니다.
            </p>
          </form>
        </div>

        <footer className="mt-7 w-full text-xs text-zinc-500">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/how-to-play" className="hover:text-amber-200">
              게임 가이드
            </Link>
            <Link href="/terms" className="hover:text-amber-200">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-amber-200">
              개인정보처리방침
            </Link>
          </nav>
        </footer>
      </section>
    </main>
  );
}
