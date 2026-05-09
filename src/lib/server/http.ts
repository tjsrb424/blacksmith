import type { ApiResponse } from "@/types/server";

const DEFAULT_API_BASE = "";

export function getServerApiBase(): string {
  return process.env.NEXT_PUBLIC_SERVER_API_BASE_URL ?? DEFAULT_API_BASE;
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getServerApiBase();
  const response = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | T | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  if (body && typeof body === "object" && "ok" in body) {
    if (body.ok) return body.data;
    throw new Error(body.message);
  }

  if (body == null) {
    throw new Error("Empty API response");
  }

  return body as T;
}
