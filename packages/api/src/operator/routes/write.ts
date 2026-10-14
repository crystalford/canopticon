// The workspace's two actions: start a draft, and take one turn of the
// conversation. Cloudflare Access gates /op at the edge, as for every other
// operator action. A turn costs money, so it runs only while someone waits on
// it: streamed to the page as it happens, or — without the page's script —
// run to the end before the redirect back.

import { resolveOperatorId } from "../../public/data";
import { proposalCard } from "../../site/pages/write";
import { invalidateUploads } from "../../site/uploads";
import { type WriteEvent, anthropicStream, runTurn } from "../../write/agent";
import { d1Drafts } from "../../write/drafts";
import { addEntry, d1Entries } from "../../write/entries";
import { announce, publishDraft, takeDown } from "../../write/publish";
import { operatorApp } from "./app";
import { createAndExtract } from "./upload";

const app = operatorApp();

app.post("/write/new", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write");
  const d = await d1Drafts(c.env, userId).create();
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
  const stream = await anthropicStream(c.env);

  if (!store || !draft || !text || !stream) {
    const message = !draft
      ? "That draft does not exist."
      : !stream
        ? "Claude is not connected: set up Cloudflare's AI Gateway or ANTHROPIC_API_KEY."
        : "Say something first.";
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
  if (!sse) {
    await runTurn({ stream, env: c.env, store, entries, draftId: id, text, emit: () => {} });
    return c.redirect(back, 303);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  // A closed tab must not stop the turn from saving what it did.
  const emit = (e: WriteEvent) => {
    const out = e.type === "proposal" ? { ...e, html: proposalCard(e.entry, id) } : e;
    writer.write(enc.encode(`data: ${JSON.stringify(out)}\n\n`)).catch(() => {});
  };
  const job = runTurn({ stream, env: c.env, store, entries, draftId: id, text, emit })
    .catch((err: Error) => emit({ type: "error", message: err.message }))
    .finally(() => writer.close().catch(() => {}));
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
    await entries.decide(entryId, { status: "dismissed" });
    return c.redirect(`${back}#entry-${entryId}`, 303);
  }
  const form = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const edits = {
    ...(typeof form.title === "string" ? { title: form.title } : {}),
    ...(typeof form.body === "string" ? { body: form.body } : {}),
  };
  const r = await addEntry(c.env, entries, entryId, edits);
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
