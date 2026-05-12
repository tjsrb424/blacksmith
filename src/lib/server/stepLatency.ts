import "server-only";

type StepEntry = {
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

export function createServerStepTimer(
  scope: string,
  options: { slowStepMs?: number } = {},
): ServerStepTimer {
  const startedAt = nowMs();
  const entries: StepEntry[] = [];
  const shouldLog = process.env.NODE_ENV !== "production";
  const slowStepMs = options.slowStepMs ?? DEFAULT_SLOW_STEP_MS;

  function record(name: string, elapsedMs: number) {
    const entry = { name, elapsedMs: rounded(elapsedMs) };
    entries.push(entry);

    if (!shouldLog) return;

    const line = `[${scope} step] ${name} ${entry.elapsedMs}ms`;
    if (entry.elapsedMs >= slowStepMs) {
      console.warn(line);
    } else {
      console.log(line);
    }
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
      return entries;
    },
  };
}
