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

import { Hono } from "hono";
import type { Env } from "../env";
import { digest } from "../graph/lib/digestion";
import { extractUpload } from "../graph/lib/extract";
import { runSynthesisSurfacer } from "../graph/lib/synthesis-surfacer";
import { insertOne, one } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { CMDK_CLIENT_JS } from "./client/cmdk-js";
import { opHtml } from "./layout";
import { renderBriefsScreen } from "./screens/briefs";
import { renderChatScreen } from "./screens/chat";
import { renderFeedScreen } from "./screens/feed";
import { renderLibraryScreen } from "./screens/library";
import { renderStudioScreen } from "./screens/studio";
import { renderSynthesisScreen } from "./screens/synthesis";

const app = new Hono<{ Bindings: Env }>();

// ---- six surfaces -------------------------------------------------------

// Feed is the home — drop the doc, watch the digestion theater.
app.get("/", async (c) => {
  const focusPieceId = c.req.query("piece");
  const error = c.req.query("error");
  return opHtml(await renderFeedScreen(c.env, { focusPieceId, error }));
});

// POST /op/feed/upload — the auto-ingest entry point.
//   1. Store file in R2 + uploaded_files row
//   2. Extract text (extract.ts: PDF → Llama Scout; md/txt → straight through)
//   3. Create a pieces row from the extracted text (status: working-material)
//   4. Run the digestion pipeline synchronously so the activity log
//      is populated by the time we redirect.
// "Upload is authorization" — no preview, no confirmation, no second click.
app.post("/feed/upload", async (c) => {
  try {
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) {
      return c.redirect(`/op?error=${encodeURIComponent("No operator user")}`);
    }
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return c.redirect(`/op?error=${encodeURIComponent("No file in form data")}`);
    }
    const f = file as unknown as File;

    // 1. R2 + uploaded_files
    const r2_key = `uploads/${userId}/${crypto.randomUUID()}-${safeName(f.name)}`;
    await c.env.FILES.put(r2_key, f.stream(), {
      httpMetadata: { contentType: f.type || "application/octet-stream" },
    });
    const classification = classify(f.type, f.name);
    const fileId = await insertOne(c.env.DB, "uploaded_files", {
      user_id: userId,
      r2_key,
      original_filename: f.name,
      mime: f.type || "application/octet-stream",
      size_bytes: f.size,
      classification,
    });

    // 2. Extract text into a sources row.
    const extracted = await extractUpload(c.env, fileId);

    // Read the extracted text back out (extractUpload stashes it inline up
    // to 8KB and overflows to R2; for digestion we want the inline portion
    // which is what claim/entity roles operate on).
    const sourceRow = await one<{ content_text: string | null; title: string }>(
      c.env.DB,
      "SELECT content_text, title FROM sources WHERE id = ? AND user_id = ?",
      [extracted.source_id, userId],
    );
    const body_md = sourceRow?.content_text ?? "";
    const title = sourceRow?.title ?? f.name;

    // 3. Create a pieces row (status: working-material per the handoff —
    //    claims/confidence are the gate to citable, not bulk publish).
    const slug = slugify(title || `piece-${Date.now()}`);
    // Ensure uniqueness: append a short suffix if the slug already exists.
    const uniqueSlug = await ensureUniqueSlug(c.env.DB, userId, slug);
    const pieceId = await insertOne(c.env.DB, "pieces", {
      user_id: userId,
      slug: uniqueSlug,
      title,
      kind: "research-report",
      publication_status: "working-material",
      body_md,
      byline: "the operator",
      tags: JSON.stringify([]),
      metadata: JSON.stringify({
        ingested_from: "feed-upload",
        source_id: extracted.source_id,
        original_filename: f.name,
        extracted_chars: extracted.extracted_chars,
        classification: extracted.classification,
      }),
    });

    // 4. Run the digestion pipeline. Synchronously so the redirect lands
    //    on a fully-populated activity log. (P1.1 stretch: SSE-stream the
    //    steps for the live theater.)
    await digest(c.env, {
      userId,
      pieceId,
      pieceSlug: uniqueSlug,
      title,
      body_md,
      sourceId: extracted.source_id,
    });

    return c.redirect(`/op?piece=${encodeURIComponent(pieceId)}`);
  } catch (err) {
    return c.redirect(`/op?error=${encodeURIComponent((err as Error).message)}`);
  }
});

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

app.get("/library", async (c) => opHtml(await renderLibraryScreen(c.env)));

app.get("/briefs", async (c) => opHtml(await renderBriefsScreen(c.env)));

app.get("/studio", async (c) => opHtml(await renderStudioScreen(c.env)));

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
