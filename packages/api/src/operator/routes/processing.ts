// The pipeline buttons and the title decisions. Split out of
// operator/routes.ts on 2026-09-24; every handler is unchanged.

import { run } from "../../lib/d1";
import { resolveOperatorId } from "../../public/data";
import { operatorApp } from "./app";

const app = operatorApp();

// ACCEPT A TITLE.
//
// A document published under the name its research session gave itself —
// "PASS 7-MINI — HARDENING DOSSIER" — and /library offered candidates lifted
// out of the document's own text. This is the click that takes one.
//
// It NEVER runs on its own. Upload is authorization for publishing (rule 2),
// but a title is the most quoted line a document has, and renaming one
// unasked is a different act from publishing it. So a rename requires a
// person, and title_approved_at records that one happened.
//
// original_title keeps the working title forever, and only on the first
// rename — so the name the operator knew the document by survives, and a
// second rename cannot overwrite it with the first rename's output.
app.post("/pieces/:id/title", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const form = await c.req.parseBody();
  const title = typeof form.title === "string" ? form.title.trim() : "";
  if (!title) return c.redirect("/library?error=a+title+cannot+be+empty");

  const { run } = await import("../../lib/d1");
  await run(
    c.env.DB,
    `UPDATE pieces
        SET original_title = COALESCE(original_title, title),
            title = ?,
            title_approved_at = ?,
            updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [title, new Date().toISOString(), new Date().toISOString(), c.req.param("id"), userId],
  ).catch(() => {});
  return c.redirect("/library?renamed=1");
});

// Manual extraction trigger. The pivot decoupled upload from extraction;
// this is where the operator actually fires the LLM digestion pipeline.
//
// Three modes:
//   piece_ids[] — extract these pieces only (per-row or detail-page button)
//   mode=all-unextracted — extract every piece that has no completed
//     digest_jobs row yet (header batch button)
//   mode=all — re-extract every piece regardless of prior status, clearing
//     existing digest_jobs so each run starts fresh at chunk 0 (used after
//     a pipeline change to refill the typed graph; mirrors /v1/admin/reextract)
// Either way: enqueue durable jobs + kick each off via waitUntil for instant
// start. The every-minute cron drain catches anything killed mid-run.
// THE PIPELINE — one step per request; the library page presses this while
// it is open (docs/the-record.md §4). A form POST lands back on /library; the
// poller asks for JSON and updates the row in place. Nothing schedules it.
app.post("/process/advance", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.json({ ok: false, error: "no operator" }, 401);
  const wantsJson = (c.req.header("accept") ?? "").includes("application/json");
  const piece = c.req.query("piece") ?? undefined;
  const { advanceProcessing, describeProcessing } = await import("../../graph/lib/processing");
  const r = await advanceProcessing(c.env, userId, piece);
  if (!wantsJson) return c.redirect("/library");
  return c.json({
    ok: true,
    piece_id: r.piece_id,
    remaining: r.remaining,
    note: r.note,
    status: describeProcessing(r.row ?? undefined),
    row: r.row,
  });
});

// Queue every published document that has never been processed to the end.
app.post("/process/all", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { enqueueEverything, ensureProcessingTable } = await import("../../graph/lib/processing");
  await ensureProcessingTable(c.env);
  const n = await enqueueEverything(c.env, userId);
  return c.redirect(`/library?queued=${n}`);
});

// Re-process one document from the start (a new version, a new model, or a
// row that never finished). Retry resumes a failed row at the step it failed.
app.post("/library/:id/reprocess", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { enqueueProcessing, ensureProcessingTable } = await import("../../graph/lib/processing");
  await ensureProcessingTable(c.env);
  await enqueueProcessing(c.env, userId, c.req.param("id"), { restart: true });
  return c.redirect("/library?queued=1");
});
app.post("/library/:id/retry", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { retryProcessing } = await import("../../graph/lib/processing");
  await retryProcessing(c.env, userId, c.req.param("id"));
  return c.redirect("/library?queued=1");
});

// Put a machine-chosen title back. original_title has the name the document
// arrived with; title_approved_at marks that a person decided this time.
app.post("/pieces/:id/title/revert", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  await run(
    c.env.DB,
    `UPDATE pieces
        SET title = COALESCE(original_title, title), title_auto_at = NULL,
            title_approved_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND original_title IS NOT NULL`,
    [new Date().toISOString(), new Date().toISOString(), c.req.param("id"), userId],
  ).catch(() => {});
  return c.redirect("/library?renamed=1");
});

export default app;
