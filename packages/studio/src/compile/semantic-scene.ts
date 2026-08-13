// THE SEMANTIC SCENE — what the sentence says is HAPPENING, before any
// question of what it looks like.
//
// THE BOTTLENECK THIS ANSWERS. The gallery reached the point where each
// representation was a competent rendering RECIPE — literal makes a
// polygon, structural makes a plane, diagrammatic makes a point field —
// and the sentence chose between them without ever reaching inside one.
// So "the city watched its residents" and "the residents watched the
// city" produced the same picture with the same elements in the same
// arrangement, because the only thing the scene knew was which noun came
// first.
//
// The missing layer is not another primitive and not another mode. It is
// that a scene has ENTITIES and RELATIONS, and the relation has a
// VISUAL CONSEQUENCE that is independent of what the entities are.
//
//     PROSE
//        ↓
//     SEMANTIC SCENE          entities + relations        ← this file
//        ↓
//     REPRESENTATION          which lens is taken
//        ↓
//     SCENE GRAPH             elements at places, in depth
//        ↓
//     GRAMMAR → PRIMITIVES → FRAME
//
// THE SMALLEST GENERAL RELATIONAL VOCABULARY. Seven consequences, chosen
// because each one is a different ARRANGEMENT rather than a different
// subject, and every one of them is reusable across completely unrelated
// prose:
//
//     OBSERVES    one oriented toward another, across distance
//     CONTAINS    one inside another's bounds
//     BECOMES     one turning into another
//     OPPOSES     two held apart, in contrast
//     ACCUMULATES many of one, gathering
//     CONNECTS    two joined by something drawn
//     EMERGES     one coming out of another
//     REVEALS     one seen THROUGH an opening in another
//     CONCEALS    one hidden BEHIND another, with no opening
//     APPROACHES  the distance between two things closing
//     DEPARTS     the distance opening
//
// APPROACHES and DEPARTS were added BY THE PAIRED TEST SUITE, which is
// the point of it: "the camera approached the door" and "the camera
// moved away from the door" both fell through to CONNECTS, so the system
// had no way to say that proximity itself was the event. Two sentences
// with opposite meanings produced one scene, and nothing downstream could
// have recovered the difference.
//
// There is no `watches` and no `surveils`. "Watched", "monitored",
// "recorded", "inspected" and "photographed" all mean OBSERVES for
// compositional purposes, and the difference between them belongs to the
// prose rather than to the picture. That is what stops this becoming a
// verb lexicon the way `subject.ts` became a noun lexicon.

import type { Relation } from "./relation.ts";
import type { DetectedSubject } from "./subject.ts";

export type RelationKind =
  | "OBSERVES"
  | "CONTAINS"
  | "BECOMES"
  | "OPPOSES"
  | "ACCUMULATES"
  | "CONNECTS"
  | "EMERGES"
  | "REVEALS"
  | "CONCEALS"
  | "APPROACHES"
  | "DEPARTS";

export interface SceneEntity {
  /** The word the prose used. Carried for typography, never as a key. */
  text: string;
  /** How much of the frame this entity is entitled to, 0..1. */
  weight: number;
  /** How many of it there are, when the prose said. */
  count: number | null;
}

export interface SemanticRelation {
  kind: RelationKind;
  /** Indices into `entities`. Direction matters: OBSERVES(0→1) and
   *  OBSERVES(1→0) are different films. */
  from: number;
  to: number;
  /** The verbatim words that produced this reading, so the claim is
   *  checkable against the prose exactly like a figure. */
  because: string;
}

export interface SemanticScene {
  entities: SceneEntity[];
  relations: SemanticRelation[];
  /** True when the sentence DENIES something — "memory was never
   *  storage". Negation is a visual event in its own right and the system
   *  had no way to say it. */
  negated: boolean;
  describes: string;
}

/* WHAT AN ACTION DOES, COMPOSITIONALLY.
 *
 * Matched on the verbatim action span the relation reader already
 * extracted, so nothing here re-parses the sentence. Ordered: the first
 * match wins, and the fallthrough is CONNECTS because two named things
 * in one sentence are at minimum related. */
const CONSEQUENCE: Array<[RegExp, RelationKind]> = [
  [
    /\b(watch|watche[ds]|monitor|monitored|record|recorded|observe[ds]?|survey|surveilled|inspect|inspected|photograph|photographed|film|filmed|track|tracked)\b/i,
    "OBSERVES",
  ],
  [
    /\b(contain|contained|hold|held|house[ds]?|enclose[ds]?|surround|surrounded|inside|within|cover|covered)\b/i,
    "CONTAINS",
  ],
  [
    /\b(becam|become[s]?|turn|turned|transform|transformed|made into|grew into|was never|is never|replace[ds]?)\b/i,
    "BECOMES",
  ],
  [
    /\b(against|oppose[ds]?|resist|resisted|refus|contradict|contradicted|but|versus|rather than|instead of)\b/i,
    "OPPOSES",
  ],
  [
    /\b(accumulat|gather|gathered|pile|piled|collect|collected|amass|multiplied|spread|grew)\b/i,
    "ACCUMULATES",
  ],
  // Proximity before connection: "moved toward" is a connection too, and
  // the closing of distance is the more specific reading.
  [
    /\b(approach|approached|toward|towards|closer|nearer|arriv(?:ed|ing) at|converg)\b/i,
    "APPROACHES",
  ],
  [
    /\b(moved away|away from|receded|withdrew|retreat|depart|left|further from|diverg)\b/i,
    "DEPARTS",
  ],
  [
    /\b(reveal|revealed|expose[ds]?|uncover|uncovered|disclos|show(?:ed|s)? through|through)\b/i,
    "REVEALS",
  ],
  [
    /\b(conceal|concealed|hid|hidden|obscur|cover(?:ed)? up|behind|buried|withheld|redact)\b/i,
    "CONCEALS",
  ],
  [/\b(emerg|arriv|appear|came out|rose|surfac|issued|arose)\b/i, "EMERGES"],
  [
    /\b(carr|carried|connect|connected|link|linked|join|joined|sent|deliver|delivered|between)\b/i,
    "CONNECTS",
  ],
];

const NEGATION = /\b(never|not|no longer|nothing|without|failed to|neither|nor|un[a-z]+ed)\b/i;

function entityFrom(s: DetectedSubject | null, count: number | null): SceneEntity | null {
  if (!s) return null;
  return { text: s.text, weight: s.weight, count };
}

/** READ THE SCENE. Everything here comes from the deterministic readers
 *  that already exist — the relation, the subjects, the figures — so this
 *  adds no model call and nothing it claims is unverifiable against the
 *  prose. */
export function readScene(
  sentence: string,
  subjects: DetectedSubject[],
  relation: Relation | null | undefined,
  count: number | null,
): SemanticScene {
  const negated = NEGATION.test(sentence);
  const entities: SceneEntity[] = [];
  const relations: SemanticRelation[] = [];

  if (relation?.agent && relation.patient) {
    // DIRECTION IS THE WHOLE POINT. `topic` is what the sentence is
    // ABOUT, which a passive puts in front — so the entity order follows
    // the topic and the relation direction follows the agency. "The city
    // watched its residents" and "the residents watched the city" now
    // differ in both.
    const a = entityFrom(relation.agent, null);
    const b = entityFrom(relation.patient, count);
    if (a && b) {
      const topicIsPatient = relation.topic?.text === relation.patient.text;
      // The thing the sentence is about is entitled to more frame.
      if (topicIsPatient) {
        b.weight = Math.min(1, b.weight * 1.25);
      } else {
        a.weight = Math.min(1, a.weight * 1.25);
      }
      entities.push(a, b);
      let kind: RelationKind = "CONNECTS";
      let because = relation.action;
      for (const [re, k] of CONSEQUENCE) {
        if (re.test(relation.action) || re.test(sentence)) {
          kind = k;
          because = (relation.action.match(re) ?? sentence.match(re))?.[0] ?? relation.action;
          break;
        }
      }
      relations.push({ kind, from: 0, to: 1, because });
    }
  }

  // No relation, but the prose counted something: that is an
  // ACCUMULATION of one entity, which is a scene even without a second.
  if (entities.length === 0) {
    const first = subjects[0];
    if (first) entities.push({ text: first.text, weight: first.weight, count });
    if (count !== null && count > 12 && entities[0]) {
      relations.push({
        kind: "ACCUMULATES",
        from: 0,
        to: 0,
        because: `the prose printed ${count}`,
      });
    }
  }

  const rel = relations[0];
  return {
    entities,
    relations,
    negated,
    describes: rel
      ? `${entities[rel.from]?.text ?? "?"} ${rel.kind} ${entities[rel.to]?.text ?? "itself"}${negated ? " — denied" : ""}`
      : entities.length
        ? `${entities[0]?.text}, alone${negated ? " — denied" : ""}`
        : "nothing named",
  };
}

/* ── WHAT A RELATION DOES TO A COMPOSITION ────────────────────────────
 *
 * The translation point, and deliberately the ONLY one: a relation kind
 * becomes an arrangement, and nothing downstream consults the verb, the
 * noun or the sentence again. This is the table that makes "the city
 * watched its residents" a different picture from "the residents watched
 * the city" without either phrase appearing anywhere in it.
 *
 * Positions are fractions of the frame. `sight` says whether the two
 * entities should be joined by something drawn between them. */
export interface Arrangement {
  /** Where the FROM entity sits, and how much frame it takes. */
  from: { x: number; y: number; scale: number };
  /** Where the TO entity sits. */
  to: { x: number; y: number; scale: number };
  /** Draw a connection between them. */
  sight: boolean;
  /** The TO entity is repeated into a field rather than drawn once. */
  field: boolean;
  /** The TO entity sits inside the FROM entity's bounds. */
  nested: boolean;
  why: string;
}

export function arrange(kind: RelationKind, negated: boolean): Arrangement {
  const A: Record<RelationKind, Arrangement> = {
    // One thing large and high, the other small and low and far off —
    // and a line between them. Asymmetry IS the relation here: an
    // observer that is the same size as what it observes is a pair.
    OBSERVES: {
      from: { x: 0.26, y: 0.28, scale: 0.62 },
      to: { x: 0.74, y: 0.72, scale: 0.2 },
      sight: true,
      field: true,
      nested: false,
      why: "one above and apart, many below, and a line of sight between them",
    },
    CONTAINS: {
      from: { x: 0.5, y: 0.5, scale: 1.05 },
      to: { x: 0.5, y: 0.54, scale: 0.3 },
      sight: false,
      field: false,
      nested: true,
      why: "one inside the other's bounds",
    },
    // Two states of the same thing, left and right, with the crossing
    // drawn. Negation splits them further and removes the join.
    BECOMES: {
      from: { x: 0.28, y: 0.5, scale: 0.44 },
      to: { x: 0.72, y: 0.5, scale: 0.44 },
      sight: !negated,
      field: false,
      nested: false,
      why: "two states of one thing, and the crossing between them",
    },
    OPPOSES: {
      from: { x: 0.22, y: 0.42, scale: 0.5 },
      to: { x: 0.78, y: 0.58, scale: 0.5 },
      sight: false,
      field: false,
      nested: false,
      why: "held apart, equal, refusing each other",
    },
    ACCUMULATES: {
      from: { x: 0.5, y: 0.5, scale: 0.3 },
      to: { x: 0.5, y: 0.5, scale: 1.2 },
      sight: false,
      field: true,
      nested: false,
      why: "many of it, gathering across the frame",
    },
    CONNECTS: {
      from: { x: 0.3, y: 0.38, scale: 0.42 },
      to: { x: 0.7, y: 0.62, scale: 0.42 },
      sight: true,
      field: false,
      nested: false,
      why: "two things, and what runs between them",
    },
    /* AN APERTURE IS A RELATION, NOT A SHAPE. The TO entity sits behind
     * and is seen only through the opening the FROM entity carries; the
     * FROM entity fills the frame because a surface that does not cover
     * anything conceals nothing. A window, a doorway, a screen and a
     * redaction are all this arrangement at different sizes. */
    REVEALS: {
      from: { x: 0.5, y: 0.5, scale: 1.4 },
      to: { x: 0.5, y: 0.5, scale: 0.8 },
      sight: false,
      field: false,
      nested: true,
      why: "one seen through an opening in the other",
    },
    // The same arrangement with the opening closed to a slit: something
    // is behind, and the sentence declines to show it.
    CONCEALS: {
      from: { x: 0.5, y: 0.5, scale: 1.6 },
      to: { x: 0.5, y: 0.52, scale: 0.5 },
      sight: false,
      field: false,
      nested: true,
      why: "one behind the other, and mostly withheld",
    },
    /* PROXIMITY IS THE EVENT. Two things near each other with a great
     * deal of frame outside them: the composition is about the gap. The
     * departing pair sits at the edges with the gap in the middle, which
     * is the same relation read the other way. */
    APPROACHES: {
      from: { x: 0.42, y: 0.5, scale: 0.4 },
      to: { x: 0.58, y: 0.5, scale: 0.4 },
      sight: false,
      field: false,
      nested: false,
      why: "two things close together, the space around them empty",
    },
    DEPARTS: {
      from: { x: 0.14, y: 0.5, scale: 0.36 },
      to: { x: 0.86, y: 0.5, scale: 0.36 },
      sight: false,
      field: false,
      nested: false,
      why: "two things at opposite edges, the gap between them the subject",
    },
    EMERGES: {
      from: { x: 0.5, y: 0.78, scale: 0.9 },
      to: { x: 0.5, y: 0.34, scale: 0.34 },
      sight: false,
      field: false,
      nested: false,
      why: "one coming up out of the other",
    },
  };
  const base = A[kind];
  // NEGATION IS A VISUAL EVENT. A denied relation is drawn as the
  // relation with its join broken and its terms pushed apart, which is
  // legible as a refusal rather than as an absence.
  if (!negated) return base;
  return {
    ...base,
    sight: false,
    from: { ...base.from, x: base.from.x - 0.08 },
    to: { ...base.to, x: base.to.x + 0.08 },
    why: `${base.why} — denied, so the join is broken and the terms pushed apart`,
  };
}
