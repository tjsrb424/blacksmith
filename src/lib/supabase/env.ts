import type { GameMode } from "@/types/server";

export function getGameMode(): GameMode {
  return process.env.NEXT_PUBLIC_GAME_MODE === "beta" ? "beta" : "local";
}

export function getSupabaseBrowserEnv():
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; message: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    return {
      ok: false,
      message:
        "Supabase browser env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  return { ok: true, url, publishableKey };
}
