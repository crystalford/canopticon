// Supabase clients for the web package.
//
// Two flavors:
//
//  - browserClient() — runs in the browser. Persists the session in
//    cookies so middleware/server-components can read it. Use in
//    "use client" components.
//  - serverClient() — runs in Server Components / Route Handlers /
//    Middleware. Reads the session from cookies via Next.js's
//    cookies() / headers() APIs. Use to fetch the JWT for API calls
//    that originate server-side.
//
// We use @supabase/ssr (the canonical Supabase + Next App Router
// adapter) so cookie handling is consistent across rendering modes.

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function publicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

export function browserClient(): SupabaseClient {
  const { url, anonKey } = publicEnv();
  return createBrowserClient(url, anonKey);
}

export type { CookieOptions };

/** Cookie store interface server helpers must provide. Matches Next.js's
    cookies() return shape (next/headers) — but typed locally so this file
    can be imported anywhere without dragging in the next runtime. */
export interface ServerCookieStore {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options?: CookieOptions) => void;
}

export function serverClient(cookieStore: ServerCookieStore): SupabaseClient {
  const { url, anonKey } = publicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set?.(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set?.(name, "", { ...options, maxAge: 0 });
      },
    },
  });
}
