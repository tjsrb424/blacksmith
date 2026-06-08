"use client";

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GameStartScreen } from "@/components/auth/GameStartScreen";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { NicknameSetupModal } from "@/components/auth/NicknameSetupModal";
import { ForgeLoading } from "@/components/loading/ForgeLoading";
import { ApiRequestError } from "@/lib/server/http";
import {
  bootstrapPlayerSnapshot,
  invalidatePlayerApiCache,
} from "@/lib/server/playerApi";
import {
  clearGuestProfile,
  clearPendingGuestLink,
  getPendingGuestLink,
  getGuestProfile,
  isOfflineGuestPlayActive,
  markAuthenticatedPlay,
  startGuestPlay,
  type PendingGuestLink,
  type GuestProfile,
} from "@/lib/player/guest";
import {
  diagnosticLog,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import { useLocale } from "@/lib/i18n/useLocale";
import { isCrazyGamesBuild } from "@/lib/distribution";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGameMode, getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { useRenderDiagnostics } from "@/lib/useRenderDiagnostics";
import { useGameStore } from "@/store/gameStore";
import type {
  BetaPlayerSnapshot,
  LinkGuestCheckResponse,
  LinkGuestConfirmResponse,
  PlayerLifecycleSummary,
  NicknameUpdateResponse,
} from "@/types/server";

type AuthGateMode = "required" | "optional" | "disabled";

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
    return "error.requestTimeout";
  }
  if (error instanceof Error && error.message) return error.message;
  return "error.progressLoadFailed";
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

function getAuthGateMode(): AuthGateMode {
  const mode = process.env.NEXT_PUBLIC_AUTH_GATE_MODE;
  if (mode === "required" || mode === "disabled") return mode;
  return "optional";
}

export function useBetaPlayer() {
  return useContext(BetaPlayerContext);
}

export function AuthGate({
  children,
  isCrazyGamesMode = false,
}: {
  children: ReactNode;
  isCrazyGamesMode?: boolean;
}) {
  useRenderDiagnostics("AuthGate");
  const { t } = useLocale();
  const crazyGamesMode = isCrazyGamesMode || isCrazyGamesBuild();
  const mode = getGameMode();
  const authGateMode = getAuthGateMode();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [snapshot, setSnapshot] = useState<BetaPlayerSnapshot | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
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
  const [pendingGuestLink, setPendingGuestLink] =
    useState<PendingGuestLink | null>(null);
  const [linkChecking, setLinkChecking] = useState(false);
  const [linkConflict, setLinkConflict] = useState<{
    guestSummary: PlayerLifecycleSummary;
    authSummary: PlayerLifecycleSummary;
  } | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const bootstrappedUserIdRef = useRef<string | null>(null);
  const pendingLinkRequestRef = useRef<string | null>(null);
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
      setGuestProfile(getGuestProfile());
      setPendingGuestLink(getPendingGuestLink());
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
    invalidatePlayerApiCache();
    bootstrappedUserIdRef.current = null;
    setAuthAttempt((value) => value + 1);
  }, [setAuthEvent, setAuthStage]);

  const sessionUserId = session?.user.id;

  useEffect(() => {
    if (sessionUserId) {
      markAuthenticatedPlay();
      queueMicrotask(() => setGuestProfile(null));
    }
  }, [sessionUserId]);

  const startGuest = useCallback((nickname: string, options?: { serverMode?: "online" | "offline" }) => {
    const profile = startGuestPlay(nickname, options);
    setGuestProfile(profile);
    setError(null);
    setAuthChecked(true);
    setAuthStage("ready");
  }, [setAuthStage]);

  const applySnapshot = useCallback((nextSnapshot: BetaPlayerSnapshot) => {
    const syncStartedAt = Date.now();
    setSnapshot(nextSnapshot);
    useGameStore.getState().syncFromServerPlayerMe(nextSnapshot);
    bootstrappedUserIdRef.current = nextSnapshot.userId;
    updatePerformanceMetric({
      playerSyncElapsedMs: Date.now() - syncStartedAt,
      lastStoreSyncElapsedMs: Date.now() - syncStartedAt,
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoadingSnapshot(true);
    setError(null);
    setAuthStage("bootstrap_loading");
    setAuthEvent("bootstrap started");
    const bootstrapStartedAt = Date.now();

    try {
      const nextSnapshot = await bootstrapPlayerSnapshot({
        cacheKey: sessionUserId ?? guestProfile?.guestId,
        guest: guestProfile
          ? {
              mode: "guest",
              guestId: guestProfile.guestId,
              guestSecret: guestProfile.guestSecret,
              nickname: guestProfile.nickname,
            }
          : undefined,
      });
      setAuthEvent("bootstrap resolved", {
        elapsedMs: Date.now() - bootstrapStartedAt,
      });
      updatePerformanceMetric({
        bootstrapElapsedMs: Date.now() - bootstrapStartedAt,
      });
      setAuthStage("syncing_store");
      applySnapshot(nextSnapshot);
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
  }, [
    applySnapshot,
    guestProfile,
    sessionUserId,
    setAuthEvent,
    setAuthFailure,
    setAuthStage,
  ]);

  const signOutAndReset = useCallback(async () => {
    setAuthEvent("sign_out_requested");
    const supabase = createSupabaseBrowserClient();
    setSnapshot(null);
    setSession(null);
    setError(null);
    setAuthChecked(false);
    setAuthStage("checking_session");
    invalidatePlayerApiCache();
    bootstrappedUserIdRef.current = null;
    if (supabase) await supabase.auth.signOut();
    setAuthChecked(true);
  }, [setAuthEvent, setAuthStage]);

  const finishLinkWithSnapshot = useCallback(
    (nextSnapshot: BetaPlayerSnapshot, message?: string) => {
      clearPendingGuestLink();
      clearGuestProfile();
      setPendingGuestLink(null);
      setGuestProfile(null);
      setLinkConflict(null);
      setLinkMessage(message ?? null);
      invalidatePlayerApiCache();
      applySnapshot(nextSnapshot);
      setAuthStage("ready");
      setAuthChecked(true);
    },
    [applySnapshot, setAuthStage],
  );

  const confirmGuestLinkChoice = useCallback(
    async (choice: "use_auth" | "use_guest" | "cancel") => {
      if (!pendingGuestLink) return;

      if (choice === "cancel") {
        await fetch("/api/player/link-guest/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...pendingGuestLink, choice: "cancel" }),
        }).catch(() => null);
        clearPendingGuestLink();
        setPendingGuestLink(null);
        setLinkConflict(null);
        setLinkMessage("account.linkCancelled");
        const supabase = createSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
        window.location.assign("/play");
        return;
      }

      setLinkChecking(true);
      setLinkMessage(null);
      try {
        const response = await fetch("/api/player/link-guest/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...pendingGuestLink, choice }),
        });
        const body = (await response.json()) as LinkGuestConfirmResponse;
        if (
          body.status === "linked" ||
          body.status === "use_auth" ||
          body.status === "use_guest"
        ) {
          if (body.status === "use_auth") {
            clearPendingGuestLink();
            setPendingGuestLink(null);
            setLinkConflict(null);
            setLinkMessage(body.message);
            invalidatePlayerApiCache();
            applySnapshot(body.snapshot);
            setAuthStage("ready");
            setAuthChecked(true);
          } else {
            finishLinkWithSnapshot(body.snapshot, body.message);
          }
          return;
        }
        if (body.status === "conflict") {
          setLinkConflict({
            guestSummary: body.guestSummary,
            authSummary: body.authSummary,
          });
          setLinkMessage(body.message);
          return;
        }
        throw new Error(body.message);
      } catch (linkError) {
        setError(
          linkError instanceof Error
            ? linkError.message
            : "error.accountLinkFailed",
        );
        setAuthStage("error");
      } finally {
        setLinkChecking(false);
      }
    },
    [
      applySnapshot,
      finishLinkWithSnapshot,
      pendingGuestLink,
      setAuthStage,
    ],
  );

  useEffect(() => {
    if (mode !== "beta") {
      queueMicrotask(() => setAuthEvent("local_mode_skip_auth"));
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => {
        const message = "error.loginSetupCheckFailed";
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
      const message = "error.loginStatusCheckFailed";
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
    if (mode !== "beta" || !sessionUserId || !pendingGuestLink) return;

    let cancelled = false;
    const requestKey = `${sessionUserId}:${pendingGuestLink.guestId}:${pendingGuestLink.startedAt}`;
    if (pendingLinkRequestRef.current === requestKey) return;
    pendingLinkRequestRef.current = requestKey;

    queueMicrotask(() => {
      if (cancelled) return;
      setLinkChecking(true);
      setLinkMessage("account.checkingLinkInfo");
      setAuthStage("bootstrap_loading");
    });

    void fetch("/api/player/link-guest/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pendingGuestLink),
    })
      .then(async (response) => (await response.json()) as LinkGuestCheckResponse)
      .then(async (body) => {
        if (cancelled) return;
        if (body.status === "can_link") {
          const response = await fetch("/api/player/link-guest/confirm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...pendingGuestLink, choice: "link_guest" }),
          });
          const confirmBody = (await response.json()) as LinkGuestConfirmResponse;
          if (
            confirmBody.status === "linked" ||
            confirmBody.status === "use_guest"
          ) {
            finishLinkWithSnapshot(confirmBody.snapshot, confirmBody.message);
            return;
          }
          if (confirmBody.status === "conflict") {
            setLinkConflict({
              guestSummary: confirmBody.guestSummary,
              authSummary: confirmBody.authSummary,
            });
            setLinkMessage(confirmBody.message);
            return;
          }
          throw new Error(confirmBody.message);
        }
        if (body.status === "conflict") {
          setLinkConflict({
            guestSummary: body.guestSummary,
            authSummary: body.authSummary,
          });
          setLinkMessage(null);
          return;
        }
        if (body.status === "already_linked") {
          finishLinkWithSnapshot(body.snapshot, "account.alreadyLinked");
          return;
        }
        throw new Error(body.message);
      })
      .catch((linkError) => {
        if (cancelled) return;
        pendingLinkRequestRef.current = null;
        setError(
          linkError instanceof Error
            ? linkError.message
            : "error.accountLinkCheckFailed",
        );
        clearPendingGuestLink();
        setPendingGuestLink(null);
        setAuthStage("error");
      })
      .finally(() => {
        if (!cancelled) setLinkChecking(false);
      });

    return () => {
      cancelled = true;
      if (pendingLinkRequestRef.current === requestKey) {
        pendingLinkRequestRef.current = null;
      }
    };
  }, [
    finishLinkWithSnapshot,
    mode,
    pendingGuestLink,
    sessionUserId,
    setAuthStage,
  ]);

  useEffect(() => {
    if (mode !== "beta" || !sessionUserId || pendingGuestLink) return;
    if (
      bootstrappedUserIdRef.current === sessionUserId &&
      snapshot?.userId === sessionUserId
    ) {
      return;
    }
    const id = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [mode, pendingGuestLink, refresh, sessionUserId, snapshot?.userId]);

  useEffect(() => {
    if (mode !== "beta" || !guestProfile || sessionUserId) return;
    if (guestProfile.serverMode === "offline") return;
    if (
      bootstrappedUserIdRef.current === guestProfile.guestId &&
      snapshot?.userId === guestProfile.guestId
    ) {
      return;
    }
    const id = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [guestProfile, mode, refresh, sessionUserId, snapshot?.userId]);

  const contextValue = useMemo(
    () => ({ snapshot, refresh }),
    [refresh, snapshot],
  );
  const offlineGuestActive =
    guestProfile?.serverMode === "offline" || isOfflineGuestPlayActive();

  if (crazyGamesMode || mode !== "beta") {
    return (
      <BetaPlayerContext.Provider value={contextValue}>
        {children}
      </BetaPlayerContext.Provider>
    );
  }

  if (offlineGuestActive && !sessionUserId) {
    return (
      <BetaPlayerContext.Provider value={contextValue}>
        {children}
      </BetaPlayerContext.Provider>
    );
  }

  if (!supabaseEnv.ok && authGateMode === "required") {
    return (
      <LoginScreen
        error={supabaseEnv.message}
        authGateMode={authGateMode}
        isCrazyGamesMode={crazyGamesMode}
      />
    );
  }

  if (linkConflict) {
    return (
      <AccountLinkConflictModal
        guestSummary={linkConflict.guestSummary}
        authSummary={linkConflict.authSummary}
        busy={linkChecking}
        message={linkMessage}
        onUseAuth={() => void confirmGuestLinkChoice("use_auth")}
        onUseGuest={() => void confirmGuestLinkChoice("use_guest")}
        onCancel={() => void confirmGuestLinkChoice("cancel")}
      />
    );
  }

  if (pendingGuestLink && (linkChecking || sessionUserId)) {
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
        message={t("account.checkingLinkInfo")}
      />
    );
  }

  if (!authChecked) {
    if (authGateMode !== "required") {
      if (guestProfile) {
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
            message={t("loading.progressLoading")}
          />
        );
      }
      return (
        <GameStartScreen
          error={authError}
          onGuestStart={startGuest}
          isCrazyGamesMode={crazyGamesMode}
        />
      );
    }
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
        message={t("loading.forgePreparing")}
      />
    );
  }

  if (error && !snapshot && stage === "error") {
    if (authGateMode !== "required") {
      return (
        <GameStartScreen
          error={error}
          onGuestStart={startGuest}
          isCrazyGamesMode={crazyGamesMode}
        />
      );
    }
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
    if (authGateMode === "required") {
      return (
        <LoginScreen
          error={authError}
          authGateMode={authGateMode}
          isCrazyGamesMode={crazyGamesMode}
        />
      );
    }
    if (guestProfile && snapshot?.userId === guestProfile.guestId) {
      return (
        <BetaPlayerContext.Provider value={contextValue}>
          {children}
        </BetaPlayerContext.Provider>
      );
    }
    if (guestProfile) {
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
          message={t("loading.progressLoading")}
        />
      );
    }
    return (
      <GameStartScreen
        error={authError}
        onGuestStart={startGuest}
        isCrazyGamesMode={crazyGamesMode}
      />
    );
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
        message={t("loading.forgePreparing")}
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

function AuthLoading({ message }: {
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
  return <ForgeLoading title={message} />;
}

function formatSummaryNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.floor(value)));
}

function AccountLinkConflictModal({
  guestSummary,
  authSummary,
  busy,
  message,
  onUseAuth,
  onUseGuest,
  onCancel,
}: {
  guestSummary: PlayerLifecycleSummary;
  authSummary: PlayerLifecycleSummary;
  busy: boolean;
  message: string | null;
  onUseAuth: () => void;
  onUseGuest: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [confirmUseGuest, setConfirmUseGuest] = useState(false);
  const summaryCard = (
    title: string,
    summary: PlayerLifecycleSummary,
    tone: "guest" | "auth",
  ) => (
    <div className="rounded-lg border border-amber-900/35 bg-zinc-950/64 p-3">
      <p
        className={`text-xs font-black uppercase tracking-[0.16em] ${
          tone === "guest" ? "text-amber-300" : "text-sky-300"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-base font-black text-zinc-100">
        {summary.nickname || t("account.unnamed")}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <dt>{t("records.maxEnhanceLevel")}</dt>
          <dd className="font-bold text-zinc-100">+{summary.highestEnhance}</dd>
        </div>
        <div>
          <dt>{t("shop.goldOwned")}</dt>
          <dd className="font-bold text-zinc-100">
            {formatSummaryNumber(summary.gold)}
          </dd>
        </div>
        <div>
          <dt>{t("records.personalBestReference")}</dt>
          <dd className="font-bold text-zinc-100">
            {formatSummaryNumber(summary.bestWeaponValue)}
          </dd>
        </div>
        <div>
          <dt>{t("ranking.score.rankingValue")}</dt>
          <dd className="font-bold text-zinc-100">
            {formatSummaryNumber(summary.rankingScore)}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-zinc-100">
      <section className="w-full max-w-xl rounded-xl border border-amber-500/30 bg-zinc-950/95 p-5 shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/75">
          Account Link
        </p>
        <h1 className="mt-2 text-xl font-black text-amber-50">
          {t("account.linkConflictTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {t("account.linkConflictBody")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {summaryCard(t("account.guestRecord"), guestSummary, "guest")}
          {summaryCard(t("account.googleRecord"), authSummary, "auth")}
        </div>
        {message ? (
          <p className="mt-3 rounded-md border border-amber-700/35 bg-amber-950/24 px-3 py-2 text-xs text-amber-100">
            {message.includes(".") ? t(message) : message}
          </p>
        ) : null}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onUseAuth}
            className="rounded-lg border border-sky-500/35 bg-sky-950/24 px-4 py-3 text-sm font-bold text-sky-100 transition hover:border-sky-300/60 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {t("account.useGoogleRecord")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmUseGuest(true)}
            className="rounded-lg border border-amber-500/45 bg-amber-500/16 px-4 py-3 text-sm font-black text-amber-100 transition hover:border-amber-300/70 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {t("account.useGuestRecord")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-950/50 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {t("common.cancel")}
          </button>
        </div>
        {confirmUseGuest ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
            <section className="w-full max-w-sm rounded-lg border border-red-500/36 bg-zinc-950 p-4 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300/75">
                Confirm
              </p>
              <h2 className="mt-2 text-lg font-black text-red-50">
                {t("account.confirmUseGuestTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-red-100/80">
                {t("account.confirmUseGuestBody")}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmUseGuest(false)}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-950/55 text-sm font-bold text-zinc-300 transition hover:border-zinc-500 disabled:opacity-55"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onUseGuest}
                  className="h-10 rounded-md border border-red-400/60 bg-red-700/78 text-sm font-black text-white transition hover:bg-red-600 disabled:opacity-55"
                >
                  {t("account.link")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
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
  const { t } = useLocale();
  const displayError = error.includes(".") ? t(error) : error;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070708] px-4 text-zinc-100">
      <section className="w-full max-w-md rounded-xl border border-red-800/60 bg-red-950/25 p-5 shadow-2xl">
        <h1 className="text-lg font-bold text-red-100">
          {t("error.progressConnectionTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-red-200/90">
          {displayError}
        </p>
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
            {t("common.retry")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-800/70 px-4 py-3 text-sm font-semibold text-red-100"
            onClick={onReloadServer}
          >
            {t("error.reloadProgress")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200"
            onClick={onSignOut}
          >
            {t("account.logoutAndLoginAgain")}
          </button>
        </div>
      </section>
    </main>
  );
}
