// A real hand-authored IR, used across the Stage 1 tests.
//
// "The Temporary Measure" — the essay the prototype was designed against.
// Its shape matters: the abstraction curve rises from grounded documents
// in Act I to dissolved particles by the final line, so the film's visual
// language enacts the argument rather than illustrating it.

import { splitSentences } from "../src/compile/solver.ts";
import type { EditorialIR } from "../src/ir/schema.ts";

export const ESSAY = `In March of 2003, the legislature passed what everyone involved described as a temporary measure. The statute ran to eleven pages. It granted the department emergency authority to bypass its own review process, and it was written to expire in ninety days.

It has been renewed forty-one times.

Nobody has ever voted against a renewal. The renewals are not debated; they are attached to appropriations bills as a single line, and the line has not changed since 2006.

What makes this ordinary rather than scandalous is the paperwork. Every renewal was lawful. Every signature was authorized.

The department now cites the measure as settled law. Longstanding is not a legal category. It is a claim about time, and time is the only thing the measure has actually accumulated.

It is evidence of something more difficult to photograph: an institution that continued, and in continuing, became the rule it was written to suspend.`;

function range(text: string): { startChar: number; endChar: number } {
  const startChar = ESSAY.indexOf(text);
  if (startChar < 0) throw new Error(`fixture text not found in essay: ${text.slice(0, 40)}`);
  return { startChar, endChar: startChar + text.length };
}

/** Frozen readings for The Temporary Measure. These stand in for the
 *  extraction artifact an operator would ratify: what each sentence is
 *  about, and whether it reports a claim. Only scenes with something
 *  depictable carry one — the rest fall back to the abstraction ladder,
 *  which is the intended behaviour, not a gap. */
const READINGS: Record<string, EditorialIR["scenes"][number]["reading"]> = {
  s02: {
    sentence: "The statute ran to eleven pages.",
    subjects: [{ label: "statute", kind: "document", weight: 0.9 }],
    visualOpportunity: "inspect",
    contested: false,
  },
  s05: {
    sentence: "Nobody has ever voted against a renewal.",
    subjects: [{ label: "renewal", kind: "document", weight: 0.8 }],
    visualOpportunity: "accumulate",
    contested: false,
  },
  s08: {
    sentence: "The department now cites the measure as settled law.",
    subjects: [
      { label: "measure", kind: "document", weight: 0.85 },
      { label: "department", kind: "concept", weight: 0.4 },
    ],
    visualOpportunity: "inspect",
    // "cites ... as settled law" is the department's characterisation, not
    // the film's finding. The whole essay turns on that distinction.
    contested: true,
  },
};

interface SceneSeed {
  id: string;
  actId: string;
  fn: "hook" | "establish" | "evidence" | "turn" | "resolve";
  label: string;
  text: string;
  durationMs: number;
  entities: string[];
  elasticity?: "rigid" | "elastic";
  minDurationMs?: number;
}

const SEEDS: SceneSeed[] = [
  {
    id: "s01",
    actId: "act_1",
    fn: "hook",
    label: "A temporary measure",
    text: "In March of 2003, the legislature passed what everyone involved described as a temporary measure.",
    durationMs: 7400,
    entities: ["time", "institution"],
  },
  {
    id: "s02",
    actId: "act_1",
    fn: "establish",
    label: "Eleven pages",
    text: "The statute ran to eleven pages.",
    durationMs: 3100,
    entities: ["institution"],
  },
  {
    id: "s03",
    actId: "act_1",
    fn: "evidence",
    label: "Ninety days",
    text: "It granted the department emergency authority to bypass its own review process, and it was written to expire in ninety days.",
    durationMs: 9200,
    entities: ["institution", "time"],
  },
  {
    id: "s04",
    actId: "act_2",
    fn: "turn",
    label: "Forty-one times",
    text: "It has been renewed forty-one times.",
    durationMs: 4000,
    entities: ["time"],
  },
  {
    id: "s05",
    actId: "act_2",
    fn: "evidence",
    label: "Nobody voted against",
    text: "Nobody has ever voted against a renewal.",
    durationMs: 3600,
    entities: ["institution"],
  },
  {
    id: "s06",
    actId: "act_2",
    fn: "turn",
    label: "The paperwork",
    text: "What makes this ordinary rather than scandalous is the paperwork.",
    durationMs: 4800,
    entities: ["institution"],
  },
  {
    id: "s07",
    actId: "act_2",
    fn: "evidence",
    label: "Every signature",
    text: "Every renewal was lawful. Every signature was authorized.",
    durationMs: 5200,
    entities: ["institution"],
  },
  {
    id: "s08",
    actId: "act_3",
    fn: "evidence",
    label: "Settled law",
    text: "The department now cites the measure as settled law.",
    durationMs: 4200,
    entities: ["institution"],
  },
  {
    id: "s09",
    actId: "act_3",
    fn: "turn",
    label: "A claim about time",
    text: "Longstanding is not a legal category. It is a claim about time, and time is the only thing the measure has actually accumulated.",
    durationMs: 10600,
    entities: ["time", "uncertainty"],
  },
  {
    id: "s10",
    actId: "act_3",
    fn: "resolve",
    label: "Became the rule",
    text: "It is evidence of something more difficult to photograph: an institution that continued, and in continuing, became the rule it was written to suspend.",
    durationMs: 12000,
    entities: ["institution", "time"],
  },
];

export function buildFixtureIR(): EditorialIR {
  return {
    $schema: "https://canopticon.dev/schemas/v0/editorial-ir.json",
    projectId: "proj_fixture",
    title: "The Temporary Measure",
    irVersion: "0.1.0",
    logline:
      "An emergency order written for ninety days, renewed forty-one times, now cited as settled law.",
    essay: ESSAY,
    acts: [
      { actId: "act_1", title: "The Measure" },
      { actId: "act_2", title: "The Accumulation" },
      { actId: "act_3", title: "What It Became" },
    ],
    scenes: SEEDS.map((s) => ({
      sceneId: s.id,
      actId: s.actId,
      label: s.label,
      narrativeFunction: s.fn,
      status: "draft" as const,
      sourceRange: range(s.text),
      narration: { text: s.text, alignmentGranularity: "chunk" as const },
      timing: {
        // A scene spans its own narration: first chunk to last. Pointing
        // the end anchor at _c1 would silently truncate every scene whose
        // narration runs to more than one sentence.
        startAnchor: { chunkId: `${s.id}_c1`, offsetMs: 0 },
        endAnchor: {
          chunkId: `${s.id}_c${Math.max(1, splitSentences(s.text).length)}`,
          offsetMs: 0,
        },
        minDurationMs: s.minDurationMs ?? 2000,
        maxDurationMs: 30000,
        elasticity: s.elasticity ?? ("elastic" as const),
      },
      entities: s.entities,
      blocks: [],
      ...(READINGS[s.id] ? { reading: READINGS[s.id] } : {}),
    })),
    entities: [
      { id: "time", type: "concept", label: "Time" },
      { id: "institution", type: "organization", label: "The department" },
      { id: "uncertainty", type: "concept", label: "Uncertainty" },
    ],
    assets: [],
    creativeState: {
      identity: { typographicWeight: 0.63, experimentalism: 0.31, restraint: 0.42 },
      controlPoints: [
        {
          at: { actId: "act_1", position: "start" },
          values: {
            abstraction: 0.15,
            archivalWeight: 0.7,
            visualDensity: 0.35,
            humanPresence: 0.8,
            motionEnergy: 0.2,
          },
        },
        {
          at: { actId: "act_2", position: "start" },
          values: {
            abstraction: 0.3,
            archivalWeight: 0.45,
            visualDensity: 0.6,
            humanPresence: 0.5,
            motionEnergy: 0.5,
          },
        },
        {
          at: { actId: "act_3", position: "end" },
          values: {
            abstraction: 0.85,
            archivalWeight: 0.1,
            visualDensity: 0.3,
            humanPresence: 0.7,
            motionEnergy: 0.88,
          },
        },
      ],
      interpolation: "smooth",
      invariants: [
        { param: "humanPresence", min: 0.3 },
        { param: "visualDensity", max: 0.92 },
      ],
    },
    motifs: [
      {
        motifId: "time",
        concept: "TIME",
        chain: ["timeline_linear", "text_stagger"],
        establishedAt: "s01",
        states: ["flat", "layered", "fragmented", "dissolved"],
        developmentRule: "escalate_with_abstraction",
      },
      {
        motifId: "institution",
        concept: "INSTITUTION",
        chain: ["document_surface", "camera_move"],
        establishedAt: "s02",
        states: ["clean", "aged", "redacted", "erased"],
        developmentRule: "escalate_with_abstraction",
      },
      {
        motifId: "uncertainty",
        concept: "UNCERTAINTY",
        chain: ["glyph_to_points", "particle_flow"],
        establishedAt: "s09",
        states: ["stable", "drifting", "scattered", "dispersed"],
        developmentRule: "escalate_with_abstraction",
      },
    ],
    rules: [
      {
        ruleId: "r1",
        statement: "No abstract visuals before Act II",
        severity: "hard",
        kind: "forbid_vocabulary",
        scope: "act_1",
        maxAbstraction: 0.3,
      },
      {
        ruleId: "r4",
        statement: "Never abstract a scene tagged EVIDENCE above 0.60",
        severity: "soft",
        kind: "narrative_guard",
        scope: "evidence",
        maxAbstraction: 0.6,
      },
    ],
    overrides: [
      {
        sceneId: "s07",
        type: "pin",
        note: "Held: document surface, no motion.",
        chain: ["document_surface", "document_layout", "annotation"],
        params: { density: 0.35, energy: 0.1, abstraction: 0.15 },
      },
    ],
    visualLanguage: "documentary",
    renderProfile: "default",
  };
}
