// /queue routes — operator's view of the daily-radar candidates +
// segment review surface.
//
// GET  /queue                       — list candidates ranked by rubric
// POST /queue/poll                  — operator-triggered manual poll
//                                     (same code path as the cron)
// POST /queue/:id/promote           — call the editorial brain to draft
//                                     a §7b segment from the candidate,
//                                     insert into segments table, redirect
//                                     to the review page
// GET  /queue/:id                   — review surface: edit forensic_turn
// POST /queue/:id/approve           — approve + render (action=approve)
//                                     or save draft (action=save)

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth";
import { draftSegment } from "../editorial/brain";
import { castTemplate, scoreCandidate } from "../editorial/rubric";
import type { Env } from "../env";
import { renderQueuePage } from "../pages/queue";
import { renderReviewPage } from "../pages/review";
import { renderSegment as renderInContainer } from "../render/client";
import { fetchBraveCandidates } from "../sourcing/brave";
import {
  listRecent,
  loadCandidate,
  markPromoted,
  recordRubric,
  recordTemplate,
  upsertCandidate,
} from "../sourcing/candidates";
import { fetchCandidates } from "../sourcing/gdelt";
import {
  approveSegment,
  createRenderJob,
  insertDraftedSegment,
  loadSegment,
  markRenderFailed,
  markRenderRunning,
  markRenderSucceeded,
  markSegmentRendered,
  saveSegmentDraft,
} from "../storage/d1";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const rows = await listRecent(c.env.DB, 48, 50).catch(() => []);
  return renderQueuePage({ candidates: rows });
});

// Manual poll — fires the same logic the daily cron does.
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
  // Editorial brain — LLM (or fallback skeleton) writes a §7b draft.
  const draft = await draftSegment({ AI: c.env.AI }, candidate);
  if (!draft.ok || !draft.segment) {
    return new Response(`draft failed: ${draft.error ?? "unknown"}`, { status: 500 });
  }
  await insertDraftedSegment(c.env.DB, draft.segment);
  await markPromoted(c.env.DB, id);
  return c.redirect(`/queue/${encodeURIComponent(id)}`, 302);
});

// Review surface — operator edits forensic_turn.
app.get("/:id", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const candId = c.req.param("id");
  const candidate = await loadCandidate(c.env.DB, candId);
  if (!candidate) return new Response("candidate not found", { status: 404 });
  const segmentId = `seg-${candId}`;
  const segment = await loadSegment(c.env.DB, segmentId);
  if (!segment) {
    return new Response("segment not drafted yet — promote the candidate first", {
      status: 404,
    });
  }
  const message = c.req.query("msg");
  return renderReviewPage({
    candidate,
    segment,
    usedLlm: !segment.forensic_turn.text.includes("[OPERATOR:"),
    ...(message ? { message } : {}),
  });
});

// Approve / save-draft.
app.post("/:id/approve", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const candId = c.req.param("id");
  const segmentId = `seg-${candId}`;
  const form = await c.req.formData();
  const action = String(form.get("action") ?? "approve");
  const forensicTurn = String(form.get("forensic_turn") ?? "").trim();
  if (!forensicTurn) {
    return c.redirect(
      `/queue/${encodeURIComponent(candId)}?msg=${encodeURIComponent("forensic_turn cannot be empty")}`,
      302,
    );
  }

  if (action === "save") {
    await saveSegmentDraft(c.env.DB, segmentId, forensicTurn);
    return c.redirect(
      `/queue/${encodeURIComponent(candId)}?msg=${encodeURIComponent("draft saved")}`,
      302,
    );
  }

  const approved = await approveSegment(c.env.DB, segmentId, forensicTurn);
  if (!approved) return new Response("segment not found", { status: 404 });

  // Fire the render in waitUntil — same path /spike uses.
  const jobId = await createRenderJob(c.env.DB, approved);
  c.executionCtx.waitUntil(
    (async () => {
      try {
        await markRenderRunning(c.env.DB, jobId);
        const result = await renderInContainer(c.env.RENDER_CONTAINER, approved);
        if (!result.ok || !result.mp4) {
          await markRenderFailed(c.env.DB, jobId, result.error ?? "unknown");
          return;
        }
        const key = `${jobId}.mp4`;
        await c.env.ASSETS.put(key, result.mp4, {
          httpMetadata: { contentType: "video/mp4" },
        });
        await markRenderSucceeded(c.env.DB, jobId, {
          r2_key: key,
          walltime_ms: result.walltime_ms ?? 0,
          est_cost_cents: result.est_cost_cents ?? 0,
        });
        await markSegmentRendered(c.env.DB, segmentId);
      } catch (err) {
        await markRenderFailed(c.env.DB, jobId, (err as Error).message ?? "unknown").catch(
          () => {},
        );
      }
    })(),
  );

  return c.redirect("/", 302);
});

/** The full discovery pass: pool from every radar → upsert → score →
 *  cast. Called by the daily cron and by the operator's manual /poll. */
export async function runDailyPoll(env: Env): Promise<void> {
  // Pool from both radars. Brave catches the "last 90 minutes" stuff
  // GDELT hasn't transcribed yet; GDELT catches the broadcast soundbites
  // Brave doesn't index. Same id format (deterministic from URL) means
  // de-dup is automatic at upsert time.
  const [gdeltCands, braveCands] = await Promise.all([
    fetchCandidates({ apiKey: env.GDELT_API_KEY }),
    fetchBraveCandidates({ apiKey: env.BRAVE_SEARCH_API_KEY }),
  ]);
  const pool = [...gdeltCands, ...braveCands];

  for (const c of pool) {
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
