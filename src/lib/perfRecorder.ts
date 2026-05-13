"use client";

import { getConfiguredAdProvider } from "@/lib/ads/adConfig";
import { getGameMode } from "@/lib/supabase/env";

export const PERF_EVENTS_STORAGE_KEY = "blacksmith_perf_events_v1";
export const PERF_EVENTS_MAX = 300;

export type PerfEventType =
  | "api"
  | "action"
  | "screen"
  | "tab"
  | "bootstrap"
  | "ad"
  | "render"
  | "error";

export type PerfEvent = {
  timestamp: string;
  sessionId: string;
  mode?: string;
  screen: string;
  eventType: PerfEventType;
  actionName?: string;
  api?: string;
  elapsedMs: number;
  bootstrapMs?: number;
  playerSyncMs?: number;
  storeSyncMs?: number;
  tabMs?: number;
  rankingMs?: number;
  adStatus?: string;
  adFetchMs?: number;
  enhanceApiMs?: number;
  enhanceModalMs?: number;
  error?: string;
  renderSummary?: string;
  origin?: string;
  userAgent?: string;
  viewportWidth: number;
  viewportHeight: number;
  adProvider?: string;
  displayAdProvider?: string;
  sideBannerAdsEnabled?: boolean;
  adStatusApiCalled?: boolean;
  adSdkLoaded?: boolean;
  adFetchSkippedReason?: string;
};

export type PerfSummaryRow = {
  key: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  errorCount: number;
  baseline?: string;
};

export type PerfExportBundle = {
  sessionId: string;
  createdAt: string;
  origin: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  summary: Record<string, PerfSummaryRow>;
  events: PerfEvent[];
};

const listeners = new Set<() => void>();
let events: PerfEvent[] | null = null;
let eventsSnapshot: readonly PerfEvent[] = [];
let sessionId: string | null = null;

const BASELINES: Record<string, string> = {
  buy: "1310ms",
  enhance: "1695ms",
  forge_collect: "1352ms",
  player_me: "403ms",
  ranking_weekly: "821ms",
  bootstrap: "451-1453ms",
  ad_fetch: "353-442ms",
};

export function perfActionNameFromApi(apiName: string) {
  const path = apiName.split("?")[0] ?? apiName;
  if (path.includes("/api/game/enhance")) return "enhance";
  if (path.includes("/api/game/buy")) return "buy";
  if (path.includes("/api/game/sell")) return "sell";
  if (path.includes("/api/game/forge/collect")) return "forge_collect";
  if (path.includes("/api/game/forge/upgrade")) return "forge_upgrade";
  if (path.includes("/api/player/bootstrap")) return "bootstrap";
  if (path.includes("/api/player/me")) return "player_me";
  if (path.includes("/api/ranking/weekly")) return "ranking_weekly";
  if (path.includes("/api/ranking/world")) return "ranking_world";
  if (path.includes("/api/ranking/submit")) return "ranking_my";
  if (path.includes("/api/ad/reward/status")) return "ad_status";
  if (path.includes("/api/ad/reward/request")) return "ad_request";
  if (path.includes("/api/ad/reward/complete")) return "ad_complete";
  return path.replace(/^\/?api\//, "").replace(/[^A-Za-z0-9]+/g, "_");
}

export function isPerfRecorderEnabled() {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED !== "false"
  );
}

function safeJsonParse(value: string | null): PerfEvent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPerfEvent).slice(-PERF_EVENTS_MAX);
  } catch {
    return [];
  }
}

function isPerfEvent(value: unknown): value is PerfEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "timestamp" in value &&
      "eventType" in value &&
      "elapsedMs" in value,
  );
}

function getEventsMutable() {
  if (!isPerfRecorderEnabled()) return [];
  if (events) return events;
  events = safeJsonParse(window.localStorage.getItem(PERF_EVENTS_STORAGE_KEY));
  refreshSnapshot();
  return events;
}

function persistEvents() {
  if (!isPerfRecorderEnabled() || !events) return;
  try {
    window.localStorage.setItem(PERF_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Dev-only recorder must never break gameplay.
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function refreshSnapshot() {
  eventsSnapshot = events ? [...events] : [];
}

export function subscribePerfEvents(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPerfEventsSnapshot() {
  if (!isPerfRecorderEnabled()) return eventsSnapshot;
  getEventsMutable();
  return eventsSnapshot;
}

export function clearPerfEvents() {
  if (!isPerfRecorderEnabled()) return;
  events = [];
  refreshSnapshot();
  try {
    window.localStorage.removeItem(PERF_EVENTS_STORAGE_KEY);
  } catch {
    // ignored
  }
  notify();
}

export function getPerfSessionId() {
  if (!isPerfRecorderEnabled()) return "disabled";
  if (sessionId) return sessionId;
  try {
    const key = "blacksmith_perf_session_id";
    const saved = window.sessionStorage.getItem(key);
    if (saved) {
      sessionId = saved;
      return saved;
    }
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(key, sessionId);
    return sessionId;
  } catch {
    sessionId = `session-${Date.now().toString(36)}`;
    return sessionId;
  }
}

function viewport() {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function userAgentShort() {
  if (typeof navigator === "undefined") return undefined;
  return navigator.userAgent.slice(0, 140);
}

function currentOrigin() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

function adSkippedReason(actionName?: string) {
  const provider = getConfiguredAdProvider();
  if (provider !== "disabled") return undefined;
  if (actionName === "ad_status" || actionName === "ad_fetch") {
    return "rewarded_provider_disabled";
  }
  return undefined;
}

export function recordPerfEvent(
  event: Omit<
    PerfEvent,
    | "timestamp"
    | "sessionId"
    | "mode"
    | "screen"
    | "userAgent"
    | "viewportWidth"
    | "viewportHeight"
  > & {
    screen?: string;
  },
) {
  if (!isPerfRecorderEnabled()) return;
  const list = getEventsMutable();
  const size = viewport();
  const configuredAdProvider = getConfiguredAdProvider();
  const actionName = event.actionName;
  const next: PerfEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    sessionId: getPerfSessionId(),
    mode: getGameMode(),
    screen: event.screen ?? "unknown",
    elapsedMs: Math.max(0, Math.round(Number(event.elapsedMs) || 0)),
    error: event.error || "",
    origin: currentOrigin(),
    userAgent: userAgentShort(),
    viewportWidth: size.width,
    viewportHeight: size.height,
    adProvider: configuredAdProvider,
    displayAdProvider: process.env.NEXT_PUBLIC_DISPLAY_AD_PROVIDER ?? "disabled",
    sideBannerAdsEnabled:
      process.env.NEXT_PUBLIC_SIDE_BANNER_ADS_ENABLED === "true",
    adSdkLoaded: typeof window !== "undefined" ? Boolean(window.googletag) : false,
    adFetchSkippedReason:
      event.adFetchSkippedReason ?? adSkippedReason(actionName),
  };
  list.push(next);
  if (list.length > PERF_EVENTS_MAX) {
    list.splice(0, list.length - PERF_EVENTS_MAX);
  }
  refreshSnapshot();
  persistEvents();
  notify();
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

function summaryKey(event: PerfEvent) {
  return event.actionName || event.api || event.eventType;
}

export function summarizePerfEvents(
  sourceEvents: readonly PerfEvent[] = getPerfEventsSnapshot(),
) {
  const groups = new Map<string, PerfEvent[]>();
  for (const event of sourceEvents) {
    const key = summaryKey(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(event);
  }

  const summary: Record<string, PerfSummaryRow> = {};
  for (const [key, group] of groups) {
    const values = group
      .map((event) => Math.round(event.elapsedMs))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (values.length === 0) continue;
    const sum = values.reduce((total, value) => total + value, 0);
    summary[key] = {
      key,
      count: values.length,
      avg: Math.round(sum / values.length),
      min: values[0] ?? 0,
      max: values[values.length - 1] ?? 0,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      errorCount: group.filter((event) => Boolean(event.error)).length,
      baseline: BASELINES[key],
    };
  }
  return summary;
}

export function createPerfExportBundle(
  sourceEvents: readonly PerfEvent[] = getPerfEventsSnapshot(),
): PerfExportBundle {
  const size = viewport();
  return {
    sessionId: getPerfSessionId(),
    createdAt: new Date().toISOString(),
    origin: currentOrigin() ?? "-",
    userAgent: userAgentShort() ?? "-",
    viewport: {
      width: size.width,
      height: size.height,
    },
    summary: summarizePerfEvents(sourceEvents),
    events: [...sourceEvents],
  };
}

export function perfExportFilename(extension: "json" | "csv") {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
  return `blacksmith-perf-${stamp}.${extension}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function perfEventsToCsv(sourceEvents: readonly PerfEvent[]) {
  const columns: Array<keyof PerfEvent> = [
    "timestamp",
    "screen",
    "eventType",
    "actionName",
    "api",
    "elapsedMs",
    "error",
    "adStatus",
    "adProvider",
    "adStatusApiCalled",
    "adFetchSkippedReason",
    "viewportWidth",
    "viewportHeight",
  ];
  return [
    columns.join(","),
    ...sourceEvents.map((event) =>
      columns.map((column) => csvEscape(event[column])).join(","),
    ),
  ].join("\n");
}
