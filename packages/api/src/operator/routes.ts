// Operator routes. Mounted at /op in the Worker root. Cloudflare Access
// gates this subtree at the edge; /op/login mints the session cookie.
//
// The operator has no separate console: /library (public/render/
// investigations.ts) is the working page, and these are the POST actions its
// buttons submit to, plus the research workspace at /op/research. The
// graph-era screens (outputs, studio, synthesis, signed readings, proposals,
// faces) were unmounted on 2026-09-24 — see docs/the-record.md §9. Their
// old paths 301 to the live surfaces at the bottom of this file.

import { unzipSync } from "fflate";
import { Hono } from "hono";
import type { Env } from "../env";
import { jobStatusForPiece } from "../graph/lib/digest-jobs";
import { extractUpload, readFullExtractedText } from "../graph/lib/extract";
import { enqueueProcessing, ensureProcessingTable } from "../graph/lib/processing";
import { insertOne, one, run } from "../lib/d1";
import { type LintNote, lintEssay, looksLikeEssay, parseEssay } from "../lib/essay";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { opHtml } from "./layout";

const app = new Hono<{ Bindings: Env }>();

// ---- one site, permission layers (spec v2.5 Part 9) ---------------------
//
// PR 1 dissolves the /op/* console as a destination. The operator now lives
// on the public URLs; /auth/login mints a session cookie, public renderers
// surface operator affordances inline. These GET redirects bounce the old
// console URLs to their public equivalents so external links keep working.
//
// POST endpoints below (extract, sign, edit, discard, etc.) are the ACTION
// endpoints the public-side affordances post to — those stay mounted. Only
// the GET screens (which rendered the dark-themed parallel console) redirect.
const OP_GET_REDIRECTS: Array<[string, string]> = [
  ["/", "/"],
  ["/out", "/"],
  ["/synthesis", "/"],
  ["/studio", "/"],
  ["/outputs", "/research"],
  ["/library", "/library"],
];
for (const [from, to] of OP_GET_REDIRECTS) {
  app.get(from, (c) => {
    const qs = new URL(c.req.url).search;
    return c.redirect(`${to}${qs}`, 302);
  });
}
// /op/library/:slug → /library/:slug (preserve the slug)
app.get("/library/:slug", (c) => c.redirect(`/library/${c.req.param("slug")}`, 302));

// POST /op/feed/upload — the auto-ingest entry point.
//   1. Store file in R2 + uploaded_files row
//   2. Extract text (extract.ts: PDF → Llama Scout; md/txt → straight through)
//   3. Create a pieces row from the extracted text (status: working-material)
//   4. Run the digestion pipeline synchronously so the activity log
//      is populated by the time we redirect.
// "Upload is authorization" — no preview, no confirmation, no second click.
// A .zip is expanded and each supported document inside is ingested.
const ZIP_ENTRY_RE = /\.(md|markdown|txt|pdf|docx)$/i;
const ZIP_MAX_ENTRIES = 100;

app.post("/feed/upload", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) {
      return c.redirect(`/op/library?error=${encodeURIComponent("No operator user")}`);
    }
    await ensureProcessingTable(c.env);
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return c.redirect(`/op/library?error=${encodeURIComponent("No file in form data")}`);
    }
    const f = file as unknown as File;
    const isZip = f.type.includes("zip") || /\.zip$/i.test(f.name);

    if (isZip) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(buf, { filter: (e) => ZIP_ENTRY_RE.test(e.name) && e.size > 0 });
      } catch (err) {
        return c.redirect(
          `/op/library?error=${encodeURIComponent(`Bad zip: ${(err as Error).message}`)}`,
        );
      }
      const names = Object.keys(entries).filter(
        (n) => !n.startsWith("__MACOSX/") && !(n.split("/").pop() ?? "").startsWith("."),
      );
      if (names.length === 0) {
        return c.redirect(
          `/op/library?error=${encodeURIComponent("No .md/.txt/.pdf/.docx files in the zip")}`,
        );
      }
      // For zips: create + bank every entry synchronously (fast), then queue
      // each new piece for the pipeline. The library page the operator lands
      // on presses the pipeline forward while it is open.
      const pieceIds: string[] = [];
      let zipDupes = 0;
      for (const name of names.slice(0, ZIP_MAX_ENTRIES)) {
        const bytes = entries[name];
        if (!bytes) continue;
        const base = name.split("/").pop() || name;
        try {
          const p = await createAndExtract(
            c.env,
            userId,
            bytes,
            base,
            mimeForName(base),
            bytes.length,
          );
          pieceIds.push(p.pieceId);
          if (p.duplicate) {
            zipDupes++;
          } else if (p.sourceId) {
            await enqueueProcessing(c.env, userId, p.pieceId);
          }
        } catch {
          // skip a bad entry; keep ingesting the rest
        }
      }
      return c.redirect(`/op/library?ingested=${pieceIds.length}&dupes=${zipDupes}`);
    }

    // Single-file: store, publish, queue the pipeline. The drop is the
    // trigger; the library page it lands on does the rest while open. A
    // duplicate upload is already banked and already queued or processed.
    const p = await createAndExtract(c.env, userId, f.stream(), f.name, f.type, f.size);
    if (p.duplicate) {
      return c.redirect(`/op/library?piece=${encodeURIComponent(p.pieceId)}&dedup=1`);
    }
    if (p.sourceId) await enqueueProcessing(c.env, userId, p.pieceId);
    return c.redirect(`/op/library?piece=${encodeURIComponent(p.pieceId)}`);
  } catch (err) {
    const message = (err as Error).message ?? "unknown error";
    // Durable breadcrumb: the failure path otherwise leaves nothing readable
    // (in-flight writes can roll back on a D1 object reset). Best-effort — a
    // fresh statement after the failure usually lands even if the prior op
    // was reset. Lets /v1/admin/runtime show WHY an upload threw.
    try {
      const uid = await resolveOperatorId(c.env.DB);
      if (uid) {
        await insertOne(c.env.DB, "orchestrator_events", {
          user_id: uid,
          event_type: "feed.upload.failed",
          subject_kind: "upload",
          subject_id: null,
          payload: JSON.stringify({ error: message }),
        });
      }
    } catch {
      // never let the breadcrumb mask the original error
    }
    return c.redirect(`/op/library?error=${encodeURIComponent(message)}`);
  }
});

// Lightweight status endpoint for the Feed processing banner to poll. Returns
// the piece's digestion state from orchestrator_events without renderering HTML.
app.get("/feed/status", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.json({ ok: false, error: "no operator" }, 401);
  const pieceId = c.req.query("piece") ?? "";
  if (!pieceId) return c.json({ ok: false, error: "missing piece" }, 400);
  const view = await jobStatusForPiece(c.env, userId, pieceId);
  if (!view) {
    return c.json({ ok: true, state: "queued", step: "queued", claims: 0, attempts: 0 });
  }
  return c.json({
    ok: true,
    state: view.state,
    step: view.stale ? "retrying" : view.step,
    claims: view.claims,
    attempts: view.attempts,
    error: view.error,
  });
});

export interface CreatedPiece {
  pieceId: string;
  slug: string;
  title: string;
  body_md: string;
  sourceId: string;
  /** Set when the upload was classified as an essay. Advisory only — the
   *  piece is published either way; these are surfaced on the upload
   *  confirmation so the answer-first discipline stays visible. */
  lint?: LintNote[];
}

// Create + extract — the fast, deterministic half of ingest. Returns the new
// piece's id + slug + extracted text so the caller can hand it to digest()
// either inline or via waitUntil.
export async function createAndExtract(
  env: Env,
  userId: string,
  body: ReadableStream | Uint8Array,
  filename: string,
  mime: string,
  size: number,
  opts: {
    // Real-world publish date for the source material — a video's own
    // upload date, e.g. — instead of "now" (when a plain file drop has
    // no such date and "now" is the only honest answer).
    publishedAt?: string | undefined;
    ingestedFrom?: string | undefined;
    extraMetadata?: Record<string, unknown> | undefined;
  } = {},
): Promise<CreatedPiece & { duplicate?: boolean }> {
  // Materialize to bytes so we can hash + put in R2 deterministically.
  // (Streams can only be consumed once; we need the bytes twice — once
  // for SHA-256 and once for R2.) Uploads are bounded by the Worker's
  // request-body limit so this is safe.
  const bytes: Uint8Array =
    body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
  const sha256 = await contentSha256(bytes);

  // Vault dedup: an uploaded_files row with this sha256 already exists →
  // skip the R2 store + pieces creation and return the existing piece.
  // Caller surfaces a "already in Vault" banner.
  const existing = await one<{ piece_id: string; piece_slug: string; piece_title: string }>(
    env.DB,
    `SELECT p.id AS piece_id, p.slug AS piece_slug, p.title AS piece_title
       FROM uploaded_files u
       JOIN sources s ON s.id = u.created_source_id
       JOIN pieces p ON json_extract(p.metadata, '$.source_id') = s.id
      WHERE u.user_id = ? AND u.sha256 = ? LIMIT 1`,
    [userId, sha256],
  );
  if (existing) {
    return {
      pieceId: existing.piece_id,
      slug: existing.piece_slug,
      title: existing.piece_title,
      body_md: "",
      sourceId: "",
      duplicate: true,
    };
  }

  const r2_key = `uploads/${userId}/${crypto.randomUUID()}-${safeName(filename)}`;
  await env.FILES.put(r2_key, bytes, {
    httpMetadata: { contentType: mime || "application/octet-stream" },
  });
  const fileId = await insertOne(env.DB, "uploaded_files", {
    user_id: userId,
    r2_key,
    original_filename: filename,
    mime: mime || "application/octet-stream",
    size_bytes: size,
    sha256,
    classification: classify(mime, filename),
  });

  const extracted = await extractUpload(env, fileId);
  const full = await readFullExtractedText(env, extracted.source_id, userId);
  const body_md = full.text;
  const title = full.title || filename;

  const slug = await ensureUniqueSlug(env.DB, userId, slugify(title || `piece-${Date.now()}`));
  const nowIso = new Date().toISOString();
  // Essays and research documents arrive through the same door. What tells
  // them apart is the essay convention itself — a majority of `##` headings
  // phrased as questions — because that contract is exactly what the essay
  // template and its Q&A structured data need. See lib/essay.ts.
  const essay = looksLikeEssay(body_md);
  const parsedEssay = essay ? parseEssay(body_md) : null;
  const pieceId = await insertOne(env.DB, "pieces", {
    user_id: userId,
    slug,
    title,
    kind: essay ? "essay" : "research-report",
    // The dek — the line under the title, before the summary — becomes the
    // subtitle, which is what the index rows, the meta description and the
    // OpenGraph tags all read from.
    ...(parsedEssay?.dek ? { subtitle: parsedEssay.dek } : {}),
    // "working-material" (the table's own default) was built for chained
    // multi-pass research where only the final synthesis gets a public URL
    // (see supabase/migrations/0015_pieces.sql) — a plain upload is never
    // part of a chain, and no route anywhere ever promotes a piece out of
    // working-material, so defaulting to it here meant every uploaded
    // document was permanently unclickable. "Upload is authorization. No
    // confirmation gauntlets" (CLAUDE.md) — the upload itself is the
    // publish decision.
    publication_status: "published",
    // opts.publishedAt lets a caller supply the material's OWN real date
    // (a video's actual upload date, e.g.) instead of "now" — "now" is
    // only honest when there genuinely is no other date, as with a plain
    // file drop.
    published_at: opts.publishedAt ?? nowIso,
    body_md,
    // No byline default — "the operator" is internal vocabulary and this
    // string renders directly on public piece pages ("By the operator").
    // An uploaded source document has no author to credit; leave it unset
    // rather than write a placeholder into a field readers see.
    tags: JSON.stringify([]),
    metadata: JSON.stringify({
      ingested_from: opts.ingestedFrom ?? "feed-upload",
      source_id: extracted.source_id,
      original_filename: filename,
      extracted_chars: extracted.extracted_chars,
      classification: extracted.classification,
      content_sha256: sha256,
      // Stored, not just flashed on the redirect: an upload confirmation is
      // seen once and then gone, and these notes are worth having next to
      // the piece whenever the operator next looks at it.
      ...(parsedEssay ? { essay_lint: lintEssay(parsedEssay) } : {}),
      ...opts.extraMetadata,
    }),
  });
  return {
    pieceId,
    slug,
    title,
    body_md,
    sourceId: extracted.source_id,
    ...(parsedEssay ? { lint: lintEssay(parsedEssay) } : {}),
  };
}

async function contentSha256(bytes: Uint8Array): Promise<string> {
  const out = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(out))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mimeForName(filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  return "text/plain";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function classify(mime: string | null, filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (mime?.includes("pdf") || ext === "pdf") return "pdf";
  if (mime?.includes("wordprocessingml") || ext === "docx") return "docx";
  if (mime?.startsWith("image/")) return "image";
  if (mime?.includes("html") || ext === "html" || ext === "htm") return "html";
  if (ext === "md" || ext === "markdown" || mime?.includes("markdown")) return "markdown";
  return "text";
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "") // strip a trailing extension
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "piece"
  );
}

async function ensureUniqueSlug(db: D1Database, userId: string, base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  while (suffix < 32) {
    const existing = await one<{ id: string }>(
      db,
      "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
      [userId, candidate],
    );
    if (!existing) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  // Fallback if 32 collisions: append a hex tag from a UUID.
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

// Chat — removed from the rail (operator directive: streamline to the
// functions actually in use). The screen + SSE backend stay in the tree;
// the surface redirects to Library until/unless Chat earns its place back.
app.get("/chat", (c) => c.redirect("/op/library", 301));
app.get("/chat/:id", (c) => c.redirect("/op/library", 301));

// Chat client module — handles SSE consumption with the new design's
// chat-msg / chat-q / chat-r-text classes.
app.get("/chat.js", () => {
  return new Response(CHAT_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

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
  const { researchOnDemand } = await import("../graph/lib/deep-research");
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
  const { advanceResearchRun, reapStaleResearchRuns } = await import("../graph/lib/deep-research");
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
  if (back.startsWith("/") && !back.startsWith("//")) return c.redirect(back);
  return c.redirect(
    `/library?research=${encodeURIComponent(report?.advanced ? "advanced" : "nothing-pending")}`,
  );
});

// SIGN IN, FROM INSIDE THE PREFIX ACCESS ACTUALLY PROTECTS.
//
// The same handler as /auth/login, mounted here on purpose. Minting a session
// requires Cloudflare Access to have verified the visitor and injected their
// email, and Access is scoped to a path — this site's application covers
// /op/* and the admin API, and CANNOT cover /* because the publication is
// meant to be publicly readable. So /auth/login sat outside the gate it
// depends on, no header ever arrived, and signing in was impossible. The
// operator reported being unable to reach the upload form four times.
//
// This mount needs no Cloudflare change. It still fails closed: no verified
// email, no cookie — so it adds a route that works, never a way in.
app.get("/login", async (c) => {
  const { handleLogin } = await import("../auth/routes");
  return handleLogin(c as never);
});

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

  const { run } = await import("../lib/d1");
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
  if (!userId) return c.redirect("/library");
  const form = await c.req.parseBody();
  const seed = typeof form.seed === "string" ? form.seed.trim() : "";
  const angle = typeof form.angle === "string" ? form.angle.trim() || undefined : undefined;
  if (!seed) return c.redirect("/library?error=that+lead+carried+nothing+to+search+for");

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
  if (kind === "contradiction") {
    const { answerLead } = await import("../graph/lib/answer-lead");
    const lead = {
      kind: "contradiction" as const,
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
    const work = answerLead(c.env, userId, lead, { writer }).catch(() => {});
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      // No execution context (tests) — already running, just not kept alive.
    }
    // Back to the document, where the lead and its answer live. There is no
    // separate screen for this and there should not be: the answer belongs
    // under the question it settles.
    const back = str("piece_slug");
    return c.redirect(back ? `/library/${encodeURIComponent(back)}#leads` : "/library#leads");
  }

  const { researchOnDemand } = await import("../graph/lib/deep-research");
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

// The on-demand research screen — its own dedicated page (operator/
// screens/research.ts), not a query param bolted onto /search. See that
// file's header comment for why.
app.get("/research", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.redirect("/");
  const angle = c.req.query("angle")?.trim() || undefined;
  const { renderResearchScreen } = await import("./screens/research");
  // Hand the screen the state at load so it renders COMPLETE — every source
  // found so far, the whole plan, the next action. The live layer then only
  // keeps it current. Without this the first paint is an empty frame that
  // fills in a second later, which is exactly the "is this working?" feeling
  // the workspace exists to remove, and it leaves the page useless with
  // JavaScript off.
  const { getResearchStatus } = await import("../graph/lib/deep-research");
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
  const { getResearchStatus } = await import("../graph/lib/deep-research");
  const status = await getResearchStatus(c.env, userId, q, { includeSynthesis }).catch(() => null);
  if (!status) {
    return c.json({ terminal: false, warn: false, headline: "Starting…", steps: [] });
  }
  return c.json(status);
});

// Video-as-source-material ingestion (Phase 1, 2026-07-24) — the operator
// pastes a video URL, it's fetched+transcribed by the video Worker's
// Container, and the transcript becomes a piece attributed to the
// channel with the video's own publish date. See graph/lib/video-intake.ts.
app.post("/library/import-video", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const form = await c.req.parseBody();
  const url = typeof form.url === "string" ? form.url.trim() : "";
  if (!url) return c.redirect("/library");
  const { requestVideoImport } = await import("../graph/lib/video-intake");
  const result = await requestVideoImport(c.env, userId, url);
  if (!result.ok || !result.importId) {
    return c.redirect(`/library?video_error=${encodeURIComponent(result.error ?? "failed")}`);
  }
  return c.redirect(`/library?importing=${encodeURIComponent(result.importId)}`);
});

// JSON status for the same live-polling banner pattern as /research-status.
app.get("/library/import-video/:id/status", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.json({ terminal: true, warn: true, headline: "not signed in" }, 401);
  const { pollVideoImport } = await import("../graph/lib/video-intake");
  const row = await pollVideoImport(c.env, userId, c.req.param("id")).catch(() => null);
  if (!row) return c.json({ terminal: true, warn: true, headline: "import not found" }, 404);
  if (row.status === "succeeded") {
    const piece = row.piece_id
      ? await one<{ slug: string }>(c.env.DB, "SELECT slug FROM pieces WHERE id = ?", [
          row.piece_id,
        ])
      : null;
    return c.json({
      terminal: true,
      warn: false,
      headline: "Transcribed and queued for extraction",
      pieceId: row.piece_id,
      ...(piece ? { reviewUrl: `/library/${piece.slug}` } : {}),
    });
  }
  if (row.status === "failed") {
    return c.json({ terminal: true, warn: true, headline: row.error ?? "transcription failed" });
  }
  return c.json({ terminal: false, warn: false, headline: "Fetching and transcribing…" });
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
  const { escapeHtml } = await import("../public/layout");
  const { renderMarkdown } = await import("../cms/lib/render-post");
  const { renderOpPage } = await import("./layout");
  const sourceCount = meta.source_piece_ids?.length ?? 0;
  const body = `<div style="font-size:12px;color:var(--dmut,#888);margin-bottom:16px">
  Researched: ${escapeHtml(meta.label ?? row.title)}
  ${meta.angle ? ` <span style="opacity:.7">· angle: "${escapeHtml(meta.angle)}"</span>` : ""}
  <span style="opacity:.7"> · ${sourceCount} source${sourceCount === 1 ? "" : "s"} banked</span>
</div>
<div style="border:1px solid #2e2e38;border-radius:9px;padding:20px 24px;background:#15181f;color:#e8eaef;max-width:720px;line-height:1.6">${renderMarkdown(row.body_md ?? "")}</div>
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
  const { advanceProcessing, describeProcessing } = await import("../graph/lib/processing");
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
  const { enqueueEverything, ensureProcessingTable } = await import("../graph/lib/processing");
  await ensureProcessingTable(c.env);
  const n = await enqueueEverything(c.env, userId);
  return c.redirect(`/library?queued=${n}`);
});

// Re-process one document from the start (a new version, a new model, or a
// row that never finished). Retry resumes a failed row at the step it failed.
app.post("/library/:id/reprocess", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { enqueueProcessing, ensureProcessingTable } = await import("../graph/lib/processing");
  await ensureProcessingTable(c.env);
  await enqueueProcessing(c.env, userId, c.req.param("id"), { restart: true });
  return c.redirect("/library?queued=1");
});
app.post("/library/:id/retry", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { retryProcessing } = await import("../graph/lib/processing");
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

// Bulk-delete from Library. Two modes:
//   mode=selected — piece_ids[] form values; deletes only those pieces
//                   (and the claims that were asserted in them).
//   mode=all      — wipes the operator's full ingest corpus: pieces,
//                   claims, entities, sources, uploaded_files,
//                   patterns, and orchestrator_events. Keeps users,
//                   chat history, studio skeleton+projects, briefs.
app.post("/library/delete", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/library");
  const form = await c.req.formData();
  const mode = String(form.get("mode") ?? "selected");

  if (mode === "all") {
    // Order matters less because every table cascades on user_id, but
    // we do the ingest-derived tables explicitly so a future schema add
    // (with no cascade) doesn't silently leave orphans.
    const tables = [
      "claim_entities",
      "claim_sources",
      "claim_versions",
      "claims",
      "entity_mentions",
      "entity_relations",
      "entity_resolution_log",
      "entity_resolution_queue",
      "entities",
      "chain_passes",
      "topic_pieces",
      "topic_entities",
      "patterns",
      "sources",
      "uploaded_files",
      "pieces",
      "orchestrator_events",
    ];
    for (const t of tables) {
      try {
        await run(c.env.DB, `DELETE FROM ${t} WHERE user_id = ?`, [userId]);
      } catch {
        // Best-effort: a missing optional table shouldn't abort the wipe.
      }
    }
    return c.redirect("/op/library");
  }

  // Selected mode — collect piece_ids[].
  const ids = form
    .getAll("piece_ids")
    .map((v) => String(v))
    .filter((v) => v.length > 0);
  if (ids.length === 0) return c.redirect("/op/library");
  const placeholders = ids.map(() => "?").join(",");
  // Drop the claims first (asserted_in_piece_id is SET-NULL, so otherwise
  // they'd survive as orphans), then the pieces (cascades chain_passes,
  // topic_pieces).
  await run(
    c.env.DB,
    `DELETE FROM claims WHERE user_id = ? AND asserted_in_piece_id IN (${placeholders})`,
    [userId, ...ids],
  );
  await run(c.env.DB, `DELETE FROM pieces WHERE user_id = ? AND id IN (${placeholders})`, [
    userId,
    ...ids,
  ]);
  return c.redirect("/op/library");
});

// ---- 301 redirects from old screen paths -------------------------------
// Bookmarks and chat-history references keep working. Each pre-P0 screen
// maps to the new surface that absorbed its functionality.

const redirects: Record<string, string> = {
  "/console": "/library",
  "/ingest": "/library",
  "/workbench": "/library",
  "/leads": "/library",
  "/patterns": "/research",
  "/editorial": "/library",
  "/build": "/library",
  "/publish": "/library",
  "/briefs": "/research",
  // Unmounted 2026-09-24 (docs/the-record.md §9).
  "/out": "/",
  "/synthesis": "/library",
  "/studio": "/",
  "/outputs": "/research",
  "/records": "/research",
  "/proposals": "/research",
  "/faces": "/",
  "/answers": "/library",
};

for (const [from, to] of Object.entries(redirects)) {
  app.get(from, (c) => c.redirect(to, 301));
  app.get(`${from}/:rest{.*}`, (c) => c.redirect(to, 301));
}

export default app;
