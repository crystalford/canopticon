// Leads and "Ask the record". Split out of operator/routes.ts on 2026-09-24;
// every handler is unchanged.

import { resolveOperatorId } from "../../public/data";
import { operatorApp } from "./app";

const app = operatorApp();

// DIG A LEAD — the Wikipedia inversion.
//
// On Wikipedia you click a link and arrive at a page someone already wrote.
// Here, clicking is the act that CREATES the next page: follow a lead, the
// system researches it, and what comes back enters the corpus as a document
// like any other — whose own extraction can then raise further leads. The
// corpus gets bigger because somebody was curious, which is the whole of what
// "it helps my research" was supposed to mean.
//
// The seed and the angle come from the form rather than a row, because a lead
// is a QUERY RESULT and not a stored object. Storing them would mean keeping a
// table in sync with a query that is cheaper to just re-run, and would give a
// lead an identity it has not earned. Upload is authorization and so is this:
// the operator is the only one who can reach the page that renders the button.
//
// Push-button, never scheduled (standing rule 4). Nothing here runs because
// time passed.
app.post("/leads/dig", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk/workbench");
  const form = await c.req.parseBody();
  const seed = typeof form.seed === "string" ? form.seed.trim() : "";
  const angle = typeof form.angle === "string" ? form.angle.trim() || undefined : undefined;
  if (!seed) return c.redirect("/desk/workbench?error=that+lead+carried+nothing+to+search+for");

  const kind = typeof form.kind === "string" ? form.kind : "";
  const str = (k: string) => (typeof form[k] === "string" ? (form[k] as string).trim() : "");
  // The per-run writer. A ticked box means Claude for THIS run; unticked means
  // the deployment default. Stored on the run so every step agrees, and it
  // fails loudly rather than substituting if Claude is chosen but unavailable.
  const writer = form.writer === "anthropic" ? "anthropic" : null;

  // A CONTRADICTION IS ANSWERED FROM WHAT WE ALREADY HOLD.
  //
  // This used to fire the full deep-research pipeline at every lead — a broad
  // web search, twelve sources read to twelve percent each, a three-thousand
  // word brief — for a question one sentence wide. For two documents that
  // disagree, that is the wrong instrument twice over: the material needed to
  // settle it is already in the corpus, in full, and the output was something
  // the operator had to trust rather than check.
  //
  // Both documents are read whole, the answer is three sentences, and every
  // quote is located verbatim in one of them before it is stored. Nothing is
  // fetched, nothing is banked, no new population appears in `pieces`.
  // An unsourced figure is one question wide too, but the answer is not in
  // the corpus — the corpus is what failed to name a source. Three pages are
  // fetched, at most; the answer says who published the number, where and
  // when; and only quotes located verbatim in a fetched page survive.
  if (kind === "contradiction" || kind === "unsourced-figure") {
    const { answerLead, answerUnsourcedFigure } = await import("../../graph/lib/answer-lead");
    const lead = {
      kind: kind as "contradiction" | "unsourced-figure",
      summary: seed,
      detail: seed,
      quote_id: null,
      piece_id: str("piece_id"),
      piece_slug: str("piece_slug") || null,
      piece_title: null,
      other_piece_slug: str("other_slug") || null,
      other_piece_title: null,
      created_at: new Date().toISOString(),
      seed,
      angle: angle ?? "",
    };
    const work = (
      kind === "unsourced-figure"
        ? answerUnsourcedFigure(c.env, userId, lead, { writer })
        : answerLead(c.env, userId, lead, { writer })
    ).catch(() => {});
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      // No execution context (tests) — already running, just not kept alive.
    }
    // Back to the document, where the lead and its answer live. There is no
    // separate screen for this and there should not be: the answer belongs
    // under the question it settles.
    const back = str("piece_slug");
    return c.redirect(back ? `/p/${encodeURIComponent(back)}#leads` : "/desk/workbench#leads");
  }

  const { researchOnDemand } = await import("../../graph/lib/deep-research");
  // Started before it is handed anywhere: c.executionCtx THROWS when there is
  // no ExecutionContext, and an unguarded access here would 500 the request
  // that started a perfectly good run. Same bug, same fix, as the subscribe
  // route.
  // Lineage (docs/the-record.md §5): the run remembers which document's lead,
  // question, bridge or reading started it, so the brief it produces is that
  // document's child. "novelty" is the bridge's second button — "Has anyone
  // said this?" — and only changes the angle the writer is given.
  const parentPieceId = str("piece_id") || null;
  const originKind = kind || "free";
  const run = researchOnDemand(c.env, userId, seed, angle, {
    writer,
    parentPieceId,
    originKind,
  }).catch(() => {});
  try {
    c.executionCtx.waitUntil(run);
  } catch {
    // No execution context (tests, some runtimes) — the promise is already
    // running; it simply is not kept alive past the response.
  }
  const angleParam = angle ? `&angle=${encodeURIComponent(angle)}` : "";
  return c.redirect(`/op/research?q=${encodeURIComponent(seed)}${angleParam}`);
});

// ---- Ask the record ---------------------------------------------------------
//
// /search retrieves the passages; this makes the record ANSWER — at most four
// sentences, from the documents those passages came out of, every quote
// located verbatim or dropped and counted, frozen into a lead_answers row
// under kind "question" (graph/lib/answer-question.ts). One press, one writer
// call, nothing scheduled (standing rule 4); the row renders for every
// reader on the search page for that question, and nothing calls a model to
// render it (rule 5). Questions get no URL of their own — this redirects
// back to /search, where the answer lives above the passages.
app.post("/ask", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/search");
  const form = await c.req.parseBody();
  const q = typeof form.q === "string" ? form.q.replace(/\s+/g, " ").trim() : "";
  if (!q) return c.redirect("/search");
  // Same per-run writer as /leads/dig: ticked means Claude for THIS answer.
  const writer = form.writer === "anthropic" ? "anthropic" : null;
  const { answerQuestion } = await import("../../graph/lib/answer-question");
  const work = answerQuestion(c.env, userId, q, { writer }).catch(() => {});
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    // No execution context (tests) — already running, just not kept alive.
  }
  return c.redirect(`/search?q=${encodeURIComponent(q)}&asked=1`);
});

export default app;
