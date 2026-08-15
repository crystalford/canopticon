// THE VISUAL STRATEGIST — one medium per moment, decided before any
// primitive or construction is chosen.
//
// The question this file answers is "what visual experience should happen
// here", not "what object represents this concept". Every fix tried before
// this one — a richer primitive palette, a persistent world engine — left
// that second question in charge and produced the same aesthetic wearing
// better bookkeeping. This is the first thing in the compiler that decides
// a MEDIUM as its own, standalone act, with real authority over the frame
// once it does.
//
// It does not invent a new vocabulary to choose from. `language.ts`'s
// seven grammars already ARE seven media — TYPOGRAPHIC, GEOMETRIC,
// DIAGRAMMATIC, COMPUTATIONAL, MATERIAL, SIGNAL, ILLUSTRATIVE — real,
// working code that was previously wired in DILUTED, competing at a
// deliberately suppressed weight inside `constructPrograms` so it could
// never actually win (see `construct.ts`'s `LANGUAGE DISPATCH` block).
// This file is what gives that vocabulary its intended authority: a
// language chosen here is realised at FULL strength, not as one more
// diluted candidate.
//
// GENERATED — a frozen, authoring-time image asset composited as visual
// material — is the eighth medium and is named here honestly before it is
// built: eligible only once a beat carries a reference to an
// already-generated asset (added in a later phase), never resolved by
// calling a model from inside this — or any — compile-time function.

import type { VisualLanguage } from "../ir/schema.ts";
import type { Style } from "./construct.ts";
import {
  GRAMMARS,
  LANGUAGE_IDS,
  type LangContext,
  type LanguageBuild,
  type LanguageId,
  chainFor,
} from "./language.ts";
import type { VisualIntent } from "./visual-intent.ts";

export type Medium = LanguageId | "GENERATED";

interface MediumCandidate {
  medium: Medium;
  built: LanguageBuild | null;
  score: number;
  why: string;
}

export interface StrategyChoice {
  medium: Medium;
  why: string;
  /** Non-null only for a language medium with real content for this beat.
   *  Null for ILLUSTRATIVE (routes to `CONSTRUCTIONS` instead) and for
   *  GENERATED (routes to a frozen asset instead). */
  built: LanguageBuild | null;
  alternatives: { medium: Medium; why: string }[];
}

/** Which creative-state dial(s) each medium is FOR — a real, checkable
 *  bias read off the same `Style` every other decision in this compiler
 *  reads, not a guess layered on top of it. Matches each grammar's own
 *  `argument` string in `language.ts`. ILLUSTRATIVE's own affinity is
 *  `human` — the object world is for scenes about people and things,
 *  which is exactly what it already draws. */
const AFFINITY: Record<LanguageId, (s: Style) => number> = {
  TYPOGRAPHIC: (s) => s.typography,
  GEOMETRIC: (s) => (1 - s.human) * 0.5 + s.experimentalism * 0.5,
  DIAGRAMMATIC: (s) => s.data,
  COMPUTATIONAL: (s) => s.abstraction * 0.5 + s.energy * 0.3,
  MATERIAL: (s) => s.archival,
  SIGNAL: (s) => s.abstraction * 0.6 + s.experimentalism * 0.4,
  ILLUSTRATIVE: (s) => s.human,
};

/** The film's own declared `VisualLanguage` (documentary/technical/pixel/
 *  surreal/kinetic — an authored, film-level constraint, `construct.ts`'s
 *  `style.language`) leans the medium choice toward the reading that
 *  language is FOR. A small bonus, not a lock: `documentary` still leans
 *  MATERIAL/ILLUSTRATIVE, `pixel` still leans COMPUTATIONAL/SIGNAL,
 *  `kinetic` still leans TYPOGRAPHIC — but the beat's own dial values from
 *  `AFFINITY` above can still override it when they say something more
 *  specific about this particular moment. */
const LANGUAGE_LEAN: Record<VisualLanguage, Partial<Record<LanguageId, number>>> = {
  documentary: { MATERIAL: 0.5, ILLUSTRATIVE: 0.3 },
  technical: { DIAGRAMMATIC: 0.5, COMPUTATIONAL: 0.3 },
  pixel: { COMPUTATIONAL: 0.5, SIGNAL: 0.3 },
  surreal: { SIGNAL: 0.5, GEOMETRIC: 0.3 },
  kinetic: { TYPOGRAPHIC: 0.5, GEOMETRIC: 0.25 },
};

/** Choose one medium for this beat. Pure and deterministic — same beat,
 *  same style, same choice, every time; nothing here reads a clock or a
 *  random source. */
export function chooseMedium(ctx: LangContext, style: Style, vi: VisualIntent): StrategyChoice {
  const candidates: MediumCandidate[] = [];

  for (const id of LANGUAGE_IDS) {
    if (id === "ILLUSTRATIVE") {
      candidates.push({
        medium: id,
        built: null,
        score: AFFINITY.ILLUSTRATIVE(style),
        why: GRAMMARS.ILLUSTRATIVE.argument,
      });
      continue;
    }
    const built = chainFor(id, ctx);
    // A real "I have nothing to say about this beat" — not scored, not
    // penalised, simply absent from the competition. Declining is a real
    // answer; see `language.ts`'s own header.
    if (!built) continue;
    if (vi.intervention === "TEXT" && !built.layers.some((l) => l.role === "words")) continue;
    // DISLOCATION WIDENS WHAT'S REACHABLE, THE SAME DISCIPLINE
    // `constructPrograms`'s OWN APPETITE DISCOUNT USES. A director asking
    // to go against the grain makes a less-obvious medium plausible; it
    // never makes the obvious one unreachable — the floor term keeps every
    // eligible medium in play regardless of how the affinity term lands.
    const affinity = AFFINITY[id](style) + (LANGUAGE_LEAN[style.language]?.[id] ?? 0);
    const score = affinity * (1 - vi.dislocation * 0.3) + vi.dislocation * 0.3;
    candidates.push({ medium: id, built, score, why: GRAMMARS[id].argument });
  }

  // GENERATED: named, not reachable yet. `Beat` carries no asset
  // reference today — a later phase adds one, populated only by a frozen,
  // authoring-time image call (see `src/generate/image.ts`, not yet
  // built). Nothing here ever calls a model.

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) {
    return {
      medium: "ILLUSTRATIVE",
      why: "no medium had anything real to say about this beat — the object world is the honest fallback",
      built: null,
      alternatives: [],
    };
  }
  return {
    medium: winner.medium,
    why: winner.why,
    built: winner.built,
    alternatives: candidates.slice(1, 4).map((c) => ({ medium: c.medium, why: c.why })),
  };
}
