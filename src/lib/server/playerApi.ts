import { requestJson } from "@/lib/server/http";
import type { BetaPlayerSnapshot, ServerPlayerProfile } from "@/types/server";

const BOOTSTRAP_CACHE_TTL_MS = 45_000;
const PLAYER_ME_CACHE_TTL_MS = 20_000;

type CacheEntry<T> = {
  expiresAt: number;
  key?: string;
  value: T;
};

type PlayerApiOptions = {
  cacheKey?: string;
  force?: boolean;
};

let bootstrapCache: CacheEntry<BetaPlayerSnapshot> | null = null;
let bootstrapInFlight: Promise<BetaPlayerSnapshot> | null = null;
let bootstrapInFlightKey: string | undefined;
let playerSnapshotCache: CacheEntry<BetaPlayerSnapshot> | null = null;
let playerSnapshotInFlight: Promise<BetaPlayerSnapshot> | null = null;
let playerSnapshotInFlightKey: string | undefined;

function isFresh<T>(entry: CacheEntry<T> | null, key?: string) {
  return Boolean(
    entry && entry.expiresAt > Date.now() && (!key || entry.key === key),
  );
}

function cachePlayerSnapshot(
  snapshot: BetaPlayerSnapshot,
  ttlMs: number,
  key = snapshot.userId,
) {
  playerSnapshotCache = {
    key,
    value: snapshot,
    expiresAt: Date.now() + ttlMs,
  };
}

export function invalidatePlayerApiCache() {
  bootstrapCache = null;
  bootstrapInFlight = null;
  bootstrapInFlightKey = undefined;
  playerSnapshotCache = null;
  playerSnapshotInFlight = null;
  playerSnapshotInFlightKey = undefined;
}

export async function getCurrentPlayer(): Promise<ServerPlayerProfile> {
  return requestJson<ServerPlayerProfile>("/api/player/me", {
    apiName: "api/player/me",
    timeoutMs: 10_000,
  });
}

export async function getCurrentPlayerSnapshot(
  options: PlayerApiOptions = {},
): Promise<BetaPlayerSnapshot> {
  if (!options.force && isFresh(playerSnapshotCache, options.cacheKey)) {
    return playerSnapshotCache!.value;
  }

  if (
    !options.force &&
    playerSnapshotInFlight &&
    (!options.cacheKey || playerSnapshotInFlightKey === options.cacheKey)
  ) {
    return playerSnapshotInFlight;
  }

  const load = requestJson<BetaPlayerSnapshot>("/api/player/me", {
    apiName: "api/player/me",
    timeoutMs: 10_000,
  })
    .then((snapshot) => {
      cachePlayerSnapshot(snapshot, PLAYER_ME_CACHE_TTL_MS, options.cacheKey);
      return snapshot;
    })
    .finally(() => {
      if (playerSnapshotInFlight === load) {
        playerSnapshotInFlight = null;
        playerSnapshotInFlightKey = undefined;
      }
    });

  playerSnapshotInFlight = load;
  playerSnapshotInFlightKey = options.cacheKey;
  return load;
}

export async function bootstrapPlayerSnapshot(
  options: PlayerApiOptions = {},
): Promise<BetaPlayerSnapshot> {
  if (!options.force && isFresh(bootstrapCache, options.cacheKey)) {
    return bootstrapCache!.value;
  }

  if (
    !options.force &&
    bootstrapInFlight &&
    (!options.cacheKey || bootstrapInFlightKey === options.cacheKey)
  ) {
    return bootstrapInFlight;
  }

  const load = requestJson<BetaPlayerSnapshot>("/api/player/bootstrap", {
    method: "POST",
    apiName: "api/player/bootstrap",
    timeoutMs: 10_000,
  })
    .then((snapshot) => {
      const expiresAt = Date.now() + BOOTSTRAP_CACHE_TTL_MS;
      bootstrapCache = {
        key: options.cacheKey ?? snapshot.userId,
        value: snapshot,
        expiresAt,
      };
      cachePlayerSnapshot(
        snapshot,
        PLAYER_ME_CACHE_TTL_MS,
        options.cacheKey ?? snapshot.userId,
      );
      return snapshot;
    })
    .finally(() => {
      if (bootstrapInFlight === load) {
        bootstrapInFlight = null;
        bootstrapInFlightKey = undefined;
      }
    });

  bootstrapInFlight = load;
  bootstrapInFlightKey = options.cacheKey;
  return load;
}
