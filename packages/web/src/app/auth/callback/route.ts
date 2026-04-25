// Auth callback route handler.
//
// Supabase's magic-link emails redirect here with a `?code=...` query
// param. We exchange the code for a session (stored as a cookie via
// the Supabase SSR helper) then redirect to the home page.

import { type ServerCookieStore, serverClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/research";

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_code", url.origin));
  }

  const cookieStore = await cookies();
  const supabase = serverClient(cookieStore as unknown as ServerCookieStore);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
