/* THE VISUAL IDEA — what a passage IS, not what its frames contain.
 *
 * THE REFRAMING THIS ANSWERS. Everything in this engine has been built by
 * asking "what primitives should exist and how should they animate". The
 * question a person who does this work actually asks is:
 *
 *     What is the visual idea, what is its behaviour, what is its rhythm,
 *     and what transformation does it undergo?
 *
 * Those are four different things and the engine had none of them as objects.
 * A passage was N INDEPENDENT SAMPLES from a latent space — each beat drew a
 * fresh point, so a paragraph had no beginning, no middle and no end. It could
 * not develop, because there was nothing there to develop: nothing persisted
 * across the beats of one passage except by accident.
 *
 * That is "it looks the same" at the scale of a paragraph, and it is the same
 * failure as every other level of this engine — variety without direction.
 *
 * SO AN IDEA IS A VECTOR, NOT A POINT. It has a FROM and a TO in the same
 * latent space everything else lives in, and each beat of its passage renders
 * a position along that path. A passage therefore ENDS somewhere it did not
 * begin, which is the minimum definition of development.
 *
 *   IDENTITY        where it starts — the passage's own signature and motif
 *   BEHAVIOUR       the shape of the journey: accumulate, drain, tighten…
 *   RHYTHM          how time maps onto that journey — steady, rushing, stalled
 *   TRANSFORMATION  what it has become by the end, which is the vector itself
 *
 * Nothing here reads a noun. A behaviour is a direction through a space of
 * material qualities; it never names a thing that could be drawn.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** THE BEHAVIOURS — each one a DIRECTION through the latent space.
 *
 *  The offsets are deltas applied to the starting point, so a behaviour is
 *  the same journey wherever it begins: "tighten" moves toward order from
 *  wherever this passage's identity happens to sit, which is why two passages
 *  that tighten look related without looking alike.
 *
 *  Indices are the six style factors then the six form factors:
 *    0 order  1 damage  2 weight  3 fill  4 contrast  5 machine
 *    6 articulation  7 orthogonality  8 profusion  9 closure
 *    10 rigidity  11 recession
 */
export const BEHAVIOURS = {
  /** Sparse becomes dense. The page fills as the argument accrues. */
  ACCUMULATE: { d: { 3: 0.55, 8: 0.5, 4: -0.15 } },
  /** Dense becomes empty. What was there leaves. */
  DRAIN: { d: { 3: -0.6, 8: -0.5, 9: -0.2 } },
  /** Loose becomes ordered. A thing resolving into sense. */
  TIGHTEN: { d: { 0: 0.6, 7: 0.45, 5: 0.3, 1: -0.2 } },
  /** Ordered comes apart. */
  UNRAVEL: { d: { 0: -0.6, 7: -0.4, 1: 0.35, 6: 0.3 } },
  /** Intact becomes damaged, and only damage moves — the same structure,
   *  worn. Distinct from unravelling, which changes what the structure IS. */
  ERODE: { d: { 1: 0.65, 4: -0.2 } },
  /** Soft becomes mechanical. The hand leaves and the machine arrives. */
  HARDEN: { d: { 5: 0.6, 7: 0.4, 10: 0.5, 6: -0.2 } },
  /** Buried becomes visible. Weight drops, contrast rises: a thing surfacing
   *  out of its own material. */
  SURFACE: { d: { 2: -0.4, 4: 0.5, 3: -0.3 } },
  /** …and its opposite. */
  BURY: { d: { 2: 0.5, 4: -0.35, 3: 0.4 } },
  /** It grows into a body — closure and articulation together. */
  SWELL: { d: { 9: 0.5, 6: 0.35, 8: 0.3 } },
  /** It recedes into space rather than sitting on the surface. */
  RECEDE: { d: { 11: 0.6, 2: -0.25, 4: -0.2 } },
};

const NAMES = Object.keys(BEHAVIOURS);

/** THE RHYTHMS — how a passage's own time maps onto its journey.
 *
 *  Two passages doing the same thing at different rhythms are different
 *  passages: one arrives steadily, one holds and then breaks. This is the
 *  "slows down to look at one thing then rushes" the operator asked for,
 *  expressed as a property of the idea rather than as a cut rate.
 */
export const RHYTHMS = {
  /** Even. The default, and unremarkable on purpose — something has to be. */
  STEADY: (t) => t,
  /** Almost nothing, then all of it. A held moment that breaks. */
  HELD_THEN_BREAK: (t) => (t < 0.68 ? t * 0.18 : 0.12 + ((t - 0.68) / 0.32) ** 0.7 * 0.88),
  /** All of it at once, then a long settle. */
  BURST_THEN_SETTLE: (t) => 1 - (1 - t) ** 0.35,
  /** In steps, so the passage arrives in stages rather than as a slide. */
  STEPPED: (t) => Math.round(t * 4) / 4,
  /** Accelerating. Each moment costs less than the one before. */
  RUSHING: (t) => t * t,
  /** It overshoots and comes back — the argument going too far and
   *  correcting, which is a real shape an essay makes. */
  OVERSHOOT: (t) => {
    const s = 1.7;
    const p = t - 1;
    return 1 + p * p * ((s + 1) * p + s);
  },
};

const RHYTHM_NAMES = Object.keys(RHYTHMS);

/** AUTHOR THE IDEA for a passage.
 *
 *  Behaviour and rhythm are chosen from what the writing is doing — its kind,
 *  its tempo, its weight, whether it returns — never from its subject.
 */
export function authorIdea(from, reading, rng, arc) {
  const kind = reading?.kind ?? "CLAIM";
  const tempo = reading?.tempo ?? 0.5;
  const weight = reading?.weight ?? 0.4;

  // The argument's own shape proposes a behaviour; several candidates each,
  // because one per kind would be a lookup table.
  const byKind = {
    QUANTITY: ["ACCUMULATE", "TIGHTEN", "HARDEN"],
    ENUMERATION: ["ACCUMULATE", "STEPPEDish", "TIGHTEN"],
    NEGATION: ["DRAIN", "ERODE", "UNRAVEL"],
    CONCESSION: ["RECEDE", "SURFACE", "DRAIN"],
    QUESTION: ["SURFACE", "SWELL", "RECEDE"],
    ATTRIBUTED: ["BURY", "RECEDE", "ERODE"],
    DIRECTIVE: ["HARDEN", "TIGHTEN", "SWELL"],
    EXPOSITION: ["ACCUMULATE", "SWELL", "RECEDE"],
    CLAIM: ["SURFACE", "TIGHTEN", "SWELL", "ACCUMULATE"],
  };
  const pool = (byKind[kind] ?? byKind.CLAIM).filter((n) => NAMES.includes(n));
  const behaviour = pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : "SURFACE";

  // A heavy passage holds and then breaks; a quick one rushes; a listing one
  // arrives in steps. The writing decides its own shape in time.
  const rhythm =
    weight > 0.66
      ? "HELD_THEN_BREAK"
      : tempo > 0.72
        ? "RUSHING"
        : kind === "ENUMERATION"
          ? "STEPPED"
          : rng() < 0.22
            ? RHYTHM_NAMES[Math.floor(rng() * RHYTHM_NAMES.length)]
            : "STEADY";

  // How FAR it travels. Late in a film an idea moves further, because by then
  // the audience has the vocabulary for it.
  const reach = 0.5 + (arc?.density ?? 0.5) * 0.5 + rng() * 0.3;

  const d = BEHAVIOURS[behaviour].d;
  const to = from.map((v, i) => clamp01(v + (d[i] ?? 0) * reach));

  return { behaviour, rhythm, from: [...from], to, reach };
}

/** Where the idea is, at `t` through its own passage.
 *
 *  This is what a beat samples instead of drawing a fresh independent point —
 *  so the beats of a passage are positions on one journey rather than N
 *  unrelated states, and the passage ends somewhere it did not begin.
 */
export function stateAt(idea, t) {
  const shaped = (RHYTHMS[idea.rhythm] ?? RHYTHMS.STEADY)(Math.max(0, Math.min(1, t)));
  return idea.from.map((v, i) => clamp01(v + (idea.to[i] - v) * shaped));
}

/** A short description, for the report and for measuring whether the film's
 *  ideas are as varied as its frames. */
export function ideaKey(idea) {
  return `${idea.behaviour}/${idea.rhythm}`;
}
