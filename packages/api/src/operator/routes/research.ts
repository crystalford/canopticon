// Research on demand: the workspace, its status poll, the advance button and
// the review/publish/discard/brief.md rail. Split out of operator/routes.ts on
// 2026-09-24; every handler is unchanged.

import { enqueueProcessing, ensureProcessingTable } from "../../graph/lib/processing";
import { one, run } from "../../lib/d1";
import { pingIndexNow } from "../../lib/indexnow";
import { resolveOperatorId } from "../../public/data";
import { opHtml } from "../layout";
import { operatorApp } from "./app";

const app = operatorApp();

// "Research this for real" — the operator-only follow-through on a search
// miss's AI-generated preview (public/render/search.ts), also reused by the
// homepage's finding/thread "Research this" buttons and the watchlist's
// "Research now". The preview text itself never enters the graph (it's
// Brave's synthesis, not a quote from a stored document); this button runs
// the real search -> fetch -> verbatim-extract pipeline (expandRecord)
// keyed off the raw query, THEN synthesizes a draft brief from whatever
// gets banked (graph/lib/deep-research.ts's researchOnDemand) — banking
// alone used to be the whole action; a synthesized draft is a more useful
// answer to "research this" than a pile of unread raw pages. Lands as an
// unpublished, unreviewed draft — see /library/research/:id/review.
app.post("/search/research", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/search");
  const form = await c.req.parseBody();
  const q = typeof form.q === "string" ? form.q.trim() : "";
  const angle = typeof form.angle === "string" ? form.angle.trim() || undefined : undefined;
  if (!q) return c.redirect("/search");
  const { researchOnDemand } = await import("../../graph/lib/deep-research");
  c.executionCtx.waitUntil(researchOnDemand(c.env, userId, q, angle).catch(() => {}));
  const angleParam = angle ? `&angle=${encodeURIComponent(angle)}` : "";
  return c.redirect(`/op/research?q=${encodeURIComponent(q)}${angleParam}`);
});

// Advance a stalled research run one step.
//
// THIS EXISTS BECAUSE THE CRON IS OFF. researchOnDemand runs pass 1 inline and
// then deliberately does NOT chain pass 2 into the same execution — the
// follow-up searches and re-synthesis were picked up by index.ts's scheduled()
// handler instead. With the cron disabled (wrangler.toml), nothing dispatches
// them: a run that finds follow-up queries parks at `pass2_pending` and shows
// "Researching…" forever, with no error anywhere. Exactly the shape of the
// digest_jobs stranding caught in review earlier.
//
// Standing rule 4 says the fix for a queue with no dispatcher is a button, not
// a schedule. This is that button.
app.post("/research/advance", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { advanceResearchRun, reapStaleResearchRuns } = await import(
    "../../graph/lib/deep-research"
  );
  // The reap first and cheaply (one UPDATE, no model calls): a run whose
  // execution died mid-pass would otherwise block the queue behind it.
  await reapStaleResearchRuns(c.env, userId).catch(() => {});
  const report = await advanceResearchRun(c.env, userId).catch(() => null);
  // When the press came from the run's own status banner, go back to that
  // banner rather than to /library — the operator was watching one run, and
  // dumping them on the library index loses the thing they were watching.
  // Same-origin only: a return_to is a redirect target, so it is confined to
  // this site's own paths and never allowed to carry a scheme or a host.
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  // The status banner takes steps itself via fetch() and then re-polls, so it
  // wants the outcome, not a redirect it would have to follow.
  if (form.no_redirect === "1") {
    return c.json({ advanced: !!report?.advanced, reason: report?.reason ?? null });
  }
  const back = typeof form.return_to === "string" ? form.return_to : "";
  // A second "/" OR a backslash: browsers parse "/\evil.com" as "//evil.com".
  if (/^\/(?![/\\])/.test(back)) return c.redirect(back);
  return c.redirect(
    `/library?research=${encodeURIComponent(report?.advanced ? "advanced" : "nothing-pending")}`,
  );
});

// The on-demand research screen — its own dedicated page (operator/
// screens/research.ts), not a query param bolted onto /search. See that
// file's header comment for why.
app.get("/research", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.redirect("/");
  const angle = c.req.query("angle")?.trim() || undefined;
  const { renderResearchScreen } = await import("../screens/research");
  // Hand the screen the state at load so it renders COMPLETE — every source
  // found so far, the whole plan, the next action. The live layer then only
  // keeps it current. Without this the first paint is an empty frame that
  // fills in a second later, which is exactly the "is this working?" feeling
  // the workspace exists to remove, and it leaves the page useless with
  // JavaScript off.
  const { getResearchStatus } = await import("../../graph/lib/deep-research");
  const status = await getResearchStatus(c.env, userId, q).catch(() => null);
  return opHtml(renderResearchScreen({ label: q, angle, status }));
});

// JSON status for the live-polling banner (public/render/status-banner.ts's
// client script) — replaces the old <meta refresh> full-page-reload loop.
// One endpoint covers both plain expand (no synthesis phase, so
// getResearchStatus just passes getExpandStatus's line straight through)
// and on-demand research (adds the synthesis phase getExpandStatus alone
// can't see). c.req.query, not parseBody — this is a GET, polled every
// ~1.5s from the client; a form POST per poll would be needless overhead.
app.get("/research-status", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId)
    return c.json({ terminal: true, warn: true, headline: "not signed in", steps: [] }, 401);
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ terminal: true, warn: true, headline: "no query", steps: [] }, 400);
  // kind=expand: plain "Expand this file" has no synthesis phase — a
  // deep_research event for its label will never arrive, so
  // getResearchStatus must not wait on one.
  const includeSynthesis = c.req.query("kind") !== "expand";
  const { getResearchStatus } = await import("../../graph/lib/deep-research");
  const status = await getResearchStatus(c.env, userId, q, { includeSynthesis }).catch(() => null);
  if (!status) {
    return c.json({ terminal: false, warn: false, headline: "Starting…", steps: [] });
  }
  return c.json(status);
});

// Review screen for an on-demand research draft (graph/lib/deep-research.ts's
// researchOnDemand) — lands as publication_status='working-material', which
// renderPiece (public/render/piece-template.ts) refuses to render at all, by
// design (working-material never gets a public page). This is the only
// place it's readable before the operator decides: publish it (which is
// also the FIRST time it gets queued for typed-graph extraction — an
// unreviewed draft doesn't get to seed graph facts either) or discard it.
app.get("/library/research/:id/review", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const row = await one<{
    id: string;
    slug: string;
    title: string;
    body_md: string | null;
    metadata: string;
  }>(
    c.env.DB,
    "SELECT id, slug, title, body_md, metadata FROM pieces WHERE id = ? AND user_id = ? AND publication_status = 'working-material'",
    [c.req.param("id"), userId],
  );
  if (!row) return c.redirect("/library");
  let meta: { label?: string; angle?: string | null; source_piece_ids?: string[] } = {};
  try {
    meta = JSON.parse(row.metadata || "{}");
  } catch {
    meta = {};
  }
  const { escapeHtml } = await import("../../public/layout");
  // The publication's renderer, which escapes the source before it renders
  // it. A brief is model-written from fetched third-party pages, so its body
  // is not operator-authored text: cms/lib/render-post passes raw HTML
  // through by design ("posts are operator-authored only"), and that let a
  // <script> carried through a fetched page run on this operator screen.
  const { renderMarkdown } = await import("../../public/render/markdown");
  const { renderOpPage } = await import("../layout");
  const sourceCount = meta.source_piece_ids?.length ?? 0;
  const body = `<div style="font-size:12px;color:var(--dmut,#888);margin-bottom:16px">
  Researched: ${escapeHtml(meta.label ?? row.title)}
  ${meta.angle ? ` <span style="opacity:.7">· angle: "${escapeHtml(meta.angle)}"</span>` : ""}
  <span style="opacity:.7"> · ${sourceCount} source${sourceCount === 1 ? "" : "s"} banked</span>
</div>
<div style="border:1px solid #2e2e38;border-radius:9px;padding:20px 24px;background:#15181f;color:#e8eaef;max-width:720px;line-height:1.6">${renderMarkdown(row.body_md ?? "", { anchors: false })}</div>
<div style="margin-top:16px;display:flex;gap:10px">
  <form method="POST" action="/op/library/research/${escapeHtml(row.id)}/publish">
    <button type="submit" class="btn primary" style="background:#d9a441;color:#1c1608;font-weight:600;padding:9px 20px;border-radius:7px;border:none;cursor:pointer">Publish</button>
  </form>
  <form method="POST" action="/op/library/research/${escapeHtml(row.id)}/discard" onsubmit="return confirm('Discard this draft? This deletes it — there is no undo.');">
    <button type="submit" class="btn" style="padding:9px 20px;border:1px solid #2e2e38;border-radius:7px;color:#c8c5bd;background:transparent;cursor:pointer">Discard</button>
  </form>
</div>`;
  return opHtml(
    renderOpPage({
      title: "Review research draft",
      sub: "written automatically, unpublished, unread until now · nothing has entered the record yet",
      body,
      activeNav: "/library",
    }),
  );
});

// Publish an on-demand research draft — the FIRST point it becomes public
// (publication_status → 'published') and the FIRST point it's queued for
// typed-graph extraction. Both were deferred from creation specifically so
// nothing here happens before the operator reads it.
app.post("/library/research/:id/publish", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const row = await one<{ slug: string; title: string; metadata: string }>(
    c.env.DB,
    "SELECT slug, title, metadata FROM pieces WHERE id = ? AND user_id = ? AND publication_status = 'working-material'",
    [c.req.param("id"), userId],
  );
  if (!row) return c.redirect("/library");
  const now = new Date().toISOString();
  await run(
    c.env.DB,
    "UPDATE pieces SET publication_status = 'published', published_at = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [now, now, c.req.param("id"), userId],
  );
  let meta: { source_id?: string } = {};
  try {
    meta = JSON.parse(row.metadata || "{}");
  } catch {
    meta = {};
  }
  // Published like an upload: the same pipeline reads it (docs/the-record.md
  // §6). meta.source_id is what the digest step reads the text from.
  if (meta.source_id) {
    await ensureProcessingTable(c.env);
    await enqueueProcessing(c.env, userId, c.req.param("id"));
  }
  // A published brief is a new public URL: one IndexNow ping, fire-and-forget,
  // inert without INDEXNOW_KEY (lib/indexnow.ts).
  const ping = pingIndexNow(c.env, [`/p/${row.slug}`, "/research", "/sitemap.xml"]).catch(() => {});
  try {
    c.executionCtx.waitUntil(ping);
  } catch {
    // No execution context — the promise is already running.
  }
  return c.redirect(`/p/${row.slug}`);
});

// Discard an on-demand research draft. Extraction was never queued for a
// working-material piece (see the review screen's comment above), so
// there's nothing downstream to clean up — a plain delete is safe.
app.post("/library/research/:id/discard", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  await run(
    c.env.DB,
    "DELETE FROM pieces WHERE id = ? AND user_id = ? AND publication_status = 'working-material'",
    [c.req.param("id"), userId],
  );
  return c.redirect("/library");
});

// THE BRIEF AS A FILE. The other way out of the review panel on the research
// workspace (public/render/research-workspace.ts): instead of publishing the
// brief under the research agent's byline, the operator takes the Markdown,
// rewrites it and uploads it as their own essay. The first line says which
// model wrote it, from which question and which parent document — the same
// label /readings/:id/draft-essay puts on its file — so a file on a disk
// never loses its provenance. No model is called; the file is the row.
// A GET, because it spends nothing and writes nothing.
app.get("/library/research/:id/brief.md", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.text("No operator user", 401);
  const row = await one<{
    id: string;
    slug: string;
    title: string;
    body_md: string | null;
    publication_status: string;
    parent_piece_id: string | null;
    origin: string | null;
  }>(
    c.env.DB,
    `SELECT id, slug, title, body_md, publication_status, parent_piece_id, origin
       FROM pieces WHERE id = ? AND user_id = ?`,
    [c.req.param("id"), userId],
  );
  if (!row) return c.text("No such brief", 404);
  const parent = row.parent_piece_id
    ? await one<{ slug: string; title: string }>(
        c.env.DB,
        "SELECT slug, title FROM pieces WHERE id = ? AND user_id = ?",
        [row.parent_piece_id, userId],
      ).catch(() => null)
    : null;
  const runRow = await one<{ writer: string | null }>(
    c.env.DB,
    "SELECT writer FROM research_runs WHERE user_id = ? AND final_piece_id = ? ORDER BY created_at DESC LIMIT 1",
    [userId, row.id],
  ).catch(() => null);
  const { writerName } = await import("../../graph/lib/deep-research");
  const model = writerName(c.env, runRow?.writer ?? null);
  const date = new Date().toISOString().slice(0, 10);
  const question = row.origin?.trim() || row.title;
  const from = parent
    ? ` and the document "${parent.title}" (https://canopticon.com/p/${parent.slug})`
    : "";
  const state =
    row.publication_status === "published"
      ? `Published at https://canopticon.com/p/${row.slug}.`
      : "Not published.";
  const body = (row.body_md ?? "").trim();
  const text = body.startsWith("# ") ? body : `# ${row.title}\n\n${body}`;
  const file = `<!-- WRITTEN BY ${model} from the question "${question.replace(/"/g, "'")}"${from} on ${date}. ${state} Edit before uploading; the byline will be yours. -->\n\n${text}\n`;
  return new Response(file, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="brief-${row.slug}.md"`,
      "cache-control": "no-store",
    },
  });
});

export default app;
