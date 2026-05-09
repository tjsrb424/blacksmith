import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let adminClient: SupabaseClient<Database> | null = null;

function getSupabaseAdminEnv():
  | { ok: true; url: string; secretKey: string }
  | { ok: false; message: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    return {
      ok: false,
      message:
        "Supabase admin env is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return { ok: true, url, secretKey };
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const env = getSupabaseAdminEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  adminClient ??= createClient<Database>(env.url, env.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
