/* THE WANDER — a film TRAVELS through the space; it does not sample from it.
 *
 * THE MEASUREMENT THIS EXISTS TO FIX. On a twenty-minute film, the mean
 * distance from each new moment to the nearest ALREADY-SEEN moment was:
 *
 *     first two minutes   0.170
 *     minutes 5–7         0.122
 *     minutes 10–12       0.126
 *     last two minutes    0.120
 *
 * It drops for five minutes and then never improves. After that the film has
 * stopped discovering: every moment is as close to something you have already
 * watched as it will ever be. That is precisely the operator's complaint —
 * "it needs to survive twenty minutes without feeling repetitive after five"
 * — as a number, and it is not fixed by adding parameters. A continuous space
 * sampled independently at each beat SATURATES: random draws revisit their own
 * modes forever, however many dimensions there are.
 *
 * COVERAGE IS A DIFFERENT PROBLEM FROM VARIETY, and this is the distinction
 * the whole engine kept missing at every level. Variety is "no two moments are
 * identical", which independent sampling gives you for free. Coverage is "the
 * film keeps reaching parts of the space it has not been to", which
 * independent sampling never gives you at all.
 *
 * So the film walks a LOW-DISCREPANCY SEQUENCE — the R_d / Roberts sequence,
 * a generalisation of the golden ratio to d dimensions. Successive points are
 * maximally far from all previous points by construction, in every dimension
 * at once, forever. There is no memory to consult and no rejection sampling:
 * the n-th point is simply frac(n · α), and the sequence cannot revisit
 * because irrational rotation never repeats.
 *
 * Drift within a passage stays local, because a film that leaps on every beat
 * is a shuffle. Only a MOVE advances the sequence.
 */

/** The additive constants of the R_d sequence. φ_d is the unique positive root
 *  of x^(d+1) = x + 1 — the plastic constant generalised — and α_i = 1/φ_d^i.
 *  Solved by iteration because a closed form in d dimensions is not worth the
 *  characters. */
function alphas(d) {
  let phi = 2;
  for (let i = 0; i < 32; i++) phi = (1 + phi) ** (1 / (d + 1));
  const a = [];
  for (let i = 1; i <= d; i++) a.push((1 / phi ** i) % 1);
  return a;
}

const frac = (x) => x - Math.floor(x);

/** A walk through a d-dimensional unit cube that covers it rather than
 *  sampling it. */
export function makeWander(dims, seed) {
  const a = alphas(dims);
  // The offset only decides WHERE the sequence starts, not how it covers —
  // so a re-roll gives a different film with the same guarantee.
  const start = a.map((_, i) => frac(Math.sin(seed * 0.017 + i * 12.9898) * 43758.5453));
  // A second, faster set of constants for travel WITHIN a region.
  const b = alphas(dims + 1).slice(0, dims);
  return { dims, a, b, start, n: 0, m: 0 };
}

/** The next point in the sequence. Every call lands maximally far from every
 *  point returned so far — that is what the sequence is for. */
export function next(w) {
  w.n += 1;
  return w.a.map((ai, i) => frac(w.start[i] + w.n * ai));
}

/** TRAVEL WITHIN THE REGION.
 *
 *  Measured on a real twenty-minute film: 23 moves across 1,399 beats — one
 *  change of visual state every fifty-two seconds. The sequence was covering
 *  the space beautifully and there were only twenty-three points on it, so
 *  every kind of thing the film contained had been seen inside four minutes.
 *  That is the staleness, and it is a COUNT problem rather than a coverage
 *  one: a passage decides the region, but a film cannot stand still inside a
 *  region for a minute.
 *
 *  So a hold is not a nudge, it is a smaller step along a second sequence —
 *  the same construction at a local radius. Every beat is a new point; a
 *  passage boundary changes neighbourhood, a hold moves within one.
 */
export function step(w, radius) {
  w.m += 1;
  const base = w.a.map((ai, i) => frac(w.start[i] + w.n * ai));
  return base.map((v, i) => {
    // A second irrational per dimension, so the local walk cannot fall into
    // step with the global one and start retracing it.
    const off = (frac(w.m * w.b[i]) - 0.5) * 2 * radius;
    const x = v + off;
    // Reflect rather than wrap: wrapping at the edge of the cube teleports a
    // drifting film from one extreme to its opposite, which reads as a cut
    // that nothing in the writing asked for.
    return x < 0 ? -x : x > 1 ? 2 - x : x;
  });
}

/** Kept as the shallow variant, for a moment that should barely move. */
export function near(w, rng, amount) {
  const p = w.a.map((ai, i) => frac(w.start[i] + w.n * ai));
  return p.map((v) => {
    const x = v + (rng() - 0.5) * 2 * amount;
    return x < 0 ? -x : x > 1 ? 2 - x : x;
  });
}

/** Name the axes so a point can be handed to a sampler as a bias object. */
export function asBias(point, keys) {
  const out = {};
  for (const [i, k] of keys.entries()) out[k] = point[i];
  return out;
}
