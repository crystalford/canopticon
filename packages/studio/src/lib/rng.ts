// Seeded randomness. Standing rule 4: nothing stochastic runs unseeded.
//
// THE DIVISION OF LABOUR HERE IS DELIBERATE AND IS A BUG FIX IN ADVANCE.
//
// Every seed in the film is DERIVED HERE, on the Worker, and travels to the
// browser as a plain number inside the FilmCut. The browser has `mulberry32`
// and nothing else — it is never given a string to hash.
//
// The old Lab and the old Worker each carried their own copy of the same
// rules and disagreed about 57 of 88 scenes. Two implementations of one
// function is how that happens. A PRNG is worse than most, because a drift
// in the string→u32 step changes every frame of every film silently and
// there is no error to notice. So there is exactly one `deriveSeed`, it is
// in this file, and it runs in exactly one place.

/** FNV-1a over the string, to an unsigned 32-bit seed. */
export function deriveSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // A separator, so ("ab","c") and ("a","bc") do not collide.
    h ^= 0x1f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The generator itself. Byte-identical to `lab/core/rng.js` — if you change
 *  one, change both, and expect every existing film to become a different
 *  film. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random film seed, for a film the operator did not pin. This is the ONE
 *  place a number arrives from outside the deterministic world, and it is
 *  written onto the record immediately — so the film stays reproducible
 *  forever after, which is the whole point of storing it. */
export function freshFilmSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}
