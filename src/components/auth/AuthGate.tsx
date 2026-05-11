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
import {
  diagnosticLog,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGameMode, getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
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

function getUserAgentShort() {
  if (typeof navigator === "undefined") return "-";
  const ua = navigator.userAgent;
  if (ua.includes("CriOS")) return "iOS Chrome";
  if (ua.includes("Safari") && ua.includes("Mobile")) return "iOS Safari";
  if (ua.includes("Chrome")) return "Chrome";
  return ua.slice(0, 48);
}

export function useBetaPlayer() {
  return useContext(BetaPlayerContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  useRenderDiagnostics("AuthGate");
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
  const [userAgentShort, setUserAgentShort] = useState("-");
  const [lastAuthEvent, setLastAuthEvent] = useState("init");
  const [lastAuthError, setLastAuthError] = useState("-");
  const [authAttempt, setAuthAttempt] = useState(0);
  const supabaseEnv = getSupabaseBrowserEnv();

  const setAuthStage = useCallback((nextStage: AuthStage) => {
    const now = Date.now();
    diagnosticLog("auth", "stage changed", { stage: nextStage });
    setStage(nextStage);
    setStageStartedAt(now);
    setStageElapsedMs(0);
    updatePerformanceMetric({
      authStage: nextStage,
      authStageElapsedMs: 0,
    });
  }, []);

  const setAuthEvent = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      diagnosticLog("auth", event, details);
      setLastAuthEvent(event);
      updatePerformanceMetric({
        lastAuthEvent: event,
        authAttempt,
        gameMode: mode,
        origin: getOriginLabel(),
        userAgentShort: getUserAgentShort(),
      });
    },
    [authAttempt, mode],
  );

  const setAuthFailure = useCallback((message: string) => {
    setLastAuthError(message);
    updatePerformanceMetric({ lastAuthError: message });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const origin = getOriginLabel();
      const ua = getUserAgentShort();
      setDebugOrigin(origin);
      setUserAgentShort(ua);
      setLastAuthEvent("component_mounted");
      updatePerformanceMetric({
        gameMode: mode,
        origin,
        userAgentShort: ua,
        authAttempt,
        lastAuthEvent: "component_mounted",
      });
      diagnosticLog("auth", "component mounted", {
        gameMode: mode,
        origin,
        userAgent: ua,
        authAttempt,
      });
    });
  }, [authAttempt, mode]);

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
    setAuthEvent("retry_auth_check");
    setSession(null);
    setSnapshot(null);
    setError(null);
    setAuthChecked(false);
    setLoadingSnapshot(false);
    setAuthStage("checking_session");
    setAuthAttempt((value) => value + 1);
  }, [setAuthEvent, setAuthStage]);

  const refresh = useCallback(async () => {
    setLoadingSnapshot(true);
    setError(null);
    setAuthStage("bootstrap_loading");
    setAuthEvent("bootstrap started");
    const bootstrapStartedAt = Date.now();

    try {
      const nextSnapshot = await bootstrapPlayerSnapshot();
      setAuthEvent("bootstrap resolved", {
        elapsedMs: Date.now() - bootstrapStartedAt,
      });
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
      const message = getFriendlyLoadError(loadError);
      setAuthEvent("bootstrap rejected", {
        message,
      });
      setAuthFailure(message);
      setAuthStage("error");
      setError(message);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [setAuthEvent, setAuthFailure, setAuthStage]);

  const signOutAndReset = useCallback(async () => {
    setAuthEvent("sign_out_requested");
    const supabase = createSupabaseBrowserClient();
    setSnapshot(null);
    setSession(null);
    setError(null);
    setAuthChecked(false);
    setAuthStage("checking_session");
    if (supabase) await supabase.auth.signOut();
    setAuthChecked(true);
  }, [setAuthEvent, setAuthStage]);

  useEffect(() => {
    if (mode !== "beta") {
      queueMicrotask(() => setAuthEvent("local_mode_skip_auth"));
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => {
        const message = "로그인 설정을 확인하지 못했습니다.";
        setAuthEvent("supabase_client_missing");
        setAuthFailure(message);
        setError(message);
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
      setAuthEvent("checking_session started", { authAttempt });
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
      const message = "로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.";
      setAuthEvent("getSession timeout", { elapsedMs: Date.now() - startedAt });
      setAuthFailure(message);
      setError(message);
      setAuthStage("error");
      setAuthChecked(true);
    }, 10_000);

    queueMicrotask(() => {
      if (mounted) setAuthEvent("getSession called", { authAttempt });
    });
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted || finished) return;
        finish("ready");
        setAuthEvent("getSession resolved", {
          hasSession: Boolean(data.session),
          userId:
            process.env.NODE_ENV !== "production"
              ? data.session?.user.id.slice(0, 8)
              : undefined,
        });
        setSession(data.session);
        setAuthStage("ready");
        setAuthChecked(true);
      })
      .catch((sessionError: unknown) => {
        if (!mounted || finished) return;
        finish("error");
        const message = getFriendlyLoadError(sessionError);
        setAuthEvent("getSession rejected", { message });
        setAuthFailure(message);
        setError(message);
        setAuthStage("error");
        setAuthChecked(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setAuthEvent("onAuthStateChange event", {
        event: _event,
        hasSession: Boolean(nextSession),
      });
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
  }, [authAttempt, mode, setAuthEvent, setAuthFailure, setAuthStage]);

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
        userAgentShort={userAgentShort}
        gameMode={mode}
        authAttempt={authAttempt}
        lastAuthEvent={lastAuthEvent}
        lastAuthError={lastAuthError}
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
        userAgentShort={userAgentShort}
        gameMode={mode}
        authAttempt={authAttempt}
        lastAuthEvent={lastAuthEvent}
        lastAuthError={lastAuthError}
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
        userAgentShort={userAgentShort}
        gameMode={mode}
        authAttempt={authAttempt}
        lastAuthEvent={lastAuthEvent}
        lastAuthError={lastAuthError}
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
  userAgentShort,
  gameMode,
  authAttempt,
  lastAuthEvent,
  lastAuthError,
}: {
  message: string;
  stage: AuthStage;
  stageElapsedMs: number;
  debugOrigin: string;
  userAgentShort: string;
  gameMode: string;
  authAttempt: number;
  lastAuthEvent: string;
  lastAuthError: string;
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
            <p>mode: {gameMode}</p>
            <p>ua: {userAgentShort}</p>
            <p>attempt: {authAttempt}</p>
            <p>event: {lastAuthEvent}</p>
            <p>error: {lastAuthError}</p>
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
  userAgentShort,
  gameMode,
  authAttempt,
  lastAuthEvent,
  lastAuthError,
  onRetry,
  onReloadServer,
  onSignOut,
}: {
  error: string;
  stage: AuthStage;
  stageElapsedMs: number;
  debugOrigin: string;
  userAgentShort: string;
  gameMode: string;
  authAttempt: number;
  lastAuthEvent: string;
  lastAuthError: string;
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
            <p>mode: {gameMode}</p>
            <p>ua: {userAgentShort}</p>
            <p>attempt: {authAttempt}</p>
            <p>event: {lastAuthEvent}</p>
            <p>last error: {lastAuthError}</p>
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
