/* TRANSITIONS — how one state becomes the next.
 *
 * THE GAP THIS FILLS: the engine had no cutting vocabulary whatsoever. A
 * beat's units faded in over 300ms or snapped in over 120, and that was the
 * entire repertoire — every change in the film was the same change. So even
 * once the film had genuinely different KINDS of page to move between, it
 * moved between them the same way every time, and a page turn read as a
 * dissolve rather than as an edit.
 *
 * These are not effects applied to a shot. They are what the press and the
 * camera do AT the boundary: the sheet is yanked through, the plate slips,
 * the lamp flashes, the paper tears and re-registers. Each is a short
 * function of time over the whole frame, resolved analytically like
 * everything else, so frame 900 drawn directly is frame 900.
 *
 * ON REPETITION. Repeating a transition is a style, not a fault — a film
 * that cuts the same way four times in a row is making a point. What is a
 * fault is having only one way to cut. So the chooser weights by editorial
 * position and lets a run happen; it just never has to.
 */

/** Every transition is: how long, and what it does to the frame while it
 *  runs. `slice` and `flash` are read by the renderer; the rest ride the
 *  plate the compositor already moves. */
export const TRANSITIONS = {
  /** No transition. The state is simply different on the next frame, which
   *  at a page turn is the hardest and often the best edit available. */
  CUT: { ms: 0 },

  /** The lamp. One or two frames of pure ink or pure ground before the new
   *  page resolves — the cheapest way to make a cut feel struck. */
  FLASH: { ms: 130, flash: 1 },

  /** The sheet yanked through the press. The whole plate travels off one
   *  edge and the new state arrives already moving. */
  ROLL: { ms: 280, roll: 1 },

  /** A punch in scale that decays. Weight, not speed. */
  SLAM: { ms: 240, punch: 1 },

  /** The page torn and re-registered slightly wrong — horizontal bands
   *  offset against each other, settling as the impression takes. */
  TEAR: { ms: 320, slice: 1 },

  /** Alternating polarity at the boil rate. Three or four frames, no more:
   *  this is a strike, not a strobe effect. */
  STRIKE: { ms: 200, strike: 1 },

  /** A hard edge sweeping across, uncovering the new state. The one
   *  transition that reads as a graphic rather than as a mechanism. */
  WIPE: { ms: 300, wipe: 1 },
};

const NAMES = Object.keys(TRANSITIONS);

/** Which edit this boundary is.
 *
 *  Reads the beat's editorial position and whether the page turned — never a
 *  noun, never a topic, same guarantee as everything upstream.
 */
export function chooseTransition(beat, turned, rng, chaos) {
  const vi = beat.visualIntent;
  const role = beat.editorialRole;

  // A rest does not get an edit. Arriving at silence with a bang is the
  // opposite of what a rest is for.
  if (role === "rest") return "CUT";

  // A burst inside a MONTAGE is already a cut; giving it a mechanism as well
  // makes a fast passage read as mush.
  //
  // But `rhythm: "burst"` is set on every subdivision, and most subdivisions
  // are long holds broken up for pace rather than montage bursts. Testing
  // rhythm alone sent three quarters of the film down this branch and the
  // whole transition vocabulary went unused — six ways to cut, and CUT
  // chosen 29 times out of 39.
  if (vi.rhythm === "burst" && vi.continuity === "interrupt") {
    return rng() < 0.25 ? "FLASH" : "CUT";
  }

  const weights = {
    CUT: 1.4 + (turned ? 1.2 : 0),
    FLASH: 0.5 + vi.intensity * 1.4 + (role === "turn" ? 1.2 : 0),
    ROLL: 0.35 + (turned ? 0.9 : 0),
    SLAM: 0.3 + (role === "assert" || role === "escalate" ? 1.6 : 0),
    TEAR: 0.25 + vi.instability * 1.8 + chaos * 0.6,
    STRIKE: 0.2 + (role === "turn" ? 1.0 : 0) + chaos * 0.5,
    WIPE: 0.4 + (turned ? 1.0 : 0) + vi.density * 0.5,
  };
  let total = 0;
  for (const n of NAMES) total += weights[n];
  let pick = rng() * total;
  for (const n of NAMES) {
    pick -= weights[n];
    if (pick <= 0) return n;
  }
  return "CUT";
}

/** Resolve a transition at a moment. Returns null once it has run out, which
 *  is most of the time — a transition is an event, not a state. */
export function resolveTransition(name, startMs, tMs, seed) {
  const T = TRANSITIONS[name];
  if (!T || !T.ms) return null;
  const p = (tMs - startMs) / T.ms;
  if (p < 0 || p >= 1) return null;
  // Everything decays toward the settled frame; nothing lands abruptly at
  // full strength and stops.
  const k = 1 - p;
  const out = { plate: { x: 0, y: 0, scale: 1, rot: 0 }, flash: 0, slice: 0, wipe: -1 };

  if (T.flash) out.flash = p < 0.45 ? 1 : 0;
  if (T.strike) out.flash = Math.floor(p * 5) % 2 === 0 ? 1 : 0;
  if (T.punch) {
    out.plate.scale = 1 + k * k * 0.16;
    out.plate.rot = (((seed >>> 7) % 200) / 100 - 1) * k * 1.6;
  }
  if (T.roll) {
    // Off the edge and back. The new page is already travelling when it
    // arrives, which is what makes it read as a sheet rather than a slide.
    out.plate.y = -k * k * 0.85;
    out.plate.scale = 1 + k * 0.05;
  }
  if (T.slice) out.slice = k;
  if (T.wipe) out.wipe = p;
  return out;
}
