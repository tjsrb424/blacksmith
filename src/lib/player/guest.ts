export const GUEST_PLAY_MODE_KEY = "blacksmith.play_mode";
export const GUEST_ID_KEY = "blacksmith.guest_id";
export const GUEST_SECRET_KEY = "blacksmith.guest_secret";
export const GUEST_NICKNAME_KEY = "blacksmith.guest_nickname";
export const PENDING_LINK_GUEST_ID_KEY = "blacksmith.pending_link_guest_id";
export const PENDING_LINK_GUEST_SECRET_KEY = "blacksmith.pending_link_guest_secret";
export const PENDING_LINK_STARTED_AT_KEY = "blacksmith.pending_link_started_at";

const PENDING_LINK_TTL_MS = 10 * 60 * 1000;

export type GuestProfile = {
  guestId: string;
  guestSecret: string;
  nickname: string;
};

export type PendingGuestLink = {
  guestId: string;
  guestSecret: string;
  startedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

export function getGuestProfile(): GuestProfile | null {
  if (!canUseStorage()) return null;
  if (window.localStorage.getItem(GUEST_PLAY_MODE_KEY) !== "guest") return null;

  const guestId = window.localStorage.getItem(GUEST_ID_KEY);
  const guestSecret = window.localStorage.getItem(GUEST_SECRET_KEY);
  const nickname = window.localStorage.getItem(GUEST_NICKNAME_KEY);
  if (!isUuid(guestId) || !guestSecret || !nickname) return null;

  return { guestId, guestSecret, nickname };
}

export function isGuestPlayActive() {
  return Boolean(getGuestProfile());
}

export function startGuestPlay(nickname: string): GuestProfile {
  const normalized = nickname.trim();
  const existingId = canUseStorage()
    ? window.localStorage.getItem(GUEST_ID_KEY)
    : null;
  const existingSecret = canUseStorage()
    ? window.localStorage.getItem(GUEST_SECRET_KEY)
    : null;
  const profile = {
    guestId: isUuid(existingId) ? existingId : createGuestId(),
    guestSecret: existingSecret || randomToken(),
    nickname: normalized,
  };

  if (canUseStorage()) {
    window.localStorage.setItem(GUEST_PLAY_MODE_KEY, "guest");
    window.localStorage.setItem(GUEST_ID_KEY, profile.guestId);
    window.localStorage.setItem(GUEST_SECRET_KEY, profile.guestSecret);
    window.localStorage.setItem(GUEST_NICKNAME_KEY, profile.nickname);
  }

  return profile;
}

export function markAuthenticatedPlay() {
  if (!canUseStorage()) return;
  window.localStorage.setItem(GUEST_PLAY_MODE_KEY, "auth");
}

export function resumeGuestPlay(): GuestProfile | null {
  if (!canUseStorage()) return null;

  const guestId = window.localStorage.getItem(GUEST_ID_KEY);
  const guestSecret = window.localStorage.getItem(GUEST_SECRET_KEY);
  const nickname = window.localStorage.getItem(GUEST_NICKNAME_KEY);
  if (!isUuid(guestId) || !guestSecret || !nickname) return null;

  window.localStorage.setItem(GUEST_PLAY_MODE_KEY, "guest");
  return { guestId, guestSecret, nickname };
}

export function updateStoredGuestNickname(nickname: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(GUEST_NICKNAME_KEY, nickname.trim());
}

export function clearGuestProfile() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(GUEST_PLAY_MODE_KEY);
  window.localStorage.removeItem(GUEST_ID_KEY);
  window.localStorage.removeItem(GUEST_SECRET_KEY);
  window.localStorage.removeItem(GUEST_NICKNAME_KEY);
}

export function storePendingGuestLink(profile: GuestProfile) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PENDING_LINK_GUEST_ID_KEY, profile.guestId);
  window.localStorage.setItem(PENDING_LINK_GUEST_SECRET_KEY, profile.guestSecret);
  window.localStorage.setItem(PENDING_LINK_STARTED_AT_KEY, String(Date.now()));
}

export function getPendingGuestLink(): PendingGuestLink | null {
  if (!canUseStorage()) return null;

  const guestId = window.localStorage.getItem(PENDING_LINK_GUEST_ID_KEY);
  const guestSecret = window.localStorage.getItem(PENDING_LINK_GUEST_SECRET_KEY);
  const startedAt = Number(
    window.localStorage.getItem(PENDING_LINK_STARTED_AT_KEY) ?? 0,
  );
  if (!isUuid(guestId) || !guestSecret || !Number.isFinite(startedAt)) {
    clearPendingGuestLink();
    return null;
  }
  if (Date.now() - startedAt > PENDING_LINK_TTL_MS) {
    clearPendingGuestLink();
    return null;
  }

  return { guestId, guestSecret, startedAt };
}

export function clearPendingGuestLink() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PENDING_LINK_GUEST_ID_KEY);
  window.localStorage.removeItem(PENDING_LINK_GUEST_SECRET_KEY);
  window.localStorage.removeItem(PENDING_LINK_STARTED_AT_KEY);
}

export function getGuestRequestContext() {
  const profile = getGuestProfile();
  if (!profile) return {};
  return {
    mode: "guest" as const,
    guestId: profile.guestId,
    guestSecret: profile.guestSecret,
    nickname: profile.nickname,
  };
}
