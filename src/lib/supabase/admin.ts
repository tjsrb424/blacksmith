import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let adminClient: SupabaseClient<Database> | null = null;

export class MissingSupabaseAdminEnvError extends Error {
  readonly code = "missing_admin_env";

  constructor(message = "Missing Supabase admin key") {
    super(message);
  }
}

export function getSupabaseAdminEnv():
  | { ok: true; url: string; secretKey: string; keyName: string }
  | { ok: false; message: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const adminKey = serviceRoleKey ?? secretKey;
  const keyName = serviceRoleKey
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : "SUPABASE_SECRET_KEY";

  if (!url || !adminKey) {
    return {
      ok: false,
      message: "Missing Supabase admin key",
    };
  }

  return { ok: true, url, secretKey: adminKey, keyName };
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const env = getSupabaseAdminEnv();
  if (!env.ok) {
    throw new MissingSupabaseAdminEnvError(env.message);
  }

  adminClient ??= createClient<Database>(env.url, env.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
