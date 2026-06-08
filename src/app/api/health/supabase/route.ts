import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      secured: Boolean(process.env.CRON_SECRET),
    });
  } catch (error) {
    console.error("[health.supabase] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Supabase health check failed",
        checkedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
