// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree at the edge — every request
// that reaches us is the authenticated operator. No auth middleware here.
//
// Six surfaces per canonical-spec v2.4 Part 9:
//   /op           Feed       — drop documents into Storage (no auto-extraction)
//   /op/chat      Chat       — single never-resetting NL stream over the graph
//   /op/synthesis Synthesis  — read-only oversight of surfacer findings + threads
//   /op/library   Library    — Storage's front end; extraction is triggered here
//   /op/outputs   Outputs    — proposer-driven; operator approves, never authors
//   /op/studio    Studio     — distributed content from outputs (Stage 1 = scripts)
//
// 301 redirects keep old screen paths working: /op/briefs and the older
// pre-pivot paths (console, workbench, editorial, leads, patterns, publish,
// build, ingest) all redirect to their new surface at the bottom of this file.

import { unzipSync } from "fflate";
import { Hono } from "hono";
import type { Env } from "../env";
import { buildBrief } from "../graph/lib/briefs/pipeline";
import { proposeBriefs } from "../graph/lib/briefs/proposer";
import {
  drainDigestJobs,
  enqueueDigest,
  ensureJobsTable,
  jobStatusForPiece,
  runDigestJob,
} from "../graph/lib/digest-jobs";
import { extractUpload, readFullExtractedText } from "../graph/lib/extract";
import { composeScript } from "../graph/lib/studio/compose";
import { runSurfacingL1, runSurfacingL2 } from "../graph/lib/surfacing";
import { runSynthesisSurfacer } from "../graph/lib/synthesis-surfacer";
import { all, insertOne, one, run } from "../lib/d1";
import { type LintNote, lintEssay, looksLikeEssay, parseEssay } from "../lib/essay";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { CMDK_CLIENT_JS } from "./client/cmdk-js";
import { opHtml } from "./layout";
import { renderDesignMock } from "./screens/design-mock";
import { renderOutputsScreen } from "./screens/outputs";
import { renderProjectWorkspace, renderStudioScreen } from "./screens/studio";

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
  ["/outputs", "/investigations"],
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
const ZIP_ENTRY_RE = /\.(md|markdown|txt|pdf)$/i;
const ZIP_MAX_ENTRIES = 100;

app.post("/feed/upload", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) {
      return c.redirect(`/op/library?error=${encodeURIComponent("No operator user")}`);
    }
    await ensureJobsTable(c.env);
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
          `/op/library?error=${encodeURIComponent("No .md/.txt/.pdf files in the zip")}`,
        );
      }
      // For zips: create + bank every entry synchronously (fast), then
      // enqueue each new piece into the typed-graph digest queue — the
      // drop itself starts reading the document into the record, rather
      // than requiring a second manual "Extract" click in Library
      // (previously the only trigger). Kick a few jobs inline via
      // waitUntil so the first pieces of a batch don't wait for the next
      // cron tick; the rest drain on the every-minute cron as before.
      const ZIP_INLINE_KICKS = 3;
      const pieceIds: string[] = [];
      let zipDupes = 0;
      let zipKicked = 0;
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
            const jobId = await enqueueDigest(c.env, {
              userId,
              pieceId: p.pieceId,
              slug: p.slug,
              title: p.title,
              sourceId: p.sourceId,
            });
            if (zipKicked < ZIP_INLINE_KICKS) {
              zipKicked++;
              c.executionCtx.waitUntil(runDigestJob(c.env, jobId));
            }
          }
        } catch {
          // skip a bad entry; keep ingesting the rest
        }
      }
      return c.redirect(`/op/library?ingested=${pieceIds.length}&dupes=${zipDupes}`);
    }

    // Single-file: store in Vault, then enqueue the typed-graph digest
    // immediately (kicked inline via waitUntil) — the drop is the trigger,
    // not a separate Extract click. A duplicate upload is already banked
    // and was either extracted before or is queued from that earlier drop;
    // don't double-enqueue it.
    const p = await createAndExtract(c.env, userId, f.stream(), f.name, f.type, f.size);
    if (p.duplicate) {
      return c.redirect(`/op/library?piece=${encodeURIComponent(p.pieceId)}&dedup=1`);
    }
    if (p.sourceId) {
      const jobId = await enqueueDigest(c.env, {
        userId,
        pieceId: p.pieceId,
        slug: p.slug,
        title: p.title,
        sourceId: p.sourceId,
      });
      c.executionCtx.waitUntil(runDigestJob(c.env, jobId));
    }
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

// Clear the orchestrator_events activity log (and any finished digest_jobs)
// without touching the corpus. Lightweight self-serve for stale state.
app.post("/feed/clear", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/library");
  await run(c.env.DB, "DELETE FROM orchestrator_events WHERE user_id = ?", [userId]);
  await run(
    c.env.DB,
    "DELETE FROM digest_jobs WHERE user_id = ? AND status IN ('completed','failed')",
    [userId],
  );
  return c.redirect("/op/library?cleared=1");
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
  if (ext === "md" || ext === "markdown") return "text/markdown";
  return "text/plain";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function classify(mime: string | null, filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (mime?.includes("pdf") || ext === "pdf") return "pdf";
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

// Command palette client — attached to every operator surface via
// layout.ts. ⌘K toggles; arrow keys + Enter run.
app.get("/cmdk.js", () => {
  return new Response(CMDK_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Re-read the corpus: re-surface findings and re-name themes. The cheap
// DETERMINISTIC steps (autoseed pages, L1) run inline so the page is
// correct on redirect; the expensive LLM step (theme-naming) runs in
// waitUntil so the request can't blow the Worker wall-clock.
//
// No longer auto-drafts signed readings — that was the same "system
// decides which subject gets a reading" behavior the corpus-settle
// draft_readings step ran; both are retired in favor of the operator
// picking the subject (and optionally the angle) directly via "Draft a
// reading" on a subject's page (draftReadingForSubject).
app.post("/out/refresh", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/out?err=no_operator");
  const { autoseedPages } = await import("../graph/lib/autoseed-pages");
  const { runSurfacingL1 } = await import("../graph/lib/surfacing");
  // Inline: fast, deterministic, no LLM.
  await autoseedPages(c.env, userId).catch(() => {});
  await runSurfacingL1(c.env, userId).catch(() => {});
  // Background: the LLM-heavy pass. waitUntil keeps it alive past the
  // response without risking a wall-clock kill of the redirect.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const { runThemeSurfacer } = await import("../graph/lib/theme-surfacer");
        await runThemeSurfacer(c.env, userId).catch(() => {});
      } catch {
        // best-effort; another Re-read retries
      }
    })(),
  );
  return c.redirect("/op/out?refreshing=1");
});

// Sign & publish a drafted reading — the operator's one act of judgment.
app.post("/out/:id/sign", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/out?err=no_operator");
  const now = new Date().toISOString();
  const pageId = c.req.param("id");
  const page = await one<{ slug: string }>(
    c.env.DB,
    "SELECT slug FROM pages WHERE id = ? AND user_id = ? AND signed_status = 'draft'",
    [pageId, userId],
  );
  // signed_by is left as-is (NULL when never set) rather than defaulted
  // to a placeholder — the public byline renders "— signed" for a null
  // signed_by (subject-page.ts), never internal vocabulary.
  await run(
    c.env.DB,
    `UPDATE pages SET signed_status = 'published', signed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND signed_status = 'draft'`,
    [now, now, pageId, userId],
  );
  // Faces-on-signing (spec v2.6 Part 8): the moment a reading is signed,
  // queue the LLM-seasoned faces (script, chapter) in the background.
  // Thread + card render live at view time (template + query). Studio
  // (Part 27) is a per-face Produce step, not a destination.
  if (page) {
    const { generateAllFaces } = await import("../graph/lib/face-renderer");
    c.executionCtx.waitUntil(generateAllFaces(c.env, userId, pageId));
  }
  return c.redirect(page ? `/op/out?signed=${encodeURIComponent(page.slug)}` : "/op/out");
});

// Edit a drafted reading before signing.
app.get("/out/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/out");
  const row = await one<{ id: string; thesis: string | null; body_md: string | null }>(
    c.env.DB,
    "SELECT id, thesis, body_md FROM pages WHERE id = ? AND user_id = ? AND signed_status = 'draft'",
    [c.req.param("id"), userId],
  );
  if (!row) return c.redirect("/op/out");
  const { escapeHtml } = await import("../public/layout");
  const { renderOpPage } = await import("./layout");
  const body = `<form method="POST" action="/op/out/${escapeHtml(row.id)}/edit">
  <label style="font-size:12px;color:var(--dmut,#888);display:block;margin-bottom:6px">Thesis</label>
  <input name="thesis" value="${escapeHtml(row.thesis ?? "")}" style="width:100%;background:#15181f;color:#e8eaef;border:1px solid #2e2e38;border-radius:7px;padding:10px 13px;font-size:14px;margin-bottom:16px" />
  <label style="font-size:12px;color:var(--dmut,#888);display:block;margin-bottom:6px">Analysis (markdown)</label>
  <textarea name="body_md" rows="26" style="width:100%;background:#15181f;color:#e8eaef;border:1px solid #2e2e38;border-radius:7px;padding:13px;font-family:ui-monospace,monospace;font-size:13px">${escapeHtml(row.body_md ?? "")}</textarea>
  <div style="margin-top:12px;display:flex;gap:10px">
    <button type="submit" class="btn primary" style="background:#d9a441;color:#1c1608;font-weight:600;padding:9px 20px;border-radius:7px;border:none;cursor:pointer">Save draft</button>
    <a href="/op/out" class="btn" style="padding:9px 20px;border:1px solid #2e2e38;border-radius:7px;color:#c8c5bd;text-decoration:none">Cancel</a>
  </div>
</form>`;
  return opHtml(
    renderOpPage({
      title: "Edit analysis",
      sub: "refine before you sign · hand-edited text is no longer machine-verified",
      body,
      activeNav: "/op/out",
    }),
  );
});

// Free-text edit of a drafted reading. INTEGRITY: this form has no
// structured claim/quote list to re-run the verbatim-substring check or
// the independent judge against — it's a raw markdown textarea, and the
// gauntlet only runs on the auto-drafter's structured claims. So we do
// NOT claim to re-verify. Instead we tell the truth: editing clears the
// machine-verified badge (claims_verified/judge_model reset), so a
// hand-edited reading can never carry a stale "N claims verified" count
// it no longer earned. See docs/canopticon-renovation.md — "the operator
// approves, never authors" has one unguarded seam, and this is it; the
// honest fix is to stop the false claim, not to fake a re-check.
app.post("/out/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/out");
  const form = await c.req.formData();
  const { renderMarkdown } = await import("../cms/lib/render-post");
  const bodyMd = String(form.get("body_md") ?? "");
  await run(
    c.env.DB,
    `UPDATE pages SET thesis = ?, body_md = ?, body_html = ?,
        claims_verified = 0, judge_model = NULL, updated_at = ?
      WHERE id = ? AND user_id = ? AND signed_status = 'draft'`,
    [
      String(form.get("thesis") ?? "").slice(0, 400),
      bodyMd,
      renderMarkdown(bodyMd),
      new Date().toISOString(),
      c.req.param("id"),
      userId,
    ],
  );
  return c.redirect("/op/out");
});

// Discard a drafted reading — back to neutral-only.
app.post("/out/:id/discard", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/out");
  await run(
    c.env.DB,
    "UPDATE pages SET signed_status = 'none', thesis = NULL, body_md = NULL, body_html = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
    [new Date().toISOString(), c.req.param("id"), userId],
  );
  return c.redirect("/op/out");
});

// Record-building on click (spec v2.5 Part 23). The "Expand this Record"
// affordance on a thin subject page POSTs here. Fires the expansion in the
// background and redirects back so the operator's page render is instant.
// Without BRAVE_SEARCH_API_KEY this still wires cleanly — it logs that the
// key is missing and no-ops, so the affordance is functional UI on day one.
app.post("/records/:slug/expand", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const slug = c.req.param("slug");
  const subject = await one<{ label: string }>(
    c.env.DB,
    `SELECT n.label FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!subject) return c.redirect("/");
  const { expandRecord } = await import("../graph/lib/record-builder");
  c.executionCtx.waitUntil(expandRecord(c.env, userId, subject.label));
  return c.redirect(`/s/${slug}?expanding=1`);
});

// "Produce video essay" — turns a SIGNED reading's thesis + verified
// facts into a video essay via the video Worker (packages/video), which
// runs its own review/approve/render pipeline from there. Server-to-
// server call (not a redirect through the browser to video.canopticon.com
// first) so the reading's content never has to round-trip through the
// operator's own request — the produce click does the work, then hands
// the operator off to the video Worker's review page to approve the
// script and watch the render, exactly the same review touchpoint the
// GDELT pipeline already uses there.
//
// Without VIDEO_BASE/VIDEO_INTERNAL_TOKEN configured, this is wired but
// inert — same "affordance visible, secret missing" pattern as
// BRAVE_SEARCH_API_KEY above — and redirects back with a plain notice
// instead of a raw error.
app.post("/records/:slug/produce-video", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const slug = c.req.param("slug");
  const format = c.req.query("format") === "long" ? "long" : "short";

  if (!c.env.VIDEO_BASE || !c.env.VIDEO_INTERNAL_TOKEN) {
    return c.redirect(
      `/s/${slug}?mode=signed&video_msg=${encodeURIComponent("video Worker not configured yet")}`,
    );
  }

  const page = await one<{ thesis: string | null; node_id: string; label: string }>(
    c.env.DB,
    `SELECT p.thesis, p.subject_node_id AS node_id, n.label
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ? AND p.signed_status IN ('signed', 'published')`,
    [userId, slug],
  );
  if (!page || !page.thesis) {
    return c.redirect(
      `/s/${slug}?video_msg=${encodeURIComponent("no signed analysis to produce from yet")}`,
    );
  }

  const { loadEstablishedFacts } = await import("../public/render/subject-page");
  const facts = await loadEstablishedFacts(c.env, userId, page.node_id);
  if (facts.length === 0) {
    return c.redirect(
      `/s/${slug}?mode=signed&video_msg=${encodeURIComponent("no established facts to draw on yet")}`,
    );
  }

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const res = await fetch(`${c.env.VIDEO_BASE}/segments/from-reading`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-token": c.env.VIDEO_INTERNAL_TOKEN as string,
          },
          body: JSON.stringify({
            subjectSlug: slug,
            subjectLabel: page.label,
            thesis: page.thesis,
            format,
            facts: facts.map((f) => ({
              text: f.label,
              quote: f.quote_text,
              source: f.piece_slug
                ? `${f.piece_title ?? "source"} (/library/${f.piece_slug})`
                : null,
            })),
          }),
        });
        await insertOne(c.env.DB, "orchestrator_events", {
          user_id: userId,
          event_type: res.ok ? "video.produce.requested" : "video.produce.failed",
          subject_kind: "page",
          subject_id: slug,
          payload: { format, status: res.status },
        }).catch(() => {});
      } catch (err) {
        await insertOne(c.env.DB, "orchestrator_events", {
          user_id: userId,
          event_type: "video.produce.failed",
          subject_kind: "page",
          subject_id: slug,
          payload: { format, error: (err as Error).message },
        }).catch(() => {});
      }
    })(),
  );

  return c.redirect(
    `/s/${slug}?mode=signed&video_msg=${encodeURIComponent(`producing a ${format}-form video essay — check the video Worker's queue shortly`)}`,
  );
});

// "Draft a reading" — operator-directed drafting. The corpus-settle
// pipeline used to auto-draft one reading per cycle by an internal score
// (the draft_readings step, since retired — see settle-pipeline.ts); this
// is the only path to a signed reading now. Any subject the operator
// picks, optionally steered by a free-text angle, goes through
// draftReadingForSubject: same grounding, same firewall, same independent
// judge draftReadings() always used — the operator only chooses the
// subject and (optionally) what it should argue, never the prose itself.
// Runs in waitUntil — a writer call plus N parallel judge calls easily
// exceeds a synchronous request's wall clock.
// Fabric redesign Phase 5: renamed from /draft-reading. Old path kept as a
// redirect for one release in case a stale open tab still posts to it —
// remove once confirmed nothing hits it.
app.post("/records/:slug/draft-reading", (c) =>
  c.redirect(`/op/records/${c.req.param("slug")}/draft-analysis`, 308),
);

app.post("/records/:slug/draft-analysis", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const slug = c.req.param("slug");
  const form = await c.req.parseBody();
  const angle = typeof form.angle === "string" ? form.angle : undefined;

  const page = await one<{ id: string; node_id: string; label: string; signed_status: string }>(
    c.env.DB,
    `SELECT p.id, p.subject_node_id AS node_id, n.label, p.signed_status
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!page) return c.redirect("/");
  // Never silently overwrite an operator-approved reading — same rule
  // draftReadings itself follows. A draft (unsigned) is fair game to
  // redraft; signed/published is not.
  if (page.signed_status === "signed" || page.signed_status === "published") {
    return c.redirect(
      `/s/${slug}?draft_msg=${encodeURIComponent("already has a signed analysis — this only drafts new ones, it won't overwrite a signed one")}`,
    );
  }

  c.executionCtx.waitUntil(
    (async () => {
      const { draftReadingForSubject } = await import("../graph/lib/draft-reading");
      await draftReadingForSubject(c.env, userId, page.id, page.node_id, page.label, angle).catch(
        () => {},
      );
    })(),
  );

  return c.redirect(
    `/s/${slug}?draft_msg=${encodeURIComponent("drafting an analysis now — this takes a minute or two; refresh to check")}`,
  );
});

// Fabric redesign Phase 7 — the Proposal layer. "Draft a proposal" is
// operator-directed, same shape as "Draft an analysis": pick a subject,
// optionally give it an angle, the system drafts a PRESCRIPTIVE piece
// (should/ought, not is/was/means) grounded on the subject's signed
// Analysis when one exists, or directly on established/corroborated
// facts otherwise. Many proposals can exist per subject — this never
// overwrites or redrafts an existing one, it always creates a new draft.
app.post("/records/:slug/draft-proposal", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const slug = c.req.param("slug");
  const form = await c.req.parseBody();
  const angle = typeof form.angle === "string" ? form.angle : undefined;

  const page = await one<{ node_id: string; label: string }>(
    c.env.DB,
    `SELECT p.subject_node_id AS node_id, n.label
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!page) return c.redirect("/");

  c.executionCtx.waitUntil(
    (async () => {
      const { draftProposalForSubject } = await import("../graph/lib/draft-proposal");
      await draftProposalForSubject(c.env, userId, page.node_id, page.label, angle).catch(() => {});
    })(),
  );

  return c.redirect(
    `/s/${slug}?proposal_msg=${encodeURIComponent("drafting a proposal now — this takes a minute or two; refresh to check")}`,
  );
});

app.post("/proposals/:id/sign", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const now = new Date().toISOString();
  const proposalId = c.req.param("id");
  const proposal = await one<{ subject_node_id: string }>(
    c.env.DB,
    "SELECT subject_node_id FROM page_proposals WHERE id = ? AND user_id = ? AND status = 'draft'",
    [proposalId, userId],
  );
  if (!proposal) return c.redirect("/");
  // signed_by left as-is (NULL when never set) — same discipline as pages'
  // own sign route; the public byline renders "— signed" for a null value.
  await run(
    c.env.DB,
    `UPDATE page_proposals SET status = 'published', signed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'draft'`,
    [now, now, proposalId, userId],
  );
  const subjectPage = await one<{ slug: string }>(
    c.env.DB,
    "SELECT slug FROM pages WHERE subject_node_id = ? AND user_id = ?",
    [proposal.subject_node_id, userId],
  );
  return c.redirect(subjectPage ? `/s/${subjectPage.slug}?proposal_msg=signed` : "/");
});

app.get("/proposals/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const row = await one<{ id: string; thesis: string | null; body_md: string | null }>(
    c.env.DB,
    "SELECT id, thesis, body_md FROM page_proposals WHERE id = ? AND user_id = ? AND status = 'draft'",
    [c.req.param("id"), userId],
  );
  if (!row) return c.redirect("/");
  const { escapeHtml } = await import("../public/layout");
  const { renderOpPage } = await import("./layout");
  const body = `<form method="POST" action="/op/proposals/${escapeHtml(row.id)}/edit">
  <label style="font-size:12px;color:var(--dmut,#888);display:block;margin-bottom:6px">Thesis</label>
  <input name="thesis" value="${escapeHtml(row.thesis ?? "")}" style="width:100%;background:#15181f;color:#e8eaef;border:1px solid #2e2e38;border-radius:7px;padding:10px 13px;font-size:14px;margin-bottom:16px" />
  <label style="font-size:12px;color:var(--dmut,#888);display:block;margin-bottom:6px">Proposal (markdown)</label>
  <textarea name="body_md" rows="26" style="width:100%;background:#15181f;color:#e8eaef;border:1px solid #2e2e38;border-radius:7px;padding:13px;font-family:ui-monospace,monospace;font-size:13px">${escapeHtml(row.body_md ?? "")}</textarea>
  <div style="margin-top:12px;display:flex;gap:10px">
    <button type="submit" class="btn primary" style="background:#d9a441;color:#1c1608;font-weight:600;padding:9px 20px;border-radius:7px;border:none;cursor:pointer">Save draft</button>
  </div>
</form>`;
  return opHtml(
    renderOpPage({
      title: "Edit proposal",
      sub: "refine before you sign · hand-edited text is no longer machine-verified",
      body,
      activeNav: "/op/out",
    }),
  );
});

app.post("/proposals/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const proposalId = c.req.param("id");
  const form = await c.req.parseBody();
  const thesis = typeof form.thesis === "string" ? form.thesis.slice(0, 400) : null;
  const bodyMd = typeof form.body_md === "string" ? form.body_md : null;
  const { renderMarkdown } = await import("../cms/lib/render-post");
  await run(
    c.env.DB,
    `UPDATE page_proposals SET thesis = ?, body_md = ?, body_html = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'draft'`,
    [
      thesis,
      bodyMd,
      bodyMd ? renderMarkdown(bodyMd) : null,
      new Date().toISOString(),
      proposalId,
      userId,
    ],
  );
  return c.redirect(`/op/proposals/${proposalId}/edit`);
});

app.post("/proposals/:id/discard", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const proposalId = c.req.param("id");
  const proposal = await one<{ subject_node_id: string }>(
    c.env.DB,
    "SELECT subject_node_id FROM page_proposals WHERE id = ? AND user_id = ? AND status = 'draft'",
    [proposalId, userId],
  );
  await run(
    c.env.DB,
    "DELETE FROM page_proposals WHERE id = ? AND user_id = ? AND status = 'draft'",
    [proposalId, userId],
  );
  if (!proposal) return c.redirect("/");
  const subjectPage = await one<{ slug: string }>(
    c.env.DB,
    "SELECT slug FROM pages WHERE subject_node_id = ? AND user_id = ?",
    [proposal.subject_node_id, userId],
  );
  return c.redirect(subjectPage ? `/s/${subjectPage.slug}` : "/");
});

// Bulk "expand the thinnest subjects now" — task #25. Deliberately small
// (3, not "all") and reuses the exact same sniper ranking the autonomous
// sweep uses (pickThinCandidates), just firing that many at once instead
// of the sweep's one-per-tick. Each expand runs as its own independent
// waitUntil (not chained sequentially) — the lesson from the settle-
// pipeline bug hunt was that CHAINING real work in one execution dies
// silently; three independent background tasks from one request don't
// have that problem, they just run concurrently.
const BULK_EXPAND_N = 3;

app.post("/records/bulk-expand", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const { pickThinCandidates } = await import("../graph/lib/autonomous-expand");
  const { expandRecord } = await import("../graph/lib/record-builder");
  const { run } = await import("../lib/d1");
  const candidates = await pickThinCandidates(c.env, userId, BULK_EXPAND_N);
  if (candidates.length === 0) return c.redirect("/?bulk=none");
  const now = new Date().toISOString();
  for (const candidate of candidates) {
    c.executionCtx.waitUntil(
      run(c.env.DB, "UPDATE pages SET auto_expand_at = ? WHERE id = ?", [
        now,
        candidate.page_id,
      ]).then(() => expandRecord(c.env, userId, candidate.label)),
    );
  }
  const subjects = candidates.map((cand) => cand.label).join("|");
  return c.redirect(`/bulk-expand?subjects=${encodeURIComponent(subjects)}`);
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
  return opHtml(renderResearchScreen({ label: q, angle }));
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

// Re-render a single face on a signed reading. Triggered from the face's
// "Retry" affordance on the signed subject page when a face is in failed
// state (a Workers AI hiccup, a transient timeout). Fires the render in the
// background and redirects back to the reading.
app.post("/faces/:pageId/:kind/render", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/");
  const pageId = c.req.param("pageId");
  const kind = c.req.param("kind");
  const VALID = new Set(["thread", "card", "carousel", "script", "chapter"]);
  if (!VALID.has(kind)) return c.redirect("/");
  const page = await one<{ slug: string }>(
    c.env.DB,
    "SELECT slug FROM pages WHERE id = ? AND user_id = ?",
    [pageId, userId],
  );
  if (!page) return c.redirect("/");
  const { generateSingleFace } = await import("../graph/lib/face-renderer");
  c.executionCtx.waitUntil(
    generateSingleFace(
      c.env,
      userId,
      pageId,
      kind as "thread" | "card" | "carousel" | "script" | "chapter",
    ),
  );
  return c.redirect(`/s/${page.slug}?mode=signed`);
});

// Manual re-surface trigger. Runs BOTH the legacy SQL surfacer and the
// typed-graph Surfacing Engine Level 1 (spec Part 17). Idempotent: both
// upsert candidate cards by slug.
app.post("/synthesis/surface", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/synthesis?err=no_operator");
    await runSurfacingL1(c.env, userId);
    await runSynthesisSurfacer(c.env, userId).catch(() => {
      // legacy surfacer reads the flat-claims tables, which may be empty
      // post-pivot; its failure must not block typed-graph findings
    });
    return c.redirect("/op/synthesis");
  } catch (err) {
    return c.redirect(`/op/synthesis?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Surfacing Engine Level 2 — the deliberate, high-effort analysis pass
// (spec Part 17 ambitious tier). Assembles a verified subgraph, asks the
// reasoning model for candidate patterns, mechanically verifies every cited
// node id, and discards anything unverifiable.
app.post("/synthesis/deep", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/synthesis?err=no_operator");
    const report = await runSurfacingL2(c.env, userId);
    return c.redirect(
      `/op/synthesis?deep=${report.l2_candidates}&discarded=${report.l2_discarded}`,
    );
  } catch (err) {
    return c.redirect(`/op/synthesis?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Inquiry-thread lifecycle (spec Part 6): open -> being_pursued -> resolved /
// dropped. Threads are first-class; they persist and resurface, feeding the
// proposer. Buttons live on the Synthesis surface.
app.post("/synthesis/thread/:id/:action", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/synthesis");
  const action = c.req.param("action");
  const status =
    action === "pursue"
      ? "being_pursued"
      : action === "resolve"
        ? "resolved"
        : action === "drop"
          ? "dropped"
          : action === "reopen"
            ? "open"
            : null;
  if (!status) return c.redirect("/op/synthesis");
  await run(
    c.env.DB,
    "UPDATE inquiry_threads SET status = ?, last_resurfaced_at = ? WHERE id = ? AND user_id = ?",
    [status, new Date().toISOString(), c.req.param("id"), userId],
  );
  return c.redirect("/op/synthesis");
});

// DESIGN PROTOTYPE — unlinked, throwaway. The artifact for the app reframe;
// see screens/design-mock.ts. Remove when the real redesign lands.
app.get("/design", (c) => c.html(renderDesignMock()));

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
  await enqueueDigest(c.env, {
    userId,
    pieceId: c.req.param("id"),
    slug: row.slug,
    title: row.title,
    sourceId: meta.source_id ?? "",
  });
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
// Drain the digest queue, by hand.
//
// drainDigestJobs() was previously only ever called from the every-2-minute
// cron in index.ts's scheduled(). With the cron disabled, this function had
// no caller at all and anything left queued — zip entries past the first
// three, chiefly — was stranded permanently and silently. This is the
// replacement: the operator presses a button, a bounded batch runs.
// Build the citable atoms for one document: findings and questions.
//
// Explicitly a button, not a hook on upload. It costs several model calls, and
// the operator should see what a document produced before any of it acquires a
// URL — human review at the document level is one of the properties that keeps
// generated pages on the right side of the scaled-content line.
app.post("/library/:id/extract-atoms", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const pieceId = c.req.param("id");
  const { extractAeoAtoms } = await import("../graph/lib/aeo-extract");
  // Optional model override, so the same document can be run under several
  // models and the results compared. Which model produced which row is stored
  // (migration 0051) — without that the comparison would not outlive the page.
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const picked = typeof body.model === "string" ? body.model : (c.req.query("model") ?? "");
  try {
    const stats = await extractAeoAtoms(c.env, userId, pieceId, { model: picked });
    return c.redirect(
      `/library?atoms=${stats.findings}.${stats.questions_new}.${stats.questions_merged}.${stats.killed}&model=${encodeURIComponent(stats.model)}`,
    );
  } catch (e) {
    return c.redirect(`/library?error=${encodeURIComponent(String(e).slice(0, 180))}`);
  }
});

// Propose the passage a retriever should lift. Selection, not composition —
// see graph/lib/lede.ts for why that distinction is the whole design.
app.post("/library/:id/lede", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { proposeLede } = await import("../graph/lib/lede");
  const res = await proposeLede(c.env, userId, c.req.param("id"));
  return c.redirect(
    res.ok
      ? "/library?lede=proposed"
      : `/library?error=${encodeURIComponent(res.reason ?? "could not select a passage")}`,
  );
});

// Nothing renders until a person has read it: a passage can be perfectly
// verbatim and still misrepresent what the document weighs.
app.post("/library/:id/lede/approve", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { approveLede } = await import("../graph/lib/lede");
  const ok = await approveLede(c.env, userId, c.req.param("id"));
  return c.redirect(ok ? "/library?lede=approved" : "/library?error=no+proposed+passage");
});

// Promote one proposed question to a public page. The gate runs here, inside
// publishQuestion, and refuses rather than publishing something thin.
app.post("/answers/:id/publish", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  const { publishQuestion } = await import("../graph/lib/aeo-extract");
  const res = await publishQuestion(c.env, userId, c.req.param("id"));
  return c.redirect(
    res.ok
      ? "/library?published=1"
      : `/library?error=${encodeURIComponent(res.reason ?? "refused")}`,
  );
});

app.post("/library/drain", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/library");
  await ensureJobsTable(c.env);
  // Bounded deliberately. Each job is several LLM calls against a shared D1
  // CPU budget, and the account has thrown "exceeded its CPU time limit" under
  // exactly this kind of concurrent load before. Press it again for more.
  const jobIds = await drainDigestJobs(c.env, 3).catch(() => []);
  for (const id of jobIds) c.executionCtx.waitUntil(runDigestJob(c.env, id));
  return c.redirect(`/library?draining=${jobIds.length}`);
});

app.post("/library/extract", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/library");
  await ensureJobsTable(c.env);
  const form = await c.req.formData();
  const mode = String(form.get("mode") ?? "selected");

  // Resolve the set of pieces to extract.
  let pieces: Array<{ id: string; slug: string; title: string; source_id: string | null }>;
  if (mode === "all-unextracted") {
    pieces = await all<{ id: string; slug: string; title: string; source_id: string | null }>(
      c.env.DB,
      `SELECT p.id, p.slug, p.title,
              json_extract(p.metadata, '$.source_id') AS source_id
         FROM pieces p
        WHERE p.user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM digest_jobs j
             WHERE j.user_id = p.user_id AND j.piece_id = p.id
               AND j.status = 'completed'
          )
        ORDER BY p.created_at`,
      [userId],
    );
  } else if (mode === "all") {
    pieces = await all<{ id: string; slug: string; title: string; source_id: string | null }>(
      c.env.DB,
      `SELECT id, slug, title, json_extract(metadata, '$.source_id') AS source_id
         FROM pieces WHERE user_id = ? ORDER BY created_at`,
      [userId],
    );
    // Clear prior jobs so enqueue starts each piece fresh at chunk 0 (the
    // prior run may have completed-but-hollow; we want a real do-over).
    await run(c.env.DB, "DELETE FROM digest_jobs WHERE user_id = ?", [userId]);
  } else {
    const ids = form
      .getAll("piece_ids")
      .map((v) => String(v))
      .filter((v) => v.length > 0);
    if (ids.length === 0) return c.redirect("/op/library");
    const placeholders = ids.map(() => "?").join(",");
    pieces = await all<{ id: string; slug: string; title: string; source_id: string | null }>(
      c.env.DB,
      `SELECT id, slug, title, json_extract(metadata, '$.source_id') AS source_id
         FROM pieces WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...ids],
    );
  }

  // Enqueue everything; kick only the first few inline. Kicking 50 jobs in
  // one request is a self-DoS (each runs LLM calls via waitUntil); the
  // every-minute cron drain works through the rest at a steady 8/tick.
  const INLINE_KICKS = 3;
  let kicked = 0;
  for (const p of pieces) {
    if (!p.source_id) continue; // can't extract without a source row
    const jobId = await enqueueDigest(c.env, {
      userId,
      pieceId: p.id,
      slug: p.slug,
      title: p.title,
      sourceId: p.source_id,
    });
    if (kicked < INLINE_KICKS) {
      c.executionCtx.waitUntil(runDigestJob(c.env, jobId));
    }
    kicked++;
  }
  return c.redirect(`/op/library?extracting=${kicked}`);
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

// Outputs — the operator's product surface (canonical spec v2.4, Part 9 / Part 11 #1).
// Proposer's suggestion cards are the PRIMARY content. No hand-authoring composer.
// Until the typed-graph extraction + LLM-driven proposer land (later PRs), this
// surface honestly states what it's showing (the old SQL heuristic).
//
// URL was previously /op/briefs — renamed per spec v2.4 Part 1 (the word "Briefs"
// is deprecated). Old /op/briefs* paths 301-redirect at the bottom of this file.
app.get("/outputs", async (c) => {
  const composed = c.req.query("composed");
  return opHtml(await renderOutputsScreen(c.env, { composed }));
});

// Re-run the proposer over the corpus. LLM-driven per spec Part 7: reads the
// typed graph + open inquiry threads, proposes across both output layers.
// Idempotent: upserts proposals by slug.
app.post("/outputs/propose", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/outputs?err=no_operator");
    await proposeBriefs(c.env, userId);
    return c.redirect("/op/outputs");
  } catch (err) {
    return c.redirect(`/op/outputs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Build — runs the 4-step generation pipeline (Part 8 trust model). Operator
// sees the verified draft on the redirect.
app.post("/outputs/:id/build", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/outputs?err=no_operator");
    await buildBrief(c.env, c.req.param("id"), userId);
    return c.redirect("/op/outputs");
  } catch (err) {
    return c.redirect(`/op/outputs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Publish — promotes a draft to the public page (URL kept on the public side
// for stability; renamed only on the operator side in this PR).
app.post("/outputs/:id/publish", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/outputs?err=no_operator");
    const now = new Date().toISOString();
    // signed_by is left NULL when never set — no internal-vocabulary
    // placeholder written into a field that renders on a public page.
    await run(
      c.env.DB,
      `UPDATE briefs SET status = 'published', published_at = COALESCE(published_at, ?),
                          signed_at = COALESCE(signed_at, ?),
                          updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'draft'`,
      [now, now, now, c.req.param("id"), userId],
    );
    return c.redirect("/op/outputs");
  } catch (err) {
    return c.redirect(`/op/outputs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Edit-a-draft-before-publish (spec Part 14 #7). GET renders a plain
// textarea over body_md; POST saves, re-renders body_html, and re-runs the
// firewall sweep (an edit must not smuggle an assertion past attribution).
app.get("/outputs/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/outputs");
  const row = await one<{ id: string; title: string; body_md: string; status: string }>(
    c.env.DB,
    "SELECT id, title, body_md, status FROM briefs WHERE id = ? AND user_id = ?",
    [c.req.param("id"), userId],
  );
  if (!row || row.status !== "draft") return c.redirect("/op/outputs");
  const { escapeHtml } = await import("../public/layout");
  const body = `<div class="okflag" style="margin-bottom:14px"><span class="ftext"><b>Editing draft.</b> Hand-edited text is no longer machine-verified — saving clears the verified-claims count.</span></div>
<form method="POST" action="/op/outputs/${escapeHtml(row.id)}/edit">
  <textarea name="body_md" rows="28" style="width:100%;font-family:var(--mono,monospace);font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:14px">${escapeHtml(row.body_md)}</textarea>
  <div style="margin-top:12px;display:flex;gap:10px">
    <button type="submit" class="btn btn-amber">Save draft</button>
    <a href="/op/outputs" class="btn">Cancel</a>
  </div>
</form>`;
  const { renderOpPage } = await import("./layout");
  return opHtml(
    renderOpPage({
      title: `Edit · ${row.title}`,
      sub: "refine the draft before approval · editing clears machine verification",
      body,
      activeNav: "/op/outputs",
      width: "wide",
    }),
  );
});

// Same integrity fix as /out/:id/edit above: a free-text edit has no
// structured claims to re-verify, so we don't pretend to — we reset the
// verified-claims provenance instead of leaving a stale count.
app.post("/outputs/:id/edit", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/outputs");
  const form = await c.req.formData();
  const bodyMd = String(form.get("body_md") ?? "");
  const { renderMarkdown } = await import("../cms/lib/render-post");
  await run(
    c.env.DB,
    `UPDATE briefs SET body_md = ?, body_html = ?,
        claims_verified = 0, judge_model = NULL, updated_at = ?
      WHERE id = ? AND user_id = ? AND status = 'draft'`,
    [bodyMd, renderMarkdown(bodyMd), new Date().toISOString(), c.req.param("id"), userId],
  );
  return c.redirect("/op/outputs");
});

// Discard — moves a draft to discarded; operator can re-propose.
app.post("/outputs/:id/discard", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/outputs?err=no_operator");
    await run(
      c.env.DB,
      "UPDATE briefs SET status = 'discarded', updated_at = ? WHERE id = ? AND user_id = ?",
      [new Date().toISOString(), c.req.param("id"), userId],
    );
    return c.redirect("/op/outputs");
  } catch (err) {
    return c.redirect(`/op/outputs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

app.get("/studio", async (c) => {
  const source = c.req.query("source");
  return opHtml(await renderStudioScreen(c.env, { source }));
});

// Per-project workspace (Script tab functional in P5; Audio/Video/Export
// show "stage not yet built" empty states).
app.get("/studio/:id", async (c) => {
  const tab = (c.req.query("tab") ?? "script") as "script" | "audio" | "video" | "export";
  const html = await renderProjectWorkspace(c.env, c.req.param("id"), tab);
  if (!html) return c.notFound();
  return opHtml(html);
});

// Lock / unlock the operator's argument skeleton. Beats and the Never
// list arrive as plain text (one per line) from the textareas.
app.post("/studio/skeleton", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/studio?err=no_operator");
    const form = await c.req.formData();
    const action = form.get("action")?.toString() ?? "lock";
    const beatsText = form.get("beats")?.toString() ?? "";
    const neverText = form.get("never")?.toString() ?? "";

    const beats = beatsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text, i) => ({ n: i + 1, text }));
    const never = neverText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const existing = await one<{ id: string }>(
      c.env.DB,
      "SELECT id FROM studio_skeleton WHERE user_id = ?",
      [userId],
    );
    const now = new Date().toISOString();
    if (existing) {
      await run(
        c.env.DB,
        `UPDATE studio_skeleton
            SET beats_json = ?, never_json = ?,
                locked_at = ?, updated_at = ?
          WHERE id = ?`,
        [
          JSON.stringify(beats),
          JSON.stringify(never),
          action === "lock" ? now : null,
          now,
          existing.id,
        ],
      );
    } else {
      await insertOne(c.env.DB, "studio_skeleton", {
        user_id: userId,
        beats_json: JSON.stringify(beats),
        never_json: JSON.stringify(never),
        examples_json: "[]",
        locked_at: action === "lock" ? now : null,
      });
    }
    return c.redirect("/op/studio");
  } catch (err) {
    return c.redirect(`/op/studio?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Compose — generate a project's beats from a finding + medium + the
// locked skeleton. Saves as a project on success.
app.post("/studio/compose", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/studio?err=no_operator");
    const form = await c.req.formData();
    const sourceId = form.get("source")?.toString() ?? "";
    const medium = form.get("medium")?.toString() ?? "";
    const title = form.get("title")?.toString().trim() || "Untitled";
    if (!sourceId || !medium) {
      return c.redirect("/op/studio?err=missing_source_or_medium");
    }

    // Pull the source finding from the patterns table for context.
    const finding = await one<{ id: string; title: string; statement_md: string }>(
      c.env.DB,
      "SELECT id, title, statement_md FROM patterns WHERE id = ? AND user_id = ?",
      [sourceId, userId],
    );
    if (!finding) return c.redirect("/op/studio?err=finding_not_found");

    const skeleton = await one<{ id: string; locked_at: string | null }>(
      c.env.DB,
      "SELECT id, locked_at FROM studio_skeleton WHERE user_id = ?",
      [userId],
    );

    const composed = await composeScript(c.env, {
      userId,
      title,
      medium,
      sourceTitle: finding.title,
      sourceBody: finding.statement_md,
    });

    const projectId = await insertOne(c.env.DB, "studio_projects", {
      user_id: userId,
      skeleton_id: skeleton?.id ?? null,
      source_finding_id: sourceId,
      title,
      medium,
      stage: "script",
      beats_json: JSON.stringify(composed.beats),
      recordings_json: "{}",
      clips_json: "{}",
      gen_done_json: "{}",
      assets_json: "[]",
    });

    return c.redirect(`/op/studio/${projectId}`);
  } catch (err) {
    return c.redirect(`/op/studio?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// ---- 301 redirects from old screen paths -------------------------------
// Bookmarks and chat-history references keep working. Each pre-P0 screen
// maps to the new surface that absorbed its functionality.

const redirects: Record<string, string> = {
  // home
  "/console": "/op",
  "/ingest": "/op",
  // oversight
  "/workbench": "/op/synthesis",
  "/leads": "/op/synthesis",
  "/patterns": "/op/synthesis",
  // authoring
  "/editorial": "/op/studio",
  "/build": "/op/outputs",
  // publishing
  "/publish": "/op/outputs",
  // canonical-spec v2.4 vocabulary: "Briefs" deprecated → "Outputs"
  "/briefs": "/op/outputs",
};

for (const [from, to] of Object.entries(redirects)) {
  app.get(from, (c) => c.redirect(to, 301));
  app.get(`${from}/:rest{.*}`, (c) => c.redirect(to, 301));
}

export default app;
