import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/play";
}

function loginUrl(requestUrl: string, authError: string) {
  const url = new URL("/play", requestUrl);
  url.searchParams.set("auth_error", authError);
  return url;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (oauthError) {
    return NextResponse.redirect(loginUrl(request.url, "oauth_failed"));
  }

  if (!code) {
    return NextResponse.redirect(loginUrl(request.url, "missing_code"));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const message = error.message.toLowerCase().includes("code verifier")
        ? "missing_code"
        : error.message;
      return NextResponse.redirect(loginUrl(request.url, message));
    }

    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    return NextResponse.redirect(
      loginUrl(
        request.url,
        error instanceof Error ? error.message : "auth_callback_failed",
      ),
    );
  }
}
