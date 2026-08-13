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

/** Does this sentence want more than one plane, and which?
 *
 *  Deliberately conservative. Most sentences name one thing and get one
 *  plane, which is exactly what they got before this file existed — a
 *  single-plane plan is not a regression, it is the same shot with its
 *  composition made explicit. The interesting case is the minority that
 *  name a setting AND a subject, which is where everything was being
 *  thrown away. */
export function planScene(beat: Beat, style: Style): ScenePlan {
  const planes: Plane[] = [];
  const subjects = beat.subjects;

  // THE SETTING. A place noun the sentence named, whatever its rank.
  // Previously this lost to the subject and vanished; here it simply sits
  // behind it, which is what a setting does.
  const place = subjects.find((s) => s.kind === "place");
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
      // a city, not about a city that happens to contain people.
      weight: subject ? 0.35 : 0.8,
    });
  }

  if (subject) {
    planes.push({
      role: "SUBJECT",
      construction: constructionFor(subject),
      from: subject.text,
      depth: 0.55,
      weight: place ? 0.65 : 0.85,
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
    });
  }

  return {
    planes,
    why: planes.length
      ? planes.map((p) => `${p.role.toLowerCase()}${p.from ? ` (${p.from})` : ""}`).join(" · ")
      : "single plane — the sentence names one thing",
    proposition: propose(planes),
  };
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
function propose(planes: Plane[]): string {
  const setting = planes.find((p) => p.role === "SETTING");
  const subject = planes.find((p) => p.role === "SUBJECT");
  const metaphor = planes.find((p) => p.role === "METAPHOR");

  if (!planes.length) return "nothing is claimed — the sentence names nothing depictable";
  if (subject && setting && metaphor) {
    return `Something is moving through ${setting.from}, and it is not behaving the way the people who belong there behave.`;
  }
  if (subject && setting) {
    return `${cap(subject.from)} occupies ${setting.from}, and the place continues around it.`;
  }
  if (subject && metaphor) {
    return `${cap(subject.from)} is being seen as something else, and the resemblance is the claim.`;
  }
  if (setting) return "A place is held, and whatever happened in it has already happened.";
  if (subject) return `${cap(subject.from)} is presented alone, with nothing to compare it to.`;
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
