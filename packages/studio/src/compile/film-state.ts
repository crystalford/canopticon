// FILM CONTINUITY — what survives from one scene into the next.
//
// The distinction this file exists for, and it is not a shade of the
// last one:
//
//     SCENE CHOREOGRAPHY   how one scene changes over its own duration
//     FILM CONTINUITY      what carries ACROSS scenes
//
// The temporal grammar proved the first. It could not express the second
// at all: every scene composed from nothing, a move ended where it began,
// and a film was a sequence of independent animations. So `REVERSE`
// existed as a move with nothing to reverse, and "the residents watched
// the city" built a fresh picture instead of turning the one the film had
// already established.
//
// A FILM HAS A STATE. Elements have IDENTITY — the entity they depict —
// and identity is what persists. The state is carried scene to scene and
// each new semantic event decides, per identity, what happens to it:
//
//     CONTINUE    it is still here, unchanged
//     TRANSFORM   it is still here and its relation moved it
//     ACCUMULATE  there is more of it than there was
//     SPLIT       it becomes several
//     MERGE       several become it
//     ENTER       it was not here and now is
//     EXIT        it was here and now is not
//     RECALL      it left, and the film is bringing it back
//
// And one more, which is the idea that makes this a grammar rather than
// a persistence mechanism:
//
//     CUT         continuity is REFUSED, and that refusal is a decision
//
// A cut is not the absence of continuity. It is an operation with the
// same standing as the others, chosen when the film has changed subject
// enough that carrying the old state forward would be a lie about the
// argument. Which means a ONE-SHOT FILM needs no separate engine: forbid
// CUT and the grammar must solve the whole essay through persistence,
// transformation and recall. That is a constraint on this vocabulary, not
// a second system.

import type { Act } from "./act.ts";
import type { Element } from "./scene-graph.ts";
import type { SemanticScene } from "./semantic-scene.ts";

export type Continuity =
  | "CONTINUE"
  | "TRANSFORM"
  | "ACCUMULATE"
  | "SPLIT"
  | "MERGE"
  | "ENTER"
  | "EXIT"
  | "RECALL"
  | "CUT";

/** An element with an identity and a history. The identity is the entity
 *  the prose named, lowercased — never a primitive, never a picture, so
 *  the same thing can be depicted six different ways across a film and
 *  still be recognisably the same thing. */
export interface Persistent {
  identity: string;
  element: Element;
  /** Scene index it first appeared in. */
  bornAt: number;
  /** Scene index it was last present in. */
  lastSeen: number;
  /** How many of it the film currently holds. Grows under ACCUMULATE. */
  multiplicity: number;
}

export interface FilmState {
  alive: Persistent[];
  /** Left the frame but not the film. RECALL brings one back, and a
   *  film that could not do this would have no memory — only a present
   *  tense. */
  retired: Persistent[];
  sceneIndex: number;
}

export interface Decision {
  identity: string;
  what: Continuity;
  why: string;
}

export interface Advance {
  state: FilmState;
  decisions: Decision[];
  /** True when the film cut. Everything alive was retired. */
  cut: boolean;
  describes: string;
  /* WHAT TO DRAW. The persistent elements in their inherited places,
   * plus the incoming scene's SCENERY — the ground, the words, the
   * surface, the line between two things. None of those depicts an
   * entity, so none of them persists; they are recomposed every scene,
   * which is correct, because a ground is not a character.
   *
   * This exists because the consumer had to reassemble it and the
   * obvious way to do that was wrong: `present(state)` alone returns only
   * what the film is holding, so every rendered one-shot state came back
   * as one faint outline on empty ground with the composition stripped
   * out of it. One authority, one list. */
  elements: Element[];
}

export const EMPTY_FILM: FilmState = { alive: [], retired: [], sceneIndex: 0 };

/** How the film is allowed to move between scenes.
 *
 *  `allowCut: false` is the one-shot: the film may never discard its
 *  state, so every semantic change has to be solved by moving, morphing
 *  or recalling what is already there. It is a constraint on this
 *  vocabulary rather than a different renderer. */
export interface ContinuityRules {
  allowCut: boolean;
  /** How many scenes an identity may be absent before RECALL rather than
   *  ENTER is the honest description of its return. */
  memory: number;
}

export const DEFAULT_RULES: ContinuityRules = { allowCut: true, memory: 8 };

/** WHAT THE SCENE SAID, read without the noun lexicon.
 *
 *  Both fields exist because this file's two inputs — `sem.entities` and
 *  `sem.relations` — are lexicon-derived, and an essay of ideas satisfies
 *  neither. Nothing here is required: a film whose prose names things
 *  behaves exactly as it did. */
export interface ContinuityRead {
  /** What kind of change this moment is. See `act.ts`. */
  act?: Act | undefined;
  /** An identity to carry when the prose named nothing — the author's own
   *  paragraph. Not a noun and not offered as one. */
  subject?: string | undefined;
}

const norm = (s: string) => s.trim().toLowerCase();

/** ADVANCE THE FILM ONE SCENE.
 *
 *  Takes the state the film is in and the semantic event that just
 *  happened, and decides what becomes of every identity. Nothing here
 *  looks at a primitive or a picture — continuity is a fact about
 *  entities, so it survives a change of representation. A film can move
 *  from literal to diagrammatic between two scenes and the same city is
 *  still the same city. */
export function advance(
  state: FilmState,
  sem: SemanticScene,
  elements: Element[],
  rules: ContinuityRules = DEFAULT_RULES,
  read: ContinuityRead = {},
): Advance {
  const i = state.sceneIndex + 1;
  const decisions: Decision[] = [];
  /* WHAT THE FILM IS CARRYING.
   *
   * `sem.entities` is the noun lexicon's reading, so on an essay of ideas
   * it is EMPTY — which meant this loop never ran, nothing ever persisted,
   * and the whole continuity model was inert on the material the system
   * exists for. Every decision below it was unreachable.
   *
   * So the film also carries the PASSAGE: the author's own paragraph,
   * already on every scene. It is not a noun and does not pretend to be
   * one — it says "the picture for this idea", which is exactly the
   * continuity an argument has.
   *
   * ALWAYS, not as a fallback. The first version added it only when the
   * prose named nothing, and that put two identity spaces in one film:
   * an abstract scene carried `passage 001`, the next sentence happened to
   * name something and carried that instead, the two shared nothing, and
   * the film CUT. Measured: 29 cuts across 20 paragraphs, most of them
   * inside a paragraph, on an essay that changes subject twenty times.
   *
   * Carried always, the rule falls out clean: THE FILM CUTS WHERE THE
   * AUTHOR STARTED A NEW PARAGRAPH. Anything the prose names is a figure
   * on top of that ground and persists on its own terms. */
  const named = sem.entities.map((e) => norm(e.text)).filter(Boolean);
  if (read.subject) named.push(norm(read.subject));

  /* WHICH ELEMENT DEPICTS WHICH ENTITY.
   *
   * This was `elements[k]` — the k-th named entity paired with the k-th
   * element of a list SORTED BY DEPTH. So the first entity in every
   * sentence was matched to the GROUND, the second to the field behind
   * it, and every element past the entity count was silently dropped
   * from the film. The types were satisfied, the continuity suite passed
   * (it asserted on decisions and places, never on what was left to
   * draw), and it took rendering seventeen one-shot states and looking
   * at them to see that a five-element scene had become one outline.
   *
   * Elements now say what they stand for. An entity with no element that
   * claims it falls back to the most prominent unclaimed one, so a
   * lexicon miss degrades rather than mispairing.
   *
   * AND THE FALLBACK IS CONSUMED. It used to return `unclaimed[0]` every
   * time, so two identities with no element of their own were handed the
   * SAME element — which was survivable while only a lexicon miss reached
   * it and is not now that every scene carries a passage. Each identity
   * takes the most prominent element still going, and an identity with
   * nothing left gets nothing rather than a duplicate. */
  const unclaimed = elements
    .filter((e) => !e.depicts)
    .sort((a, b) => (b.emphasis ?? 0) - (a.emphasis ?? 0));
  let taken = 0;
  const elementFor = (identity: string): Element | undefined =>
    elements.find((e) => e.depicts === identity) ?? unclaimed[taken++];
  /** The composition around the entities — recomposed each scene. */
  const scenery = elements.filter((e) => !e.depicts || !named.includes(e.depicts));

  /* THE CUT, AS A DECISION.
   *
   * Taken when the new scene shares NO identity with what is on screen
   * and the film has something on screen to lose. Carrying a state
   * forward through a complete change of subject would be a lie about the
   * argument — the film would be claiming a continuity the prose does not
   * have. Forbidden outright in one-shot mode, where the grammar must
   * solve the change some other way. */
  /* A FILM THAT REMEMBERS SOMETHING HAS NOT CHANGED SUBJECT.
   *
   * This tested only what was ON SCREEN, so "the city forgot its
   * residents" cut — five scenes after the city was established and
   * three after it left — and then re-introduced both as strangers. A
   * return is the opposite of a change of subject. The retired set is
   * the film's memory and it counts. */
  const shares = named.some(
    (n) =>
      state.alive.some((p) => p.identity === n) ||
      state.retired.some((p) => p.identity === n && i - p.lastSeen <= rules.memory),
  );
  if (rules.allowCut && state.alive.length > 0 && named.length > 0 && !shares) {
    for (const p of state.alive)
      decisions.push({
        identity: p.identity,
        what: "CUT",
        why: "the film changed subject entirely",
      });
    const retired = [
      ...state.retired,
      ...state.alive.map((p) => ({ ...p, lastSeen: state.sceneIndex })),
    ];
    const alive = named
      .map((identity) => {
        const el = elementFor(identity);
        return el ? { identity, element: el, bornAt: i, lastSeen: i, multiplicity: 1 } : null;
      })
      .filter((p): p is Persistent => p !== null);
    for (const a of alive)
      decisions.push({ identity: a.identity, what: "ENTER", why: "after the cut" });
    return {
      state: { alive, retired, sceneIndex: i },
      decisions,
      cut: true,
      describes: `CUT — ${named.join(", ") || "nothing"} replaces what was there`,
      elements: draw(alive, scenery),
    };
  }

  const alive: Persistent[] = [];
  const stillRetired = [...state.retired];
  /* WHAT HAPPENS TO WHAT IS ALREADY HERE.
   *
   * These read `sem.relations`, which needs TWO lexicon-known nouns
   * (`semantic-scene.ts` requires `relation.agent && relation.patient`).
   * On abstract prose that array is empty, so both were permanently false
   * and every persisting identity got CONTINUE — the machinery was real
   * and was being starved of input.
   *
   * The ACT is the same reading taken from what the sentence DOES rather
   * than from what it names, so it needs no lexicon and it is available on
   * every scene. The relation stays where it exists, because two named
   * things is a more specific reading than a verb over a whole sentence;
   * it simply stops being the gate. */
  const accumulating =
    sem.relations.some((r) => r.kind === "ACCUMULATES") || read.act === "ACCUMULATE";
  const transforming =
    sem.relations.some((r) => r.kind === "BECOMES" || r.kind === "EMERGES") ||
    read.act === "TRANSFORM";

  for (const identity of named) {
    const el = elementFor(identity);
    if (!el) continue;
    const held = state.alive.find((p) => p.identity === identity);
    if (held) {
      // STILL HERE. Whether it merely continues or is transformed depends
      // on what the sentence did to it — the relation decides, not a
      // preference.
      const what: Continuity = accumulating
        ? "ACCUMULATE"
        : transforming
          ? "TRANSFORM"
          : "CONTINUE";
      decisions.push({
        identity,
        what,
        why:
          what === "ACCUMULATE"
            ? "there is more of it than there was"
            : what === "TRANSFORM"
              ? "the sentence changed what it is"
              : "still here, unchanged",
      });
      alive.push({
        ...held,
        // THE PLACE IS INHERITED, and only the parts the new arrangement
        // genuinely moves are taken from it. This is the whole of
        // continuity: a thing that persists does not jump to wherever the
        // new scene would have put it if it were arriving fresh.
        element: {
          ...el,
          place: {
            ...el.place,
            x: what === "CONTINUE" ? held.element.place.x : (held.element.place.x + el.place.x) / 2,
            y: what === "CONTINUE" ? held.element.place.y : (held.element.place.y + el.place.y) / 2,
            scale:
              what === "ACCUMULATE"
                ? Math.min(4, held.element.place.scale * 1.35)
                : (held.element.place.scale + el.place.scale) / 2,
          },
        },
        lastSeen: i,
        multiplicity: what === "ACCUMULATE" ? held.multiplicity + 1 : held.multiplicity,
      });
      continue;
    }
    // NOT HERE. Is the film remembering it, or meeting it?
    const rememberedAt = stillRetired.findIndex(
      (p) => p.identity === identity && i - p.lastSeen <= rules.memory,
    );
    if (rememberedAt >= 0) {
      const was = stillRetired.splice(rememberedAt, 1)[0] as Persistent;
      decisions.push({
        identity,
        what: "RECALL",
        why: `established in scene ${was.bornAt}, absent since ${was.lastSeen}`,
      });
      // It comes back where it WAS, then moves toward where it is needed —
      // which is what makes a recall read as a return rather than as a
      // new arrival that happens to share a name.
      alive.push({
        ...was,
        element: {
          ...el,
          place: {
            ...el.place,
            x: (was.element.place.x * 2 + el.place.x) / 3,
            y: (was.element.place.y * 2 + el.place.y) / 3,
          },
        },
        lastSeen: i,
      });
      continue;
    }
    decisions.push({ identity, what: "ENTER", why: "the film has not seen it before" });
    alive.push({ identity, element: el, bornAt: i, lastSeen: i, multiplicity: 1 });
  }

  // WHAT LEFT. Retired rather than deleted, because the film may want it
  // again and a film that forgets cannot recall.
  const retired = [...stillRetired];
  for (const p of state.alive) {
    if (alive.some((a) => a.identity === p.identity)) continue;
    decisions.push({
      identity: p.identity,
      what: "EXIT",
      why: "the sentence stopped being about it",
    });
    retired.push({ ...p, lastSeen: state.sceneIndex });
  }

  const counts = decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.what] = (acc[d.what] ?? 0) + 1;
    return acc;
  }, {});
  return {
    state: { alive, retired, sceneIndex: i },
    decisions,
    cut: false,
    describes:
      Object.entries(counts)
        .map(([k, v]) => `${v}×${k}`)
        .join(" · ") || "nothing carried",
    elements: draw(alive, scenery),
  };
}

/** THE FILM RESTS FOR A SCENE.
 *
 *  A scene the allocator decided is SILENT never reaches `advance` — it
 *  returns early, before the world block, with no elements. So the film
 *  did not age: `sceneIndex` stayed where it was, `lastSeen` did not move
 *  further away, and every RECALL window silently extended by the length
 *  of the silence. A film that fell quiet for four scenes would then treat
 *  a twelve-scene-old identity as eight scenes old and call its return a
 *  recall rather than an entrance.
 *
 *  This is the correct behaviour stated explicitly: time passes, nothing
 *  enters, nothing leaves. Silence does not clear the world — but it is
 *  not a pause in the film's clock either. */
export function rest(state: FilmState): FilmState {
  return { ...state, sceneIndex: state.sceneIndex + 1 };
}

/** The elements the film currently holds, far to near. What PERSISTS —
 *  not what to render, which also needs the scene's own composition
 *  around it. Use `Advance.elements` for that. */
export function present(state: FilmState): Element[] {
  return [...state.alive].sort((a, b) => a.element.depth - b.element.depth).map((p) => p.element);
}

/** Assemble the frame: what the film is carrying, plus the composition
 *  it is carried in, ordered far to near. */
function draw(alive: Persistent[], scenery: Element[]): Element[] {
  return [...alive.map((p) => p.element), ...scenery].sort((a, b) => a.depth - b.depth);
}
