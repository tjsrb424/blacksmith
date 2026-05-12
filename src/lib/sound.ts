import {
  BASE_VOLUME,
  SOUND_PATHS,
  UI_SOUND_KEYS,
  type SoundKey,
} from "@/data/sounds";
import type { EnhanceResult } from "@/types/game";
import type { TranscendAttemptResult } from "@/lib/transcend";

export const SOUND_SETTINGS_STORAGE_KEY = "world-best-blacksmith-sound-settings-v1";

export type SoundSettings = {
  sfxEnabled: boolean;
  masterVolume: number;
  uiVolume: number;
  effectVolume: number;
};

const DEFAULT_SETTINGS: SoundSettings = {
  sfxEnabled: true,
  masterVolume: 0.8,
  uiVolume: 0.45,
  effectVolume: 0.75,
};

const THROTTLE_MS_DEFAULT = 72;
const THROTTLE_MS: Partial<Record<SoundKey, number>> = {
  uiClick: 80,
  uiModalOpen: 120,
  uiModalClose: 120,
  uiError: 100,
  enhanceHammerHit: 175,
  weaponDestroyed: 500,
  recordNew: 800,
};

const MAX_POOL_PER_KEY = 5;

let settings: SoundSettings = { ...DEFAULT_SETTINGS };
let unlocked = false;
let templatesReady = false;

const templates = new Map<SoundKey, HTMLAudioElement>();
const pools = new Map<SoundKey, HTMLAudioElement[]>();
const lastPlayedAt = new Map<SoundKey, number>();

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function parseStoredSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const p = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      sfxEnabled:
        typeof p.sfxEnabled === "boolean" ? p.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
      masterVolume: clamp01(p.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
      uiVolume: clamp01(p.uiVolume ?? DEFAULT_SETTINGS.uiVolume),
      effectVolume: clamp01(p.effectVolume ?? DEFAULT_SETTINGS.effectVolume),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function refreshSettingsFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    settings = parseStoredSettings(
      window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY),
    );
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

refreshSettingsFromStorage();

export function getSoundSettings(): SoundSettings {
  refreshSettingsFromStorage();
  return { ...settings };
}

export function saveSoundSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function setSfxEnabled(enabled: boolean): void {
  settings = { ...settings, sfxEnabled: enabled };
  saveSoundSettings();
  if (!enabled) stopAllSounds();
}

export function setMasterVolume(volume: number): void {
  settings = { ...settings, masterVolume: clamp01(volume) };
  saveSoundSettings();
}

export function setUiVolume(volume: number): void {
  settings = { ...settings, uiVolume: clamp01(volume) };
  saveSoundSettings();
}

export function setEffectVolume(volume: number): void {
  settings = { ...settings, effectVolume: clamp01(volume) };
  saveSoundSettings();
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

function shouldThrottle(key: SoundKey): boolean {
  const now = performance.now();
  const minGap = THROTTLE_MS[key] ?? THROTTLE_MS_DEFAULT;
  const prev = lastPlayedAt.get(key) ?? 0;
  if (now - prev < minGap) return true;
  lastPlayedAt.set(key, now);
  return false;
}

function effectiveVolume(key: SoundKey, volumeMul: number): number {
  const base = BASE_VOLUME[key];
  const cat = UI_SOUND_KEYS.has(key) ? settings.uiVolume : settings.effectVolume;
  return clamp01(base * settings.masterVolume * cat * volumeMul);
}

function acquirePlayer(key: SoundKey, src: string): HTMLAudioElement {
  let pool = pools.get(key);
  if (!pool) {
    pool = [];
    pools.set(key, pool);
  }
  const idle = pool.find((a) => a.paused || a.ended);
  if (idle) return idle;
  if (pool.length < MAX_POOL_PER_KEY) {
    const el = new Audio(src);
    el.preload = "auto";
    pool.push(el);
    return el;
  }
  const rotated = pool[pool.length - 1];
  try {
    rotated.pause();
    rotated.currentTime = 0;
  } catch {
    /* ignore */
  }
  return rotated;
}

export type PlaySoundOptions = {
  /** 추가 배수 (예: 광고 2배 수령 시 볼륨 부스트) */
  volumeMul?: number;
  /** throttle 무시 (신기록 지연 재생 등) */
  bypassThrottle?: boolean;
};

export function playSound(key: SoundKey, options: PlaySoundOptions = {}): void {
  const { volumeMul = 1, bypassThrottle = false } = options;
  if (typeof window === "undefined") return;
  if (!settings.sfxEnabled) return;
  if (!bypassThrottle && shouldThrottle(key)) return;

  const src = SOUND_PATHS[key];
  const vol = effectiveVolume(key, volumeMul);

  try {
    const audio = acquirePlayer(key, src);
    audio.volume = vol;
    const p = audio.play();
    if (p !== undefined) {
      void p.catch(() => {
        /* autoplay / decode */
      });
    }
  } catch {
    /* ignore */
  }
}

export function playUiClick(): void {
  playSound("uiClick");
}

export function playUiError(): void {
  playSound("uiError");
}

export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  if (templatesReady) return;

  try {
    for (const key of Object.keys(SOUND_PATHS) as SoundKey[]) {
      const src = SOUND_PATHS[key];
      const el = new Audio(src);
      el.preload = "auto";
      el.load();
      templates.set(key, el);
    }
    templatesReady = true;
  } catch {
    templatesReady = false;
  }
}

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  if (unlocked) return;

  preloadSounds();

  try {
    const silent = new Audio(SOUND_PATHS.uiClick);
    silent.volume = 0;
    const p = silent.play();
    if (p !== undefined) {
      void p
        .then(() => {
          try {
            silent.pause();
            silent.currentTime = 0;
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* still consider unlocked for UX */
        });
    }
    unlocked = true;
  } catch (e) {
    console.warn("[sound] unlock failed", e);
  }
}

export function stopAllSounds(): void {
  if (typeof window === "undefined") return;
  try {
    for (const pool of pools.values()) {
      for (const el of pool) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    }
    for (const el of templates.values()) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** 강화 시작음만 (연출 오케스트레이터에서 망치 타이밍 별도 처리) */
export function playEnhanceStartOnly(): void {
  playSound("enhanceStart");
}

/** 연속 망치 타격 — throttle 우회 */
export function playEnhanceHammerHitOnce(): void {
  playSound("enhanceHammerHit", { bypassThrottle: true });
}

/** 강화 결과 — 파괴 시 파괴음만 강하게. outcomeDelayMs: 모달 표시 직후 결과 효과음까지 간격 */
export function scheduleEnhanceOutcomeSounds(
  result: EnhanceResult,
  recordBreak: boolean,
  outcomeDelayMs = 320,
): void {
  window.setTimeout(() => {
    if (result.type === "destroyed") {
      playSound("weaponDestroyed");
      return;
    }
    if (result.type === "success") {
      playSound("enhanceSuccess");
      if (recordBreak && result.afterLevel >= 12) {
        window.setTimeout(() => {
          playSound("recordNew", { bypassThrottle: true });
        }, 480);
      }
      return;
    }
    playSound("enhanceFail");
    if (result.beforeDurability > result.afterDurability) {
      window.setTimeout(() => {
        playSound("durabilityDamage");
      }, 150);
    }
  }, outcomeDelayMs);
}

export function beginTranscendAttemptSounds(): void {
  playSound("transcendStart");
}

export function scheduleTranscendOutcomeSounds(
  result: TranscendAttemptResult,
  recordBreak: boolean,
): void {
  if (result.type === "destroyed") {
    playSound("weaponDestroyed");
    return;
  }
  if (result.type === "success") {
    playSound("transcendSuccess");
    if (recordBreak) {
      window.setTimeout(() => {
        playSound("recordNew", { bypassThrottle: true });
      }, 520);
    }
    return;
  }
  playSound("transcendFail");
}
