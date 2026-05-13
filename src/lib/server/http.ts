import {
  getPerformanceMetricSnapshot,
  updatePerformanceMetric,
} from "@/lib/performanceMetrics";
import {
  perfActionNameFromApi,
  recordPerfEvent,
} from "@/lib/perfRecorder";
import type { ApiResponse } from "@/types/server";

const DEFAULT_API_BASE = "";
const DEFAULT_TIMEOUT_MS = 8_000;

type ErrorBody = {
  error?: string;
  code?: string;
  message?: string;
  details?: string;
};

type MutationDiagnostics = {
  mutationPath?: string;
  rpcName?: string;
  rpcApplied?: boolean;
  fallbackAllowed?: boolean;
};

type BodyWithDebug = {
  debug?: MutationDiagnostics;
  data?: {
    debug?: MutationDiagnostics;
  };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: string,
  ) {
    super(message);
  }
}

export function getServerApiBase(): string {
  return process.env.NEXT_PUBLIC_SERVER_API_BASE_URL ?? DEFAULT_API_BASE;
}

function parseBooleanHeader(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function getBodyMutationDiagnostics(body: unknown): MutationDiagnostics {
  if (!body || typeof body !== "object") return {};
  const candidate = body as BodyWithDebug;
  return candidate.debug ?? candidate.data?.debug ?? {};
}

function getMutationDiagnostics(
  response: Response | undefined,
  body?: unknown,
): MutationDiagnostics {
  const fromBody = getBodyMutationDiagnostics(body);
  return {
    mutationPath:
      response?.headers.get("x-blacksmith-mutation-path") ??
      fromBody.mutationPath,
    rpcName:
      response?.headers.get("x-blacksmith-rpc-name") ?? fromBody.rpcName,
    rpcApplied:
      parseBooleanHeader(response?.headers.get("x-blacksmith-rpc-applied") ?? null) ??
      fromBody.rpcApplied,
    fallbackAllowed:
      parseBooleanHeader(
        response?.headers.get("x-blacksmith-rpc-fallback-allowed") ?? null,
      ) ?? fromBody.fallbackAllowed,
  };
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number; apiName?: string },
): Promise<T> {
  const base = getServerApiBase();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiName = init?.apiName ?? path;
  const controller = new AbortController();
  const callerSignal = init?.signal;
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  const recordApiEvent = (
    elapsedMs: number,
    error?: string,
    diagnostics: MutationDiagnostics = {},
  ) => {
    const actionName = perfActionNameFromApi(apiName);
    recordPerfEvent({
      screen: getPerformanceMetricSnapshot().currentScreen ?? "unknown",
      eventType: error ? "error" : actionName === "bootstrap" ? "bootstrap" : "api",
      actionName,
      api: apiName,
      elapsedMs,
      bootstrapMs: actionName === "bootstrap" ? elapsedMs : undefined,
      enhanceApiMs: actionName === "enhance" ? elapsedMs : undefined,
      error: error ?? "",
      adStatusApiCalled: actionName === "ad_status",
      mutationPath: diagnostics.mutationPath,
      rpcName: diagnostics.rpcName,
      rpcApplied: diagnostics.rpcApplied,
      fallbackAllowed: diagnostics.fallbackAllowed,
    });
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener(
        "abort",
        () => controller.abort(callerSignal.reason),
        { once: true },
      );
    }
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const timedOut = controller.signal.aborted;
    const code = timedOut ? "request_timeout" : "network_error";
    updatePerformanceMetric({
      apiName,
      elapsedMs,
      errorCode: code,
    });
    recordApiEvent(elapsedMs, code);
    throw new ApiRequestError(
      timedOut
        ? "서버 응답이 지연되고 있습니다. 다시 시도해주세요."
        : "네트워크 요청에 실패했습니다. 연결 상태를 확인해주세요.",
      0,
      code,
      error instanceof Error ? error.message : undefined,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const body = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | T
    | ErrorBody
    | null;

  if (!response.ok) {
    const code =
      body && typeof body === "object" && "code" in body
        ? String(body.code)
        : body && typeof body === "object" && "error" in body
          ? String(body.error)
          : undefined;
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : `Request failed with ${response.status}`;
    const details =
      body && typeof body === "object" && "details" in body
        ? String(body.details)
        : undefined;
    updatePerformanceMetric({
      apiName,
      elapsedMs: Date.now() - startedAt,
      errorCode: code,
    });
    recordApiEvent(
      Date.now() - startedAt,
      code,
      getMutationDiagnostics(response, body),
    );
    throw new ApiRequestError(message, response.status, code, details);
  }

  if (body && typeof body === "object" && "ok" in body) {
    if (body.ok) {
      const elapsedMs = Date.now() - startedAt;
      updatePerformanceMetric({
        apiName,
        elapsedMs,
        errorCode: undefined,
      });
      recordApiEvent(elapsedMs, undefined, getMutationDiagnostics(response, body));
      return body.data;
    }
    throw new Error(body.message);
  }

  if (body == null) {
    throw new Error("Empty API response");
  }

  const elapsedMs = Date.now() - startedAt;
  updatePerformanceMetric({
    apiName,
    elapsedMs,
    errorCode: undefined,
  });
  recordApiEvent(elapsedMs, undefined, getMutationDiagnostics(response, body));
  return body as T;
}
