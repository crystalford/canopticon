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
import type { Env } from "../env.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.post("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;

  // Commit 4 wires the ingest orchestrator here:
  //   c.executionCtx.waitUntil(runIngest(c.env));
  // For now the button is live but the pipeline is a no-op; the
  // operator lands back on the instrument.
  const stamp = Date.now();
  return c.redirect(`/?refreshed=${stamp}`, 302);
});

export default app;
