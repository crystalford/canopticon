/* The generator, and ONLY the generator.
 *
 * There is deliberately no `deriveSeed` here. Every seed in the film is
 * derived on the Worker (src/lib/rng.ts) and travels in the FilmCut as a
 * plain number. The browser is only ever GIVEN a seed; it never hashes a
 * string into one.
 *
 * That asymmetry is a bug fix in advance. Two copies of a string→u32 step
 * that drift apart change every frame of every film silently, with no error
 * to notice — and the old Lab and Worker each carrying their own copy of
 * one rule is exactly how they came to disagree about 57 of 88 scenes.
 *
 * `mulberry32` below IS duplicated from the Worker, and must stay
 * byte-identical. It is fifteen lines with no dependencies, and the
 * determinism test compares their output.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, seekable value noise. Used wherever drift or turbulence
 *  is wanted, precisely BECAUSE it is a pure function of (seed, x, y) and
 *  not of what the previous frame did. */
export function noise2(seed, x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.0001) * 43758.5453;
  return n - Math.floor(n);
}
