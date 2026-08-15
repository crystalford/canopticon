/* MOTIFS — a persistent visual identity that changes form.
 *
 * NOT AN OBJECT, AND NOT A REPEAT. The distinction is the whole point. If an
 * idea returns three minutes later, showing the same text again is a
 * repetition; the visual system REMEMBERING it is storytelling. A motif is
 * something the audience never names and always feels: they know they have
 * seen this before, without being able to say what "this" is.
 *
 * THE SPINE ALREADY EXISTED AND WAS DEAD. `cut.motifs` carries the essay's own
 * recurring phrases with an arc — escalate, degrade, survive, invert — and
 * every beat carries `motif: {id, treatment}` where treatment is one of
 * establish / repeat / degrade / restate. All of it computed, all of it
 * correct, and a grep of the entire renderer found ZERO references. The same
 * failure this codebase has produced before: a complete grammar sitting one
 * wire short of the screen. It is wired now.
 *
 * A MOTIF OWNS AN IDENTITY, NOT A PICTURE. Its identity is a point in the same
 * latent space everything else lives in, derived from the motif's OWN PHRASE —
 * so what it looks like comes from what it is, and the same motif in two
 * different films looks different because the films' spaces are anchored
 * elsewhere. Each appearance TRANSFORMS that point rather than replaying it,
 * and the transformation is what the audience reads as development.
 *
 * THE VERBS. Not effects — relations between an identity and its own history:
 *
 *   INTRODUCE   precise, small, ordered, undamaged. A thing being stated.
 *   AMPLIFY     the same identity, larger and denser. It has grown.
 *   CONTRADICT  inverted polarity, fractured, its own opposite.
 *   CONTAMINATE it appears inside another motif's field, bleeding into it.
 *   RECALL      returned intact but worn — the time between shows on it.
 *   TRANSFORM   the identity moved: recognisably itself, materially other.
 *   COLLAPSE    what it was, coming apart.
 *
 * Nothing here reads a noun. A motif's identity comes from the letters of its
 * own phrase and from how many times it has been seen.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Project a phrase into the latent space. The motif's look is a function of
 *  its own words, so it is stable across a film and different across films. */
function identity(phrase, dims) {
  let h = 2166136261;
  for (let i = 0; i < phrase.length; i++) {
    h ^= phrase.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = [];
  for (let k = 0; k < dims; k++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(((h >>> 0) % 10000) / 10000);
  }
  return out;
}

/** Build the film's motif ledger from what the editor already found. */
export function makeMotifs(cut, dims) {
  const m = new Map();
  for (const mo of cut.motifs ?? []) {
    m.set(mo.id, {
      id: mo.id,
      phrase: mo.phrase,
      arc: mo.arc,
      point: identity(mo.phrase, dims),
      seen: 0,
      wear: 0,
      lastAt: -Infinity,
    });
  }
  return m;
}

/** WHICH VERB THIS APPEARANCE IS.
 *
 *  Decided from the motif's own history and the essay's declared arc, never
 *  from the passage's subject. A motif seen once is being introduced; seen
 *  again soon it is amplified; seen again after a long gap it is recalled, and
 *  the gap itself is what makes a recall feel like one. An essay that declares
 *  a degrading arc gets contradiction and collapse late.
 */
export function verbFor(motif, treatment, atMs, u) {
  const gap = atMs - motif.lastAt;
  if (motif.seen === 0) return "INTRODUCE";
  if (treatment === "degrade") return u > 0.75 ? "COLLAPSE" : "CONTRADICT";
  if (treatment === "restate") return "RECALL";
  // A LONG SILENCE MAKES A RECALL. Returning after eight seconds is
  // continuation; returning after a minute is memory, and they should not look
  // the same.
  if (gap > 24000) return motif.arc === "invert" ? "CONTRADICT" : "RECALL";
  if (motif.arc === "escalate") return "AMPLIFY";
  if (motif.arc === "degrade" && u > 0.6) return "COLLAPSE";
  return motif.seen > 2 ? "TRANSFORM" : "AMPLIFY";
}

/** Apply a verb. Returns the latent point this appearance sits at, plus the
 *  overrides that make the verb legible as itself. */
export function invoke(motif, verb, atMs, rng) {
  motif.seen += 1;
  motif.lastAt = atMs;
  const p = [...motif.point];
  const jog = (i, d) => {
    p[i] = clamp01((p[i] ?? 0.5) + d);
  };
  const out = { point: p, over: {} };

  switch (verb) {
    case "INTRODUCE":
      // Precise, small, undamaged. A thing being stated for the first time.
      out.over = { order: 0.85, damage: 0.05, fill: 0.2, occupancy: 0.16, focus: 0.85 };
      break;
    case "AMPLIFY":
      // The same identity with more of it. Not a new place — a louder one.
      motif.wear = clamp01(motif.wear + 0.06);
      jog(2, 0.16);
      out.over = { fill: 0.8, occupancy: 0.72, contrast: 0.8 };
      break;
    case "CONTRADICT":
      // Its own opposite: the identity mirrored through the centre of the
      // space, which is recognisably related and materially against it.
      motif.wear = clamp01(motif.wear + 0.14);
      for (let i = 0; i < p.length; i++) p[i] = 1 - p[i];
      out.over = { damage: clamp01(0.4 + motif.wear), invert: true, contrast: 0.9 };
      break;
    case "CONTAMINATE":
      // It appears inside something else's field. Weak, off-centre, present.
      jog(0, (rng() - 0.5) * 0.3);
      out.over = { occupancy: 0.3, focus: 0.2, fill: 0.35 };
      break;
    case "RECALL":
      // Intact, and the time between shows on it. This is the one that makes
      // an audience feel they have been here before.
      motif.wear = clamp01(motif.wear + 0.18);
      out.over = { damage: clamp01(0.25 + motif.wear), order: 0.6, occupancy: 0.45 };
      break;
    case "TRANSFORM":
      // Moved, but not replaced: a bounded step, so it stays recognisable.
      motif.wear = clamp01(motif.wear + 0.1);
      for (let i = 0; i < p.length; i++) p[i] = clamp01(p[i] + (rng() - 0.5) * 0.34);
      motif.point = p;
      out.over = { damage: clamp01(0.2 + motif.wear) };
      break;
    case "COLLAPSE":
      motif.wear = clamp01(motif.wear + 0.3);
      out.over = { damage: clamp01(0.65 + motif.wear * 0.35), order: 0.1, occupancy: 0.85 };
      break;
    default:
      break;
  }
  return out;
}

/** THE TRACE A MOTIF LEAVES BEHIND.
 *
 *  A motif that has been seen recently pulls the film slightly toward itself
 *  even in passages that do not carry it, which is the difference between a
 *  film with recurring images and a film with a memory. It decays, so the
 *  pull is strongest just after an appearance and gone a minute later.
 */
export function trace(motifs, atMs) {
  let best = null;
  let weight = 0;
  for (const m of motifs.values()) {
    if (m.seen === 0) continue;
    const w = Math.exp(-(atMs - m.lastAt) / 18000);
    if (w > weight) {
      weight = w;
      best = m;
    }
  }
  return best ? { point: best.point, weight: Math.min(0.4, weight * 0.4) } : null;
}
