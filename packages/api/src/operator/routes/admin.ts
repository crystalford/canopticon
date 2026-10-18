// Admin's buttons (site/pages/admin.ts). docs/blackbox/README.md §Desk:
// "Nothing publishes without Publish." Every action is a plain form POST,
// scoped to the operator's own uploads (OWN_UPLOADS_SQL), and every one has
// an undo except Remove, which says what it does.

import { OWN_UPLOADS_SQL } from "../../admin/runtime";
import { purgeTypedGraphForPiece } from "../../graph/lib/digestion-typed";
import { enqueueProcessing, ensureProcessingTable } from "../../graph/lib/processing";
import { one, run } from "../../lib/d1";
import { pingIndexNow } from "../../lib/indexnow";
import { isSortedAs } from "../../lib/sort-upload";
import { resolveOperatorId } from "../../public/data";
import { hubTopics } from "../../site/data";
import { html } from "../../site/layout";
import { renderClaude } from "../../site/pages/claude";
import { invalidateUploads } from "../../site/uploads";
import { testClaude } from "../../write/connection";
import { forgetStoredKey, saveStoredKey } from "../../write/stored-key";
import { operatorApp } from "./app";
import { createAndExtract, mimeForName } from "./upload";

const app = operatorApp();

const back = (msg: string) => `/admin?done=${encodeURIComponent(msg)}`;
const fail = (msg: string) => `/admin?error=${encodeURIComponent(msg)}`;

interface Owned {
  id: string;
  slug: string;
  title: string;
  publication_status: string;
  published_at: string | null;
}

async function owned(db: D1Database, userId: string, id: string): Promise<Owned | null> {
  return one<Owned>(
    db,
    `SELECT id, slug, title, publication_status, published_at FROM pieces
      WHERE id = ? AND user_id = ? AND ${OWN_UPLOADS_SQL}`,
    [id, userId],
  ).catch(() => null);
}

/** The card's own choices — how it is read, and the topic it files under. */
async function choices(c: { req: { formData(): Promise<FormData> } }): Promise<{
  sortedAs: string | null;
  topic: string | null;
}> {
  const form = await c.req.formData().catch(() => new FormData());
  const s = String(form.get("sorted_as") ?? "");
  const t = String(form.get("topic") ?? "");
  return {
    sortedAs: isSortedAs(s) ? s : null,
    // Only a topic the site has a hub for; anything else files under Other.
    topic: hubTopics().some((h) => h.name === t) ? t : null,
  };
}

async function setStatus(
  db: D1Database,
  id: string,
  status: string,
  extra: { sortedAs?: string | null; topic?: string | null } = {},
): Promise<void> {
  const sets = ["'$.admin_status', ?"];
  const args: unknown[] = [status];
  if (extra.sortedAs) {
    sets.push("'$.sorted_as', ?", "'$.sorted_why', ?");
    args.push(extra.sortedAs, "was set by you");
  }
  if (extra.topic) {
    sets.push("'$.library_topic', ?");
    args.push(extra.topic);
  }
  await run(
    db,
    `UPDATE pieces SET metadata = json_set(COALESCE(metadata, '{}'), ${sets.join(", ")}) WHERE id = ?`,
    [...args, id],
  );
}

app.post("/admin/:id/publish", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const p = await owned(c.env.DB, userId, c.req.param("id"));
  if (!p) return c.redirect(fail("That document is not in Admin"));
  const pick = await choices(c);
  await run(
    c.env.DB,
    `UPDATE pieces SET publication_status = 'published', published_at = COALESCE(published_at, ?)
      WHERE id = ?`,
    [new Date().toISOString(), p.id],
  );
  await setStatus(c.env.DB, p.id, "published", pick);
  // Now, and only now, the pipeline reads it and the engines hear of it.
  await ensureProcessingTable(c.env);
  await enqueueProcessing(c.env, userId, p.id);
  invalidateUploads();
  const ping = pingIndexNow(c.env, [`/p/${p.slug}`, "/library", "/sitemap.xml"]).catch(() => {});
  try {
    c.executionCtx.waitUntil(ping);
  } catch {
    // No execution context (tests): the ping is already running.
  }
  return c.redirect(back(`Published “${p.title}”.`));
});

app.post("/admin/:id/private", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const p = await owned(c.env.DB, userId, c.req.param("id"));
  if (!p) return c.redirect(fail("That document is not in Admin"));
  await setStatus(c.env.DB, p.id, "private", await choices(c));
  return c.redirect(back(`Kept “${p.title}” private.`));
});

app.post("/admin/:id/undo", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const p = await owned(c.env.DB, userId, c.req.param("id"));
  if (!p) return c.redirect(fail("That document is not in Admin"));
  await setStatus(c.env.DB, p.id, "waiting");
  return c.redirect(back(`“${p.title}” is waiting again.`));
});

app.post("/admin/:id/unpublish", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const p = await owned(c.env.DB, userId, c.req.param("id"));
  if (!p) return c.redirect(fail("That document is not in Admin"));
  await run(c.env.DB, "UPDATE pieces SET publication_status = 'working-material' WHERE id = ?", [
    p.id,
  ]);
  await setStatus(c.env.DB, p.id, "waiting");
  invalidateUploads();
  return c.redirect(back(`“${p.title}” is off the site and waiting again.`));
});

// Remove: the graph first (nodes carry no foreign key to pieces, so deleting
// the piece alone would leave its quotes unmoored — CLAUDE.md), then the row.
app.post("/admin/:id/remove", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const p = await owned(c.env.DB, userId, c.req.param("id"));
  if (!p) return c.redirect(fail("That document is not in Admin"));
  await purgeTypedGraphForPiece(c.env, userId, p.id);
  await run(c.env.DB, "DELETE FROM pieces WHERE id = ? AND user_id = ?", [p.id, userId]);
  invalidateUploads();
  return c.redirect(back(`Removed “${p.title}”.`));
});

// Paste a link: fetch the file once, then the same door as a dropped file.
const MAX_LINK_BYTES = 20 * 1024 * 1024;
app.post("/admin/link", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect(fail("No operator user"));
  const form = await c.req.formData();
  let url: URL;
  try {
    url = new URL(String(form.get("url") ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
  } catch {
    return c.redirect(fail("That is not a web address."));
  }
  const res = await fetch(url.toString(), { redirect: "follow" }).catch(() => null);
  if (!res?.ok)
    return c.redirect(fail(`Could not fetch ${url.hostname} (${res?.status ?? "no answer"}).`));
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_LINK_BYTES) return c.redirect(fail("That file is over 20 MB."));
  const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  const last = decodeURIComponent(url.pathname.split("/").pop() || url.hostname);
  let name = /\.[a-z0-9]{2,5}$/i.test(last) ? last : `${last}.txt`;
  let body: Uint8Array = bytes;
  if (type === "text/html") {
    // A web page: keep its text, not its markup.
    const text = new TextDecoder()
      .decode(bytes)
      .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    body = new TextEncoder().encode(`Source: ${url.toString()}\n\n${text}`);
    name = `${name.replace(/\.[a-z0-9]{2,5}$/i, "")}.md`;
  }
  const p = await createAndExtract(
    c.env,
    userId,
    body,
    name,
    type === "text/html" ? "text/markdown" : type || mimeForName(name),
    body.length,
    {
      hold: true,
      extraMetadata: { source_url: url.toString() },
    },
  );
  return c.redirect(
    p.duplicate ? "/admin?dedup=1" : `/admin?uploaded=${encodeURIComponent(p.pieceId)}`,
  );
});

// "Test the connection" on /admin/claude: one small call, the way the
// workspace makes them, and the page again with what came back.
app.post("/admin/claude-test", async (c) => html(renderClaude(c.env, await testClaude(c.env))));

// The Anthropic key, pasted on /admin/claude: saved encrypted, then tested at
// once. A key Anthropic refuses is not kept. The key never comes back to any
// page; the page shows its last four characters.
app.post("/admin/claude-key", async (c) => {
  const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const saved = await saveStoredKey(c.env, typeof form.key === "string" ? form.key : "");
  if (!saved.ok) return c.redirect(`/admin/claude?error=${encodeURIComponent(saved.reason)}`, 303);
  const test = await testClaude(c.env);
  if (!test.ok && /^(401|403)\b/.test(test.error)) {
    await forgetStoredKey(c.env);
    return c.redirect(
      `/admin/claude?error=${encodeURIComponent(`Anthropic refused that key (${test.error}). It was not kept.`)}`,
      303,
    );
  }
  return html(renderClaude(c.env, test, { done: "Key saved." }));
});

app.post("/admin/claude-key/forget", async (c) => {
  await forgetStoredKey(c.env);
  return c.redirect(
    `/admin/claude?done=${encodeURIComponent("The pasted key is forgotten.")}`,
    303,
  );
});

export default app;
