// Operator console routes. Mounted at /op in the Worker root.
// Cloudflare Access gates this whole subtree (configured at the edge),
// so no auth middleware is needed here — every request that reaches us
// is the authenticated operator.

import { unzipSync } from "fflate";
import { Hono } from "hono";
import type { Env } from "../env";
import { insertOne, one, run } from "../lib/d1";
import { resolveOperatorId } from "../public/data";
import { CHAT_CLIENT_JS } from "./client/chat-js";
import { opHtml } from "./layout";
import { renderBuild } from "./screens/build";
import { renderChatScreen } from "./screens/chat";
import { renderConsole } from "./screens/console";
import { publishEditorial, renderEditorial, saveEditorial } from "./screens/editorial";
import { renderIngestScreen } from "./screens/ingest";
import { renderLeads } from "./screens/leads";
import { renderPatterns, signPattern } from "./screens/patterns";
import { changePublicationStatus, renderPublish } from "./screens/publish";
import { renderStudio } from "./screens/studio";
import { renderWorkbench } from "./screens/workbench";

const app = new Hono<{ Bindings: Env }>();

// Console (home).
app.get("/", async (c) => opHtml(await renderConsole(c.env)));

// Chat — list + active conversation. Client JS handles the live stream.
app.get("/chat", async (c) => opHtml(await renderChatScreen(c.env)));
app.get("/chat/:id", async (c) => opHtml(await renderChatScreen(c.env, c.req.param("id"))));

// Chat client module. Long cache; content changes rarely.
app.get("/chat.js", () => {
  return new Response(CHAT_CLIENT_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Workbench — entity-by-entity working surface.
app.get("/workbench", async (c) => {
  const slug = c.req.query("slug");
  return opHtml(await renderWorkbench(c.env, slug));
});
app.get("/workbench/:entity", async (c) =>
  opHtml(await renderWorkbench(c.env, c.req.param("entity"))),
);

// Build — door one.
app.get("/build", () => opHtml(renderBuild()));

// Ingest — door two.
app.get("/ingest", async (c) => {
  const result = c.req.query("result");
  const error = c.req.query("error");
  return opHtml(await renderIngestScreen(c.env, { result, error }));
});

// Ingest upload — accepts one or more files. Loose .md/.txt → piece;
// .zip → unpack, look for library-manifest.json or just take any
// .md/.txt inside. Status comes from the form (default = "published"
// so the operator's mental model matches: drop a doc, see it on the
// public site).
app.post("/ingest/upload", async (c) => {
  try {
    const form = await c.req.formData();
    const force = form.get("force") === "1";
    const statusRaw = form.get("status")?.toString() ?? "published";
    const status = (
      ["working-material", "published", "canonical"].includes(statusRaw) ? statusRaw : "published"
    ) as "working-material" | "published" | "canonical";
    const userId = await resolveOperatorId(c.env.DB);
    if (!userId) throw new Error("No operator user found — run the deploy workflow first.");

    const files: File[] = [];
    for (const v of form.getAll("file")) {
      if (v && typeof v !== "string") files.push(v as File);
    }
    if (files.length === 0) return c.redirect("/op/ingest?error=No+files+selected");

    const report = {
      inserted: 0,
      skipped: 0,
      failed: [] as Array<{ slug: string; reason: string }>,
    };

    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        await ingestZip(c.env, file, userId, force, status, report);
      } else {
        await ingestSingle(c.env, file, userId, force, status, report);
      }
    }

    const lines = [
      "✓ Ingest complete",
      `  Inserted: ${report.inserted} (status: ${status})`,
      `  Skipped:  ${report.skipped} (already exists; check Force to overwrite)`,
      ...(report.failed.length
        ? [
            `  Failed (${report.failed.length}):`,
            ...report.failed.map((f) => `    • ${f.slug}: ${f.reason}`),
          ]
        : []),
    ];
    return c.redirect(`/op/ingest?result=${encodeURIComponent(lines.join("\n"))}`);
  } catch (err) {
    return c.redirect(`/op/ingest?error=${encodeURIComponent((err as Error).message)}`);
  }
});

// Editorial — writing interface.
app.get("/editorial", async (c) => {
  const saved = c.req.query("saved") === "1";
  const published = c.req.query("published") === "1";
  const bulk = Number(c.req.query("bulk")) || undefined;
  return opHtml(await renderEditorial(c.env, undefined, { saved, published, bulk }));
});
app.get("/editorial/:slug", async (c) => {
  const saved = c.req.query("saved") === "1";
  const published = c.req.query("published") === "1";
  const bulk = Number(c.req.query("bulk")) || undefined;
  return opHtml(await renderEditorial(c.env, c.req.param("slug"), { saved, published, bulk }));
});
app.post("/editorial/:slug/save", async (c) => {
  const slug = c.req.param("slug");
  const form = await c.req.formData();
  await saveEditorial(c.env, slug, {
    title: form.get("title")?.toString(),
    subtitle: form.get("subtitle")?.toString(),
    body_md: form.get("body_md")?.toString(),
  });
  return c.redirect(`/op/editorial/${slug}?saved=1`);
});
app.post("/editorial/:slug/publish", async (c) => {
  const slug = c.req.param("slug");
  const form = await c.req.formData();
  // formaction submits the SAME form's title/subtitle/body_md fields, so
  // "Save & publish" should persist edits AND change status in one click.
  await saveEditorial(c.env, slug, {
    title: form.get("title")?.toString(),
    subtitle: form.get("subtitle")?.toString(),
    body_md: form.get("body_md")?.toString(),
  });
  // Status comes from either a form field (Save button hidden input) or a
  // ?status=… query string set by formaction. Default = "published".
  const target = (form.get("status")?.toString() ?? c.req.query("status") ?? "published") as
    | "published"
    | "canonical";
  await publishEditorial(c.env, slug, target);
  return c.redirect(`/op/editorial/${slug}?published=1`);
});

// Bulk publish — promote every working-material piece to published.
// Useful right after a bulk ingest (the 65-report library, a zip of
// notes, etc.). Idempotent. Redirects back with a count.
app.post("/editorial/bulk-publish", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/op/editorial?error=No+operator+user");
  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `UPDATE pieces
        SET publication_status = 'published',
            published_at = COALESCE(published_at, ?),
            updated_at = ?
      WHERE user_id = ? AND publication_status = 'working-material'`,
  )
    .bind(now, now, userId)
    .run();
  const count = result.meta?.changes ?? 0;
  return c.redirect(`/op/editorial?bulk=${count}`);
});

// Leads — triage queue.
app.get("/leads", async (c) => opHtml(await renderLeads(c.env)));

// Patterns — the lighthouse.
app.get("/patterns", async (c) => opHtml(await renderPatterns(c.env)));
app.post("/patterns/:id/sign", async (c) => {
  await signPattern(c.env, c.req.param("id"));
  return c.redirect("/op/patterns");
});

// Publish — projection to public face.
app.get("/publish", async (c) => {
  const slug = c.req.query("slug");
  return opHtml(await renderPublish(c.env, slug));
});
app.post("/publish/:slug", async (c) => {
  const slug = c.req.param("slug");
  const form = await c.req.formData();
  const status = (form.get("status")?.toString() ?? "published") as
    | "working-material"
    | "published"
    | "canonical";
  await changePublicationStatus(c.env, slug, status);
  return c.redirect(`/op/publish?slug=${encodeURIComponent(slug)}`);
});

// Studio — audio production.
app.get("/studio", async (c) => opHtml(await renderStudio(c.env)));

export default app;

// --- ingest helpers ----------------------------------------------------

interface IngestReport {
  inserted: number;
  skipped: number;
  failed: Array<{ slug: string; reason: string }>;
}

type IngestStatus = "working-material" | "published" | "canonical";

async function ingestZip(
  env: Env,
  zipFile: File,
  userId: string,
  force: boolean,
  status: IngestStatus,
  report: IngestReport,
): Promise<void> {
  const bytes = new Uint8Array(await zipFile.arrayBuffer());
  const unzipped = unzipSync(bytes);
  const dec = new TextDecoder();

  // Two modes:
  // (a) If a library-manifest.json is present, use it for slugs/titles.
  // (b) Otherwise, treat every .md/.txt inside as a separate piece.
  const manifestKey = Object.keys(unzipped).find((k) => k.endsWith("library-manifest.json"));

  if (manifestKey) {
    const manifest = JSON.parse(dec.decode(unzipped[manifestKey])) as {
      reports: Array<{
        id?: string;
        slug: string;
        title: string;
        kind?: string;
        source_file: string;
        word_count?: number;
        detected_entities?: string[];
      }>;
    };
    const prefix = manifestKey.replace("library-manifest.json", "");
    for (const r of manifest.reports) {
      try {
        const bytes = unzipped[`${prefix}${r.source_file}`];
        if (!bytes) {
          report.failed.push({ slug: r.slug, reason: "source file not found in zip" });
          continue;
        }
        await upsertPiece(env, userId, {
          slug: r.slug,
          title: r.title.replace(/^#+\s*/, "").trim(),
          kind: r.kind ?? "research-report",
          body_md: dec.decode(bytes),
          status,
          metadata: {
            source_id: r.id ?? null,
            detected_entities: r.detected_entities ?? [],
            word_count: r.word_count ?? null,
            ingested_from: "library-zip",
          },
          force,
          report,
        });
      } catch (err) {
        report.failed.push({ slug: r.slug, reason: (err as Error).message });
      }
    }
    return;
  }

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (!/\.(md|txt)$/i.test(path)) continue;
    const filename = path.split("/").pop() ?? path;
    const slug = slugify(filename.replace(/\.(md|txt)$/i, ""));
    if (!slug) continue;
    const body_md = dec.decode(bytes);
    const title = bestTitle(body_md, filename);
    try {
      await upsertPiece(env, userId, {
        slug,
        title,
        kind: "note",
        body_md,
        status,
        metadata: { ingested_from: "zip-bulk", original_filename: filename },
        force,
        report,
      });
    } catch (err) {
      report.failed.push({ slug, reason: (err as Error).message });
    }
  }
}

async function ingestSingle(
  env: Env,
  file: File,
  userId: string,
  force: boolean,
  status: IngestStatus,
  report: IngestReport,
): Promise<void> {
  const name = file.name;
  const slug = slugify(name.replace(/\.(md|txt|pdf)$/i, ""));
  let body_md = "";
  let kind = "note";

  if (/\.(md|txt)$/i.test(name)) {
    body_md = await file.text();
    kind = "note";
  } else if (/\.pdf$/i.test(name)) {
    report.failed.push({
      slug,
      reason: "PDF ingestion runs through chat (drop into chat to extract). Not yet wired here.",
    });
    return;
  } else {
    body_md = await file.text();
  }

  const title = bestTitle(body_md, name);
  try {
    await upsertPiece(env, userId, {
      slug,
      title,
      kind,
      body_md,
      status,
      metadata: { ingested_from: "single-file", original_filename: name },
      force,
      report,
    });
  } catch (err) {
    report.failed.push({ slug, reason: (err as Error).message });
  }
}

interface UpsertArgs {
  slug: string;
  title: string;
  kind: string;
  body_md: string;
  status: IngestStatus;
  metadata: Record<string, unknown>;
  force: boolean;
  report: IngestReport;
}

async function upsertPiece(env: Env, userId: string, args: UpsertArgs): Promise<void> {
  const existing = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM pieces WHERE user_id = ? AND slug = ?",
    [userId, args.slug],
  );
  if (existing && !args.force) {
    args.report.skipped++;
    return;
  }
  const now = new Date().toISOString();
  const isPublished = args.status !== "working-material";
  if (existing && args.force) {
    if (isPublished) {
      await run(
        env.DB,
        `UPDATE pieces
            SET title = ?, kind = ?, body_md = ?, metadata = ?,
                publication_status = ?,
                published_at = COALESCE(published_at, ?),
                updated_at = ?
          WHERE id = ?`,
        [
          args.title,
          args.kind,
          args.body_md,
          JSON.stringify(args.metadata),
          args.status,
          now,
          now,
          existing.id,
        ],
      );
    } else {
      await run(
        env.DB,
        `UPDATE pieces
            SET title = ?, kind = ?, body_md = ?, metadata = ?,
                publication_status = ?, updated_at = ?
          WHERE id = ?`,
        [
          args.title,
          args.kind,
          args.body_md,
          JSON.stringify(args.metadata),
          args.status,
          now,
          existing.id,
        ],
      );
    }
    args.report.inserted++;
    return;
  }
  const insertRow: Record<string, unknown> = {
    user_id: userId,
    slug: args.slug,
    title: args.title,
    kind: args.kind,
    publication_status: args.status,
    body_md: args.body_md,
    byline: "the operator",
    tags: JSON.stringify([]),
    metadata: JSON.stringify(args.metadata),
  };
  if (isPublished) insertRow.published_at = now;
  await insertOne(env.DB, "pieces", insertRow);
  args.report.inserted++;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Best-effort title extraction. Tries (1) a leading "# heading", (2) the
// first non-empty line treated as a title if short, (3) a filename
// fallback that strips claude-artifact-style noise. Always returns a
// non-empty string so the editor never loads with a blank title.
function bestTitle(body_md: string, filename: string): string {
  const heading = body_md.match(/^#{1,3}\s+(.+)$/m);
  if (heading?.[1]) {
    const t = heading[1].trim();
    if (t.length > 0 && t.length <= 200) return t;
  }
  const firstLine = body_md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (
    firstLine &&
    firstLine.length > 4 &&
    firstLine.length <= 160 &&
    !firstLine.startsWith("```")
  ) {
    return firstLine.replace(/^[#>*\-\s]+/, "").trim();
  }
  return prettyTitle(filename);
}

function prettyTitle(filename: string): string {
  let s = filename.replace(/\.(md|txt|pdf|html|json)$/i, "");
  // Strip Claude.ai compass-artifact prefixes that uniquely identify the
  // export but read as noise in a piece title.
  s = s.replace(/^compass-artifact-wf-[a-f0-9-]{36}-?/i, "");
  s = s.replace(/-text-markdown-\d+$/i, "");
  s = s.replace(/[-_]+/g, " ").trim();
  if (s.length === 0) return "Untitled";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
