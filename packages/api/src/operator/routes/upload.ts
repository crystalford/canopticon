// Ingest: upload, the create+extract spine, new versions, video import and
// bulk delete. Split out of operator/routes.ts on 2026-09-24; every handler is
// unchanged.

import { unzipSync } from "fflate";
import type { Env } from "../../env";
import { type ExtractResult, extractUpload, readFullExtractedText } from "../../graph/lib/extract";
import { enqueueProcessing, ensureProcessingTable } from "../../graph/lib/processing";
import { insertOne, one, run } from "../../lib/d1";
import {
  type LintNote,
  lintEssay,
  looksLikeEssay,
  looksLikeTetrad,
  parseEssay,
} from "../../lib/essay";
import { sortUpload } from "../../lib/sort-upload";
import { resolveOperatorId } from "../../public/data";
import { operatorApp } from "./app";

const app = operatorApp();

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
    const files = form.getAll("file").filter((x) => typeof x !== "string") as unknown as File[];
    const file = files[0];
    if (!file) {
      return c.redirect(`/op/library?error=${encodeURIComponent("No file in form data")}`);
    }
    // Several files chosen at once: each is read, sorted and held, exactly as
    // a single drop would be.
    if (files.length > 1) {
      const ids: string[] = [];
      let dupes = 0;
      for (const one of files.slice(0, ZIP_MAX_ENTRIES)) {
        try {
          const p = await createAndExtract(
            c.env,
            userId,
            one.stream(),
            one.name,
            one.type,
            one.size,
            {
              hold: true,
            },
          );
          ids.push(p.pieceId);
          if (p.duplicate) dupes++;
        } catch {
          // a bad file is skipped; the rest still land
        }
      }
      return c.redirect(
        `/op/library?ingested=${ids.length}&dupes=${dupes}&uploaded=${encodeURIComponent(ids.slice(0, 5).join(","))}`,
      );
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
            { hold: true },
          );
          pieceIds.push(p.pieceId);
          // Held: the pipeline runs when the operator publishes it.
          if (p.duplicate) zipDupes++;
        } catch {
          // skip a bad entry; keep ingesting the rest
        }
      }
      return c.redirect(
        `/op/library?ingested=${pieceIds.length}&dupes=${zipDupes}&uploaded=${encodeURIComponent(pieceIds.slice(0, 5).join(","))}`,
      );
    }

    // Single file: store, read, sort, and hold it on the desk. Publishing —
    // the pipeline, IndexNow — happens on the desk's Publish button
    // (operator/routes/desk.ts), never on the drop.
    const p = await createAndExtract(c.env, userId, f.stream(), f.name, f.type, f.size, {
      hold: true,
    });
    if (p.duplicate) {
      return c.redirect(`/op/library?piece=${encodeURIComponent(p.pieceId)}&dedup=1`);
    }
    return c.redirect(
      `/op/library?piece=${encodeURIComponent(p.pieceId)}&uploaded=${encodeURIComponent(p.pieceId)}`,
    );
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
    /** The desk's rule (docs/blackbox/README.md §Desk): "Nothing publishes
     *  without Publish." A held upload is stored, read and sorted, and waits
     *  on the desk as working-material until the operator publishes it. */
    hold?: boolean | undefined;
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

  const { extracted, body_md, title } = await bankUpload(env, userId, bytes, sha256, {
    filename,
    mime,
    size,
  });

  const slug = await ensureUniqueSlug(env.DB, userId, slugify(title || `piece-${Date.now()}`));
  const nowIso = new Date().toISOString();
  // Essays and research documents arrive through the same door. What tells
  // them apart is the essay convention itself — a majority of `##` headings
  // phrased as questions — because that contract is exactly what the essay
  // template and its Q&A structured data need. See lib/essay.ts.
  const tetrad = looksLikeTetrad(body_md);
  const essay = tetrad || looksLikeEssay(body_md);
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
    publication_status: opts.hold ? "working-material" : "published",
    // opts.publishedAt lets a caller supply the material's OWN real date
    // (a video's actual upload date, e.g.) instead of "now" — "now" is
    // only honest when there genuinely is no other date, as with a plain
    // file drop.
    ...(opts.hold ? {} : { published_at: opts.publishedAt ?? nowIso }),
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
      classification: tetrad ? "tetrad" : extracted.classification,
      content_sha256: sha256,
      // Stored, not just flashed on the redirect: an upload confirmation is
      // seen once and then gone, and these notes are worth having next to
      // the piece whenever the operator next looks at it.
      ...(parsedEssay ? { essay_lint: lintEssay(parsedEssay) } : {}),
      ...(opts.hold
        ? (() => {
            const s = sortUpload(body_md);
            return {
              desk: "waiting",
              sorted_as: s.as,
              sorted_why: s.why,
              uploaded_at: nowIso,
            };
          })()
        : {}),
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

/**
 * The deterministic middle of ingest, shared by a first upload and a new
 * version of an existing document: R2 → `uploaded_files` → `extract.ts` →
 * the full text. No `pieces` row is touched here; the caller decides whether
 * to create one or update one.
 */
async function bankUpload(
  env: Env,
  userId: string,
  bytes: Uint8Array,
  sha256: string,
  file: { filename: string; mime: string; size: number },
): Promise<{ extracted: ExtractResult; body_md: string; title: string }> {
  const { filename, mime, size } = file;
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
  return { extracted, body_md: full.text, title: full.title || filename };
}

async function contentSha256(bytes: Uint8Array): Promise<string> {
  const out = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(out))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function mimeForName(filename: string): string {
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

// Video-as-source-material ingestion (Phase 1, 2026-07-24) — the operator
// pastes a video URL, it's fetched+transcribed by the video Worker's
// Container, and the transcript becomes a piece attributed to the
// channel with the video's own publish date. See graph/lib/video-intake.ts.
app.post("/library/import-video", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk/workbench");
  const form = await c.req.parseBody();
  const url = typeof form.url === "string" ? form.url.trim() : "";
  if (!url) return c.redirect("/desk/workbench");
  const { requestVideoImport } = await import("../../graph/lib/video-intake");
  const result = await requestVideoImport(c.env, userId, url);
  if (!result.ok || !result.importId) {
    return c.redirect(
      `/desk/workbench?video_error=${encodeURIComponent(result.error ?? "failed")}`,
    );
  }
  return c.redirect(`/desk/workbench?importing=${encodeURIComponent(result.importId)}`);
});

// JSON status for the same live-polling banner pattern as /research-status.
app.get("/library/import-video/:id/status", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.json({ terminal: true, warn: true, headline: "not signed in" }, 401);
  const { pollVideoImport } = await import("../../graph/lib/video-intake");
  const row = await pollVideoImport(c.env, userId, c.req.param("id")).catch(() => null);
  if (!row) return c.json({ terminal: true, warn: true, headline: "import not found" }, 404);
  if (row.status === "succeeded") {
    const piece = row.piece_id
      ? await one<{ slug: string }>(
          c.env.DB,
          "SELECT slug FROM pieces WHERE id = ? AND user_id = ?",
          [row.piece_id, userId],
        )
      : null;
    return c.json({
      terminal: true,
      warn: false,
      headline: "Transcribed and queued for extraction",
      pieceId: row.piece_id,
      ...(piece ? { reviewUrl: `/p/${piece.slug}` } : {}),
    });
  }
  if (row.status === "failed") {
    return c.json({ terminal: true, warn: true, headline: row.error ?? "transcription failed" });
  }
  return c.json({ terminal: false, warn: false, headline: "Fetching and transcribing…" });
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

// A NEW VERSION of a document (docs/the-record.md §4): the body is replaced,
// the slug and published_at stay, the pipeline re-runs, and nothing is
// deleted — the previous source id is appended to metadata. The typed graph
// and the findings for the old body are purged so no stale quote survives a
// body change; the operator's READINGS are the one thing kept: each passage
// is re-located verbatim in the new body and re-anchored, and the ones the
// new body no longer contains are dropped and counted on the redirect.
// form: multipart `file`. Redirects with ?replaced=1&readings_lost=N, or
// ?error=same+file when the upload is byte-identical to the current source.
app.post("/library/:id/replace", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk/workbench?error=No%20operator%20user");
  const pieceId = c.req.param("id");
  const piece = await one<{
    id: string;
    slug: string;
    title: string;
    body_md: string | null;
    metadata: string | null;
  }>(
    c.env.DB,
    "SELECT id, slug, title, body_md, metadata FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  if (!piece) return c.redirect("/desk/workbench?error=No%20document");
  const form = await c.req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return c.redirect(`/desk/workbench?error=${encodeURIComponent("No file in form data")}`);
  }
  const f = file as unknown as File;
  const bytes = new Uint8Array(await f.arrayBuffer());
  const sha256 = await contentSha256(bytes);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(piece.metadata ?? "{}") ?? {};
  } catch {
    meta = {};
  }
  const oldSourceId = typeof meta.source_id === "string" ? meta.source_id : null;
  // The current source's hash: on the piece for every upload since content_sha256 was recorded; older rows
  // carry it only on uploaded_files, reached through the source.
  let currentSha = typeof meta.content_sha256 === "string" ? meta.content_sha256 : null;
  if (!currentSha && oldSourceId) {
    const u = await one<{ sha256: string | null }>(
      c.env.DB,
      "SELECT sha256 FROM uploaded_files WHERE user_id = ? AND created_source_id = ? LIMIT 1",
      [userId, oldSourceId],
    );
    currentSha = u?.sha256 ?? null;
  }
  if (currentSha && currentSha === sha256) {
    return c.redirect("/desk/workbench?error=same+file");
  }

  // Readings are read BEFORE the purge: their quotes cascade away with the
  // source node, and the note is the operator's own words — the one thing a
  // new version must not lose silently.
  const { createReading, readingsForPiece } = await import("../../lib/readings");
  const readings = await readingsForPiece(c.env.DB, userId, pieceId).catch(() => []);

  await ensureProcessingTable(c.env);
  const { extracted, body_md } = await bankUpload(c.env, userId, bytes, sha256, {
    filename: f.name,
    mime: f.type,
    size: f.size,
  });
  const tetrad = looksLikeTetrad(body_md);
  const essay = tetrad || looksLikeEssay(body_md);
  const parsedEssay = essay ? parseEssay(body_md) : null;
  const previous = Array.isArray(meta.previous_source_ids) ? meta.previous_source_ids : [];
  const nowIso = new Date().toISOString();
  const metadata = {
    ...meta,
    source_id: extracted.source_id,
    original_filename: f.name,
    extracted_chars: extracted.extracted_chars,
    classification: tetrad ? "tetrad" : extracted.classification,
    content_sha256: sha256,
    previous_source_ids: oldSourceId ? [...previous, oldSourceId] : previous,
    ...(parsedEssay ? { essay_lint: lintEssay(parsedEssay) } : {}),
  };
  await run(
    c.env.DB,
    `UPDATE pieces SET body_md = ?, kind = ?, subtitle = COALESCE(?, subtitle), metadata = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [
      body_md,
      essay ? "essay" : "research-report",
      parsedEssay?.dek ?? null,
      JSON.stringify(metadata),
      nowIso,
      pieceId,
      userId,
    ],
  );

  // Stale quotes never survive a body change. Both purges are keyed on the
  // piece, and the readings' quotes go with the source node.
  const { purgeTypedGraphForPiece } = await import("../../graph/lib/digestion-typed");
  const { clearAeoAtoms } = await import("../../graph/lib/aeo-extract");
  await purgeTypedGraphForPiece(c.env, userId, pieceId);
  await clearAeoAtoms(c.env, userId, pieceId).catch(() => {});
  await run(c.env.DB, "DELETE FROM readings WHERE user_id = ? AND piece_id = ?", [userId, pieceId]);

  let lost = 0;
  for (const r of readings) {
    const re = await createReading(c.env, userId, pieceId, r.verbatim_text, r.note_md);
    if (!re.ok) {
      lost++;
      continue;
    }
    // The note was written when it was written; a re-anchor is not a new reading.
    await run(c.env.DB, "UPDATE readings SET created_at = ? WHERE id = ? AND user_id = ?", [
      r.created_at,
      re.id,
      userId,
    ]);
  }

  await enqueueProcessing(c.env, userId, pieceId, { restart: true });
  return c.redirect(`/desk/workbench?replaced=1&readings_lost=${lost}`);
});

export default app;
