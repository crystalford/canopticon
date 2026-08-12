// Semantic extraction — prose in, SemanticReading out.
//
// This is the only place in the compiler that talks to a model, and it does
// so ONCE, at authoring time. The reading it returns is an input artifact:
// hashed, committed, and thereafter read rather than regenerated. Compile
// never calls this. That is standing rule 1, and it is what lets the system
// read meaning out of prose without making the film's appearance depend on
// a model's mood on a given afternoon.
//
// The operator ratifies. `proposeReading` returns a proposal with the model
// and prompt recorded on it; nothing downstream will use it until it has
// been stored as an asset, which is a deliberate human act.

import type { SemanticReading } from "./treatment.ts";

export const EXTRACTION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export interface ReadingProposal {
  /** Null when extraction DECLINED — no model was available, or the model
   *  produced nothing usable. A declined scene keeps no reading, so the
   *  composition engine falls back to the abstraction ladder and the film's
   *  creative-state curve carries it.
   *
   *  This matters more than it looks. A guessed reading OVERRIDES the curve,
   *  so handing an operator an invented reading to ratify is worse than
   *  handing them nothing: on an abstract essay it flattened nineteen
   *  sentences to one body plan and took the film's trajectory with it. */
  reading: SemanticReading | null;
  /** How it was produced, so the Compile view can state provenance rather
   *  than presenting a machine's guess as a fact about the essay. */
  provenance: {
    generatedBy: string;
    createdAt: string;
    sourceText: string;
    /** True when the model call failed and the deterministic reader ran.
     *  A degraded reading is still a usable one — standing rule 8 — but it
     *  must never be mistaken for the model's. */
    fallback: boolean;
  };
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

const SYSTEM = `You read one sentence from a documentary essay and report what it is ABOUT, so a procedural film compiler can choose a visual treatment. You do not choose the treatment.

Report:
- subjects: the concrete nouns worth depicting, each with a kind and a weight 0..1 for how much the shot is about it. An abstract noun is a "concept". A named or generic physical thing is an "object". A place is a "place". A living thing is a "creature". A person is a "person". A paper record is a "document".
- visualOpportunity: what the sentence invites the camera to DO — "inspect" (a specific thing worth looking at closely), "establish" (a setting), "contrast" (two things set against each other), "dissolve" (something coming apart or being lost), "accumulate" (something piling up or repeating).
- contested: true if the sentence REPORTS A CLAIM rather than asserting a fact — "he claimed", "according to", "allegedly", "said to be". This matters: a claim must never be depicted as though it were established.

Return ONLY JSON:
{"subjects":[{"label":"...","kind":"object|creature|document|person|place|concept","weight":0.0}],"visualOpportunity":"inspect|establish|contrast|dissolve|accumulate","contested":true|false}`;

/** Words that mark reported speech. Used by the deterministic fallback and
 *  as a floor under the model: if the prose hedges and the model says the
 *  sentence is settled fact, the hedge wins. Getting this wrong in the
 *  permissive direction would let a claim be depicted as established. */
const CLAIM_MARKERS = [
  "claimed",
  "claims",
  "alleged",
  "allegedly",
  "according to",
  "said to be",
  "reportedly",
  "insisted",
  "maintained that",
  "denied",
  "asserted",
  // Attribution by naming a group — "critics call this", "we call it".
  // This essay is full of them and the first pass caught none.
  "call it",
  "call this",
  "called it",
  "so-called",
  "supposedly",
  "purportedly",
];

export function looksContested(sentence: string): boolean {
  const s = sentence.toLowerCase();
  return CLAIM_MARKERS.some((m) => s.includes(m));
}

export async function proposeReading(
  ai: AiBinding | undefined,
  sentence: string,
): Promise<ReadingProposal> {
  const createdAt = new Date().toISOString();

  if (ai) {
    try {
      const out = (await ai.run(EXTRACTION_MODEL, {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: sentence },
        ],
        max_tokens: 500,
      })) as { response?: string };
      const parsed = parseReading(out.response ?? "", sentence);
      if (parsed) {
        return {
          reading: parsed,
          provenance: {
            generatedBy: EXTRACTION_MODEL,
            createdAt,
            sourceText: sentence,
            fallback: false,
          },
        };
      }
    } catch {
      // Fall through to the deterministic reader. A failed extraction
      // degrades one scene; it does not block the film.
    }
  }

  // Decline rather than guess. The deterministic reader below exists for
  // tests and for inspection; it is deliberately NOT offered as a reading
  // an operator could ratify, because it cannot tell a statute from
  // latency and would depict both identically.
  return {
    reading: null,
    provenance: {
      generatedBy: "deterministic-fallback",
      createdAt,
      sourceText: sentence,
      fallback: true,
    },
  };
}

/** Parse and sanity-check the model's JSON. Anything malformed returns null
 *  rather than a half-populated reading — a reading with no subjects would
 *  silently plan a treatment about nothing. */
export function parseReading(raw: string, sentence: string): SemanticReading | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }

  const obj = parsed as Partial<SemanticReading>;
  const kinds = new Set(["object", "creature", "document", "person", "place", "concept"]);
  const opportunities = new Set(["inspect", "establish", "contrast", "dissolve", "accumulate"]);

  const subjects = (Array.isArray(obj.subjects) ? obj.subjects : [])
    .filter((s) => s && typeof s.label === "string" && s.label.trim() !== "" && kinds.has(s.kind))
    .map((s) => ({
      label: s.label.trim(),
      kind: s.kind,
      weight: typeof s.weight === "number" ? Math.max(0, Math.min(1, s.weight)) : 0.5,
    }));
  if (subjects.length === 0) return null;

  const opportunity = opportunities.has(obj.visualOpportunity as string)
    ? (obj.visualOpportunity as SemanticReading["visualOpportunity"])
    : "establish";

  return {
    sentence,
    subjects,
    visualOpportunity: opportunity,
    // The hedge floor: the prose wins over the model here. A model that
    // misses "he claimed" would otherwise let a claim be depicted as fact.
    contested: obj.contested === true || looksContested(sentence),
  };
}

/** A reading derived from the sentence alone — no model. Crude on purpose:
 *  it exists so a film still compiles when extraction is unavailable, and
 *  so the planner is testable without a network. */
export function fallbackReading(sentence: string): SemanticReading {
  const words = sentence
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const stop = new Set([
    "the",
    "a",
    "an",
    "was",
    "were",
    "is",
    "are",
    "on",
    "in",
    "at",
    "of",
    "to",
    "he",
    "she",
    "it",
    "they",
    "his",
    "her",
    "their",
    "that",
    "this",
    "and",
    "but",
    "had",
    "has",
    "have",
    "been",
    "be",
    "said",
    "claimed",
    "would",
  ]);
  const nouns = words
    .filter((w) => w.length > 3 && !stop.has(w.toLowerCase()))
    .map((w) => w.toLowerCase());

  const subjects: SemanticReading["subjects"] = nouns.slice(0, 3).map((label, i) => ({
    label,
    // "concept", not "object". A word-splitter cannot tell a statute from
    // latency, and claiming "object" is a false confidence that runs all
    // the way to a body plan: on an abstract essay it turned every one of
    // nineteen sentences into the same ceiling fixture. Concept routes to
    // typography, which is the honest depiction of a noun whose referent
    // the reader could not identify.
    kind: "concept" as const,
    // Earlier words weigh more; a flat weighting would make the planner's
    // subject choice arbitrary and therefore unstable across edits.
    weight: Math.max(0.2, 0.9 - i * 0.3),
  }));

  return {
    sentence,
    subjects: subjects.length > 0 ? subjects : [{ label: "subject", kind: "concept", weight: 0.5 }],
    visualOpportunity: "establish",
    contested: looksContested(sentence),
  };
}
