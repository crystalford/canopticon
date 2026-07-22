// POST /refresh — operator-only. Triggers a re-pull of the official
// statistics: fetch each source, snapshot to R2 if changed, re-ingest
// into D1, recompute the Invisibility Index. Push-button only — there
// is no cron.
//
// Commit 2 ships the gated shell: anonymous callers are bounced to the
// publication login; the operator gets a 302 back to `/`. The actual
// ingest orchestration lands in Commit 4 (data layer), called from
// here via `ctx.waitUntil`.

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth.ts";
import { runIngest } from "../data/ingest.ts";
import type { Env } from "../env.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.post("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;

  // Ingest is fast (fetch + snapshot + a handful of D1 upserts), so we
  // await it and land the operator back on a freshly-painted instrument.
  // Any failure is recorded in update_log inside runIngest; the operator
  // still gets redirected rather than a raw error.
  const stamp = Date.now();
  try {
    const summary = await runIngest(c.env);
    const status = summary.errors.length ? "partial" : "ok";
    return c.redirect(`/?refreshed=${stamp}&status=${status}`, 302);
  } catch {
    return c.redirect(`/?refreshed=${stamp}&status=error`, 302);
  }
});

export default app;
