// Supabase client factories.
//
// Two flavors:
//
//  - serviceClient(env) — service-role key. Bypasses RLS. Use ONLY for
//    backend bookkeeping (cost_ledger writes, role_invocations writes,
//    seeding role_definitions). Never use service-role for reads or writes
//    that should be scoped to a user.
//
//  - userClient(env, jwt) — user's JWT attached. RLS applies. Use for every
//    operation performed on behalf of an authenticated user. The Supabase
//    client forwards the JWT in the Authorization header so policies see
//    auth.uid() correctly.
//
// Don't keep these as singletons — instantiate per request. The Worker
// runtime is short-lived and the JWT is per-request.

import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import type { Env } from "../env.ts";

export function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function userClient(env: Env, jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}
