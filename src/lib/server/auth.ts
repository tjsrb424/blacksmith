import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSupabaseUser(): Promise<
  | { ok: true; user: User }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "unauthenticated",
          code: "unauthenticated",
          message: "세션이 만료되었습니다. 다시 로그인해주세요.",
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}
