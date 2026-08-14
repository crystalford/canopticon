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
import { CONSTRUCTION_IDS, OPERATOR_IDS } from "./compile/construct.ts";
import { VERBS } from "./compile/verbs.ts";
import type { Env } from "./env.ts";
import { VOICES } from "./narrate/tts.ts";
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

/** THE DIRECTOR'S VOCABULARY, as the compiler understands it.
 *
 *  Named rather than counted. "Eight constructions, twelve operations, six
 *  verbs" is a fact a director can act on; "128 primitives" is not — it is
 *  a fact about the instruction set. The Lab reads this so the two can
 *  never disagree about what can be said. */
app.get("/vocabulary", (c) =>
  c.json({
    constructions: CONSTRUCTION_IDS,
    operators: OPERATOR_IDS,
    verbs: VERBS,
    primitives: PRIMITIVE_IDS.length,
  }),
);

/** THE VOICES, AND THE APPROACHES. Both lists live on the compiler so the
 *  front door can only offer what exists — the third occurrence of "a
 *  control that reports rather than acts" was a picker the browser
 *  invented, and the fix is that the browser stops inventing. */
app.get("/v1/vocabulary/choices", (c) =>
  c.json({
    voices: VOICES,
    approaches: [
      {
        id: "text",
        label: "Text driven",
        note: "The writing itself is the material — typography, kinetic text, particles, hard cuts.",
      },
      {
        id: "abstract",
        label: "Abstract",
        note: "No attempt to depict the nouns. Geometry, fields, light, motion, spatial relation.",
      },
      {
        id: "world",
        label: "World",
        note: "Persistent objects and spaces that evolve as the narration goes on.",
      },
      {
        id: "hybrid",
        label: "Let CANOPTICON decide",
        note: "The system chooses the visual language from the writing, sentence by sentence.",
      },
    ],
    editing: [
      {
        id: "oneshot",
        label: "Continuous",
        note: "Never cuts. Every change is travelled through.",
      },
      { id: "cut", label: "Scene based", note: "Each moment is its own shot." },
      {
        id: "hybrid",
        label: "Mixed",
        note: "Continuous passages, punctuated where a cut is earned.",
      },
      { id: "montage", label: "Collide", note: "Cuts are the argument. Held apart, never eased." },
    ],
    registers: [
      {
        id: "auto",
        label: "Let it decide",
        note: "Set for a phrase, taken apart for the statement the argument turns on.",
      },
      {
        id: "editorial",
        label: "Editorial",
        note: "Set large and composed. Legibility is the point; the writing does the work.",
      },
      {
        id: "fiore",
        label: "Fiore",
        note: "Violent scale, cropped by the frame, halftone. Each frame is one assertion.",
      },
      {
        id: "kinetic",
        label: "Kinetic",
        note: "Letterforms as points — the words assemble and come apart.",
      },
    ],
    intensity: [
      { id: "restrained", label: "Restrained" },
      { id: "expressive", label: "Expressive" },
      { id: "chaotic", label: "Chaotic" },
    ],
  }),
);

app.route("/v1", projects);

app.onError((err, c) => {
  console.error("studio error", { path: c.req.path, message: err.message, stack: err.stack });
  return c.json({ error: "internal_error", message: err.message }, 500);
});

export default app;
