// TEXT PROMOTION — which words deserve to become visual objects.
//
// The layer that was missing, and the reason the films read as "technically
// interesting pictures without understanding what should be on screen".
//
// `phrase.ts` chooses the best span of a sentence to set as type, and it is
// good at that. But it runs on EVERY scene, so every sentence put words on
// screen, and a 36-scene essay became 36 title cards. That is subtitles
// sprinkled over a video. An essay does not have 36 visual anchors; it has
// eight or ten, and the rest is development that should be SPOKEN and not
// shown.
//
// So there are two questions and they were being answered at once:
//
//     WHAT MATTERS          this file
//     HOW TO SHOW IT        the visual languages, downstream
//
// Separating them is what lets the same promoted moment be realised as
// typography in a TEXT film, as a transformation in an ABSTRACT one, and
// as a change to a persistent object in a WORLD one. One semantic event,
// several realisations.
//
//     0  NARRATION   spoken, nothing on screen. Most of the essay.
//     1  CONTEXT     a small label — a section, a fragment, a marker
//     2  EMPHASIS    a phrase made prominent WHILE it is spoken
//     3  STATEMENT   a complete idea becomes the visual centrepiece
//     4  THESIS      a major statement takes over the screen
//
// EVERYTHING HERE IS CHECKABLE. Not one judgement in this file needs a
// model, because the signals are facts about the prose: a contrast is a
// syntactic shape, a refrain is a repeated substring, a figure is already
// lifted verbatim, a hedge is a word list. Which matters for the same
// reason it matters in `figures.ts` — the operator can verify every
// promotion against their own sentence, and a promotion the compiler got
// wrong is visibly wrong rather than arguably wrong.
//
// The one thing it is NOT allowed to do is invent. Every promoted span is
// a literal substring of the narration.

import type { EditorialIR, Scene } from "../ir/schema.ts";
import type { FilmTimeline } from "../narrate/timeline.ts";
import { detectSubjects } from "./subject.ts";

/** HOW MUCH OF THE FILM'S ATTENTION THIS MOMENT GETS, 0..4.
 *
 *  Read as "how much text" for as long as TEXT was the only thing that
 *  could be allocated. It is the INTENSITY of whatever the moment was
 *  given, and the scale is unchanged — 0 is the film spending nothing
 *  here, 4 is a moment taking the screen. */
export type Intensity = 0 | 1 | 2 | 3 | 4;

/** WHAT THE FILM SPENDS ON A MOMENT.
 *
 *  Two kinds today, and the honest reason there are only two: those are
 *  the two this compiler can actually carry out. `SPOKEN` is not a
 *  failure and not an absence of decision — it is the allocator deciding
 *  that the voice carries this moment alone, which is what most of an
 *  essay should be.
 *
 *  Deliberately NOT called `NONE`. A moment can be spoken-only and still
 *  have a picture behind it: this layer allocates the film's ATTENTION,
 *  and whether a scene draws anything at all is a separate question that
 *  nothing in this compiler can currently answer. Naming this `NONE`
 *  would claim a capability that does not exist. */
export type InterventionKind =
  /** Nothing is drawn. The film's own ground, and the voice alone.
   *
   *  The decision the compiler could not previously express — not because
   *  nobody wanted it, but because four separate layers each independently
   *  guaranteed a picture, so a higher layer asking for silence was
   *  overruled by a lower one manufacturing something. */
  | "NONE"
  /** What is already on screen stays on screen. Nothing new arrives.
   *
   *  COMPOSITIONAL, not simulated: the world's persistent elements are
   *  recomposed at their inherited places. A particle field does not keep
   *  running across the boundary — retaining live chain instances is the
   *  exact opposite of the buffer disposal that stopped the tab dying
   *  mid-film, and that is a decision about long-film export rather than
   *  something to slip into a change about breathing room. */
  | "HOLD"
  /** The words are the intervention. */
  | "TEXT"
  /** The compiler builds a picture for this moment. Today's default, and
   *  now one option among four rather than the only outcome. */
  | "COMPOSE";

/** What a TEXT intervention needs in order to happen: the words, and
 *  where they sit in the sentence so they can be timed to the voice. */
export interface TextPayload {
  /** The span to put on screen — verbatim from the narration, always. */
  text: string;
  /** Its character offset in the sentence, which is what lets it be timed
   *  to the measured words rather than to the sentence's whole window. */
  offset: number;
}

/** What this sentence is DOING in the argument — as distinct from what it
 *  is about. The visual rhythm should follow the argument, not the
 *  sentence count: argument → event → development → transformation →
 *  event → payoff, rather than sentence → shot → sentence → shot. */
export type ArgumentRole =
  | "TITLE"
  | "PROBLEM"
  | "EXPLANATION"
  | "THESIS"
  | "MECHANISM"
  | "DIAGNOSTIC"
  | "COUNTER"
  | "DEVELOPMENT"
  | "STANDARD"
  | "CONCLUSION";

/** ONE MOMENT'S SHARE OF THE FILM'S VISUAL ATTENTION.
 *
 *  Everything on this record except `payload` is already
 *  intervention-agnostic — `role`, `window`, `why` and `score` say
 *  nothing about type — which is why generalising the allocator was a
 *  smaller change than it looked. What was welded to typography was two
 *  fields, and they are now the payload of a kind rather than the point
 *  of the record. */
export interface Intervention {
  sceneId: string;
  kind: InterventionKind;
  intensity: Intensity;
  role: ArgumentRole;
  /** Present when `kind` needs one. Null for `SPOKEN`. */
  payload: TextPayload | null;
  /** WHEN it is spoken. `measured` false means the recording gave only a
   *  sentence boundary, so this is the sentence's window and the phrase is
   *  landing on a guess. Kept as a distinct fact rather than smoothed
   *  over: a word time that was interpolated is not a measurement. */
  window: { startMs: number; endMs: number; measured: boolean } | null;
  /** The signals that promoted it, for the report. A promotion nobody can
   *  account for is indistinguishable from a guess. */
  why: string[];
  score: number;
}

/** The film's text, as the allocator left it. A consumer that wants the
 *  words asks for them rather than reaching into a shape that will gain
 *  more kinds. */
export function textOf(i: Intervention): TextPayload | null {
  return i.kind === "TEXT" ? i.payload : null;
}

/* ── THE SIGNALS ──────────────────────────────────────────────────────
 *
 * Each returns the span it found, or null. They are deliberately narrow:
 * a signal that fires on everything promotes everything, which is the
 * failure this file exists to end.
 */

/** X, NOT Y — the shape most of an argument's memorable lines are in.
 *
 *  "A POSITION, NOT A PERSON" · "EXPOSURE, NOT CORRUPTION" · "not a lapse
 *  but a diagnosis". A contrast is a claim about a category, which is why
 *  it reads as a thesis rather than as a detail. */
const CONTRAST = [
  /\b([\w'’-]+(?:\s+[\w'’-]+){0,2}),\s+not\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
  /\bnot\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})\s+but\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
  /\b([\w'’-]+(?:\s+[\w'’-]+){0,2})\s+(?:vs\.?|versus)\s+([\w'’-]+(?:\s+[\w'’-]+){0,2})/i,
];

/* ISN'T A LAPSE. IT'S A DIAGNOSIS.
 *
 * The single most reliable shape an argumentative claim takes, and it
 * SPANS THE FULL STOP — so it cannot be found one sentence at a time, and
 * the segmenter has already cut those two sentences into two scenes. A
 * per-scene pass sees "The fallacy isn't a lapse." (a fragment) and "It's
 * a diagnosis." (a pronoun with nothing to refer to) and promotes neither.
 * Measured on the real thing: both came back level 0 while a weaker line
 * three scenes later took a slot.
 *
 * So it is detected across ADJACENT SCENES, and both halves are promoted
 * together — which is also how it should read on screen: two lines, the
 * second landing when the second is spoken. */
const DENIES = /\b(?:is|was|are|were|do|does|did)(?:n['’]t| not)\b|\bnever\b/i;
const ASSERTS = /^\s*(?:it|they|that|this|he|she)\b/i;

/** Hedges. A hedged sentence is not a thesis, whatever else it looks like.
 *  Same discipline as `extract-reading.ts`'s hedge floor and for the same
 *  reason: an essay is allowed to be uncertain, and dramatising an
 *  uncertainty into a full-screen statement is the compiler putting words
 *  in the author's mouth. */
const HEDGE =
  /\b(?:probably|perhaps|maybe|arguably|seems?|appears?|suggests?|might|may|could|allegedly|reportedly|apparently|roughly|approximately|tends? to|often|usually|sometimes)\b/i;

/** A short, unhedged declarative. Nine words is about the length past
 *  which a line stops being a statement and starts being a sentence. */
const STATEMENT_WORDS = 9;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s'’-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Where a span sits in its sentence, verified as a literal substring.
 *  Returns -1 when the span is not actually in the prose, which is the
 *  check that makes "never invents" mechanical rather than a promise. */
function locate(sentence: string, span: string): number {
  return sentence.indexOf(span);
}

/** Words a promoted span may not begin or end on. A line ending on a
 *  preposition reads as a rendering error at 60px, and it is one. */
const WEAK = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "as",
  "that",
  "this",
  "it",
  "its",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "not",
  "no",
  "so",
  "than",
  "then",
  "into",
]);

/* TRIM WITHOUT LEAVING THE PROSE.
 *
 * `phrase.ts`'s `trimPhrase` does this job well and UPPERCASES its result,
 * which is right for something being set as type and fatal here: the
 * uppercased span is no longer a literal substring, so the verbatim check
 * below rejected it and the promotion was dropped in silence. Measured —
 * "a position, not a person" scored 0.9, failed `locate`, and never
 * appeared, which is exactly the class of bug the verbatim check exists to
 * catch and exactly why it must not be defeated by its own helper.
 *
 * Casing is a decision for the layer that draws the words. This one only
 * decides WHICH words, and it returns them as the essay wrote them. */
function trimVerbatim(sentence: string, raw: string): string {
  const at = sentence.indexOf(raw);
  if (at < 0) return "";
  // Work in word tokens with their offsets so the result can only ever be
  // a slice of the original.
  const toks: Array<{ w: string; from: number; to: number }> = [];
  const re = /\S+/g;
  let m = re.exec(raw);
  while (m) {
    toks.push({ w: m[0], from: m.index, to: m.index + m[0].length });
    m = re.exec(raw);
  }
  let lo = 0;
  let hi = toks.length - 1;
  const bare = (w: string) => w.toLowerCase().replace(/[^\w'’-]/g, "");
  while (lo < hi && WEAK.has(bare(toks[lo]?.w ?? ""))) lo++;
  while (hi > lo && WEAK.has(bare(toks[hi]?.w ?? ""))) hi--;
  if (hi < lo) return "";
  const start = toks[lo]?.from ?? 0;
  const end = toks[hi]?.to ?? raw.length;
  const span = raw.slice(start, end).replace(/[.,;:]+$/, "");
  return sentence.includes(span) ? span : "";
}

/** What this sentence is doing in the argument.
 *
 *  The essay's own structure does most of the work: `narrativeFunction` is
 *  already on every scene and the act boundaries are the essay's own
 *  headings. The markers below only distinguish the cases those cannot —
 *  a counterargument and a mechanism are both "evidence" to the
 *  segmenter. */
export function roleOf(scene: Scene, index: number, total: number): ArgumentRole {
  const t = scene.narration.text;
  if (index === 0) return "TITLE";
  if (/^(?:but|and yet|of course|the objection|you might|one could|critics?)\b/i.test(t.trim()))
    return "COUNTER";
  if (/\b(?:the easy explanation|the obvious answer|because|which is why|the reason)\b/i.test(t))
    return "EXPLANATION";
  // A diagnostic names what the thing IS a case of. The denial half of a
  // pair carries none of those words — "The fallacy isn't a lapse." is the
  // set-up — which is why the pair's role is taken from whichever half is
  // the stronger, above.
  if (/\b(?:diagnos|symptom|reveal|expos|betray)/i.test(t)) return "DIAGNOSTIC";
  if (/\b(?:the test|the standard|the measure|how you (?:tell|know)|the way to)\b/i.test(t))
    return "STANDARD";
  if (/\b(?:works by|the mechanism|the process|what happens is|it operates)\b/i.test(t))
    return "MECHANISM";
  if (scene.narrativeFunction === "turn") return "THESIS";
  if (scene.narrativeFunction === "hook") return "PROBLEM";
  if (scene.narrativeFunction === "resolve" || index >= total - 2) return "CONCLUSION";
  return "DEVELOPMENT";
}

interface Candidate {
  text: string;
  score: number;
  why: string;
}

/** Everything this sentence offers, with what it is worth. */
function candidatesFor(scene: Scene, refrains: Set<string>): Candidate[] {
  const t = scene.narration.text.trim();
  const out: Candidate[] = [];
  const hedged = HEDGE.test(t);

  for (const re of CONTRAST) {
    const m = re.exec(t);
    if (!m || m.index === undefined) continue;
    const span = trimVerbatim(t, m[0]);
    if (span) {
      out.push({ text: span, score: 0.9, why: "a contrast — a claim about a category" });
      break;
    }
  }

  // A whole short sentence, unhedged, is a statement rather than a detail.
  const w = words(t);
  if (w.length <= STATEMENT_WORDS && /[.!?]$/.test(t) && !hedged) {
    out.push({
      text: t.replace(/[.]$/, ""),
      score: 0.72,
      why: `a short declarative — ${w.length} words`,
    });
  }

  /* THE COLON, WHICH IS AN AUTHOR POINTING.
   *
   * "The move is always the same: manufacture the win, then cite it."
   * Everything before the colon is set-up and everything after it is the
   * thing being announced. A writer using a colon has already done the
   * promotion; this reads it rather than second-guessing it. */
  const colon = /:\s*([^.!?;]{4,60})/.exec(t);
  if (colon?.[1]) {
    const span = trimVerbatim(t, colon[1].split(/,\s+(?:then|and)\b/)[0] ?? colon[1]);
    if (span && words(span).length >= 2 && words(span).length <= 6) {
      out.push({ text: span, score: 0.8, why: "announced by the essay's own colon" });
    }
  }

  // A verbatim quantity. Already lifted and already checked as a literal
  // substring — the one thing in this system that needs neither a model
  // nor a ratification.
  for (const fig of scene.figures ?? []) {
    if (!fig.text || locate(t, fig.text) < 0) continue;
    out.push({ text: fig.text, score: 0.66, why: "a quantity the essay printed" });
    break;
  }

  // THE AUTHOR'S OWN REFRAIN. A phrase they wrote twice is a phrase they
  // meant; nothing about this is the compiler's opinion.
  for (const phrase of refrains) {
    const at = norm(t).indexOf(phrase);
    if (at < 0) continue;
    // Recover the verbatim span rather than the normalised one — what goes
    // on screen is always something the essay actually says.
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "i");
    const m = re.exec(t);
    const span = m ? trimVerbatim(t, m[0]) : "";
    if (span) out.push({ text: span, score: 0.78, why: "the essay says this more than once" });
    break;
  }

  if (hedged) for (const c of out) c.score *= 0.45;
  return out.sort((a, b) => b.score - a.score);
}

/** Phrases the essay repeats. Three to six words, normalised, seen twice
 *  or more — the author's refrain, found by counting rather than by
 *  interpretation. */
function findRefrains(ir: EditorialIR): Set<string> {
  const seen = new Map<string, number>();
  for (const scene of ir.scenes) {
    const w = norm(scene.narration.text).split(" ");
    for (let n = 3; n <= 6; n++) {
      for (let i = 0; i + n <= w.length; i++) {
        const g = w.slice(i, i + n).join(" ");
        seen.set(g, (seen.get(g) ?? 0) + 1);
      }
    }
  }
  const out = new Set<string>();
  for (const [g, n] of seen) if (n >= 2 && g.split(" ").length >= 3) out.add(g);
  return out;
}

/** How many moments an essay of this length should actually SHOW.
 *
 *  The scarcity is the point, and it is why this is a film-level pass
 *  rather than a per-scene one. A film that promotes every sentence has
 *  promoted nothing: the level-4 statement only takes over the screen
 *  because the two minutes around it did not. Roughly one visual anchor
 *  per four scenes, floored so a very short film still has some, capped so
 *  a long one does not become a slideshow again. */
function quota(sceneCount: number, totalMs?: number): { shown: number; major: number } {
  /* A BUDGET IS A FUNCTION OF HOW LONG THE FILM LASTS.
   *
   * This read scene count alone, which is a proxy that drifts badly: an
   * essay of long sentences and an essay of short ones can have the same
   * scene count and twice the runtime between them, and the second was
   * being given a caption every few seconds while the first went quiet.
   *
   * The measured timeline is already available at the call site — it is
   * passed in for `windowFor` — so the honest denominator was there all
   * along. Roughly one anchor per half-minute of speech, which puts a
   * seven-minute essay at the top of the range without reaching for the
   * cap. Scene count stays as the fallback for a film that has not been
   * narrated yet, where there is no runtime to divide. */
  const bySpeech = totalMs && totalMs > 0 ? Math.round(totalMs / 30_000) : null;
  const shown = Math.max(3, Math.min(14, bySpeech ?? Math.round(sceneCount * 0.34)));
  return { shown, major: Math.max(1, Math.round(shown * 0.35)) };
}

/** Roles whose promoted line is allowed to take the whole screen. A
 *  development paragraph is never a thesis however well it is written. */
const MAJOR: ArgumentRole[] = ["TITLE", "THESIS", "DIAGNOSTIC", "CONCLUSION", "STANDARD"];

/* ── WHAT HAPPENS TO THE VISUAL WORLD ────────────────────────────────
 *
 * The decision the compiler could not make. Every scene got a picture,
 * so the only question ever asked was WHICH one — and with four layers
 * independently guaranteeing that something be drawn, whatever the
 * semantic material could be bent into was going to win.
 *
 * Everything below is checkable against the prose, which is the same bar
 * the promotion signals keep. Nothing here reads a noun's KIND: the
 * question is whether this sentence introduces something, not what that
 * something is. A token may inform what is happening; it may never name
 * what is drawn.
 *
 * DELIBERATELY NOT TUNED. The thresholds are the simplest defensible
 * ones, because the point of this pass is to find out what the film
 * grammar does when it finally has permission to breathe — and tuning
 * before looking is how the last several passes went wrong. */
function decide(
  scene: Scene,
  standing: Set<string>,
  newPassage: boolean,
): { kind: InterventionKind; why: string } {
  // CHECKABLE MATERIAL OUTRANKS SILENCE. A printed figure or a drawn
  // route is the prose asking for a picture, and holding through one
  // would be the machine ignoring its own evidence.
  if ((scene.figures ?? []).length > 0) {
    return { kind: "COMPOSE", why: "composed — the prose printed a figure" };
  }
  if ((scene.route ?? []).length >= 2) {
    return { kind: "COMPOSE", why: "composed — the prose drew a route" };
  }

  // SOMETHING NEW ARRIVES. Not "this sentence names a thing" — this
  // sentence names a thing the film has not established yet.
  const named = detectSubjects(scene.narration.text).map((x) => x.text.toLowerCase());
  const arriving = named.filter((n) => !standing.has(n));
  if (arriving.length > 0) {
    return { kind: "COMPOSE", why: `composed — "${arriving[0]}" arrives` };
  }

  /* A BREATH BETWEEN IDEAS.
   *
   * Measured before this existed: NONE fired zero times in seventeen
   * scenes. `standing` never empties, so once anything is established
   * every non-arriving scene becomes a HOLD and the film can persist but
   * can never clear. A world that only ever accumulates is not breathing
   * either — it is just a picture that refuses to leave.
   *
   * So the film clears when a NEW PARAGRAPH opens by introducing
   * nothing. That is punctuation rather than a threshold: the author has
   * finished developing one idea, the next has not arrived yet, and the
   * frame goes quiet in the gap. The boundary is the author's own —
   * `passageId` is their paragraph — so the prose decides where the film
   * breathes rather than a number I picked.
   *
   * The first version also required a run of holds immediately before the
   * boundary, and that was me inventing a threshold. It never fired:
   * a paragraph's last sentence is usually its payoff and usually
   * promoted, which resets the run at exactly the point being tested. */
  if (newPassage && standing.size > 0) {
    return {
      kind: "NONE",
      why: "nothing on screen — a new idea begins and the last one has finished developing",
    };
  }

  // NOTHING NEW, BUT SOMETHING IS ALREADY STANDING. The world persists
  // and the sentence develops it. This is the one that stops a film
  // generating an unrelated picture every time the narrator opens their
  // mouth.
  if (standing.size > 0) {
    return { kind: "HOLD", why: "held — nothing new arrives, and the world is already standing" };
  }

  /* NOTHING NAMED IS NOT NOTHING TO SHOW.
   *
   * This returned NONE, and the measurement was immediate and total: a
   * hand-authored fixture whose prose names nothing depictable came out
   * as a film of entirely empty scenes. Which is the exact error the
   * proposition layer exists to prevent, arriving from the opposite
   * direction — the old compiler read "no noun" as "reach for a noun
   * anyway", and this read it as "there is nothing here".
   *
   * An essay of ideas names nothing and is most of what this system is
   * for. So the default is to compose. Silence is a decision the film
   * makes at a boundary, never the residue of a sentence that happened
   * not to mention an object. */
  return { kind: "COMPOSE", why: "composed — the film's own state carries this moment" };
}

/** ALLOCATE THE FILM'S VISUAL ATTENTION.
 *
 *  Film-level, before any visual decision. Returns one entry per scene —
 *  most of them level 0, which is the whole point. */
export function allocate(ir: EditorialIR, timeline?: FilmTimeline | null): Intervention[] {
  const refrains = findRefrains(ir);
  const total = ir.scenes.length;
  const { shown, major } = quota(total, timeline?.totalMs);

  /* THE PAIRS, FOUND ACROSS THE CUT. A denial followed by an assertion is
   * one claim in two sentences, and the segmenter has already separated
   * them. Both halves score as a pair so they win or lose together — half
   * of "isn't a lapse / it's a diagnosis" on screen is worse than none. */
  /** sceneId → the id of the claim it belongs to. A pair is ONE claim in
   *  two sentences, so it takes one slot rather than two — otherwise a
   *  single "isn't X. It's Y." would eat half the quota of a short film,
   *  which is what it did on the first run. */
  const paired = new Map<string, string>();
  for (let i = 0; i + 1 < ir.scenes.length; i++) {
    const a = ir.scenes[i];
    const b = ir.scenes[i + 1];
    if (!a || !b) continue;
    if (!DENIES.test(a.narration.text)) continue;
    if (!ASSERTS.test(b.narration.text)) continue;
    // Both halves short, because the shape only reads as a claim when it
    // is one. A denial followed by a paragraph is a denial followed by a
    // paragraph, and promoting it would put a wall of type on screen.
    if (words(b.narration.text).length > 12) continue;
    if (words(a.narration.text).length > 14) continue;
    paired.set(a.sceneId, a.sceneId);
    paired.set(b.sceneId, a.sceneId);
  }

  const scored = ir.scenes.map((scene, i) => {
    /* A PAIR HAS ONE ROLE. "The fallacy isn't a lapse." names nothing and
     * reads as DEVELOPMENT on its own; "It's a diagnosis." is what makes
     * the pair diagnostic. Ranking them under different roles gave the
     * film's thesis a weaker weight than its ending. The stronger of the
     * two halves speaks for both. */
    const partnerId = paired.get(scene.sceneId);
    const partner =
      partnerId === undefined
        ? undefined
        : ir.scenes.find((o) => o.sceneId !== scene.sceneId && paired.get(o.sceneId) === partnerId);
    const own = roleOf(scene, i, total);
    const other = partner
      ? roleOf(partner, ir.scenes.indexOf(partner), total)
      : ("DEVELOPMENT" as ArgumentRole);
    const role =
      own === "DEVELOPMENT" && MAJOR.includes(other)
        ? other
        : MAJOR.includes(own) || !partner
          ? own
          : own;
    /* THE FILM'S OWN TITLE. The essay wrote it as a heading, so it is not
     * in any sentence's narration — and it is still verbatim, checked
     * against the essay rather than against one line of it. A title
     * competes with nothing: it is outside the quota, because a film
     * withholding its own name to save a slot for a sentence would be the
     * scarcity rule applied where it does not belong. */
    // The heading's MARKER is markdown, not the title. "# The Logic
    // Costume" on screen would be the compiler showing its own plumbing.
    const title = ir.title.replace(/^#+\s*/, "").trim();
    if (role === "TITLE" && title && ir.essay.includes(title)) {
      return {
        scene,
        role,
        best: { text: title, score: 1, why: "the essay's own title" },
        score: 1,
        pinned: true,
      };
    }
    const cands = candidatesFor(scene, refrains);
    const pair = paired.has(scene.sceneId)
      ? {
          text: scene.narration.text.trim().replace(/[.]$/, ""),
          score: 0.95,
          why: "a denial and its assertion, across the cut",
        }
      : null;
    const best = pair && (!cands[0] || cands[0].score < pair.score) ? pair : cands[0];
    // The role is a multiplier on what the sentence offers, not a
    // promotion of its own: a DIAGNOSTIC sentence with nothing quotable in
    // it stays spoken.
    const roleWeight = MAJOR.includes(role) ? 1.25 : role === "COUNTER" ? 1.1 : 1;
    return {
      scene,
      role,
      best,
      score: best ? Math.min(1, best.score * roleWeight) : 0,
      pinned: false,
    };
  });

  // Rank, then take the quota. Ties broken by scene order so the same IR
  // always promotes the same moments.
  /* RANKED BY CLAIM, NOT BY SCENE. A pair is one claim wearing two
   * sentences; ranking its halves separately spent two of four slots on
   * one idea and pushed the film's own ending off the screen. Measured. */
  const claims = new Map<string, typeof scored>();
  for (const s of scored) {
    if (s.score <= 0 || s.pinned) continue;
    const id = paired.get(s.scene.sceneId) ?? s.scene.sceneId;
    const group = claims.get(id);
    if (group) group.push(s);
    else claims.set(id, [s]);
  }
  /* SPENT ACROSS THE FILM, NOT MERELY CAPPED.
   *
   * This was a single global sort followed by `.slice(0, shown)` — scene
   * order was the tiebreak and nothing else consulted position. So the
   * budget was a CEILING on how many anchors a film could have and said
   * nothing about WHERE they went, and since an argument puts its title
   * and its thesis at the front, they all went to the front. Measured on
   * an 18-scene fixture: seven of ten anchors inside the first 40%, then
   * nothing at all between 39% and 83%.
   *
   * A scarcity rule that does not distribute is not a rhythm, it is a
   * cap. The runtime is divided into as many bands as there are slots and
   * each band offers its best claim.
   *
   * Two consequences, both intended:
   *
   *   A BAND WITH NOTHING WORTH SHOWING YIELDS NOTHING. The count can come
   *   in under quota and that is correct — an essay with a quiet middle
   *   should have a quiet middle. The quota becomes a ceiling on density
   *   rather than a target to fill.
   *
   *   A PAIR STILL TRAVELS TOGETHER even when it straddles a boundary,
   *   because a claim is banded by where it STARTS and the group is
   *   already one entry here. */
  const bandOf = (group: typeof scored): number => {
    const first = Math.min(...group.map((x) => ir.scenes.indexOf(x.scene)));
    return Math.min(shown - 1, Math.floor((first / Math.max(1, total)) * shown));
  };
  const peak = (group: typeof scored): number => Math.max(...group.map((x) => x.score));
  const byBand = new Map<number, typeof scored>();
  for (const group of claims.values()) {
    const band = bandOf(group);
    const held = byBand.get(band);
    if (!held || peak(group) > peak(held)) byBand.set(band, group);
  }

  /* AN UNSPENT SLOT IS RE-OFFERED, NOT LOST.
   *
   * Coverage first, merit second. One-per-band alone throws away a real
   * claim whenever two strong ones share a band — measured: a 0.9
   * contrast lost its slot to a neighbour and vanished from a film that
   * had a silent band elsewhere. The budget is film-wide; a band that
   * declined has not consumed anything, so the slot should go back.
   *
   * The bar is what keeps this from undoing the distribution. A leftover
   * slot is filled only by a claim that would have carried a band on its
   * own — not by the next thing down. So a quiet middle still stays
   * quiet, because filling a slot requires a real signal rather than
   * merely being the best of what is left. */
  const STRONG_ENOUGH = 0.7;
  const chosen = new Set(byBand.values());
  if (chosen.size < shown) {
    const leftovers = [...claims.values()]
      .filter((g) => !chosen.has(g) && peak(g) >= STRONG_ENOUGH)
      .sort(
        (a, b) =>
          peak(b) - peak(a) ||
          ir.scenes.indexOf((a[0] as (typeof scored)[number]).scene) -
            ir.scenes.indexOf((b[0] as (typeof scored)[number]).scene),
      );
    for (const g of leftovers) {
      if (chosen.size >= shown) break;
      chosen.add(g);
    }
  }

  /* Ranked AFTER selection, by score, because rank drives the LEVEL
   * ladder — the strongest claim of those shown is the one allowed to
   * take the screen, and that is a different question from where in the
   * film it sits. Scene order breaks ties so the same IR always promotes
   * the same moments. */
  const ranked = [...chosen].sort(
    (a, b) =>
      peak(b) - peak(a) ||
      ir.scenes.indexOf((a[0] as (typeof scored)[number]).scene) -
        ir.scenes.indexOf((b[0] as (typeof scored)[number]).scene),
  );
  const promoted = new Map<string, number>();
  for (const s of scored) if (s.pinned) promoted.set(s.scene.sceneId, -1);
  ranked.forEach((group, rank) => {
    for (const s of group) promoted.set(s.scene.sceneId, rank);
  });

  /* WHAT THE FILM HAS ALREADY ESTABLISHED, accumulated in scene order.
   *
   * `.map` runs in order, so this is the world as it stood when each
   * scene arrived. It is what lets HOLD mean "the thing is already there"
   * rather than "nothing was promoted here" — the difference between a
   * film that persists and a film that merely fails to draw. */
  const standing = new Set<string>();
  /** The passage the previous scene belonged to. Read only by the
   *  breathing rule: the film may clear where the author started a new
   *  paragraph, and nowhere else. */
  let lastPassage: string | undefined;

  return scored.map(({ scene, role, best, score }) => {
    const rank = promoted.get(scene.sceneId);
    const namesHere = detectSubjects(scene.narration.text).map((x) => x.text.toLowerCase());
    const wasStanding = new Set(standing);
    for (const n of namesHere) standing.add(n);
    if (rank === undefined || !best) {
      const decided = decide(scene, wasStanding, scene.passageId !== lastPassage);
      lastPassage = scene.passageId;
      return {
        sceneId: scene.sceneId,
        kind: decided.kind,
        intensity: 0 as const,
        role,
        payload: null,
        window: null,
        why: [
          best
            ? `no text — ${shown} of ${total} moments carry it, and this was not among them`
            : "no text — nothing in this sentence is a visual anchor",
          decided.why,
        ],
        score,
      };
    }
    /* THE LADDER. Rank within the promoted set, gated by role: only a
     * TITLE, a THESIS, a DIAGNOSTIC, a STANDARD or a CONCLUSION may take
     * the whole screen, however strongly a development paragraph scored. */
    const intensity: Intensity =
      rank < 0
        ? 4
        : rank < major && MAJOR.includes(role)
          ? 4
          : rank < major
            ? 3
            : rank < shown * 0.7
              ? 2
              : 1;
    lastPassage = scene.passageId;
    const offset = locate(scene.narration.text, best.text);
    return {
      sceneId: scene.sceneId,
      kind: "TEXT" as const,
      intensity,
      role,
      payload: { text: best.text, offset },
      window: windowFor(scene, best.text, timeline),
      why: [
        best.why,
        rank < 0 ? role.toLowerCase() : `${role.toLowerCase()} · rank ${rank + 1} of ${shown}`,
      ],
      score,
    };
  });
}

/** WHEN THE PHRASE IS SPOKEN.
 *
 *  Matched against the measured words rather than interpolated across the
 *  sentence, which is the difference between "IT'S A DIAGNOSIS" landing on
 *  the word *diagnosis* and landing three quarters of the way through a
 *  window. Degrades honestly: a recording that gave only sentence
 *  boundaries yields the sentence's window with `measured: false`, and a
 *  film with no narration yields null. */
export function windowFor(
  scene: Scene,
  span: string,
  timeline?: FilmTimeline | null,
): Intervention["window"] {
  const on = timeline?.scenes.find((s) => s.sceneId === scene.sceneId);
  if (!on) return null;
  const wanted = norm(span).split(" ").filter(Boolean);
  if (on.words.length > 0 && wanted.length > 0) {
    const spoken = on.words.map((w) => norm(w.word));
    for (let i = 0; i + wanted.length <= spoken.length; i++) {
      let hit = true;
      for (let k = 0; k < wanted.length; k++) {
        if (spoken[i + k] !== wanted[k]) {
          hit = false;
          break;
        }
      }
      if (!hit) continue;
      const first = on.words[i];
      const last = on.words[i + wanted.length - 1];
      if (!first || !last) break;
      return { startMs: first.startMs, endMs: last.endMs, measured: true };
    }
  }
  return { startMs: on.startMs, endMs: on.endMs, measured: false };
}
