// CANOPTICON STUDIO — an editorial film generator for essays.
//
// You paste an essay. You choose a voice, and how fast, how chaotic and
// how dense you want it. You get a film.
//
// The Worker's job is narrow and it stays narrow: read the writing, speak
// it, measure the speech, and cut the film against that measurement. It
// emits a FilmCut — what happens, when, and how much it weighs. It never
// decides what anything looks like, because placement and fitting need
// text metrics that do not exist here, and one engine deciding what
// another engine will draw is how this system previously ended up with two
// that disagreed.
//
// The compositor and the renderer live in `lab/`, served by this same
// Worker as static assets.

import { Hono } from "hono";
import type { Env } from "./env.ts";
import film from "./routes/film.ts";
import narrate from "./routes/narrate.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
  c.json({ ok: true, service: "canopticon-studio", engine: "TYPOGRAPHIC_EDITORIAL" }),
);

app.route("/v1", film);
app.route("/v1", narrate);

app.notFound((c) => c.json({ error: "no such route" }, 404));
app.onError((err, c) => {
  console.error("studio error", err);
  return c.json({ error: err instanceof Error ? err.message : "unknown error" }, 500);
});

export default app;
