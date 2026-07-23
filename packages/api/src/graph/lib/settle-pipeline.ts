// The corpus-settle pipeline — one step at a time, always.
//
// Six steps run, in order, whenever the corpus needs to catch up: entity
// resolution -> event dedup -> surfacing -> theme detection -> page
// autoseeding -> signed-reading drafts. These used to run chained together
// in one execution context every time the corpus went idle. Confirmed live
// (twice, on the standalone admin /resettle endpoint before this module
// existed) that chaining real LLM-calling steps this way reliably exceeds
// Cloudflare's aggregate wall-clock/CPU budget for a single waitUntil, with
// no catchable error — the platform tears down the execution context
// outright. advanceSettleOneStep is the fix applied everywhere the pipeline
// fires: run exactly ONE step, persist which one ran via settle_state
// (migration 0037), move on next time. Two triggers keep it moving:
//   1. digest-jobs.ts calls it once when the corpus goes idle (the last
//      queued job finishes) — the common case, right after an upload.
//   2. index.ts's every-minute cron calls it too (self-throttled below to
//      at most once per ~90s) so the full cycle keeps completing even
//      without new uploads — otherwise draft_readings, last in the cycle,
//      only ever gets a turn when someone happens to upload again.
//
// A "propose_briefs" step used to sit between autoseed_pages and
// draft_readings, automatically feeding the older `briefs` publishing
// pipeline (graph/lib/briefs/). Removed — signed `pages` readings are the
// pipeline actually being used; briefs is sunset going forward, but its
// library (graph/lib/briefs/pipeline.ts) stays, since draft-reading.ts
// still shares its judgeClaim function, and old /briefs/:slug pages still
// resolve from data already published.

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";

export const SETTLE_STEPS_ORDER = [
  "entity_resolution",
  "event_dedup",
  "surfacing_l1",
  "theme_surfacer",
  "autoseed_pages",
  "draft_readings",
] as const;

export type SettleStepName = (typeof SETTLE_STEPS_ORDER)[number];

export const SETTLE_STEP_RUNNERS: Record<
  SettleStepName,
  (env: Env, userId: string) => Promise<unknown>
> = {
  entity_resolution: async (env, userId) => {
    const { resolveEntities } = await import("./entity-resolution");
    return resolveEntities(env, userId);
  },
  event_dedup: async (env, userId) => {
    const { resolveDuplicateEvents } = await import("./entity-resolution");
    return resolveDuplicateEvents(env, userId);
  },
  surfacing_l1: async (env, userId) => {
    const { runSurfacingL1 } = await import("./surfacing");
    return runSurfacingL1(env, userId);
  },
  theme_surfacer: async (env, userId) => {
    const { runThemeSurfacer } = await import("./theme-surfacer");
    return runThemeSurfacer(env, userId);
  },
  autoseed_pages: async (env, userId) => {
    const { autoseedPages } = await import("./autoseed-pages");
    return autoseedPages(env, userId);
  },
  draft_readings: async (env, userId) => {
    const { draftReadings } = await import("./draft-reading");
    return draftReadings(env, userId);
  },
};

// Don't re-advance inside this window — protects against the digest-job
// trigger and the cron trigger firing within seconds of each other and
// racing to run the same step twice, and against the cron hammering a
// step that's genuinely slow.
const MIN_ADVANCE_INTERVAL_MS = 90 * 1000;

export async function advanceSettleOneStep(env: Env, userId: string): Promise<void> {
  const state = await one<{ next_step: string; last_advanced_at: string | null }>(
    env.DB,
    "SELECT next_step, last_advanced_at FROM settle_state WHERE user_id = ?",
    [userId],
  ).catch(() => null);

  if (state?.last_advanced_at) {
    const sinceMs = Date.now() - new Date(state.last_advanced_at).getTime();
    if (sinceMs < MIN_ADVANCE_INTERVAL_MS) return;
  }

  const step = (SETTLE_STEPS_ORDER as readonly string[]).includes(state?.next_step ?? "")
    ? (state?.next_step as SettleStepName)
    : SETTLE_STEPS_ORDER[0];
  const runner = SETTLE_STEP_RUNNERS[step];

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "settle_step_started",
    subject_kind: "corpus",
    subject_id: userId,
    payload: { step },
  }).catch(() => {});

  try {
    await runner(env, userId);
  } catch (err) {
    await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: "settle_step_failed",
      subject_kind: "corpus",
      subject_id: userId,
      payload: { step, error: (err as Error).message ?? "unknown error" },
    }).catch(() => {});
  }

  const idx = SETTLE_STEPS_ORDER.indexOf(step);
  const nextStep = SETTLE_STEPS_ORDER[(idx + 1) % SETTLE_STEPS_ORDER.length];
  const now = new Date().toISOString();
  try {
    await run(
      env.DB,
      `INSERT INTO settle_state (user_id, next_step, last_advanced_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET next_step = excluded.next_step, last_advanced_at = excluded.last_advanced_at`,
      [userId, nextStep, now],
    );
  } catch (err) {
    // If this write fails silently (this whole function runs inside a
    // waitUntil — an unhandled rejection here has nowhere else to surface)
    // the pipeline gets stuck re-running the same step forever, which is
    // exactly the bug this event log exists to catch.
    await insertOne(env.DB, "orchestrator_events", {
      user_id: userId,
      event_type: "settle_advance_write_failed",
      subject_kind: "corpus",
      subject_id: userId,
      payload: { step, nextStep, error: (err as Error).message ?? "unknown error" },
    }).catch(() => {});
  }
}
