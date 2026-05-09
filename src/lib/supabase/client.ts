"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const env = getSupabaseBrowserEnv();
  if (!env.ok) return null;

  browserClient ??= createBrowserClient<Database>(
    env.url,
    env.publishableKey,
  );

  return browserClient;
}
