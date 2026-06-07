// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree at the edge — every request
// that reaches us is the authenticated operator. No auth middleware here.
//
// Six surfaces per the operator-claude-code-handoff:
//   /op           Feed     — drop documents · digest into the graph
//   /op/chat      Chat     — single never-resetting NL stream
//   /op/synthesis Synthesis — read-only finding cards (Pattern / Contradiction / …)
//   /op/library   Library  — full document archive
//   /op/briefs    Briefs   — proposal-only citable-page builder
//   /op/studio    Studio   — Script → Audio → Video → Export
//
// 301 redirects keep old screen paths from breaking bookmarks. The old
// screen modules (console, workbench, editorial, leads, patterns, publish,
// build, ingest) were deleted in this commit — their functionality folds
// into the six new surfaces over phases P1–P5.

import { unzipSync } from "fflate";
import { Hono } from "hono";
import type { Env } from "../env";
import { buildBrief } from "../graph/lib/briefs/pipeline";
import { proposeBriefs } from "../graph/lib/briefs/proposer";
import {
  enqueueDigest,
  ensureJobsTable,
  jobStatusForPiece,
  runDigestJob,
} from "../graph/lib/digest-jobs";
import { extractUpload, readFullExtractedText } from "../graph/lib/extract";
import { composeScript } from "../graph/lib/studio/compose";
import { runSynthesisSurfacer } from "../graph/lib/synthesis-surfacer";
import { all, insertOne, one, run } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { CMDK_CLIENT_JS } from "./client/cmdk-js";
import { opHtml } from "./layout";
import { renderBriefsScreen } from "./screens/briefs";
import { renderChatScreen } from "./screens/chat";
import { renderFeedScreen } from "./screens/feed";
import { renderLibraryScreen } from "./screens/library";
import { renderLibraryDocScreen } from "./screens/library-doc";
import { renderProjectWorkspace, renderStudioScreen } from "./screens/studio";
import { renderSynthesisScreen } from "./screens/synthesis";

const app = new Hono<{ Bindings: Env }>();

// ---- six surfaces -------------------------------------------------------

// Feed is the home — drop the doc, watch the digestion theater.
app.get("/", async (c) => {
  const focusPieceId = c.req.query("piece");
  const error = c.req.query("error");
  const ingested = c.req.query("ingested");
  const processing = c.req.query("processing");
  const cleared = c.req.query("cleared");
  return opHtml(
    await renderFeedScreen(c.env, { focusPieceId, error, ingested, processing, cleared }),
  );
});

// POST /op/feed/upload — the auto-ingest entry point.
//   1. Store file in R2 + uploaded_files row
//   2. Extract text (extract.ts: PDF → Llama Scout; md/txt → straight through)
//   3. Create a pieces row from the extracted text (status: working-material)
//   4. Run the digestion pipeline synchronously so the activity log
//      is populated by the time we redirect.
// "Upload is authorization" — no preview, no confirmation, no second click.
// A .zip is expanded and each supported document inside is ingested.
const ZIP_ENTRY_RE = /\.(md|markdown|txt|pdf)$/i;
const ZIP_MAX_ENTRIES = 50;

app.post("/feed/upload", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) {
      return c.redirect(`/op?error=${encodeURIComponent("No operator user")}`);
    }
    await ensureJobsTable(c.env);
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return c.redirect(`/op?error=${encodeURIComponent("No file in form data")}`);
    }
    const f = file as unknown as File;
    const isZip = f.type.includes("zip") || /\.zip$/i.test(f.name);

    if (isZip) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(buf, { filter: (e) => ZIP_ENTRY_RE.test(e.name) && e.size > 0 });
      } catch (err) {
        return c.redirect(`/op?error=${encodeURIComponent(`Bad zip: ${(err as Error).message}`)}`);
      }
      const names = Object.keys(entries).filter(
        (n) => !n.startsWith("__MACOSX/") && !(n.split("/").pop() ?? "").startsWith("."),
      );
      if (names.length === 0) {
        return c.redirect(`/op?error=${encodeURIComponent("No .md/.txt/.pdf files in the zip")}`);
      }
      // For zips: create + extract every entry synchronously (fast). Documents
      // land in the Vault; extraction is decoupled — run it from Library when
      // ready. (Pivot: upload = bank in Vault, extraction is a separate manual
      // step, no auto-fan-out of LLM work on upload.)
      const pieceIds: string[] = [];
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
        } catch {
          // skip a bad entry; keep ingesting the rest
        }
      }
      return c.redirect(`/op?ingested=${pieceIds.length}`);
    }

    // Single-file: store in Vault. Extraction is triggered manually from
    // Library — the cron drain + durable job infra remain in place for that.
    const p = await createAndExtract(c.env, userId, f.stream(), f.name, f.type, f.size);
    return c.redirect(`/op?piece=${encodeURIComponent(p.pieceId)}`);
  } catch (err) {
    return c.redirect(`/op?error=${encodeURIComponent((err as Error).message)}`);
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
  if (!userId) return c.redirect("/op");
  await run(c.env.DB, "DELETE FROM orchestrator_events WHERE user_id = ?", [userId]);
  await run(
    c.env.DB,
    "DELETE FROM digest_jobs WHERE user_id = ? AND status IN ('completed','failed')",
    [userId],
  );
  return c.redirect("/op?cleared=1");
});

interface CreatedPiece {
  pieceId: string;
  slug: string;
  title: string;
  body_md: string;
  sourceId: string;
}

// Create + extract — the fast, deterministic half of ingest. Returns the new
// piece's id + slug + extracted text so the caller can hand it to digest()
// either inline or via waitUntil.
async function createAndExtract(
  env: Env,
  userId: string,
  body: ReadableStream | Uint8Array,
  filename: string,
  mime: string,
  size: number,
): Promise<CreatedPiece> {
  const r2_key = `uploads/${userId}/${crypto.randomUUID()}-${safeName(filename)}`;
  await env.FILES.put(r2_key, body, {
    httpMetadata: { contentType: mime || "application/octet-stream" },
  });
  const fileId = await insertOne(env.DB, "uploaded_files", {
    user_id: userId,
    r2_key,
    original_filename: filename,
    mime: mime || "application/octet-stream",
    size_bytes: size,
    classification: classify(mime, filename),
  });

  const extracted = await extractUpload(env, fileId);
  const full = await readFullExtractedText(env, extracted.source_id, userId);
  const body_md = full.text;
  const title = full.title || filename;

  const slug = await ensureUniqueSlug(env.DB, userId, slugify(title || `piece-${Date.now()}`));
  const pieceId = await insertOne(env.DB, "pieces", {
    user_id: userId,
    slug,
    title,
    kind: "research-report",
    publication_status: "working-material",
    body_md,
    byline: "the operator",
    tags: JSON.stringify([]),
    metadata: JSON.stringify({
      ingested_from: "feed-upload",
      source_id: extracted.source_id,
      original_filename: filename,
      extracted_chars: extracted.extracted_chars,
      classification: extracted.classification,
    }),
  });
  return { pieceId, slug, title, body_md, sourceId: extracted.source_id };
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

// Chat — the conversation stream. P0 stub; P3 reskins to the new design.
app.get("/chat", async (c) => opHtml(await renderChatScreen(c.env)));
app.get("/chat/:id", async (c) => opHtml(await renderChatScreen(c.env, c.req.param("id"))));

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

app.get("/synthesis", async (c) => {
  const view = c.req.query("view") === "corpus" ? "corpus" : "findings";
  return opHtml(await renderSynthesisScreen(c.env, view));
});

// Manual re-surface trigger. The handoff treats Synthesis as read-only
// oversight, but a Re-surface button on the topbar lets the operator
// force a recompute after a fresh ingest. Idempotent: the surfacer
// upserts candidate cards by slug, so re-running just updates counts.
app.post("/synthesis/surface", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/synthesis?err=no_operator");
    await runSynthesisSurfacer(c.env, userId);
    return c.redirect("/op/synthesis");
  } catch (err) {
    return c.redirect(`/op/synthesis?err=${encodeURIComponent((err as Error).message)}`);
  }
});

app.get("/library", async (c) => {
  const extracting = c.req.query("extracting");
  return opHtml(await renderLibraryScreen(c.env, { extracting }));
});

app.get("/library/:slug", async (c) => {
  const html = await renderLibraryDocScreen(c.env, c.req.param("slug"));
  if (!html) return c.notFound();
  return opHtml(html);
});

// Manual extraction trigger. The pivot decoupled upload from extraction;
// this is where the operator actually fires the LLM digestion pipeline.
//
// Two modes:
//   piece_ids[] — extract these pieces only (per-row or detail-page button)
//   mode=all-unextracted — extract every piece that has no completed
//     digest_jobs row yet (header batch button)
// Either way: enqueue durable jobs + kick each off via waitUntil for instant
// start. The every-minute cron drain catches anything killed mid-run.
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
    c.executionCtx.waitUntil(runDigestJob(c.env, jobId));
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

app.get("/briefs", async (c) => opHtml(await renderBriefsScreen(c.env)));

// Re-run the proposer over the corpus. Idempotent: upserts proposals
// by slug. Surfaces graph coverage gaps + synthesis-finding-derived
// Brief shapes.
app.post("/briefs/propose", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/briefs?err=no_operator");
    await proposeBriefs(c.env, userId);
    return c.redirect("/op/briefs");
  } catch (err) {
    return c.redirect(`/op/briefs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Build a Brief — runs the 4-step pipeline synchronously and persists
// claims + body. The operator sees the verified draft on the redirect.
app.post("/briefs/:id/build", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/briefs?err=no_operator");
    await buildBrief(c.env, c.req.param("id"), userId);
    return c.redirect("/op/briefs");
  } catch (err) {
    return c.redirect(`/op/briefs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Publish — promotes a draft Brief to the public /briefs/:slug page.
app.post("/briefs/:id/publish", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/briefs?err=no_operator");
    const now = new Date().toISOString();
    await run(
      c.env.DB,
      `UPDATE briefs SET status = 'published', published_at = COALESCE(published_at, ?),
                          signed_by = COALESCE(signed_by, 'the operator'),
                          signed_at = COALESCE(signed_at, ?),
                          updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'draft'`,
      [now, now, now, c.req.param("id"), userId],
    );
    return c.redirect("/op/briefs");
  } catch (err) {
    return c.redirect(`/op/briefs?err=${encodeURIComponent((err as Error).message)}`);
  }
});

// Discard — moves a draft back to discarded status; operator can re-propose.
app.post("/briefs/:id/discard", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) return c.redirect("/op/briefs?err=no_operator");
    await run(
      c.env.DB,
      "UPDATE briefs SET status = 'discarded', updated_at = ? WHERE id = ? AND user_id = ?",
      [new Date().toISOString(), c.req.param("id"), userId],
    );
    return c.redirect("/op/briefs");
  } catch (err) {
    return c.redirect(`/op/briefs?err=${encodeURIComponent((err as Error).message)}`);
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
  "/build": "/op/briefs",
  // publishing
  "/publish": "/op/briefs",
};

for (const [from, to] of Object.entries(redirects)) {
  app.get(from, (c) => c.redirect(to, 301));
  app.get(`${from}/:rest{.*}`, (c) => c.redirect(to, 301));
}

export default app;
