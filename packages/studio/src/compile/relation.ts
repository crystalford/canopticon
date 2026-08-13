// RELATIONS — who acts on whom, whether it is asserted, and what caused it.
//
// THE TEST THIS FILE EXISTS TO PASS.
//
//   "The city watched its residents."
//   "The residents watched the city."
//   "The city was watched by its residents."
//   "The residents believed the city was watching them."
//   "The city appeared to watch its residents."
//
//   "Almost the same vocabulary. But the relationship is reversed... Do
//    not solve this by adding lexical entries or new visual primitives."
//
// Five sentences sharing two nouns. A compiler that reads NOUNS answers
// all five identically, because to a noun reader they ARE identical: a
// place and some people. Everything that distinguishes them — who is
// doing it, who it is being done to, whether it is happening at all —
// lives in the grammar between the nouns, which nothing here had ever
// looked at.
//
// SO THIS FILE ADDS NO NOUNS. It reuses `subject.ts` for what the sentence
// names and reads the STRUCTURE between those names:
//
//   the words BETWEEN two detected entities are the relation
//   "by" immediately before the second entity      → passive
//   an epistemic verb before the second entity     → someone BELIEVES it
//   "appeared to" / "seemed to"                    → it merely SEEMS so
//   "so" / "because" / "made" / "designed to"      → a direction of cause
//
// The only word lists here are stance and cause markers, and those are not
// lexicon padding — they ARE the semantic layer. There is no list of
// verbs: the action is whatever sits between the two entities, taken
// verbatim, exactly as a figure is taken verbatim.
//
// WHAT THIS DELIBERATELY IS NOT. It is not a parser, not a theory of
// meaning, and not a claim to understand metaphor. It reads one clause of
// the shape ENTITY … ENTITY and declines on everything else — which is
// most prose. `readRelation` returning null is the common case and the
// honest one, and the compiler says so rather than inventing a structure.

import type { DetectedSubject } from "./subject.ts";
import { detectAbstractions, detectSubjects } from "./subject.ts";

/** Whether the sentence CLAIMS the relation happened.
 *
 *  The distinction the Record has always drawn between a fact and an
 *  attributed assertion, arriving in the compiler for the first time. "The
 *  city watched its residents" is a claim about the city. "The residents
 *  believed the city was watching them" is a claim about the residents,
 *  and a film that draws them identically has silently upgraded a belief
 *  into a fact — which is the one thing this project refuses to do
 *  anywhere else. */
export type Stance =
  /** Stated outright. */
  | "asserted"
  /** Someone holds it to be true; the sentence does not. */
  | "believed"
  /** It presents that way; the sentence declines to say whether it is. */
  | "apparent";

export interface Relation {
  /** Who or what does it. Null when the sentence never says. */
  agent: DetectedSubject | null;
  /** Who or what it is done to. */
  patient: DetectedSubject | null;
  /** WHAT THE SHOT IS ABOUT, which is not always the agent.
   *
   *  The distinction between "the residents watched the city" and "the
   *  city was watched by its residents". Identical relation, identical
   *  agency, and the second one is a shot of a city — English puts the
   *  thing a sentence is about in front, and a passive exists precisely to
   *  put the patient there. A compiler that only tracked agency would draw
   *  those two the same way and be wrong about the second. */
  topic: DetectedSubject | null;
  /** The words between the entities, verbatim, so the reading is checkable
   *  against the prose like a figure. Never matched against a verb list. */
  action: string;
  voice: "active" | "passive";
  stance: Stance;
  /** Who holds the belief, when the stance is `believed`. The sentence is
   *  about THEM, not about what they believe. */
  experiencer: DetectedSubject | null;
  /** Which way the causation runs, when the sentence draws one.
   *
   *  `forward`  — the first thing caused the second ("the policy MADE them
   *               afraid"). The shot can arrive at its consequence.
   *  `backward` — the second thing explains the first ("they were already
   *               afraid, SO the policy was introduced"). The shot is of a
   *               thing that was already true. */
  cause: "none" | "forward" | "backward";
}

/** Someone holds it to be true. Kept minimal and explicit: this is the
 *  hinge between a claim and a report of a claim, and a long list would
 *  make it easy to add a verb that does not actually embed a proposition. */
const BELIEVES =
  /\b(believed?|believes|thought|thinks|felt|feels|suspected|suspects|assumed|assumes|feared|fears|claimed|claims|insisted|insists|maintained|maintains)\b/;

/** It presents that way and the sentence declines to say whether it is. */
const APPEARS = /\b(appeared|appears|seemed|seems|looked like|appeared to be|purported|purports)\b/;

/** The first thing brought the second about. */
const CAUSES_FORWARD =
  /\b(made|makes|caused|causes|led to|leads to|designed to|intended to|resulted in|results in|forced|forces|produced|produces)\b/;

/** The second thing explains the first. */
const CAUSES_BACKWARD = /\b(because|since|so that|which is why|as a result of|owing to)\b/;

/** Function words that put a noun inside a phrase rather than at the head
 *  of a clause. A noun after one of these is WHERE or HOW something
 *  happened, not the thing the clause is about.
 *
 *  Found by "They walked around the city like insects", which the first
 *  version read as a relation between a city and some insects and handed
 *  to the space construction — losing the bodies the whole paragraph is
 *  about. The grammatical subject there is "They", which names nothing
 *  the lexicon can see, and the first noun it CAN see is buried in a
 *  prepositional phrase. Grammar, not vocabulary: this list is closed and
 *  contains no nouns. */
const PREPOSITION_BEFORE =
  /\b(around|in|into|inside|at|on|onto|through|throughout|over|under|beneath|near|beside|between|among|amongst|across|along|behind|beyond|within|without|toward|towards|past|outside|by|from|to|of|for|with)\s+(?:the|a|an|its|his|her|their|our|my|your)?\s*$/;

/** A simile is not a relation. "Walked around the city LIKE insects" does
 *  not mean the city did anything to the insects. */
const SIMILE_BEFORE = /\b(like|as|such as|resembling|similar to)\s+(?:the|a|an)?\s*$/;

/** A passive: the thing in front had it done TO it. Requires "by" to name
 *  the agent — without it the sentence never says who acted, and inventing
 *  one would be exactly the guess this file refuses to make. */
const PASSIVE_BY =
  /\b(?:was|were|is|are|been|being)\b[^.]*?\bby\b(?:\s+(?:its|his|her|their|the|a|an|our|my|your))?\s*$/;

/** Read one clause's relation, or decline.
 *
 *  Declines far more often than not, and that is correct. Most sentences
 *  in an institutional essay name at most one thing, and a relation needs
 *  two. Returning null is the honest answer and the compiler reports it. */
export function readRelation(sentence: string): Relation | null {
  // BOTH ENDS OF A RELATION, WHICH IS NOT THE SAME AS BOTH ENDS BEING
  // DRAWABLE. "The policy made the residents afraid" has a perfectly clear
  // agent that no camera can point at, and reading only depictable nouns
  // threw the causal structure away along with the picture. The
  // abstractions carry weight 0, so they can stand in a relation and can
  // never win a construction.
  const subjects = [...detectSubjects(sentence), ...detectAbstractions(sentence)];
  if (subjects.length < 2) return null;

  // The two entities in the order the PROSE puts them, not the order the
  // lexicon weights them. Word order is the whole signal here — sorting by
  // weight first is what would make "the city watched its residents" and
  // "the residents watched the city" collapse into each other.
  const ordered = [...subjects].sort((a, b) => a.offset - b.offset);
  const first = ordered[0];
  const second = ordered[1];
  if (!first || !second) return null;

  // IS THE FIRST ENTITY ACTUALLY THE HEAD OF A CLAUSE? A noun sitting
  // inside a prepositional phrase is the setting, and reading it as the
  // topic hands the shot to the room instead of to what happened in it.
  const before = sentence.slice(0, first.offset).toLowerCase();
  if (PREPOSITION_BEFORE.test(before)) return null;

  const between = sentence.slice(first.offset + first.text.length, second.offset);
  const lower = between.toLowerCase();
  // A SIMILE IS NOT A RELATION. The second noun is what the first is being
  // compared to, not something it acted on.
  if (SIMILE_BEFORE.test(lower)) return null;
  // A relation is what sits BETWEEN two names. Nothing between them means
  // they are a list ("the residents and the tenants"), not a relation.
  const action = between.replace(/^[\s,;:]+|[\s,;:]+$/g, "");
  if (!action) return null;

  const passive = PASSIVE_BY.test(lower);
  const believes = BELIEVES.test(lower);
  const appears = APPEARS.test(lower);

  const stance: Stance = believes ? "believed" : appears ? "apparent" : "asserted";

  // WHO ACTS.
  //
  // Active: the thing in front does it. Passive: the thing in front has it
  // done to it, and "by" names who did. Believed: the thing in front holds
  // the belief and the thing behind is what they believe about — so the
  // AGENT is the second entity even though the first one leads the
  // sentence, which is the same shape as a passive arriving by a different
  // route.
  const agentIsSecond = passive || believes;
  const agent = agentIsSecond ? second : first;
  const patient = agentIsSecond ? first : second;

  // WHAT THE SHOT IS ABOUT. Always the thing the sentence puts in front —
  // that is what a passive and an epistemic frame are FOR. Kept separate
  // from `agent` because the two genuinely differ, and collapsing them is
  // what makes a compiler blind to the difference between "the residents
  // watched the city" and "the city was watched by its residents".
  const topic = first;

  return {
    agent,
    patient,
    topic,
    action,
    voice: passive ? "passive" : "active",
    stance,
    // Only a belief has someone holding it. An `apparent` reading has
    // nobody in it on purpose — that is what makes it ambient rather than
    // psychological.
    experiencer: believes ? first : null,
    cause: CAUSES_FORWARD.test(lower)
      ? "forward"
      : CAUSES_BACKWARD.test(lower) || CAUSES_BACKWARD.test(sentence.toLowerCase())
        ? "backward"
        : "none",
  };
}

/** How a relation bends the film's curves at this beat.
 *
 *  Same shape as a direction's bias and for the same reason: the relation
 *  states a disposition, and every construction already reads these dials
 *  to set its own numbers. Nothing here names a primitive.
 *
 *  Deliberately smaller than a direction's bias. A relation is a fact
 *  about the prose, and a fact should inform the picture rather than
 *  overrule the director's own curve. */
export function relationBias(relation: Relation): Record<string, number> {
  const bias: Record<string, number> = {};

  // A BELIEF IS NOT A FACT, and the picture should not assert one.
  // Further from the literal, and more restrained, because dramatising
  // what someone merely believes is the visual form of laundering an
  // attributed claim into a neutral one.
  if (relation.stance === "believed") {
    bias.abstraction = 0.2;
    bias.restraint = 0.22;
    // Someone is holding this belief and the sentence is about them.
    bias.human = 0.24;
  }
  // AN APPEARANCE HAS NOBODY IN IT. Softer and emptier than a belief —
  // the difference between "they thought the city was watching" and "the
  // city appeared to watch" is that the second has no one in the frame to
  // be wrong.
  if (relation.stance === "apparent") {
    bias.abstraction = 0.26;
    bias.human = -0.2;
    bias.energy = -0.18;
  }
  // A PASSIVE IS A SHOT OF SOMETHING HAVING IT DONE TO IT. Stiller, and
  // less human, because the agency has been moved out of the frame — that
  // is what the construction is for in English and it should be what it
  // looks like.
  if (relation.voice === "passive") {
    bias.energy = (bias.energy ?? 0) - 0.16;
    bias.human = (bias.human ?? 0) - 0.12;
  }
  // CAUSE RUNNING FORWARD is a thing arriving. Denser and more restless,
  // because the shot has somewhere to get to.
  if (relation.cause === "forward") {
    bias.density = 0.18;
    bias.energy = (bias.energy ?? 0) + 0.14;
  }
  // CAUSE RUNNING BACKWARD is a thing that was already true. Held.
  if (relation.cause === "backward") {
    bias.energy = (bias.energy ?? 0) - 0.2;
    bias.restraint = (bias.restraint ?? 0) + 0.16;
  }
  return bias;
}

/** The relation, in a sentence a director can disagree with.
 *
 *  Says what was READ, not what is true. A director who sees the agency
 *  reported backwards can say so — which is the entire reason for reading
 *  it deterministically rather than asking a model. */
export function describeRelation(relation: Relation | null): string {
  if (!relation) return "no relation read — the sentence names fewer than two things";
  const who = relation.agent?.text ?? "something";
  const whom = relation.patient?.text ?? "something";
  const core = `${who} → ${relation.action} → ${whom}`;
  const frame =
    relation.stance === "believed"
      ? ` · believed by ${relation.experiencer?.text ?? "someone"}, not asserted`
      : relation.stance === "apparent"
        ? " · apparent only, not asserted"
        : "";
  const emphasis =
    relation.topic && relation.topic !== relation.agent
      ? ` · the shot is about ${relation.topic.text}`
      : "";
  const cause =
    relation.cause === "forward"
      ? " · and caused it"
      : relation.cause === "backward"
        ? " · and was explained by it"
        : "";
  return core + frame + emphasis + cause;
}
