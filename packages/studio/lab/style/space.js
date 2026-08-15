/* THE STYLE SPACE — a look is a POINT, not a row in a table.
 *
 * WHAT WAS WRONG WITH EVERYTHING BEFORE THIS FILE, and it took nine rounds to
 * hear: every visual decision in the engine was a SELECTION FROM A LIST.
 * WORLDS had ten entries. TREATMENTS thirteen. LAYOUTS eleven. PROCESSES six.
 * REGISTERS five. That is a preset system — a large one, some eight thousand
 * combinations — but they are combinations of the same hand-typed parts, which
 * is precisely why every film read as one thing. You can SEE `COLLAGE`,
 * because `COLLAGE` is a row somebody wrote, and once you have seen it twice
 * you have seen it.
 *
 * A preset system cannot produce a look that its author did not think of. That
 * ceiling is the whole complaint, and no amount of adding rows raises it.
 *
 * So there are no named looks here. There is a CONTINUOUS SPACE, and a style
 * is a point sampled from it — around forty dimensions, none of which is
 * "collage" or "terminal" or any other name. Two samples are never the same
 * point, so a film never repeats a look and no look is recognisable as a
 * preset, because none of them is one.
 *
 * WHY IT IS NOT NOISE. Sampling forty independent dimensions gives forty
 * dimensions of mush — the reason preset tables exist at all is that they
 * encode which combinations hold together. That coherence is kept and the
 * table is not: SIX LATENT FACTORS drive everything. A style samples the
 * factors, and the forty parameters are derived from them plus a little
 * independent play. High `damage` pulls tonal steps down, grain up, edges
 * ragged and alignment loose ALL AT ONCE, because in the physical world those
 * travel together. The result is coherent and unrepeatable, which is what a
 * generative system is and what a menu can never be.
 *
 * Nothing here reads the essay. This is the space of possible looks; what
 * moves through it is decided elsewhere, by the writing.
 */

/** THE LATENT FACTORS. Six numbers that between them decide what kind of
 *  object the image is. Everything else follows from these, which is what
 *  keeps a random point in a forty-dimensional space from being sludge. */
export const FACTORS = [
  /** chaotic ↔ strict. Whether the page obeys a grid at all. */
  "order",
  /** pristine ↔ destroyed. How much the process damages what it prints. */
  "damage",
  /** airy ↔ black. How much ink is on the page and how heavy the forms are. */
  "weight",
  /** empty ↔ packed. How much is happening at once. */
  "fill",
  /** uniform ↔ extreme. The ratio between the largest and smallest thing. */
  "contrast",
  /** organic ↔ mechanical. Whether the hand or the machine made it. */
  "machine",
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** A value near the middle far more often than at the ends. */
const mid = (rng) => (rng() + rng()) / 2;

/** COMMITTED. Pushed toward one end or the other, hard.
 *
 *  The previous version of this squeezed toward 0.3/0.7 and the one above it
 *  toward 0.5, so NO DIMENSION EVER REACHED AN EXTREME. Measured on a real
 *  film: mean frame tone 0.484 with under 3% midtone — every frame roughly
 *  half black and half white, forever. That is not a coincidence, it is these
 *  two functions: a film built from dimensions that always sit near the middle
 *  has no empty frames and no packed ones, no quiet and no loud, and reads as
 *  one texture however many parameters vary underneath.
 *
 *  I wrote them to avoid "uniformly deranged" output and produced uniformly
 *  average output instead, which is worse — deranged is at least memorable. */
const polar = (rng) => {
  const v = rng();
  const k = 3.2; // how hard it commits
  return v < 0.5 ? 0.5 * (2 * v) ** k : 1 - 0.5 * (2 * (1 - v)) ** k;
};

/** Sample a style. Every call returns a point that has not been visited.
 *
 *  `bias` lets the caller lean the space without naming a look — the film's
 *  own arc pushes `damage` up over its length, a loud passage pushes `weight`,
 *  and none of that requires a preset to exist.
 */
export function sampleStyle(rng, bias = {}, palette) {
  const f = {
    order: clamp01((bias.order ?? polar(rng)) + (rng() - 0.5) * 0.12),
    damage: clamp01((bias.damage ?? mid(rng) * 0.85) + (rng() - 0.5) * 0.12),
    weight: clamp01((bias.weight ?? polar(rng)) + (rng() - 0.5) * 0.12),
    fill: clamp01((bias.fill ?? mid(rng)) + (rng() - 0.5) * 0.12),
    contrast: clamp01((bias.contrast ?? polar(rng)) + (rng() - 0.5) * 0.12),
    machine: clamp01((bias.machine ?? polar(rng)) + (rng() - 0.5) * 0.12),
  };
  return derive(f, rng, palette);
}

/** Move to a NEARBY point. A film that jumps to an unrelated style every time
 *  the writing moves is a shuffle; one that travels through the space has a
 *  direction. `amount` is how far — a paragraph break is a step, a section is
 *  a leap. */
export function driftStyle(style, rng, amount) {
  const f = {};
  for (const k of FACTORS) {
    f[k] = clamp01(style.f[k] + (rng() - 0.5) * 2 * amount);
  }
  return derive(f, rng, style.palette);
}

/** THE DERIVATION. Forty parameters from six factors. This function is the
 *  actual design work — it is where "high damage and low tonal range travel
 *  together" is stated, which is the knowledge a preset table used to hold
 *  implicitly in each of its rows. */
function derive(f, rng, palette) {
  const j = (n) => (rng() - 0.5) * n;
  // Commit a factor that arrived near the middle, so a derived dial can still
  // reach its ends even when the latent point is unremarkable.
  const polarOf = (v) => (v < 0.5 ? 0.5 * (2 * v) ** 2.4 : 1 - 0.5 * (2 * (1 - v)) ** 2.4); // a little independent play

  // ── the image itself ───────────────────────────────────────────────────
  // How many values exist between black and white. THIS is the dimension
  // whose absence made every frame of every film 96–99% pure black or white:
  // the old engine had one press and it always thresholded.
  const inverted = f.weight > 0.55;

  return {
    f,

    /* COLOUR — which this engine has never had at all.
     *
     * Every frame ever rendered was greyscale, because `ground` and `ink`
     * were scalars and the press interpolated between them. Saturation is its
     * own dimension so a sample can be fully monochrome, fully saturated, or
     * anywhere between; `machine` pushes hues apart because a printed thing
     * and a screen thing disagree about how colour behaves. */
    // THE PALETTE TRAVELS SLOWLY WHILE EVERYTHING ELSE TRAVELS FAST.
    //
    // Sampled per beat, hue strobed: a film cutting every second through
    // independent random hues is a fault, not a colour scheme. The palette
    // comes from its own slow walk and the beat only varies WITHIN it.
    palette,
    hue: Math.round(((palette?.hue ?? rng() * 360) + j(24)) % 360),
    hue2: Math.round(((palette?.hue2 ?? rng() * 360) + j(30)) % 360),
    sat: clamp01((palette?.sat ?? (1 - f.damage) * 0.5 + f.machine * 0.5) + j(0.18)),

    /* IMAGE */
    // 2 = a photocopy, 256 = a clean impression, and everything between.
    // REACHABLE. The old expression needed damage, machine and weight all near
    // 1 simultaneously to leave 256, so on a real film it was 256 on all 111
    // beats — a dial with one value. Driven by a single committed factor now.
    steps: [2, 2, 3, 4, 6, 12, 256][Math.floor(polarOf(f.damage) * 6.99)],
    // A CONTRAST FLOOR. Ground and ink were derived independently, so a
    // sample could put light type on a light ground and the words vanished —
    // the operator reported white on white and black on black. Legibility is
    // not a taste question here: a film whose words cannot be read has failed
    // at the only thing it does. The floor is on LIGHTNESS, so colour is free
    // to do whatever it likes above it.
    ...contrasted(
      inverted ? lerp(0.02, 0.16, 1 - f.weight) : lerp(0.99, 0.82, f.weight),
      inverted ? lerp(0.86, 1, f.contrast) : lerp(0.12, 0.02, f.contrast),
    ),
    // Zero is a PERFECTLY CLEAN frame. The old renderer ran its grain field
    // unconditionally on every frame ever made, so this value could not be
    // reached and no film could contain a clean image.
    grain: clamp01(f.damage * 1.25 - 0.15 + j(0.1)),
    grainScale: lerp(0.25, 2.4, f.machine + j(0.2)),
    wear: clamp01(f.damage * 0.9 + j(0.1)),
    bite: clamp01(f.damage * f.damage * 1.1 + j(0.08)),
    // How soft the boundary between ink and paper is. Hard at high machine.
    edge: lerp(0.22, 0.01, f.machine),
    // A dot screen's pitch, in fractions of frame height. 0 = no screen.
    screen: f.machine > 0.62 ? lerp(0.004, 0.03, 1 - f.order) : 0,
    scanline: f.machine > 0.78 ? lerp(0.2, 0.6, f.damage) : 0,
    registration: lerp(0, 3.2, f.damage * (1 - f.machine)),

    /* LIGHT — which this engine has never had in any form.
     *
     * Everything was flat coverage: a mark was on or off and the frame had no
     * direction, no depth and no atmosphere. Chiaroscuro does three jobs at
     * once and the middle one is the one this engine most needs — depth,
     * VISUAL HIERARCHY, and mood. A lit element is the important element,
     * which is composition work that no amount of placement can do. */
    lightAngle: rng() * Math.PI * 2,
    /** Hard light is dramatic and directional; soft is diffuse and intimate.
     *  Film noir and a cloudy afternoon are the same dial. */
    lightHard: clamp01(f.machine * 0.5 + f.contrast * 0.6 + j(0.2)),
    lightThrow: lerp(0.004, 0.075, clamp01(f.contrast * 0.8 + j(0.25))),
    /** How much of the frame is in shadow at all. At 0 the image is evenly
     *  lit — which is where every frame has been until now. */
    // COMMITTED, LIKE EVERY OTHER DIMENSION THAT MATTERS. Measured: adding
    // light made the perceptual distance between frames WORSE — 0.325 to
    // 0.216 — because a mid-range value put a similar soft gradient on every
    // frame and homogenised them. A film needs frames that are flat graphic
    // objects with no light at all, and frames that are almost entirely
    // shadow. The middle of this dial is where atmosphere becomes haze.
    lightDepth: polar(rng) < 0.34 ? 0 : lerp(0.3, 1, polar(rng)),
    /** Whether the light falls ACROSS the frame or picks out one region. A
     *  raking gradient is atmosphere; a pool of light is hierarchy. */
    lightFocus: polar(rng),

    /* TYPE */
    weightAxis: lerp(300, 900, clamp01(f.weight * 1.1 + j(0.15))),
    tracking: lerp(-0.5, 2.4, clamp01((1 - f.fill) * 0.7 + f.order * 0.3 + j(0.2))),
    // How much the faces on one page disagree. 0 = one face throughout.
    faceEntropy: clamp01((1 - f.order) * 1.1 + j(0.2)),
    caseMix: clamp01(f.weight * 0.8 + j(0.3)),
    // Scale range as a fraction of frame height. `contrast` opens the gap.
    scaleMin: lerp(0.02, 0.06, 1 - f.contrast),
    scaleMax: lerp(0.10, 0.62, f.contrast * 0.8 + f.weight * 0.3),

    /* SETTING — synthetic axes. Four self-hosted faces cannot be a hundred
       typefaces, but a face at 40% width, sheared 14° and stroked is not the
       same object as the face it came from. Width, shear and a per-run
       perspective multiply four into a great many. */
    widthScale: lerp(0.42, 1.9, clamp01(f.contrast * 0.6 + j(0.4) + 0.3)),
    shear: lerp(-0.42, 0.42, clamp01((1 - f.order) * 0.8 + j(0.4))) * (rng() < 0.55 ? 0 : 1),
    /** Type set INTO the frame's depth rather than on its surface. */
    typeDepth: rng() < lerp(0.05, 0.5, 1 - f.order) ? lerp(0.15, 0.85, rng()) : 0,

    /** HOW MUCH THE WORDS BIND TO THE FORM. At 0 they are two systems sharing
     *  a canvas — which is what they have been. At 1 the type is placed on the
     *  form's own skeleton: along a limb, at a tip, inside a membrane. */
    attachment: clamp01((1 - f.order) * 0.5 + f.fill * 0.6 + j(0.35)),

    /* SETTING — what used to be thirteen named treatments is now four
       continuous dimensions, so `line`, `arc`, `column` and `perLetter` are
       regions of one space and everything between them exists too. */
    curvature: clamp01((1 - f.order) * (1 - f.machine) * 1.6 + j(0.15)) * 0.9,
    glyphJitter: clamp01((1 - f.order) * 1.3 - 0.25 + j(0.2)),
    verticality: rng() < lerp(0.02, 0.4, 1 - f.order) ? lerp(0.4, 1, rng()) : 0,
    stacking: clamp01(f.fill * 0.8 + (1 - f.order) * 0.3 + j(0.25)),
    stroke: rng() < lerp(0.02, 0.35, 1 - f.weight) ? lerp(0.006, 0.03, f.contrast) : 0,

    /* THE PICTURE AS A WHOLE — what was entirely missing.
     *
     * Nothing decided what the FRAME was doing. A form got a random position,
     * the type either bound to it or went to the grid, and the result was
     * always "some things at middling density somewhere in the middle". These
     * are the dimensions of a composition rather than of its contents, and
     * they are deliberately committed: a film needs frames that are nearly
     * empty and frames that are packed, not a hundred frames at 50%. */
    occupancy: lerp(0.015, 0.95, polar(rng)),
    /** 0 spreads the mass evenly, 1 puts almost all of it in one element. */
    focus: polar(rng),
    /** Where the mass sits: 0 dead centre, 1 pinned to an edge. */
    eccentric: polar(rng),
    /** The ratio between the largest and smallest thing on the frame. */
    scaleSpread: lerp(1.1, 14, polar(rng)),

    /* PLACEMENT — what used to be eleven named layouts. */
    gridStrength: clamp01(f.order * 1.25 - 0.1 + j(0.12)),
    columns: 1 + Math.round(lerp(0, 8, f.order * 0.7 + f.fill * 0.5)),
    margin: lerp(0.005, 0.14, f.order * 0.8 + (1 - f.fill) * 0.4),
    angleMean: lerp(-90, 90, rng()) * lerp(0, 1, 1 - f.order),
    angleSpread: lerp(0.5, 62, (1 - f.order) * (1 - f.machine) + j(0.1)),
    radiality: clamp01((1 - f.order) * 0.9 - f.machine * 0.4 + j(0.2)),
    scatter: clamp01((1 - f.order) * 1.1 + j(0.2)),
    overlap: clamp01(f.fill * 1.2 - f.order * 0.4 + j(0.2)),
    bleed: clamp01(f.contrast * 0.9 + (1 - f.order) * 0.3 + j(0.2)),
    density: clamp01(f.fill * 1.15 + j(0.15)),

    /* FURNITURE */
    rules: clamp01(f.order * 1.1 + j(0.25)),
    blocks: clamp01(f.weight * 1.2 - 0.1 + j(0.25)),
    bars: clamp01(f.weight * 0.7 + (1 - f.order) * 0.5 + j(0.25)),
    screens: clamp01(f.machine * 0.8 + f.damage * 0.4 + j(0.2)),
    crops: clamp01(f.order * 0.6 + f.machine * 0.4 + j(0.2)),

    /* MOTION */
    attack: lerp(40, 520, (1 - f.machine) * 0.7 + f.order * 0.4),
    drift: lerp(0, 0.05, (1 - f.machine) * 0.8 + j(0.1)),
    push: lerp(-2, 3.4, rng()) * lerp(0.2, 1, 1 - f.order),
    boilHz: f.machine > 0.7 ? 0 : Math.round(lerp(4, 16, 1 - f.machine)),
  };
}

/** A short, stable fingerprint of a style — for measuring whether the engine
 *  is actually visiting new points or circling a few. */
export function styleKey(s) {
  return FACTORS.map((k) => Math.round(s.f[k] * 20)).join(",");
}


/** Push a ground and an ink apart until they can be told from each other.
 *  0.42 of the lightness range is roughly where type stops being readable at
 *  the sizes this engine sets. */
const CONTRAST_FLOOR = 0.42;

function contrasted(ground, ink) {
  const gap = ink - ground;
  if (Math.abs(gap) >= CONTRAST_FLOOR) return { ground, ink };
  const mid = (ground + ink) / 2;
  const half = CONTRAST_FLOOR / 2;
  const dir = gap >= 0 ? 1 : -1;
  return {
    ground: Math.max(0, Math.min(1, mid - dir * half)),
    ink: Math.max(0, Math.min(1, mid + dir * half)),
  };
}
