// The workspace's two actions: start a draft, and take one turn of the
// conversation. Cloudflare Access gates /op at the edge, as for every other
// operator action. A turn costs money, so it runs only while someone waits on
// it: streamed to the page as it happens, or — without the page's script —
// run to the end before the redirect back.

import { OWN_UPLOADS_SQL } from "../../admin/runtime";
import { purgeTypedGraphForPiece } from "../../graph/lib/digestion-typed";
import { one, run } from "../../lib/d1";
import { resolveOperatorId } from "../../public/data";
import { proposalCard } from "../../site/pages/write";
import { invalidateUploads } from "../../site/uploads";
import { type WriteEvent, anthropicStream, runTurn } from "../../write/agent";
import { slugify } from "../../write/article";
import { d1Drafts } from "../../write/drafts";
import { ENGINES, defaultEngine, setDefaultEngine } from "../../write/engines";
import { addEntry, d1Entries } from "../../write/entries";
import { d1Notes } from "../../write/notes";
import { announce, articleTopics, publishDraft, takeDown } from "../../write/publish";
import { d1Reads } from "../../write/read";
import {
  checkReport,
  d1Sources,
  reportBrief,
  reportFile,
  reportProblems,
} from "../../write/research";
import { operatorApp } from "./app";
import { createAndExtract } from "./upload";

const app = operatorApp();

app.post("/write/new", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write");
  const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const store = d1Drafts(c.env, userId);
  const d = await store.create(form.kind === "research" ? "research" : "article");
  // The engine chosen stays with the conversation, and becomes the default.
  const chosen = String(form.engine ?? "");
  if (ENGINES.some((e) => e.id === chosen)) {
    await store.save(d.id, { meta: { ...d.meta, engine: chosen } });
    await setDefaultEngine(c.env.DB, userId, chosen).catch(() => {});
  }
  return c.redirect(`/admin/write/${d.id}`, 303);
});

app.post("/write/:id/turn", async (c) => {
  const id = c.req.param("id");
  const back = `/admin/write/${id}`;
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  const store = userId ? d1Drafts(c.env, userId) : null;
  const draft = store ? await store.get(id) : null;
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const text = String((form as Record<string, unknown>).text ?? "")
    .trim()
    .slice(0, 20000);
  const sse = (c.req.header("accept") ?? "").includes("text/event-stream");
  // Claude's stream, when Claude is connected; a conversation on Workers AI
  // runs without it (runTurn says so if a Claude conversation has none).
  const stream = await anthropicStream(c.env);
  const defaultEngineId = userId ? await defaultEngine(c.env.DB, userId) : undefined;

  if (!store || !draft || !text) {
    const message = !draft ? "That draft does not exist." : "Say something first.";
    if (!sse) return c.redirect(back, 303);
    return new Response(
      `data: ${JSON.stringify({ type: "error", message })}\n\ndata: {"type":"done"}\n\n`,
      {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  const entries = userId ? d1Entries(c.env, userId) : undefined;
  const sources = userId ? d1Sources(c.env, userId) : undefined;
  const notes = userId ? d1Notes(c.env, userId) : undefined;
  const reads = userId ? d1Reads(c.env, userId) : undefined;
  if (!sse) {
    await runTurn({
      stream,
      env: c.env,
      store,
      entries,
      sources,
      notes,
      reads,
      draftId: id,
      text,
      ...(defaultEngineId ? { defaultEngine: defaultEngineId } : {}),
      emit: () => {},
    });
    return c.redirect(back, 303);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  // Every step is saved as it happens, so a closed tab keeps what was done;
  // but the Worker is stopped about 30 seconds after the tab goes, so the
  // page asks for the tab to stay open until Claude finishes.
  const emit = (e: WriteEvent) => {
    const out = e.type === "proposal" ? { ...e, html: proposalCard(e.entry, id) } : e;
    writer.write(enc.encode(`data: ${JSON.stringify(out)}\n\n`)).catch(() => {});
  };
  // A comment line every 15 seconds keeps proxies and the browser from
  // closing a stream that is quiet while Claude thinks.
  const beat = setInterval(() => {
    writer.write(enc.encode(": still working\n\n")).catch(() => {});
  }, 15_000);
  const job = runTurn({
    stream,
    env: c.env,
    store,
    entries,
    sources,
    notes,
    reads,
    draftId: id,
    text,
    ...(defaultEngineId ? { defaultEngine: defaultEngineId } : {}),
    emit,
  })
    .catch((err: Error) => emit({ type: "error", message: err.message }))
    .finally(() => {
      clearInterval(beat);
      writer.close().catch(() => {});
    });
  try {
    c.executionCtx.waitUntil(job);
  } catch {
    // No execution context (tests): the job is already running.
  }
  return new Response(readable, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" },
  });
});

// Reports dropped into the chat: each is stored, read and sorted exactly as
// an Admin upload is, and waits in Admin (nothing publishes without
// Publish). Claude can read a waiting upload; an article that quotes it
// cannot publish until it is published too. Answers JSON for the page.
app.post("/write/:id/attach", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.json({ error: "No operator user." }, 400);
  const form = await c.req.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter(
    (x) => typeof x !== "string",
  ) as unknown as File[];
  if (!files.length) return c.json({ error: "No file." }, 400);
  const added: Array<{
    id: string;
    title: string;
    chars: number;
    duplicate: boolean;
    error?: string;
  }> = [];
  for (const f of files.slice(0, 10)) {
    if (/\.zip$/i.test(f.name)) {
      added.push({
        id: "",
        title: f.name,
        chars: 0,
        duplicate: false,
        error: "Drop the files themselves, not a zip.",
      });
      continue;
    }
    try {
      const p = await createAndExtract(c.env, userId, f.stream(), f.name, f.type, f.size, {
        hold: true,
      });
      added.push({ id: p.slug, title: p.title, chars: p.body_md.length, duplicate: !!p.duplicate });
    } catch (err) {
      added.push({
        id: "",
        title: f.name,
        chars: 0,
        duplicate: false,
        error: (err as Error).message,
      });
    }
  }
  invalidateUploads();
  return c.json({ added });
});

// A proposal: added as written or as rewritten, or dismissed.
app.post("/write/:id/entries/:entry/:act{add|dismiss}", async (c) => {
  const id = c.req.param("id");
  const entryId = c.req.param("entry");
  const back = `/admin/write/${id}`;
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect(back, 303);
  const entries = d1Entries(c.env, userId);
  if (c.req.param("act") === "dismiss") {
    // A card left open from before must not undo an entry already added.
    if ((await entries.get(entryId))?.status === "proposed")
      await entries.decide(entryId, { status: "dismissed" });
    return c.redirect(`${back}#entry-${entryId}`, 303);
  }
  const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const edits = {
    ...(typeof form.title === "string" ? { title: form.title } : {}),
    ...(typeof form.body === "string" ? { body: form.body } : {}),
  };
  const r = await addEntry(c.env, userId, entries, entryId, edits);
  if (!r.ok)
    return c.redirect(
      `${back}?error=${encodeURIComponent(r.problems.join(" "))}#entry-${entryId}`,
      303,
    );
  invalidateUploads();
  return c.redirect(
    `${back}?done=${encodeURIComponent(`Added to the record: ${r.route}`)}#entry-${entryId}`,
    303,
  );
});

// A finished research report goes to Admin as a waiting upload — the same
// path every upload takes — and publishes there, on Publish. It leaves only
// when every quotation is found in the pages Claude read.
app.post("/write/:id/save", async (c) => {
  const id = c.req.param("id");
  const back = `/admin/write/${id}`;
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect(back, 303);
  const store = d1Drafts(c.env, userId);
  const d = await store.get(id);
  if (!d || d.kind !== "research") return c.redirect(back, 303);
  const pages = await d1Sources(c.env, userId).texts(id);
  const problems = reportProblems(d, checkReport(d.body, pages), articleTopics());
  if (problems.length)
    return c.redirect(`${back}?error=${encodeURIComponent(problems.join(" "))}`, 303);
  // Saved before under the same title: the same report, revised.
  const prior =
    d.meta.savedAs && d.meta.savedTitle && d.meta.savedTitle === d.meta.title
      ? await one<{ id: string; publication_status: string }>(
          c.env.DB,
          `SELECT id, publication_status FROM pieces WHERE slug = ? AND user_id = ? AND ${OWN_UPLOADS_SQL}`,
          [d.meta.savedAs, userId],
        ).catch(() => null)
      : null;
  const bytes = new TextEncoder().encode(reportFile(d));
  const p = await createAndExtract(
    c.env,
    userId,
    bytes,
    `${slugify(d.meta.title ?? "research")}.md`,
    "text/markdown",
    bytes.length,
    {
      hold: true,
      extraMetadata: { origin: "workspace-research", draft_id: id, pages_read: pages.length },
    },
  );
  let done = "Saved to Admin. It waits there for Publish.";
  if (p.duplicate) done = "Already in Admin, unchanged.";
  else if (prior && prior.id !== p.pieceId && prior.publication_status !== "published") {
    // The same report, revised: the new copy replaces the one still waiting
    // (Admin's Remove: the graph first, then the row).
    await purgeTypedGraphForPiece(c.env, userId, prior.id);
    await run(c.env.DB, "DELETE FROM pieces WHERE id = ? AND user_id = ?", [prior.id, userId]);
    done = "Updated in Admin. It waits there for Publish.";
  } else if (prior)
    done =
      "The earlier version is already published, so this one was saved as a new document in Admin. It waits there for Publish.";
  else if (d.meta.savedAs)
    done =
      "Saved to Admin as a new document; the earlier report stays there too. It waits there for Publish.";
  await store.save(id, { meta: { ...d.meta, savedAs: p.slug, savedTitle: d.meta.title ?? "" } });
  invalidateUploads();
  return c.redirect(`${back}?done=${encodeURIComponent(done)}`, 303);
});

// "Write an article from this": a saved report starts an article draft that
// reads it first. Pressed again for the same report, it opens that draft.
app.post("/write/:id/article", async (c) => {
  const id = c.req.param("id");
  const back = `/admin/write/${id}`;
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect(back, 303);
  const store = d1Drafts(c.env, userId);
  const d = await store.get(id);
  if (!d || d.kind !== "research" || !d.meta.savedAs)
    return c.redirect(
      `${back}?error=${encodeURIComponent("Save the report to Admin first; the article reads it from there.")}`,
      303,
    );
  if (d.meta.articleDraft && d.meta.articleFrom === d.meta.savedAs) {
    const open = await store.get(d.meta.articleDraft).catch(() => null);
    if (open) return c.redirect(`/admin/write/${open.id}`, 303);
  }
  const title = d.meta.savedTitle || d.meta.title || d.meta.savedAs;
  const draft = await store.create("article");
  await store.save(draft.id, {
    meta: { based_on: [d.meta.savedAs], seed: reportBrief(title, d.meta.savedAs) },
  });
  await store.save(id, {
    meta: { ...d.meta, articleDraft: draft.id, articleFrom: d.meta.savedAs },
  });
  return c.redirect(`/admin/write/${draft.id}?start=1`, 303);
});

// Publish (or update) and take down. Publish runs the same gates as the
// build; a refusal comes back as the reasons, on the workspace page.
app.post("/write/:id/publish", async (c) => {
  const id = c.req.param("id");
  const back = `/admin/write/${id}`;
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect(back, 303);
  const r = await publishDraft(c.env, userId, d1Drafts(c.env, userId), id);
  if (!r.ok) return c.redirect(`${back}?error=${encodeURIComponent(r.problems.join(" "))}`, 303);
  invalidateUploads();
  const ping = announce(c.env, r.slug);
  try {
    c.executionCtx.waitUntil(ping);
  } catch {
    // No execution context (tests): the ping is already running.
  }
  return c.redirect(`${back}?published=${encodeURIComponent(r.slug)}&v=${r.version}`, 303);
});

app.post("/write/:id/unpublish", async (c) => {
  const id = c.req.param("id");
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (userId) {
    await takeDown(d1Drafts(c.env, userId), id);
    invalidateUploads();
  }
  return c.redirect(
    `/admin/write/${id}?done=${encodeURIComponent("Taken down. The address and every version are kept.")}`,
    303,
  );
});

export default app;
