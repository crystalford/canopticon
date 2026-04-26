// Map auth.users.id (JWT sub) to public.users.id.
// RLS policies use public.users.id for ownership, but the JWT carries
// auth.users.id. Routes call this once per request to translate.

import type { SupabaseClient } from "@supabase/supabase-js";
import { unauthorized } from "./errors.ts";

export async function getPublicUserId(client: SupabaseClient, authUserId: string): Promise<string> {
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw unauthorized("user row not found; sign in once before calling the API");
  return (data as { id: string }).id;
}
