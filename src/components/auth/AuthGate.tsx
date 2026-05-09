"use client";

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { NicknameSetupModal } from "@/components/auth/NicknameSetupModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGameMode, getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { useGameStore } from "@/store/gameStore";
import type {
  BetaPlayerSnapshot,
  NicknameUpdateResponse,
} from "@/types/server";

type BetaPlayerContextValue = {
  snapshot: BetaPlayerSnapshot | null;
  refresh: () => Promise<void>;
};

const BetaPlayerContext = createContext<BetaPlayerContextValue>({
  snapshot: null,
  refresh: async () => {},
});

function isErrorBody(body: unknown): body is { error?: string } {
  return Boolean(body && typeof body === "object" && "error" in body);
}

export function useBetaPlayer() {
  return useContext(BetaPlayerContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const mode = getGameMode();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [snapshot, setSnapshot] = useState<BetaPlayerSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseEnv = getSupabaseBrowserEnv();

  const authError = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("auth_error");
  }, []);

  const refresh = useCallback(async () => {
    setLoadingSnapshot(true);
    setError(null);
    try {
      const response = await fetch("/api/player/bootstrap", {
        method: "POST",
      });
      const body = (await response.json()) as
        | BetaPlayerSnapshot
        | { error?: string };

      if (!response.ok || isErrorBody(body)) {
        throw new Error(
          isErrorBody(body) && body.error
            ? body.error
            : "플레이어 정보를 불러오지 못했습니다.",
        );
      }

      setSnapshot(body);
      useGameStore.getState().syncFromServerPlayerMe(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "플레이어 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "beta") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setAuthChecked(true));
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setSnapshot(null);
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "beta" || !session) return;
    const id = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [mode, refresh, session]);

  const contextValue = useMemo(
    () => ({ snapshot, refresh }),
    [refresh, snapshot],
  );

  if (mode !== "beta") {
    return (
      <BetaPlayerContext.Provider value={contextValue}>
        {children}
      </BetaPlayerContext.Provider>
    );
  }

  if (!supabaseEnv.ok) {
    return <LoginScreen error={supabaseEnv.message} />;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] text-sm text-zinc-500">
        로그인 상태 확인 중...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen error={authError} />;
  }

  if (loadingSnapshot && !snapshot) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] text-sm text-zinc-500">
        서버 프로필 불러오는 중...
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-zinc-100">
        <section className="w-full max-w-md rounded-xl border border-red-800/60 bg-red-950/25 p-5">
          <h1 className="text-lg font-bold text-red-100">서버 연결 오류</h1>
          <p className="mt-2 text-sm text-red-200/90">{error}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-red-900/70 px-4 py-2 text-sm font-semibold text-red-50"
            onClick={() => void refresh()}
          >
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  return (
    <BetaPlayerContext.Provider value={contextValue}>
      {children}
      {snapshot && !snapshot.profile.nickname ? (
        <NicknameSetupModal
          onSaved={(response: NicknameUpdateResponse) => {
            setSnapshot({
              ...snapshot,
              profile: response.profile,
            });
          }}
        />
      ) : null}
    </BetaPlayerContext.Provider>
  );
}
