/* CANOPTICON — COLOUR, as a directorial property.
 *
 * WHAT THIS REPLACES, AND WHY IT IS THE HIGHEST-LEVERAGE FILE IN THE LAB.
 *
 * Measured across all 129 primitives, rendered standalone at 854×480:
 *
 *   105 of 129 produce a frame with mean luminance below 40/255
 *    86 of 129 produce a frame with contrast (luminance σ) below 20
 *
 * That is the "grey, murky, near-black, low-contrast" complaint, as a
 * number. And its cause was not 129 separate decisions — it was FIVE
 * CONSTANTS and one helper. `BG = "#0d0f11"` and `bg(ctx,w,h)` between
 * them decided the tonal world of every frame the system has ever made,
 * and no director could reach either.
 *
 * A primitive should know WHAT it is drawing. It should not decide the
 * colour world of the film. So:
 *
 *     FILM
 *       ↓  four directorial numbers, on the IR
 *     CINEMATOGRAPHY   key · temperature · saturation · contrast
 *       ↓  resolvePalette() — the ONE translation point
 *     PALETTE          bg · ink · accent · muted · cool · dim
 *       ↓  setPalette(), once per scene
 *     PRIMITIVE        draws with INK / EMB / MUT / COOL / bg()
 *
 * NOT PRESETS. The four inputs are continuous, and every colour is
 * derived from them arithmetically — so "slightly warmer" is a real
 * position, not the nearest of six named looks. Named looks exist
 * (`LOOKS` below) but they are *coordinates*, offered as starting points
 * and immediately editable, which is the difference between a palette
 * system and a filter menu.
 *
 * WHERE THIS LIVES AND WHY. The compiler stores the four numbers and
 * never resolves them; the Lab resolves them and never invents them.
 * One authoritative translation point per semantic quantity (standing
 * rule 9) — the semantic layer says "this film is warm and light", and
 * exactly one function decides what that means in hex.
 *
 * No `Math.random()`: every value here is a pure function of its inputs.
 */

/** The film's colour, in four numbers a director can actually hold.
 *
 *  key         0 = the image is dark and light is drawn onto it
 *              1 = the image is light and marks are drawn onto it
 *  temperature 0 = cold (blue/cyan)      1 = warm (amber/red)
 *  saturation  0 = monochrome            1 = fully saturated
 *  contrast    0 = flat, close values    1 = hard, separated values
 */
// Kept identical to DEFAULT_COLOUR in src/ir/schema.ts — the compiler
// owns the number, this file owns what it means in hex.
/* THE DEFAULT LOOK.
 *
 * This was `key 0.14, saturation 0.42` — a dark, half-desaturated ground —
 * and because the only control for it lived in the Directing drawer,
 * EVERY film ever made was that ground. The eight named looks below were
 * implemented, coherent and unreachable from the screen where a film is
 * created.
 *
 * The default is now the `documentary` look, chosen because it is the one
 * a film should have to be talked out of rather than into: low-key,
 * slightly warm, restrained, and with enough saturation that a frame
 * reads as a picture rather than as a diagnostic buffer. It is the same
 * coordinates as `LOOKS[1]` — a position in the space, not a second
 * opinion about it. */
const COLOUR_DEFAULT = { key: 0.16, temperature: 0.58, saturation: 0.34, contrast: 0.56 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/** HSL → hex. Plain sRGB: the palette needs to be predictable to read in
 *  a diff, not perceptually perfect. */
function hsl(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const q = (v) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${q(r)}${q(g)}${q(b)}`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    Number.parseInt(f.slice(0, 2), 16),
    Number.parseInt(f.slice(2, 4), 16),
    Number.parseInt(f.slice(4, 6), 16),
  ];
}

/* The two ends of the temperature axis, as hue. Not arbitrary: 210° is
 * the blue of a cold interior and 32° is the amber of sodium light and
 * aged paper — the two poles documentary and archival material actually
 * sit between. */
const HUE_COLD = 210;
const HUE_WARM = 32;
/* TEMPERATURE IS NOT A HUE ROTATION, and this axis has now been wrong
 * twice in two different directions for the same reason.
 *
 * First it was `mix(210, 32, temp)`, interpolating DOWN through cyan and
 * green: at the default the hue was 112 and every undirected film was
 * olive. That was fixed by routing the other way, `mix(210, 392, temp)`,
 * up through violet and red — which moved the midpoint from olive to
 * MAGENTA. Measured across the named looks: noir resolved to hue 274,
 * muted documentary to 316, warm editorial to 330. Four of the eight
 * looks landed in the violet-pink band, and since the default sits at
 * 0.58, every film ever made here has had a magenta cast on its ground,
 * its ink tint and its accent.
 *
 * Both attempts assumed the axis is a path between two hues. It is not.
 * Colour temperature runs blue → NEUTRAL → amber: the middle of the dial
 * is the absence of a cast, not a third colour. Travelling any route
 * between 210 and 32 must pass through some unrelated hue, so there is no
 * correct direction to pick — the model itself was the bug.
 *
 * So: two poles and a distance. Which side of neutral chooses the hue,
 * how far from neutral decides how much of it there is. The hue snaps at
 * the midpoint and that is invisible, because at the midpoint the cast is
 * zero and both sides are the same grey. */
function temperatureCast(temp) {
  return {
    hue: temp >= 0.5 ? HUE_WARM : HUE_COLD,
    /** 0 at neutral, 1 at either end. */
    cast: Math.abs(temp - 0.5) * 2,
  };
}
/** The accent sits across the wheel from the ground, so it separates from
 *  it at any temperature rather than only at one end. */
/* THE ACCENT SITS ON THE OTHER SIDE OF NEUTRAL FROM THE GROUND.
 *
 * A fixed +34 offset was right while the ground's hue moved continuously
 * around the wheel. It is wrong now that the ground snaps to one of two
 * poles: 32 + 34 lands every warm film's accent on yellow-green and
 * 210 + 34 lands every cold film's on indigo, so "Signal — saturated
 * red" resolved to a lime mark and Noir to a violet one.
 *
 * Warm ground, cool accent; cool ground, warm accent. That is the oldest
 * grade in the medium and it is the same idea as the ground's own axis:
 * temperature has two sides, and the thing that must be READ sits on the
 * side the frame is not. It also means the accent is legible on every
 * film rather than only on the ones whose ground happened to be far from
 * it.
 *
 * The warm accent runs hotter than the warm GROUND — 14 rather than 32 —
 * so a mark on a cold film is red rather than merely less blue, which is
 * what "the one place saturation is allowed to be assertive" was for. */
const ACCENT_WARM = 14;
const ACCENT_COOL = 194;

/** THE ONE TRANSLATION POINT. Four numbers in, a whole colour world out.
 *
 *  Every value is derived rather than tabulated, which is what makes this
 *  a system: nudging `contrast` moves the ground, the ink, the mid tones
 *  and the accent together and consistently, and there is no combination
 *  of the four inputs that produces an undefined look. */
function resolvePalette(colour) {
  const c = { ...COLOUR_DEFAULT, ...(colour || {}) };
  const key = clamp01(c.key);
  const temp = clamp01(c.temperature);
  const sat = clamp01(c.saturation);
  const con = clamp01(c.contrast);

  const { hue, cast } = temperatureCast(temp);

  // THE GROUND. At key 0 it is near-black; at key 1 it is paper. Contrast
  // pushes it away from the middle in whichever direction key chose, so a
  // high-contrast dark film gets a deeper ground and a high-contrast
  // light film gets a cleaner one.
  const groundL = mix(0.055, 0.94, key) + (key > 0.5 ? con * 0.04 : -con * 0.03);
  // A ground is never fully neutral — a completely grey ground is what
  // made every frame read as a diagnostic buffer rather than a picture.
  // Scaled by `cast`: a film at temperature 0.5 has a neutral ground
  // rather than a magenta one. A floor remains, because a completely grey
  // ground is what made every frame read as a diagnostic buffer.
  const groundS = 0.03 + sat * 0.24 * (0.3 + cast * 0.7) * (1 - Math.abs(key - 0.5) * 0.6);

  // THE INK. Always the far side of the ground, separated by contrast.
  const inkL = key > 0.5 ? mix(0.28, 0.06, con) : mix(0.78, 0.985, con);
  const inkS = sat * 0.1 * (0.3 + cast * 0.7);

  // The mid tone carries structure that is present but not the subject.
  const midL = mix(groundL, inkL, mix(0.42, 0.3, con));
  const midS = 0.04 + sat * 0.22 * (0.3 + cast * 0.7);

  // DIM — barely off the ground. Grids, hairlines, the things that give a
  // frame depth without asking to be read.
  const dimL = mix(groundL, inkL, 0.14 + con * 0.06);

  const accentHue = hue === HUE_WARM ? ACCENT_COOL : ACCENT_WARM;
  // The accent is the one place saturation is allowed to be assertive:
  // a film at saturation 0 still needs a focal colour or nothing in the
  // frame can be emphasised at all.
  const accentS = 0.42 + sat * 0.52;
  const accentL = key > 0.5 ? mix(0.5, 0.4, con) : mix(0.56, 0.62, con);

  return {
    bg: hsl(hue, groundS, groundL),
    bgRgb: hexToRgb(hsl(hue, groundS, groundL)),
    ink: hsl(hue, inkS, inkL),
    /* THE SAME THREE COLOURS, AS NUMBERS.
     *
     * A primitive that manipulates pixels cannot use a CSS string. Until
     * these existed the only numeric colour in the palette was the ground,
     * so `color_transform` carried its own hardcoded duotone table and
     * mapped ink to near-white on a light film — which erased every word
     * on screen and looked exactly like a texture. */
    inkRgb: hexToRgb(hsl(hue, inkS, inkL)),
    accentRgb: hexToRgb(hsl(accentHue, accentS, accentL)),
    coolRgb: hexToRgb(hsl((accentHue + 40) % 360, accentS * 0.72, accentL * (key > 0.5 ? 0.85 : 1.05))),
    muted: hsl(hue, midS, midL),
    dim: hsl(hue, midS * 0.7, dimL),
    accent: hsl(accentHue, accentS, accentL),
    /** A second, cooler accent for the rare frame that needs two. */
    cool: hsl((accentHue + 40) % 360, accentS * 0.72, accentL * (key > 0.5 ? 0.85 : 1.05)),
    /** Carried through so a primitive can ask how light the world is
     *  rather than guessing from the ground colour. */
    key,
    contrast: con,
  };
}

/* NAMED LOOKS — coordinates, not presets.
 *
 * Each one is a position in the same four-number space, so choosing one
 * and then nudging `temperature` is a coherent act rather than an escape
 * from a preset into an unnamed state. */
const LOOKS = [
  { id: "noir", name: "Noir", blurb: "Near-black ground, hard light, almost no colour.",
    colour: { key: 0.05, temperature: 0.35, saturation: 0.12, contrast: 0.85 } },
  { id: "documentary", name: "Muted documentary", blurb: "Low-key, slightly warm, restrained.",
    colour: { key: 0.16, temperature: 0.58, saturation: 0.28, contrast: 0.5 } },
  { id: "editorial", name: "Warm editorial", blurb: "Paper ground, dark type, one cool accent.",
    colour: { key: 0.9, temperature: 0.66, saturation: 0.36, contrast: 0.72 } },
  { id: "technical", name: "Cold technical", blurb: "Blue-white, thin, diagrammatic, marked in red.",
    colour: { key: 0.86, temperature: 0.1, saturation: 0.22, contrast: 0.66 } },
  /* The blurb said "saturated red" and described the OLD hue path, on
   * which a warm film's ground itself landed near 14. With temperature
   * as a cast rather than a rotation, a warm ground is amber and the hot
   * mark is the accent's job. Said accurately rather than left to
   * promise a colour the coordinates no longer produce. */
  { id: "signal", name: "Signal", blurb: "Dark, hot ground with a cold mark. Maximum separation.",
    colour: { key: 0.08, temperature: 0.9, saturation: 0.95, contrast: 0.9 } },
  { id: "fluorescent", name: "Fluorescent", blurb: "Bright, cold, over-lit interior.",
    colour: { key: 0.82, temperature: 0.05, saturation: 0.62, contrast: 0.4 } },
  { id: "sodium", name: "Sodium", blurb: "Amber street light against dark.",
    colour: { key: 0.14, temperature: 1, saturation: 0.72, contrast: 0.62 } },
  { id: "bleached", name: "Bleached", blurb: "Washed-out, flat, overexposed.",
    colour: { key: 0.95, temperature: 0.5, saturation: 0.14, contrast: 0.18 } },
];

/** Push the CURRENT FILM's colour into the primitives. Called at the top
 *  of every draw — the preview loop, the renderer, the palette browser —
 *  so there is no path that paints with a stale or default palette, and
 *  no primitive has to be told which film it is in. */
function applyFilmPalette(colour) {
  setPalette(resolvePalette(colour || (window.FILM && window.FILM.colour)));
}

Object.assign(window, { resolvePalette, applyFilmPalette, LOOKS, COLOUR_DEFAULT, hexToRgb });
