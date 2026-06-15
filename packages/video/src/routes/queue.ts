// /queue routes — operator's view of the daily-radar candidates.
//
// GET  /queue                       — list
// POST /queue/poll                  — operator-triggered manual GDELT poll
// POST /queue/:id/promote           — promote a candidate to a segment (stub)

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth";
import { castTemplate, scoreCandidate } from "../editorial/rubric";
import type { Env } from "../env";
import { renderQueuePage } from "../pages/queue";
import {
  listRecent,
  loadCandidate,
  markPromoted,
  recordRubric,
  recordTemplate,
  upsertCandidate,
} from "../sourcing/candidates";
import { fetchCandidates } from "../sourcing/gdelt";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const rows = await listRecent(c.env.DB, 48, 50).catch(() => []);
  return renderQueuePage({ candidates: rows });
});

// Manual poll — fires the same logic the daily cron does. Useful for
// the operator during Phase 1 testing before the cron has fired.
app.post("/poll", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  c.executionCtx.waitUntil(runDailyPoll(c.env));
  return c.redirect("/queue", 302);
});

app.post("/:id/promote", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const id = c.req.param("id");
  const candidate = await loadCandidate(c.env.DB, id);
  if (!candidate) return new Response("candidate not found", { status: 404 });
  if (!candidate.cast_template) {
    return new Response("candidate has no template — re-score it first", { status: 400 });
  }
  // Phase 1 chunk B will wire the editorial brain here (LLM writes the
  // full §7b script). Phase 1 chunk A just marks the candidate promoted
  // so the operator can see the flow shape.
  await markPromoted(c.env.DB, id);
  return c.redirect("/queue", 302);
});

/** Fetch → upsert → score → cast — the full discovery pass. Called by
 *  the daily cron and by the operator's manual /poll button. */
export async function runDailyPoll(env: Env): Promise<void> {
  const candidates = await fetchCandidates({
    apiKey: env.GDELT_API_KEY,
  });
  for (const c of candidates) {
    await upsertCandidate(env.DB, c).catch(() => {});
    const rubric = await scoreCandidate({ AI: env.AI }, c).catch(() => null);
    if (!rubric) continue;
    await recordRubric(env.DB, c.id, rubric.total, JSON.stringify(rubric.scores)).catch(() => {});
    const tmpl = castTemplate(rubric.gap_kind);
    if (tmpl) {
      await recordTemplate(env.DB, c.id, tmpl).catch(() => {});
    }
  }
}

export default app;
