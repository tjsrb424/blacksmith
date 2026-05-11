import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");
  const nextParam = requestUrl.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  if (oauthError) {
    const url = new URL("/", request.url);
    url.searchParams.set("auth_error", "oauth_failed");
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_code", request.url),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const url = new URL("/", request.url);
      url.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(url);
    }

    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    const url = new URL("/", request.url);
    url.searchParams.set(
      "auth_error",
      error instanceof Error ? error.message : "auth_callback_failed",
    );
    return NextResponse.redirect(url);
  }
}
