// The workspace's two actions: start a draft, and take one turn of the
// conversation. Cloudflare Access gates /op at the edge, as for every other
// operator action. A turn costs money, so it runs only while someone waits on
// it: streamed to the page as it happens, or — without the page's script —
// run to the end before the redirect back.

import { resolveOperatorId } from "../../public/data";
import { type WriteEvent, anthropicStream, runTurn } from "../../write/agent";
import { d1Drafts } from "../../write/drafts";
import { operatorApp } from "./app";

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
        ? "Claude is not connected: ANTHROPIC_API_KEY is not set."
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

  if (!sse) {
    await runTurn({ stream, env: c.env, store, draftId: id, text, emit: () => {} });
    return c.redirect(back, 303);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  // A closed tab must not stop the turn from saving what it did.
  const emit = (e: WriteEvent) => {
    writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {});
  };
  const job = runTurn({ stream, env: c.env, store, draftId: id, text, emit })
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

export default app;
