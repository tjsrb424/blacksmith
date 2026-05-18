"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBetaPlayer } from "@/components/auth/AuthGate";
import {
  setSettingsLanguage,
  SETTINGS_LANGUAGE_OPTIONS,
} from "@/components/settings/settingsStorage";
import { isCrazyGamesBuild } from "@/lib/distribution";
import { useLocale } from "@/lib/i18n/useLocale";
import {
  clearGuestProfile,
  getGuestProfile,
  resumeGuestPlay,
  storePendingGuestLink,
  updateStoredGuestNickname,
} from "@/lib/player/guest";
import { type NicknameValidationReason, validateNickname } from "@/lib/player/nickname";
import { invalidatePlayerApiCache } from "@/lib/server/playerApi";
import { getSoundSettings, setSfxEnabled } from "@/lib/sound";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { useGameStore } from "@/store/gameStore";
import type { SupportedLocale } from "@/lib/i18n/locales";
import type {
  NicknameUpdateErrorResponse,
  NicknameUpdateResponse,
} from "@/types/server";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  isCrazyGamesMode?: boolean;
};

type DangerAction = "guest_reset" | "logout" | "account_delete";

const footerLinks = [
  { href: "/how-to-play", labelKey: "links.gameGuide" },
  { href: "/contact", labelKey: "links.contact" },
  { href: "/privacy", labelKey: "links.privacy" },
  { href: "/terms", labelKey: "links.terms" },
] as const;

function formatCooldown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function nicknameReasonKey(reason: NicknameValidationReason) {
  return `nickname.${reason}`;
}

export function SettingsModal({
  open,
  onClose,
  isCrazyGamesMode = false,
}: SettingsModalProps) {
  const crazyGamesMode = isCrazyGamesMode || isCrazyGamesBuild();
  const { snapshot, refresh } = useBetaPlayer();
  const { locale, setLocale, t } = useLocale();
  const env = getSupabaseBrowserEnv();
  const [sfxOn, setSfxOn] = useState(() => getSoundSettings().sfxEnabled);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [nicknameCooldownSeconds, setNicknameCooldownSeconds] = useState(0);
  const [confirmAction, setConfirmAction] = useState<DangerAction | null>(null);

  const guestProfile = getGuestProfile();
  const profile = snapshot?.profile ?? null;
  const isAuthenticated = Boolean(snapshot?.email || profile?.play_mode === "auth");
  const nickname = profile?.nickname || guestProfile?.nickname || t("account.unnamed");
  const resetProgress = useGameStore((state) => state.resetProgress);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (nicknameCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setNicknameCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nicknameCooldownSeconds]);

  if (!open) return null;

  const toggleSfx = () => {
    const next = !sfxOn;
    setSfxOn(next);
    setSfxEnabled(next);
  };

  const chooseLanguage = (next: SupportedLocale) => {
    setLocale(next);
    setSettingsLanguage(next);
  };

  const signInWithGoogle = async () => {
    if (crazyGamesMode) return;
    setAccountMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAccountMessage(env.ok ? t("error.googleLoginSetup") : env.message);
      return;
    }

    setAccountBusy(true);
    if (guestProfile) {
      storePendingGuestLink(guestProfile);
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=/play`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setAccountBusy(false);
      setAccountMessage(t("error.googleLoginFailed"));
    }
  };

  const signOut = async () => {
    setAccountMessage(null);
    const supabase = createSupabaseBrowserClient();
    setAccountBusy(true);
    const { error } = supabase
      ? await supabase.auth.signOut()
      : { error: new Error("Supabase client unavailable") };

    if (error) {
      setAccountBusy(false);
      setAccountMessage(t("error.logoutFailed"));
      return;
    }

    resumeGuestPlay();
    window.location.assign("/play");
  };

  const resetGuestRecord = async () => {
    if (!guestProfile) {
      clearGuestProfile();
      resetProgress();
      window.location.assign("/play");
      return;
    }

    setAccountBusy(true);
    setAccountMessage(null);
    try {
      await fetch("/api/player/guest/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guestId: guestProfile.guestId,
          guestSecret: guestProfile.guestSecret,
        }),
      });
    } finally {
      clearGuestProfile();
      invalidatePlayerApiCache();
      resetProgress();
      window.location.assign("/play");
    }
  };

  const deleteAccountData = async () => {
    setAccountBusy(true);
    setAccountMessage(null);
    const response = await fetch("/api/player/account/delete", {
      method: "POST",
    });
    if (!response.ok) {
      setAccountBusy(false);
      setAccountMessage(t("error.accountDeleteFailed"));
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    invalidatePlayerApiCache();
    resetProgress();
    resumeGuestPlay();
    window.location.assign("/play");
  };

  const runConfirmedAction = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "guest_reset") {
      await resetGuestRecord();
      return;
    }
    if (action === "logout") {
      await signOut();
      return;
    }
    if (action === "account_delete") {
      await deleteAccountData();
    }
  };

  const saveNickname = async () => {
    setNicknameMessage(null);
    setNicknameCooldownSeconds(0);
    const validation = validateNickname(nicknameDraft);
    if (!validation.ok) {
      setNicknameMessage(t(nicknameReasonKey(validation.reason)));
      return;
    }

    setNicknameSaving(true);
    try {
      const requestBody = isAuthenticated
        ? {
            mode: "authenticated" as const,
            nickname: validation.nickname,
          }
        : {
            mode: "guest" as const,
            nickname: validation.nickname,
            guestId: guestProfile?.guestId,
            guestSecret: guestProfile?.guestSecret,
          };
      const response = await fetch("/api/player/nickname", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await response.json()) as
        | NicknameUpdateResponse
        | NicknameUpdateErrorResponse;

      if (!response.ok || "error" in body) {
        if ("reason" in body && body.reason === "cooldown") {
          setNicknameCooldownSeconds(
            body.cooldownRemainingSeconds ??
              Math.ceil((body.cooldownRemainingMs ?? 0) / 1000),
          );
        }
        if ("reason" in body && body.reason) {
          throw new Error(t(nicknameReasonKey(body.reason)));
        }
        throw new Error(
          "message" in body && body.message
            ? body.message
            : t("error.nicknameChangeFailed"),
        );
      }

      if (!("profile" in body)) {
        throw new Error(t("error.nicknameChangeFailed"));
      }

      if (!isAuthenticated) {
        updateStoredGuestNickname(body.profile.nickname ?? validation.nickname);
      }
      invalidatePlayerApiCache();
      await refresh();
      setNicknameEditing(false);
      setNicknameDraft("");
      setNicknameCooldownSeconds(0);
      setNicknameMessage(t("account.nicknameChanged"));
    } catch (error) {
      setNicknameMessage(
        error instanceof Error ? error.message : t("error.nicknameChangeFailed"),
      );
    } finally {
      setNicknameSaving(false);
    }
  };

  return (
    <div
      className="game-no-select fixed inset-0 z-[70] flex items-center justify-center bg-black/68 px-3 py-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-lg border border-amber-500/24 bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(8,8,10,0.98))] text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(251,191,36,0.12)]">
        <header className="flex items-center justify-between border-b border-amber-900/30 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300/75">
              Forge Control
            </p>
            <h2 id="settings-title" className="mt-1 text-lg font-black text-amber-50">
              {t("settings.title")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("settings.close")}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/70 text-base font-black text-zinc-300 transition hover:border-amber-400/45 hover:text-amber-100"
          >
            ×
          </button>
        </header>

        <div className="settings-scroll max-h-[calc(92dvh-4.5rem)] overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            <section className="rounded-md border border-zinc-700/70 bg-zinc-950/44 p-4">
              <h3 className="text-sm font-black text-amber-100">{t("settings.account")}</h3>
              <div className="mt-3 space-y-1 text-sm text-zinc-300">
                <p>
                  {t("account.currentStatus")}:{" "}
                  <span className="font-bold text-zinc-100">
                    {isAuthenticated ? t("account.googleLinked") : t("account.guestPlaying")}
                  </span>
                </p>
                <p>
                  {t("account.nickname")}: <span className="font-bold text-amber-100">{nickname}</span>
                </p>
                {nicknameEditing ? (
                  <div className="mt-3 grid gap-2">
                    <input
                      value={nicknameDraft}
                      onChange={(event) => {
                        setNicknameDraft(event.target.value);
                        setNicknameMessage(null);
                        setNicknameCooldownSeconds(0);
                      }}
                      maxLength={12}
                      className="h-10 rounded-md border border-amber-700/40 bg-zinc-950/78 px-3 text-sm font-bold text-amber-50 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/16"
                      placeholder={t("account.newNickname")}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={nicknameSaving}
                        onClick={() => void saveNickname()}
                        className="h-9 rounded-md bg-amber-500 px-3 text-xs font-black text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {nicknameSaving ? t("common.saving") : t("common.save")}
                      </button>
                      <button
                        type="button"
                        disabled={nicknameSaving}
                        onClick={() => {
                          setNicknameEditing(false);
                          setNicknameMessage(null);
                          setNicknameCooldownSeconds(0);
                        }}
                        className="h-9 rounded-md border border-zinc-700 bg-zinc-950/50 px-3 text-xs font-bold text-zinc-300 transition hover:border-zinc-500"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNicknameDraft(nickname);
                      setNicknameEditing(true);
                      setNicknameMessage(null);
                      setNicknameCooldownSeconds(0);
                    }}
                    className="mt-3 h-9 rounded-md border border-amber-500/28 bg-amber-950/20 px-3 text-xs font-bold text-amber-100 transition hover:border-amber-300/55"
                  >
                    {t("account.changeNickname")}
                  </button>
                )}
                {nicknameMessage ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-800/35 bg-amber-950/18 px-3 py-2 text-xs text-amber-100">
                    <span className="min-w-0 flex-1">{nicknameMessage}</span>
                    {nicknameCooldownSeconds > 0 ? (
                      <span className="shrink-0 rounded border border-amber-500/24 bg-black/24 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200/82">
                        {formatCooldown(nicknameCooldownSeconds)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {isAuthenticated && snapshot?.email ? (
                  <p className="truncate">
                    {t("account.email")}: <span className="text-zinc-100">{snapshot.email}</span>
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {crazyGamesMode
                  ? t("login.crazyGamesSaveNotice")
                  : t("account.linkDescription")}
              </p>
              {!crazyGamesMode ? (
                <div className="mt-4">
                {isAuthenticated ? (
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => setConfirmAction("logout")}
                    className="h-10 rounded-md border border-red-500/35 bg-red-950/28 px-4 text-sm font-bold text-red-100 transition hover:border-red-300/60 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {accountBusy ? t("common.processing") : t("account.logout")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={accountBusy || !env.ok}
                    onClick={() => void signInWithGoogle()}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-600/75 bg-zinc-950/60 px-4 text-sm font-bold text-zinc-100 transition hover:border-amber-400/45 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-600">
                      G
                    </span>
                    {accountBusy ? t("start.googleMoving") : t("account.linkGoogle")}
                  </button>
                )}
                </div>
              ) : null}
              {accountMessage ? (
                <p className="mt-3 rounded-md border border-red-700/35 bg-red-950/32 px-3 py-2 text-xs text-red-100">
                  {accountMessage}
                </p>
              ) : null}
            </section>

            <section className="rounded-md border border-zinc-700/70 bg-zinc-950/44 p-4">
              <h3 className="text-sm font-black text-amber-100">{t("settings.sound")}</h3>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-100">{t("settings.sfx")}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("settings.sfxDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sfxOn}
                  onClick={toggleSfx}
                  className={`relative h-8 w-14 rounded-full border transition ${
                    sfxOn
                      ? "border-amber-400/60 bg-amber-500/24"
                      : "border-zinc-700 bg-zinc-900"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full transition ${
                      sfxOn
                        ? "left-7 bg-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.42)]"
                        : "left-1 bg-zinc-500"
                    }`}
                  />
                  <span className="sr-only">{sfxOn ? t("settings.sfxOn") : t("settings.sfxOff")}</span>
                </button>
              </div>
            </section>

            <section className="rounded-md border border-zinc-700/70 bg-zinc-950/44 p-4">
              <h3 className="text-sm font-black text-amber-100">
                {t("settings.language")}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SETTINGS_LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => chooseLanguage(option.value)}
                    className={`min-h-10 rounded-md border px-2 text-sm font-bold transition ${
                      locale === option.value
                        ? "border-amber-300/70 bg-amber-500/18 text-amber-50"
                        : "border-zinc-700/75 bg-zinc-950/45 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-zinc-700/70 bg-zinc-950/44 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-amber-100">
                    {t("game.title")}
                  </h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-400/70">
                    Service
                  </p>
                </div>
                <p className="rounded border border-amber-500/25 px-2 py-1 text-xs font-bold text-amber-100">
                  {t("settings.creator", { name: "SeonGyu" })}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t("settings.gameDescription")}
              </p>
              <nav className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold sm:grid-cols-4">
                {footerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md border border-zinc-700/70 bg-zinc-950/45 px-2 py-2 text-center text-zinc-300 transition hover:border-amber-400/45 hover:text-amber-100"
                    onClick={onClose}
                  >
                    {t(link.labelKey)}
                  </Link>
                ))}
              </nav>
            </section>

            <section className="rounded-md border border-red-800/50 bg-red-950/14 p-4 shadow-[inset_0_1px_0_rgba(248,113,113,0.08)]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300/70">
                  Record Care
                </p>
                <h3 className="mt-1 text-sm font-black text-red-100">{t("settings.recordCare")}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-red-100/68">
                {t("settings.recordCareDescription")}
              </p>
              <div className="mt-4 grid gap-2">
                {!isAuthenticated ? (
                  <button
                    type="button"
                    disabled={accountBusy}
                    onClick={() => setConfirmAction("guest_reset")}
                    className="h-10 rounded-md border border-red-500/40 bg-red-950/30 px-3 text-sm font-bold text-red-100 transition hover:border-red-300/65 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {t("account.resetGuest")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={accountBusy}
                      onClick={() => setConfirmAction("logout")}
                      className="h-10 rounded-md border border-zinc-600/70 bg-zinc-950/45 px-3 text-sm font-bold text-zinc-200 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {t("account.logout")}
                    </button>
                    <button
                      type="button"
                      disabled={accountBusy}
                      onClick={() => setConfirmAction("account_delete")}
                      className="h-10 rounded-md border border-red-500/45 bg-red-950/34 px-3 text-sm font-black text-red-100 transition hover:border-red-300/70 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {t("account.deleteAccountData")}
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
      {confirmAction ? (
        <DangerConfirmDialog
          action={confirmAction}
          busy={accountBusy}
          t={t}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmedAction()}
        />
      ) : null}
    </div>
  );
}

function dangerDialogCopy(
  action: DangerAction,
  t: (key: string) => string,
) {
  if (action === "guest_reset") {
    return {
      title: t("account.confirmGuestResetTitle"),
      body: t("account.confirmGuestResetBody"),
      confirmLabel: t("account.reset"),
    };
  }
  if (action === "logout") {
    return {
      title: t("account.confirmLogoutTitle"),
      body: t("account.confirmLogoutBody"),
      confirmLabel: t("account.logout"),
    };
  }
  return {
    title: t("account.confirmDeleteTitle"),
    body: t("account.confirmDeleteBody"),
    confirmLabel: t("account.delete"),
  };
}

function DangerConfirmDialog({
  action,
  busy,
  t,
  onCancel,
  onConfirm,
}: {
  action: DangerAction;
  busy: boolean;
  t: (key: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = dangerDialogCopy(action, t);

  return (
    <div className="game-no-select fixed inset-0 z-[80] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-lg border border-red-500/36 bg-[linear-gradient(180deg,rgba(30,10,12,0.98),rgba(10,10,12,0.98))] p-4 text-zinc-100 shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300/75">
          Confirm
        </p>
        <h3 className="mt-2 text-lg font-black text-red-50">{copy.title}</h3>
        <div className="mt-3 space-y-1 text-sm leading-6 text-red-100/80">
          {copy.body.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-950/55 text-sm font-bold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-55"
          >
          {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="h-10 rounded-md border border-red-400/60 bg-red-700/78 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? t("common.processing") : copy.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
