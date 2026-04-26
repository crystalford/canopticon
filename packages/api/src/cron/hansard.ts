// Hansard cron handler.
//
// Wired to the cron trigger in wrangler.toml (every 6 hours). On each run:
//   1. Fetch the most recent Hansard debates from openparliament.ca.
//   2. For each debate not already represented in `sources` (dedup by url),
//      pull the full debate + speeches and normalize into a sources row.
//   3. Insert via the service-role Supabase client (RLS-bypassing — there's
//      no user JWT in a cron context).
//   4. Return a summary so the Worker's scheduled() handler can log it.
//
// Sprint 1 single-tenant: writes for env.OPERATOR_USER_ID. Multi-tenant
// auto-ingest is Sprint 2 — at that point we iterate over all users with
// auto_ingest_enabled=TRUE.

import type { Env } from "../env.ts";
import { OpenParliamentClient, normalizeDebate } from "../lib/openparliament.ts";
import { serviceClient } from "../lib/supabase.ts";

export interface HansardCronResult {
  ok: boolean;
  considered: number;
  ingested: number;
  skipped_duplicate: number;
  errors: Array<{ debate: string; message: string }>;
  ingested_sources: Array<{ id: string; slug: string }>;
}

export async function runHansardCron(
  env: Env,
  options: { limit?: number; opClient?: OpenParliamentClient } = {},
): Promise<HansardCronResult> {
  const op =
    options.opClient ??
    new OpenParliamentClient({
      userAgent: env.OPENPARLIAMENT_USER_AGENT,
    });
  const supabase = serviceClient(env);

  const recent = await op.listRecentDebates(options.limit ?? 5);
  const result: HansardCronResult = {
    ok: true,
    considered: recent.length,
    ingested: 0,
    skipped_duplicate: 0,
    errors: [],
    ingested_sources: [],
  };

  for (const summary of recent) {
    const ref = `${summary.date}/${summary.number}`;
    try {
      // Dedup by URL within this user's substrate.
      const canonicalUrl = summary.url.startsWith("http")
        ? summary.url
        : `https://openparliament.ca${summary.url}`;
      const { data: existing, error: lookupErr } = await supabase
        .from("sources")
        .select("id")
        .eq("user_id", env.OPERATOR_USER_ID)
        .eq("url", canonicalUrl)
        .maybeSingle();
      if (lookupErr) throw new Error(`lookup failed: ${lookupErr.message}`);
      if (existing) {
        result.skipped_duplicate++;
        continue;
      }

      // Pull full debate + speeches.
      const detail = await op.getDebate(summary.date, summary.number);
      const speeches = await op.getDebateSpeeches(summary.date, summary.number);
      const normalized = normalizeDebate(detail, speeches);

      const { data: inserted, error: insertErr } = await supabase
        .from("sources")
        .insert({
          user_id: env.OPERATOR_USER_ID,
          ...normalized,
        })
        .select("id, slug")
        .single();
      if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);

      result.ingested++;
      result.ingested_sources.push({ id: inserted.id as string, slug: inserted.slug as string });
    } catch (err) {
      result.ok = false;
      result.errors.push({ debate: ref, message: (err as Error).message });
    }
  }

  return result;
}
