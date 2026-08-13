// THE SCENE PLAN — a shot is several things at once, not one thing.
//
// THE MEASUREMENT THAT PRODUCED THIS FILE.
//
//   "They walked around the city like insects. At first nobody noticed.
//    Then there were dozens of them, moving through the streets in strange
//    synchronized waves."
//
// Compiled, that paragraph accounted for five of eight semantic facts. The
// five it got were real and were not noun associations — count 1 → 12,
// scale 0.53 → 0.22, speed 0.45 → 0.65, wander 0.30 → 0.16, that last one
// being "synchronized" expressed as the ABSENCE of wander.
//
// The three it missed were CITY, STREETS and the temporal turn. And the
// diagnosis that mattered: **city and streets were both DETECTED and both
// lost.** Not misread — outranked. A scene built exactly one construction,
// so the setting always lost to the subject, every time, by design.
//
// So this is not a semantics fix. The sentence was understood. This is the
// renderer being unable to hold an environment AND its agents at once.
//
// A PLANE IS A SEMANTIC ROLE, NOT A CANVAS LAYER.
//
// That distinction is the whole design. "Another layer" would be a
// rendering convenience; a ROLE is a claim about what the shot contains and
// why, which is what lets the same scene plan produce genuinely different
// compositions:
//
//   environment dominant  the city is legible, the people are small
//   subject dominant      the people fill the frame, the city is context
//   metaphor dominant     the insect reading overwhelms the literal one
//
// Those are five directorial interpretations of ONE scene graph, not five
// parameter variations — which is the same distinction `construct.ts` drew
// between candidates and effects, one level up.

import type { Beat, Style } from "./construct.ts";
import type { DetectedSubject } from "./subject.ts";

/** What a plane is FOR. Ordered far to near, and the order is the default
 *  depth order — a setting sits behind its subject because that is what a
 *  setting is, not because a layer index said so. */
export type PlaneRole =
  /** Where this happens. A place noun the sentence named. */
  | "SETTING"
  /** What the sentence is about. */
  | "SUBJECT"
  /** What the subject is being compared to — a simile, held as its own
   *  plane so the literal and the figurative can both be on screen and the
   *  director can weight between them. */
  | "METAPHOR"
  /** What the subject is happening AGAINST — the ordinary world that has
   *  not reacted to it. Never named by the sentence; it enters because the
   *  PROPOSITION requires it, which is the whole test of whether a
   *  proposition is doing work. */
  | "COUNTERPOINT"
  /** The words, when the film puts them on screen. Always nearest. */
  | "EDITORIAL";

export interface Plane {
  role: PlaneRole;
  /** Which construction builds it — an id from `construct.ts`. */
  construction: string;
  /** The noun this plane came from, verbatim, so a plane is checkable
   *  against the prose exactly like a figure or a subject. Null on a plane
   *  the sentence implied rather than named. */
  from: string | null;
  /** 0 far … 1 near. Feeds `parallax_layers`' own depth parameter, which
   *  has always existed and has never had a planner to drive it. */
  depth: number;
  /** How much of the frame this plane is entitled to, 0..1. This is the
   *  dial a director moves to get "environment dominant" versus "subject
   *  dominant" WITHOUT changing what the scene contains. */
  weight: number;
  /** HOW POPULATED THIS LAYER'S WORLD IS, 0..1.
   *
   *  Carried on the plane rather than passed alongside it so that
   *  `applyPlane` keeps one signature and a layer stays a complete
   *  description of itself — and so a future per-plane override has
   *  somewhere to live.
   *
   *  Meaningful only on a plane that depicts a WORLD. A subject's count
   *  comes from the prose ("dozens of them"), and multiplying that by a
   *  director's world dial would be the engine editing the essay's own
   *  numbers — the figure firewall, applied to population. Enforced in
   *  `applyPlane`, which is the only place it is read. */
  population: number;
}

export interface ScenePlan {
  planes: Plane[];
  /** Stated in the report so a director can see the shot was understood as
   *  a composition rather than a single object. */
  why: string;
  /** THE UNSTATED PROPOSITION — what a viewer would construct from the
   *  relationships between these planes, in one sentence, WITHOUT the
   *  narration.
   *
   *  Taken from the Aldershot archive's Pass 3, and it is the sharpest
   *  test in that document: the sentence must not repeat the concept. If
   *  the proposition for a scene about metacognition has to say
   *  "metacognition", the scene is illustrating a noun rather than
   *  composing a claim — the gavel problem, stated as a check you can run.
   *
   *  Deliberately NOT shown in the film and not required to be shown to
   *  the director. It exists so the question "does this composition say
   *  anything without the voiceover" has an answer that can be read and
   *  disagreed with. */
  proposition: string;
}

/** Words that mark a simile — the same closed, grammatical list
 *  `relation.ts` uses to REFUSE a relation. Here it does the opposite job:
 *  a simile is not a relation between two things, it is one thing asking to
 *  be seen as another, which is a plane. */
const SIMILE = /\b(like|as if|as though|resembl\w*)\b/i;

/** THE SENTENCE THAT NAMES NOTHING AND STILL DESCRIBES A PICTURE.
 *
 *  "At first nobody noticed." There is no noun here to build. A noun
 *  reader gets nothing and falls through to typography — which is what
 *  happened, and it is why this sentence was the clearest failure in the
 *  paragraph.
 *
 *  But it describes a frame precisely: something is happening, and the
 *  ordinary world around it is carrying on. That requires the ORDINARY
 *  WORLD to be visible — people facing away, traffic continuing, a street
 *  behaving normally — and none of that is a noun in the sentence.
 *
 *  So this is the test of whether a proposition does any work: if it can
 *  put something in the frame that no noun asked for, the system is
 *  composing a claim. If it cannot, it is a better noun compositor. */
/** The turn — the anomaly stops being background. */
const ESCALATING =
  /\b(then|suddenly|by then|soon)\b[^.]*\b(dozens|hundreds|thousands|more|everywhere|all)\b/i;

/** Exported so `compose.ts` can carry the film's subject into a sentence
 *  that names nothing. "Nobody noticed" is ABOUT the thing that went
 *  unnoticed, but it contains no anaphor, so the ordinary pronoun rule
 *  does not fire and the anomaly never reaches the constructor — planned
 *  and never built. */
export function isUnnoticed(sentence: string): boolean {
  return UNNOTICED.test(sentence);
}

const UNNOTICED =
  /\b(nobody|no one|no-one|none of them|nothing)\b[^.]*\b(notic\w*|saw|see|register\w*|react\w*|question\w*|report\w*|look\w*)\b/i;

/** Does this sentence want more than one plane, and which?
 *
 *  Deliberately conservative. Most sentences name one thing and get one
 *  plane, which is exactly what they got before this file existed — a
 *  single-plane plan is not a regression, it is the same shot with its
 *  composition made explicit. The interesting case is the minority that
 *  name a setting AND a subject, which is where everything was being
 *  thrown away. */
export function planScene(
  beat: Beat,
  style: Style,
  /** What the film was already looking at. A sentence that names nothing
   *  is still ABOUT something, and without this the unnoticed case has no
   *  subject to be unnoticed. */
  carried?: DetectedSubject | null,
  /** WHERE THE FILM ALREADY WAS.
   *
   *  A setting outlives the sentence that named it. "At first nobody
   *  noticed" is still in the city — the prose does not re-establish a
   *  location every sentence, and a compositor that forgets one between
   *  two consecutive scenes is cutting to a different film and back.
   *
   *  This is the same memory mechanism the subject already had, applied to
   *  the other thing a shot is made of. It is not a new semantic role and
   *  it invents nothing: the noun is still verbatim from the prose, just
   *  from an earlier sentence, and it is discounted for being inherited
   *  exactly as a carried subject is. */
  carriedPlace?: DetectedSubject | null,
): ScenePlan {
  const planes: Plane[] = [];
  const subjects = beat.subjects;

  // THE SETTING. A place noun the sentence named, whatever its rank.
  // Previously this lost to the subject and vanished; here it simply sits
  // behind it, which is what a setting does.
  const named = subjects.find((s) => s.kind === "place");
  const inherited =
    !named && carriedPlace && !subjects.some((s) => s.text === carriedPlace.text)
      ? carriedPlace
      : undefined;
  const place = named ?? inherited;
  // THE SUBJECT. The highest-weighted thing that is not the setting.
  const subject = subjects.find((s) => s !== place);

  if (place) {
    planes.push({
      role: "SETTING",
      construction: "space",
      from: place.text,
      depth: 0.15,
      // A setting is entitled to less of the frame than its subject unless
      // the director says otherwise — the sentence is about the people, in
      // a city, not about a city that happens to contain people. An
      // INHERITED setting is quieter still: the film is somewhere it has
      // already established, and re-asserting it at full weight would read
      // as a re-establishing shot the edit did not ask for.
      weight: (subject ? 0.35 : 0.8) * (inherited ? 0.8 : 1),
      population: style.population,
    });
  }

  if (subject) {
    planes.push({
      role: "SUBJECT",
      construction: constructionFor(subject),
      from: subject.text,
      depth: 0.55,
      weight: place ? 0.65 : 0.85,
      population: style.population,
    });
  }

  // THE METAPHOR. "...like insects" is the sentence asking for a second
  // reading of the same subject. Only planned when the prose actually
  // draws the comparison AND names something to compare to — a simile with
  // nothing on the far side of it is not a plane.
  const simile = SIMILE.test(beat.sentence);
  const figurative = simile ? subjects.find((s) => s.kind === "creature") : undefined;
  if (figurative && figurative !== subject) {
    planes.push({
      role: "METAPHOR",
      construction: "body",
      from: figurative.text,
      depth: 0.6,
      // Rises with abstraction: a literal film shows people who move like
      // insects, an abstract one shows the insects.
      weight: 0.25 + style.abstraction * 0.5,
      population: style.population,
    });
  }

  // THE UNNOTICED CASE. The sentence names nothing; the proposition
  // populates the frame anyway.
  //
  // This is the falsifiable claim: a COUNTERPOINT plane enters because the
  // proposition needs an ordinary world for the anomaly to go unregistered
  // AGAINST. No noun in "at first nobody noticed" asked for it.
  const unnoticed = UNNOTICED.test(beat.sentence);
  if (unnoticed) {
    // AN UNNOTICED ANOMALY IS NEVER DOMINANT. Once `compose` began
    // carrying the subject into this sentence, the ordinary SUBJECT branch
    // fired first and claimed 0.85 of the frame — a swarm filling the
    // screen while the narration says nobody saw it. Weight is a claim
    // about salience, so it is corrected here rather than left to whichever
    // branch happened to run.
    const existing = planes.find((pl) => pl.role === "SUBJECT");
    if (existing) existing.weight = 0.3;
    const anomaly = subject ?? carried ?? null;
    if (anomaly && !existing) {
      planes.push({
        role: "SUBJECT",
        construction: constructionFor(anomaly),
        from: anomaly.text,
        depth: 0.55,
        // Small: the whole point is that it has not yet taken the frame.
        weight: 0.3,
        population: style.population,
      });
    }
    planes.push({
      role: "COUNTERPOINT",
      // A place, because "the ordinary world carrying on" IS a setting
      // seen as indifferent rather than as a location.
      construction: "space",
      from: null,
      depth: 0.3,
      // Dominant on purpose. The ordinary world is most of the frame; that
      // is what "nobody noticed" looks like.
      weight: 0.7,
      population: style.population,
    });
  }

  // THE WORDS. Nearest, and only when the film is putting them up.
  if (style.typography > 0.55 && beat.phrase) {
    planes.push({
      role: "EDITORIAL",
      construction: "type",
      from: null,
      depth: 0.92,
      weight: 0.2 + style.typography * 0.25,
      population: style.population,
    });
  }

  // ATTENTION, APPLIED LAST AND TO NOTHING BUT WEIGHT.
  //
  // Every plane is already decided by this point — which roles the scene
  // contains, what builds each one, where each sits in depth. Attention
  // only redistributes the FRAME'S ENTITLEMENT across them.
  //
  // That ordering is the whole argument. `propose()` below is built from
  // roles, so a proposition cannot move when only weights have moved: the
  // same scene at attention 0.1 and 0.9 makes the same claim and makes it
  // two different ways. "Director controls alter expression without
  // altering meaning" is not a hope here, it is a consequence of applying
  // this after the roles are fixed and never before.
  applyAttention(planes, style.attention);

  return {
    planes,
    why: planes.length
      ? planes.map((p) => `${p.role.toLowerCase()}${p.from ? ` (${p.from})` : ""}`).join(" · ")
      : "single plane — the sentence names one thing",
    proposition: propose(planes, ESCALATING.test(beat.sentence)),
  };
}

/** WHERE THE FRAME'S ENTITLEMENT SITS — the second director dimension.
 *
 *  Mutates weights in place and touches nothing else. 0.5 is the identity:
 *  both multipliers are exactly 1, so a film that never sets attention
 *  composes precisely as it did before this function existed.
 *
 *  The floor and ceiling are not cosmetic. A plane driven to zero would
 *  still be BUILT and still cost a frame's worth of time while being
 *  invisible, which is the most expensive way to say nothing; a plane at 1
 *  would erase everything behind it. Attention is a redistribution, and a
 *  redistribution that can annihilate a term is a deletion wearing a
 *  dial. */
function applyAttention(planes: Plane[], attention: number): void {
  if (planes.length < 2) return;
  const a = clamp01(attention);
  // Symmetric about 0.5 and bounded, so the two ends are mirror images of
  // each other rather than one being a stronger move than the other.
  const toSubject = 0.5 + a; // 0.5 … 1.5
  const toWorld = 1.5 - a; // 1.5 … 0.5
  for (const plane of planes) {
    // EDITORIAL is deliberately exempt. The words are neither the subject
    // nor its world — an attention dial that shrank the typography while
    // the director was asking about the city would be reaching a decision
    // nobody made.
    if (plane.role === "EDITORIAL") continue;
    const factor = plane.role === "SUBJECT" || plane.role === "METAPHOR" ? toSubject : toWorld;
    plane.weight = Math.max(0.06, Math.min(0.96, plane.weight * factor));
  }
}

/** What the composition claims, without the narration.
 *
 *  Built from the ROLES rather than from the sentence, which is the whole
 *  point: a proposition assembled by pasting the sentence back together
 *  would prove nothing. This says what the arrangement of planes implies —
 *  a subject inside a setting, a subject seen as something else — and it
 *  is deliberately plain rather than literary, because it is a test
 *  artifact and not a caption.
 *
 *  Deterministic: same planes, same sentence, always. */
function propose(planes: Plane[], escalating: boolean): string {
  const setting = planes.find((p) => p.role === "SETTING");
  const subject = planes.find((p) => p.role === "SUBJECT");
  const metaphor = planes.find((p) => p.role === "METAPHOR");
  const counter = planes.find((p) => p.role === "COUNTERPOINT");

  if (!planes.length) return "nothing is claimed — the sentence names nothing depictable";

  // The counterpoint case states the RELATIONSHIP, which is the whole
  // reason the plane exists. "Insects occupies city" would be a role
  // summary; this is what a viewer would take from the arrangement.
  if (counter) {
    return "Something is happening that does not belong here, and the ordinary world has not registered it.";
  }
  if (escalating && subject) {
    return "There are too many of them now, and they are moving together — the ordinary world can no longer absorb it.";
  }
  if (subject && setting && metaphor) {
    return `Something is moving through ${setting.from} that does not move the way the things that belong there move.`;
  }
  if (subject && setting) {
    return `Something is loose in ${setting.from}, and the place has not changed to accommodate it.`;
  }
  if (subject && metaphor) {
    return `${cap(subject.from)} is being shown as something else, and the resemblance is the argument.`;
  }
  if (setting) return "A place is held, and whatever happened in it has already happened.";
  if (subject)
    return `${cap(subject.from)} is presented alone, with nothing to measure it against.`;
  return "The words are the image; there is nothing behind them.";
}

function cap(s: string | null | undefined): string {
  if (!s) return "Something";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Which construction builds a given detected subject. Mirrors the `fit`
 *  functions in `construct.ts` rather than duplicating their judgement —
 *  this answers "what kind of thing is this", not "what should win". */
function constructionFor(s: DetectedSubject): string {
  switch (s.kind) {
    case "creature":
    case "person":
      return "body";
    case "object":
      return "fixture";
    case "document":
      return "paper";
    case "place":
      return "space";
    default:
      return "type";
  }
}

/** Is this plan worth compositing, or is it just the old single shot?
 *
 *  Two planes is the threshold, and a plan below it should compile exactly
 *  as it did before — the cost of a second plane is a second full program
 *  per scene, and paying it to composite one thing over nothing is how a
 *  render gets slow for no picture. */
export function isComposite(plan: ScenePlan): boolean {
  return plan.planes.length >= 2;
}

/** WEIGHT AND DEPTH, APPLIED TO A BUILT NODE'S PARAMETERS.
 *
 *  The capability map found `plane.weight` and `plane.depth` computed and
 *  read by nothing — PLANNED, in its own vocabulary, which is the state
 *  that looks finished from every angle except the screen. This is the
 *  function that closes that loop, and it is deliberately the ONLY place
 *  the mapping lives so it can be argued with in one file.
 *
 *  WEIGHT IS NOT ONE THING. It is how much of the frame a role is entitled
 *  to, and different constructions spend that entitlement differently: a
 *  body spends it on scale and population, a space on how much is in it,
 *  type on its measure. Hardcoding "weight → opacity" would make the
 *  emphasis a fade rather than a composition.
 *
 *  Returns a NEW params object; never mutates. Only touches keys the
 *  primitive actually declares — the parameter-contract test is permanent
 *  and this must not be the thing that breaks it. */
export function applyPlane(
  primitiveId: string,
  params: Record<string, number | string>,
  plane: Plane,
  /** The node's own seed, when it has one.
   *
   *  DETERMINISTIC IS NOT THE SAME AS REPETITIVE, and conflating them is
   *  a real risk for a compiler built this way. `population 0.7` should
   *  not mean "exactly 47 cars" — it should mean a world with a
   *  particular population CHARACTER, and which cars, at which density,
   *  is a realisation of it.
   *
   *  So the population-derived numbers carry a seeded jitter. Same
   *  script, same direction, same seed always gives the same film — the
   *  standing determinism rule is untouched, and there is still no
   *  `Math.random()` anywhere. But the same semantic instruction under a
   *  different seed gives a different valid realisation, which is the
   *  procedural equivalent of documentary texture.
   *
   *  Omitted, the jitter is exactly 1 — so every caller that does not opt
   *  in gets the arithmetic it always got. */
  seed?: number,
): Record<string, number | string> {
  const out = { ...params };
  // Centred on 0.5 so a mid-weight plane is unchanged and the mapping is
  // legible: below half it recedes, above half it takes the frame.
  const w = plane.weight;
  const lift = 0.6 + w * 0.8; // 0.6 … 1.4
  // POPULATION, ON A PLANE THAT DEPICTS A WORLD AND NOWHERE ELSE.
  //
  // A subject's numbers come off the prose — "dozens of them" is thirteen
  // bodies because the sentence said dozens — and multiplying that by a
  // director's world dial would be the engine editing the essay. Same
  // firewall the figures keep, applied to population. So the multiplier is
  // identity on every role but SETTING and COUNTERPOINT, and 0.5 is
  // identity everywhere.
  const worldly = plane.role === "SETTING" || plane.role === "COUNTERPOINT";
  // ±18% around the character the dial asked for. Wide enough that two
  // scenes at the same population do not look stamped from one plate,
  // narrow enough that 0.1 and 0.9 never overlap — a jitter that can
  // reach across the dial is not texture, it is noise standing in for a
  // decision.
  const crowd = worldly ? (0.25 + clamp01(plane.population) * 1.5) * jitter(seed, 0.18) : 1;

  switch (primitiveId) {
    case "creature_chain":
      // A low-weight anomaly is small and few. "Nobody noticed" is a claim
      // about salience, so this is the parameter that makes the sentence
      // true rather than merely illustrated.
      if (typeof out.scale === "number") out.scale = clamp01(out.scale * lift);
      if (typeof out.count === "number") {
        out.count = Math.max(1, Math.round(out.count * lift * crowd));
      }
      break;
    case "plate_scene":
      // A space spends weight on how populated it is — and population
      // spends itself on the same parameters, because "how much of the
      // frame does this world get" and "how much is going on in it" are
      // genuinely two questions about one plate. An almost-empty street
      // that dominates the frame and a crowded one squeezed into a corner
      // are both real shots, and they need both dials to be reachable.
      if (typeof out.cars === "number") {
        out.cars = Math.max(0, Math.round(out.cars * lift * crowd));
      }
      if (typeof out.life === "number") out.life = clamp01(out.life * lift * crowd);
      break;
    case "text_layout":
      if (typeof out.scale === "number") out.scale = clamp01(out.scale * lift);
      break;
    case "parallax_layers":
      // DEPTH, at last reaching the one primitive that has always had a
      // depth parameter and has never been told what the scene's depth is.
      out.depth = clamp01(plane.depth);
      break;
    case "layer_over":
      // THE COMPOSITOR IS ALSO A TRANSLATION, and this is the reason this
      // case belongs here rather than in the stack builder. A layer's
      // entitlement to the frame is expressed on the compositor that puts
      // it behind something — how strongly it re-asserts (`opacity`) and
      // how far it sinks under what is in front of it (`sink`).
      //
      // Called with the DEEPER plane, always: the compositor is answering
      // "how much of the frame does the thing behind me keep", which is
      // that plane's weight and nobody else's.
      out.opacity = clamp01(0.25 + w * 0.6);
      // Inverted deliberately. A heavy background sinks LESS, so weight
      // reads the same direction everywhere it lands — more weight, more
      // presence — rather than meaning "louder" here and "further" there.
      out.sink = clamp01(0.7 - w * 0.5);
      out.front = 0;
      break;
    default:
      break;
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** A multiplier around 1, derived from a seed. Exactly 1 when there is no
 *  seed, so opting out is free and nothing silently moves.
 *
 *  An integer hash rather than any PRNG, because standing rule 4 is not
 *  "seed your randomness", it is that everything stochastic is a pure
 *  function of its seed. This one is: same seed, same number, forever, in
 *  any runtime. */
function jitter(seed: number | undefined, amount: number): number {
  if (seed === undefined) return 1;
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return 1 + (h / 0xffffffff - 0.5) * 2 * amount;
}
