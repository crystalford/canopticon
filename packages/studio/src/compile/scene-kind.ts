// What KIND of sentence this is — decided from the prose, with no model.
//
// The complaint that produced this file: "it seems like it's only doing the
// same text effect... it needs to intelligently select what to build with
// each scene." Both halves were true. An 89-scene investigation compiled to
// twelve distinct chains and three of them covered sixty-six scenes,
// because the ONLY thing choosing a chain was the abstraction curve — a
// smooth line, so neighbouring scenes necessarily got the same rung, in
// runs of thirty.
//
// The fix is not more primitives. It is noticing that the compiler already
// knows a great deal about each sentence and was throwing all of it away.
//
// A SEMANTIC READING IS AN INTERPRETATION. It says what a sentence is
// ABOUT, a model proposes it, and a human ratifies it — that gate is not
// negotiable and this file does not touch it.
//
// A SENTENCE'S KIND IS NOT AN INTERPRETATION. Whether it prints money,
// draws a route, names a place, asks a question, quotes someone, or runs
// four words long is checkable by anyone against the text. That is exactly
// the same distinction that let figures reach the chart family without a
// model, applied to everything else the prose is wearing on its surface.
//
// So: the curve still decides HOW FAR from literal depiction a scene sits —
// that is the director's trajectory and it must stay theirs. The kind
// decides WHAT KIND OF THING is depicted at that distance. Two axes rather
// than one, and the second one varies scene to scene the way prose does.

import type { Scene } from "../ir/schema.ts";

export type SceneKind =
  | "quantity" // prints a number the essay printed
  | "routing" // draws a path something travels
  | "chronology" // two or more dates
  | "attribution" // reports someone's words or framing
  | "place" // names a specific somewhere
  | "assertion" // a short flat declarative — the essay landing a blow
  | "enumeration" // a list item, one of a run
  | "question" // asks something
  | "statement"; // everything else

export interface SceneReading {
  kind: SceneKind;
  /** Why, in one phrase, for the Compile view. A classification nobody can
   *  interrogate is indistinguishable from a mood. */
  because: string;
}

/** Capitalised words that are not sentence-initial and are not the usual
 *  institutional furniture. A place or an organisation is a specific thing
 *  and deserves a specific treatment; "The Government" does not. */
const GENERIC_CAPS = new Set([
  "the",
  "a",
  "an",
  "federal",
  "government",
  "program",
  "budget",
  "interim",
  "housing",
  "assistance",
  "direct",
  "model",
  "total",
  "peak",
  "primary",
  "funding",
  "national",
  "department",
  "ministry",
  "office",
  "act",
  "bill",
]);

function properNouns(text: string): string[] {
  const words = text.split(/\s+/);
  const found: string[] = [];
  for (let i = 1; i < words.length; i++) {
    const raw = (words[i] as string).replace(/[^\w'-]/g, "");
    if (raw.length < 3) continue;
    if (!/^[A-Z]/.test(raw)) continue;
    if (GENERIC_CAPS.has(raw.toLowerCase())) continue;
    // A word that is capitalised only because it follows a full stop is
    // not a proper noun.
    const prev = words[i - 1] as string;
    if (/[.!?]$/.test(prev)) continue;
    found.push(raw);
  }
  return found;
}

/** Classify a scene. Deterministic, checkable, and ordered so the most
 *  specific evidence wins — a sentence that both prints money and names a
 *  city is about the money, because the money is the finding. */
export function readSceneKind(scene: Scene): SceneReading {
  const text = scene.narration.text;
  const figures = scene.figures ?? [];
  const route = scene.route ?? [];
  const quantities = figures.filter((f) => f.kind !== "year");
  const years = figures.filter((f) => f.kind === "year");

  if (route.length >= 2) {
    return { kind: "routing", because: `the prose draws ${route.length} stages` };
  }
  if (quantities.length > 0) {
    return {
      kind: "quantity",
      because: `prints ${quantities.map((f) => f.text).join(", ")}`,
    };
  }
  if (years.length >= 2) {
    return { kind: "chronology", because: `spans ${years.map((f) => f.text).join("–")}` };
  }
  if (/\?\s*$/.test(text.trim())) {
    return { kind: "question", because: "asks rather than states" };
  }
  // Attribution before place: a sentence reporting a government's own
  // vocabulary is about the reporting, wherever it happens.
  if (scene.reading?.contested || /"[^"]{2,}"|["""][^"""]{2,}["""]/.test(text)) {
    return { kind: "attribution", because: "reports someone else's words" };
  }
  const names = properNouns(text);
  if (names.length > 0) {
    return { kind: "place", because: `names ${names.slice(0, 2).join(", ")}` };
  }
  // A bullet is one of a run, and a run wants to read as a run — the same
  // treatment repeating is correct here and nowhere else.
  if (scene.narrativeFunction === "evidence" && /^[A-Z][^.!?]*:/.test(text)) {
    return { kind: "enumeration", because: "a labelled item in a list" };
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words <= 7) {
    return { kind: "assertion", because: `${words} words — the essay landing a blow` };
  }
  return { kind: "statement", because: "ordinary prose" };
}

/** The chain a kind wants, at a given rung of the abstraction ladder.
 *
 *  The rung is the DIRECTOR'S — it is where the curve put this moment — and
 *  the kind chooses what sort of thing is depicted there. A quantity at the
 *  literal end is a counter on a document; the same quantity further out is
 *  a chart coming apart into points. The subject is invariant; the distance
 *  is the director's. That is the Constitution's own rule, applied to a
 *  second axis.
 *
 *  Returns null when the kind has no opinion, and the ladder's own base
 *  chain carries the scene — which is the honest default rather than
 *  inventing a treatment for a sentence that does not suggest one. */
export function chainForKind(kind: SceneKind, tier: string, sceneIndex = 0): string[] | null {
  const LITERAL = tier === "GROUNDED" || tier === "ANNOTATED";
  /** Rotate among a kind's treatments so two neighbouring scenes of the
   *  same kind do not land on the same one. Twenty-five short declaratives
   *  all rendered as `text_stagger` is the "same text effect" complaint
   *  arriving from the other direction: the kind was right and the film
   *  still had one look. Derived from the scene index, so it is varied and
   *  not random — the same film always cuts the same way. */
  const pick = <T>(options: T[]): T => options[sceneIndex % options.length] as T;

  switch (kind) {
    case "quantity":
      return LITERAL
        ? pick([
            ["data_series", "counter", "ease_profile"],
            ["data_series", "chart_cartesian", "particle_trail"],
            ["data_series", "small_multiples", "particle_trail"],
          ])
        : ["data_series", "chart_cartesian", "particle_trail"];
    case "routing":
      return LITERAL
        ? ["data_series", "sankey_flow", "particle_trail"]
        : ["data_series", "sankey_flow", "particle_seek", "particle_trail"];
    case "chronology":
      return LITERAL
        ? ["data_series", "timeline_linear", "particle_trail"]
        : ["data_series", "timeline_radial", "particle_trail"];
    case "attribution":
      // Someone else's words, set as a quotation and held slightly apart
      // from the film's own voice.
      return LITERAL
        ? pick([
            ["document_surface", "annotation", "text_scramble"],
            ["document_surface", "redaction", "text_stagger"],
            ["document_surface", "document_layout", "annotation"],
          ])
        : ["text_layout", "glyph_to_points", "particle_seek"];
    case "place":
      return LITERAL
        ? pick([
            ["document_surface", "document_layout", "camera_move"],
            // map_projection consumes DATA, so it needs a source above it.
            ["data_series", "map_projection", "particle_trail"],
            ["document_layout", "annotation", "text_stagger"],
          ])
        : ["noise_field", "flow_field", "particle_flow", "particle_trail"];
    case "assertion":
      // Short and flat — the essay landing a blow. Big type and nothing
      // else, but not the SAME big type: a word arriving one unit at a
      // time, a word resolving out of noise, and a word drawn as an
      // outline are three different kinds of emphasis, and an essay that
      // lands twenty-five blows should not land them all identically.
      return pick([
        ["text_stagger"],
        ["text_scramble"],
        ["glyph_to_path", "text_stagger"],
        ["variable_axis"],
      ]);
    case "question":
      return LITERAL ? ["text_layout", "text_stagger"] : ["glyph_to_path", "text_scramble"];
    case "enumeration":
      return LITERAL ? ["document_surface", "annotation", "text_stagger"] : null;
    default:
      return null;
  }
}
