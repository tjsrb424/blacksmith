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
import { ApiRequestError } from "@/lib/server/http";
import { bootstrapPlayerSnapshot } from "@/lib/server/playerApi";
import { updatePerformanceMetric } from "@/lib/performanceMetrics";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGameMode, getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { useGameStore } from "@/store/gameStore";
import type {
  BetaPlayerSnapshot,
  NicknameUpdateResponse,
} from "@/types/server";

type AuthStage =
  | "checking_session"
  | "bootstrap_loading"
  | "syncing_store"
  | "ready"
  | "error";

type BetaPlayerContextValue = {
  snapshot: BetaPlayerSnapshot | null;
  refresh: () => Promise<void>;
};

const BetaPlayerContext = createContext<BetaPlayerContextValue>({
  snapshot: null,
  refresh: async () => {},
});

function getFriendlyLoadError(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === "request_timeout") {
    return "서버 응답이 지연되고 있습니다. 다시 시도해주세요.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "서버 저장 데이터를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.";
}

function getOriginLabel() {
  if (typeof window === "undefined") return "-";
  return window.location.origin;
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
  const [stage, setStage] = useState<AuthStage>("checking_session");
  const [stageStartedAt, setStageStartedAt] = useState(() => Date.now());
  const [stageElapsedMs, setStageElapsedMs] = useState(0);
  const [debugOrigin, setDebugOrigin] = useState("-");
  const [authAttempt, setAuthAttempt] = useState(0);
  const supabaseEnv = getSupabaseBrowserEnv();

  const setAuthStage = useCallback((nextStage: AuthStage) => {
    const now = Date.now();
    setStage(nextStage);
    setStageStartedAt(now);
    setStageElapsedMs(0);
    updatePerformanceMetric({
      authStage: nextStage,
      authStageElapsedMs: 0,
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => setDebugOrigin(getOriginLabel()));
  }, []);

  useEffect(() => {
    if (stage === "ready") return;
    const timer = window.setInterval(() => {
      setStageElapsedMs(Date.now() - stageStartedAt);
    }, 250);
    return () => window.clearInterval(timer);
  }, [stage, stageStartedAt]);

  const authError = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("auth_error");
  }, []);

  const retryAuthCheck = useCallback(() => {
    setSession(null);
    setSnapshot(null);
    setError(null);
    setAuthChecked(false);
    setLoadingSnapshot(false);
    setAuthStage("checking_session");
    setAuthAttempt((value) => value + 1);
  }, [setAuthStage]);

  const refresh = useCallback(async () => {
    setLoadingSnapshot(true);
    setError(null);
    setAuthStage("bootstrap_loading");
    const bootstrapStartedAt = Date.now();

    try {
      const nextSnapshot = await bootstrapPlayerSnapshot();
      updatePerformanceMetric({
        bootstrapElapsedMs: Date.now() - bootstrapStartedAt,
      });
      setAuthStage("syncing_store");
      const syncStartedAt = Date.now();
      setSnapshot(nextSnapshot);
      useGameStore.getState().syncFromServerPlayerMe(nextSnapshot);
      updatePerformanceMetric({
        playerSyncElapsedMs: Date.now() - syncStartedAt,
        lastStoreSyncElapsedMs: Date.now() - syncStartedAt,
      });
      setAuthStage("ready");
    } catch (loadError) {
      setAuthStage("error");
      setError(getFriendlyLoadError(loadError));
    } finally {
      setLoadingSnapshot(false);
    }
  }, [setAuthStage]);

  const signOutAndReset = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    setSnapshot(null);
    setSession(null);
    setError(null);
    setAuthChecked(false);
    setAuthStage("checking_session");
    if (supabase) await supabase.auth.signOut();
    setAuthChecked(true);
  }, [setAuthStage]);

  useEffect(() => {
    if (mode !== "beta") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => {
        setError("로그인 설정을 확인하지 못했습니다.");
        setAuthStage("error");
        setAuthChecked(true);
      });
      return;
    }

    let mounted = true;
    let finished = false;
    const startedAt = Date.now();

    queueMicrotask(() => {
      if (!mounted) return;
      setAuthStage("checking_session");
      setError(null);
    });

    const finish = (nextStage: AuthStage) => {
      finished = true;
      updatePerformanceMetric({
        authStage: nextStage,
        authStageElapsedMs: Date.now() - startedAt,
      });
    };

    const watchdog = window.setTimeout(() => {
      if (!mounted || finished) return;
      finish("error");
      setError("로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.");
      setAuthStage("error");
      setAuthChecked(true);
    }, 10_000);

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted || finished) return;
        finish("ready");
        setSession(data.session);
        setAuthStage("ready");
        setAuthChecked(true);
      })
      .catch((sessionError: unknown) => {
        if (!mounted || finished) return;
        finish("error");
        setError(getFriendlyLoadError(sessionError));
        setAuthStage("error");
        setAuthChecked(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) setSnapshot(null);
      if (!finished) finish("ready");
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, [authAttempt, mode, setAuthStage]);

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
      <AuthLoading
        stage={stage}
        stageElapsedMs={stageElapsedMs}
        debugOrigin={debugOrigin}
        message="로그인 상태 확인 중..."
      />
    );
  }

  if (error && !snapshot && stage === "error") {
    return (
      <AuthErrorPanel
        error={error}
        stage={stage}
        stageElapsedMs={stageElapsedMs}
        debugOrigin={debugOrigin}
        onRetry={session ? () => void refresh() : retryAuthCheck}
        onReloadServer={session ? () => void refresh() : retryAuthCheck}
        onSignOut={() => void signOutAndReset()}
      />
    );
  }

  if (!session) {
    return <LoginScreen error={authError} />;
  }

  if (loadingSnapshot && !snapshot) {
    return (
      <AuthLoading
        stage={stage}
        stageElapsedMs={stageElapsedMs}
        debugOrigin={debugOrigin}
        message="서버 프로필 불러오는 중..."
      />
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

function AuthLoading({
  message,
  stage,
  stageElapsedMs,
  debugOrigin,
}: {
  message: string;
  stage: AuthStage;
  stageElapsedMs: number;
  debugOrigin: string;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-center text-sm text-zinc-500">
      <div>
        <p>{message}</p>
        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-2 space-y-1 font-mono text-xs text-zinc-700">
            <p>{stage}</p>
            <p>{stageElapsedMs}ms</p>
            <p>{debugOrigin}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthErrorPanel({
  error,
  stage,
  stageElapsedMs,
  debugOrigin,
  onRetry,
  onReloadServer,
  onSignOut,
}: {
  error: string;
  stage: AuthStage;
  stageElapsedMs: number;
  debugOrigin: string;
  onRetry: () => void;
  onReloadServer: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-zinc-100">
      <section className="w-full max-w-md rounded-xl border border-red-800/60 bg-red-950/25 p-5 shadow-2xl">
        <h1 className="text-lg font-bold text-red-100">서버 연결 오류</h1>
        <p className="mt-2 text-sm leading-6 text-red-200/90">{error}</p>
        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-3 space-y-1 font-mono text-xs text-red-200/50">
            <p>stage: {stage}</p>
            <p>elapsed: {stageElapsedMs}ms</p>
            <p>origin: {debugOrigin}</p>
          </div>
        ) : null}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            className="rounded-lg bg-red-900/70 px-4 py-3 text-sm font-semibold text-red-50"
            onClick={onRetry}
          >
            다시 시도
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-800/70 px-4 py-3 text-sm font-semibold text-red-100"
            onClick={onReloadServer}
          >
            서버 데이터 다시 불러오기
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200"
            onClick={onSignOut}
          >
            로그아웃하고 다시 로그인
          </button>
        </div>
      </section>
    </main>
  );
}
