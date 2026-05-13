import "server-only";

export type StepEntry = {
  name: string;
  elapsedMs: number;
};

export type ServerStepTimer = {
  time<T>(name: string, fn: () => Promise<T>): Promise<T>;
  timeSync<T>(name: string, fn: () => T): T;
  mark(name: string, startedAt: number): void;
  finish(name?: string): StepEntry[];
};

const DEFAULT_SLOW_STEP_MS = 1000;

function nowMs() {
  return performance.now();
}

function rounded(ms: number) {
  return Math.round(ms);
}

function shouldLogPerf() {
  if (process.env.PERF_DEBUG_SERVER === "true") return true;
  if (process.env.PERF_DEBUG_SERVER === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function perfKey(name: string) {
  const words = name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "step";
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function serverTimingKey(name: string) {
  return perfKey(name).replace(/[^A-Za-z0-9_-]/g, "") || "step";
}

export function serverTimingHeader(entries: readonly StepEntry[]) {
  return entries
    .map((entry) => `${serverTimingKey(entry.name)};dur=${entry.elapsedMs}`)
    .join(", ");
}

export function attachServerTiming<T extends Response>(
  response: T,
  entries: readonly StepEntry[],
): T {
  if (entries.length > 0) {
    response.headers.set("Server-Timing", serverTimingHeader(entries));
  }
  return response;
}

export function createServerStepTimer(
  scope: string,
  options: { slowStepMs?: number } = {},
): ServerStepTimer {
  const startedAt = nowMs();
  const entries: StepEntry[] = [];
  const shouldLog = shouldLogPerf();
  const slowStepMs = options.slowStepMs ?? DEFAULT_SLOW_STEP_MS;

  function record(name: string, elapsedMs: number) {
    const entry = { name, elapsedMs: rounded(elapsedMs) };
    entries.push(entry);
  }

  function logSummary() {
    if (!shouldLog) return;
    const parts = entries.map((entry) => `${perfKey(entry.name)}=${entry.elapsedMs}ms`);
    const line = `[perf][${scope}] ${parts.join(" ")}`;
    const hasSlowStep = entries.some((entry) => entry.elapsedMs >= slowStepMs);
    if (hasSlowStep) console.warn(line);
    else console.log(line);
  }

  return {
    async time<T>(name: string, fn: () => Promise<T>) {
      const stepStartedAt = nowMs();
      try {
        return await fn();
      } finally {
        record(name, nowMs() - stepStartedAt);
      }
    },
    timeSync<T>(name: string, fn: () => T) {
      const stepStartedAt = nowMs();
      try {
        return fn();
      } finally {
        record(name, nowMs() - stepStartedAt);
      }
    },
    mark(name: string, stepStartedAt: number) {
      record(name, nowMs() - stepStartedAt);
    },
    finish(name = "total") {
      record(name, nowMs() - startedAt);
      logSummary();
      return entries;
    },
  };
}
