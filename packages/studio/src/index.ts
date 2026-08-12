// CANOPTICON STUDIO — the deterministic editorial compiler.
//
// A film is the compiled artifact of a versioned, reproducible source
// representation. Not an AI video generator, not a prompt-to-video
// wrapper, not a template engine.
//
// The Worker's job is narrow on purpose: hold the IR, hold the frozen
// input artifacts, run the solver and the composition engine, and report
// what the cache did. The primitives themselves paint in the browser —
// canvas is the renderer, and the Lab is where a primitive earns its place
// in the palette before it is ever wired into the pipeline.

import { Hono } from "hono";
import type { Env } from "./env.ts";
import { FAMILIES, PRIMITIVES, PRIMITIVE_IDS } from "./primitives/registry.ts";
import projects from "./routes/projects.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "canopticon-studio",
    primitives: PRIMITIVE_IDS.length,
    families: FAMILIES.length,
  }),
);

/** The palette, as the compiler understands it. The Lab reads this to
 *  build its browser list, so the two can never disagree about what
 *  exists. */
app.get("/primitives", (c) =>
  c.json({
    count: PRIMITIVE_IDS.length,
    families: FAMILIES,
    primitives: Object.values(PRIMITIVES),
  }),
);

app.route("/v1", projects);

app.onError((err, c) => {
  console.error("studio error", { path: c.req.path, message: err.message, stack: err.stack });
  return c.json({ error: "internal_error", message: err.message }, 500);
});

export default app;
