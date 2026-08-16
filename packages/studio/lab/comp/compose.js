/* THE COMPOSITOR.
 *
 * ONE composition, alive for the whole film, mutated by behaviours. Nothing
 * in here chooses a picture — that architecture was right and it survives.
 *
 * WHAT WAS WRONG WITH IT, AND IS FIXED HERE.
 *
 * 1. IT DEFINED COMPOSITION AS COLLISION-AVOIDANCE. `place()` scored
 *    candidates to minimise overlap and then hard-clamped every unit inside
 *    a margin. Editorial design does the opposite: it overlaps, crops and
 *    bleeds deliberately, and treats the page as one surface rather than a
 *    tray of non-touching boxes. Avoidance is why the frames read as a
 *    slide deck. Overlap is now scored as TENSION and bleed is a decision.
 *
 * 2. IT HAD NO THEORY OF TIME. The only temporal term in the entire engine
 *    was a 40–300ms fade at the top of a beat. After that every unit was
 *    frozen: fixed box, fixed size, fixed alpha. A beat spanning six seconds
 *    of narration was 0.3s of fade and 5.7s of a still image. Here NOTHING
 *    IS EVER STILL — the plate carries a velocity through every beat, every
 *    unit carries its own drift at its own phase so nothing moves in
 *    lockstep, and the type boils.
 *
 * 3. IT WAS TIMID BY CONSTRUCTION. Type capped around a third of the frame,
 *    everything clamped inside a margin, a legibility pass that dimmed the
 *    whole page to protect one phrase. Scale now has a real range, up to and
 *    past the frame edge.
 *
 * Time is still resolved ANALYTICALLY. The exporter draws frame 900 directly
 * as t=30s and the stills script draws out of order; anything accumulating
 * per-frame state renders differently depending on which frames were asked
 * for.
 */

import { FIELD_REST } from "../core/field.js";
import { boilOffset, boilStep } from "../core/noise.js";
import { mulberry32 } from "../core/rng.js";
import { arcAt, vocabularyAt } from "./arc.js";
import { LAYOUTS, emptiest, place } from "./layout.js";
import { partition, placeInZone, zoneFor } from "./frame.js";
import { authorIdea, ideaKey, stateAt } from "./idea.js";
import { emitMarks } from "./marks.js";
import { emitSigns } from "./sign.js";
import { invoke, makeMotifs, trace, verbFor } from "./motif.js";
import {
  attachPoints,
  buildForm,
  driftForm,
  formKey,
  formTransform,
  sampleForm,
} from "../form/grow.js";
import { FACTORS, driftStyle, sampleStyle, styleKey } from "../style/space.js";
import { asBias, makeWander, next as nextPoint, step } from "../style/wander.js";
import { WORLDS, WORLD_MEMORY, chooseWorld } from "./world.js";
import { applyField, chooseRegister, lerp, REGISTERS } from "./register.js";
import { chooseTransition, resolveTransition } from "./transition.js";

/* ── the grid ──────────────────────────────────────────────────────────── */

/** Derived ONCE from the film seed. Two seeds are architecturally different
 *  films, not the same film with the words moved. */
export function buildGrid(seed) {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const cols = 3 + Math.floor(r() * 5); // 3..7
  return {
    cols,
    rows: Math.max(3, Math.round(cols * 0.62)),
    margin: 0.03 + r() * 0.05,
    symmetry: ["axial", "offset", "diagonal"][Math.floor(r() * 3)],
    rotation: (r() - 0.5) * 1.6,
    baseline: 0.28 + r() * 0.42,
    // How willing THIS film is to run type off the edge. A property of the
    // film, so one seed crops hard and another sets inside the page.
    bleed: 0.15 + r() * 0.5,
  };
}

/* ── placement ─────────────────────────────────────────────────────────── */

/* ── units ─────────────────────────────────────────────────────────────── */

const ROLE_PROTECTION = { key: 1, support: 0.6, fragment: 0.2, texture: 0.36 };

function makeUnit(text, role, beat, grid, rng, opts, reg, arcScale = 1, world, style) {
  const intent = beat.visualIntent;
  const R = reg ?? REGISTERS.COLLISION;
  const Wd = world ?? WORLDS.COLLAGE;
  // SCALE SPREAD. A key line and a texture line differed by a fixed ratio, so
  // every frame had the same tonal hierarchy. This is the ratio itself.
  const spread = style?.scaleSpread ?? 3;
  // THE WORLD DECIDES HOW THIS IS SET. Face, case and treatment all come from
  // the universe this passage is in, not from a fixed table keyed on role —
  // which is what made every unit in every film the same horizontal line.

  // SCALE WITH A REAL RANGE. The old engine ran 0.18..0.52 for everything,
  // which is the safe middle of the page at all times. A key line can now
  // reach most of the frame height, and a texture line can be genuinely
  // small — the contrast between those two is most of what makes a page
  // read as designed rather than as laid out.
  // SCALE COMES FROM THE REGISTER. A statement page and a document page
  // disagree about how big a headline is by a factor of five, and that
  // disagreement is most of what makes them read as different kinds of page
  // rather than as the same page at different densities.
  //
  // The texture floor is a press limit, not a taste: below about 0.03 of
  // frame height the stems are under a plate pixel and the threshold erases
  // them, which is how twenty texture units once resolved and drew nothing.
  const base =
    role === "key"
      ? lerp(R.keyScale, Math.min(1, (intent.scale * 0.7 + intent.intensity * 0.5) * arcScale)) *
        (0.55 + (Wd.spread ?? 1) * 0.15)
      : role === "support"
        ? lerp(R.supportScale, intent.scale)
        : Math.max(0.022, (0.030 + rng() * 0.026) * (3 / spread));
  return {
    id: `${beat.id}:${role}:${text.slice(0, 12)}`,
    text,
    role,
    protection: ROLE_PROTECTION[role] ?? 0.3,
    face: role === "key" ? Wd.faces.key : role === "support" ? Wd.faces.support : Wd.faces.texture,
    weight: role === "key" ? 400 : 500,
    case: role === "key" ? Wd.case : "as",
    // THE STYLE POINT THIS UNIT IS SET BY. Not a named treatment — a point in
    // a continuous space, so no two units in a film are set the same way.
    style,
    altFace: rng() < 0.5 ? Wd.faces.support : Wd.faces.texture,
    trackingOffset: (rng() - 0.5) * 0.6,
    jitter: rng(),
    chaos: opts.chaos * (1 + (Wd.chaosBoost ?? 0)),
    tracking: role === "key" ? -0.15 + rng() * 0.5 : 0.1 + rng() * 0.3,
    box: { x: grid.margin, y: grid.baseline, w: 0, h: 0 },
    size: base,
    rot: 0,
    layer: role === "key" ? 10 : role === "support" ? 5 : 1,
    density: 1,
    wear: 0,
    // How willing THIS unit is to leave the frame. A key line at full scale
    // is the one that should crop; a caption never does.
    // A SHORT line cropping off the edge is a decision; a LONG one cropping
    // is just a lost word. Bleed is earned by brevity and by scale.
    bleed:
      role === "key"
        ? Math.min(1, base * 2.6) * Math.max(0, 1 - text.length / 34) * R.bleed * (Wd.bleedBoost ?? 1)
        : 0,
    born: beat.startMs,
    die: null,
    dead: false,
    motion: null,
    // CONTINUOUS DRIFT, per unit, at its own phase. Small — this is not an
    // animation, it is the refusal to be still. Overlapping action: nothing
    // shares a velocity, so the frame never locks into a single moving slab.
    drift: {
      x: (rng() - 0.5) * 0.020 * (0.4 + opts.chaos),
      y: (rng() - 0.5) * 0.014 * (0.4 + opts.chaos),
      scale: (rng() - 0.5) * 0.05,
      rot: (rng() - 0.5) * 0.5 * opts.chaos,
    },
    // The unit's own boil phase, so two words never wobble together.
    phase: Math.floor(rng() * 8192),
    lastBox: null,
  };
}

/* ── behaviours ────────────────────────────────────────────────────────── */

const BEHAVIORS = {
  APPEAR(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
    ctx.push(stage, 0.6);
  },
  SLAM(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: Math.min(140, ctx.attackMs * 0.4) });
    for (const u of stage.units) {
      if (u.born >= beat.startMs || u.dead) continue;
      u.wear = Math.min(1, u.wear + 0.1 * beat.visualIntent.intensity);
      u.density = Math.max(0.15, u.density - 0.18);
    }
    // The plate takes the hit too. A shove that only moves the type reads as
    // a text effect; a shove that moves the whole sheet reads as force.
    ctx.kick(stage, beat, 1.4);
  },
  SURGE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: ctx.attackMs * 0.5 });
    for (const u of stage.units) if (!u.dead) u.size *= 1.09;
    ctx.push(stage, 2.4);
  },
  FREEZE(stage, beat, ctx) {
    // A rest introduces nothing. It does NOT stop the film — the plate keeps
    // moving and the field keeps boiling, because a held frame in a film is
    // still a moving image. This is where negative space is made.
    ctx.push(stage, 0.25);
  },
  ACCUMULATE(stage, beat, ctx) {
    // Accumulation that also DRIFTS APART reads as evidence piling up;
    // accumulation that stays put reads as a list.
    converge(stage, beat, ctx, null, -0.35);
    // THE ESSAY'S OWN SMALL PRINT, not five copies of the headline.
    //
    // This used to clone the highest-protection unit over and over, which is
    // precisely how a frame ends up carrying one phrase repeated down the
    // page — the "does one thing over and over" complaint, generated by the
    // one behaviour whose whole job is density. The stock is now the beat's
    // own prose at texture scale, so accumulation reads as a page filling
    // with writing rather than as a stutter.
    // A COUNT, NOT A COVERAGE LOOP. Closing against `coverage()` looked
    // principled and did nothing: one inherited headline at bleed width
    // already puts coverage above any plausible target, so the loop exited
    // on its first test and no texture was ever laid down. The frame stayed
    // empty for exactly the reason that was hardest to see.
    const stock = beat.text.body ?? [];
    // FOCUS. At 1 almost everything is in one element and the rest is a
    // whisper; at 0 the frame is many equal things. Previously fixed.
    const focus = ctx.style?.focus ?? 0.5;
    const want = Math.round(
      lerp(ctx.reg.texture, ctx.style?.occupancy ?? beat.visualIntent.density) * (1 - focus * 0.85),
    );

    // BODY COPY SETS IN COLUMNS. Placing each fragment independently against
    // the occupancy map scatters them, and several landing in one coarse grid
    // cell overprint into mush that reads as noise rather than as small
    // print. Real small text is a COLUMN: one left edge, one leading, lines
    // stacked. So the first line is placed, and the rest of its column
    // follows it down — which is also why it reads as a document.
    let col = null;
    let line = 0;
    for (let i = 0; i < want && stock.length > 0; i++) {
      const u = makeUnit(stock[i % stock.length], "texture", beat, ctx.grid, ctx.rng, ctx.opts, ctx.reg, ctx.arc.scale, ctx.world, ctx.style);
      u.box.w = Math.min(0.9, u.text.length * u.size * 0.5);
      u.box.h = u.size * 1.3;
      const perCol = 3 + Math.floor(ctx.rng() * 4);
      if (col === null || line >= perCol) {
        place(ctx.layout, ctx.grid, stage, u, ctx.rng, ctx.opts);
        col = { x: u.box.x, y: u.box.y, lead: u.box.h * (1.5 + ctx.rng() * 0.5) };
        line = 1;
      } else {
        u.box.x = col.x + (ctx.rng() - 0.5) * 0.006;
        u.box.y = col.y + col.lead * line;
        u.rot = 0;
        line++;
      }
      // Staggered arrival. Twenty fragments landing on one frame is a paste;
      // twenty landing over a second and a half is a page being set.
      u.motion = { kind: "fade", dur: ctx.attackMs, t0: beat.startMs, delay: i * 70 };
      stage.units.push(u);
      stage.fieldTo.wear = Math.min(1, stage.fieldTo.wear + 0.004);
    }
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
    ctx.push(stage, 1.1);
  },
  COLLAPSE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
    // Everything on the page is drawn INTO the surviving line rather than
    // simply switched off around it.
    converge(stage, beat, ctx, null, 0.85);
    const alive = stage.units.filter((u) => !u.dead).sort((a, b) => b.protection - a.protection);
    alive.slice(1).forEach((u, i) => {
      u.die = beat.startMs + 140 + i * 70;
    });
    ctx.push(stage, -1.6);
  },
  INVERT(stage, beat, ctx) {
    // A FLIP IS PUNCTUATION, NOT A NEW SETTING. `polarity ^= 1` with nothing
    // to undo it meant one early `turn` left the rest of the film on a white
    // ground — the flip stopped being an event and became the film.
    stage.ink.polarity = 1;
    stage.ink.hold = 0;
    introduce(stage, beat, ctx, { kind: "snap", dur: ctx.attackMs * 0.4 });
    ctx.kick(stage, beat, 0.7);
  },
  INTERRUPT(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: 60 });
    ctx.kick(stage, beat, 1.8);
  },
  FRAGMENT(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
    // Instability shows in the material, not in a filter: the sheet starts
    // fighting the ink.
    stage.fieldTo.turbulence = Math.min(1, stage.fieldTo.turbulence + 0.3);
    stage.fieldTo.bite = Math.min(1, stage.fieldTo.bite + 0.22);
    ctx.push(stage, 0.9);
  },
  REASSEMBLE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs * 1.5 });
    converge(stage, beat, ctx, null, 0.5);
    stage.fieldTo.turbulence = Math.max(0.05, stage.fieldTo.turbulence - 0.2);
    stage.fieldTo.bite = Math.max(0.05, stage.fieldTo.bite - 0.15);
    ctx.push(stage, 0.5);
  },
  ECHO(stage, beat, ctx) {
    const u = stage.units.filter((x) => !x.dead).sort((a, b) => b.protection - a.protection)[0];
    if (!u) return;
    u.repeat = {
      // TWO OR THREE, NOT SEVEN. At seven the device stops reading as an
      // echo and becomes a stack of identical lines — the repetition the
      // whole rebuild exists to remove, reintroduced by the one behaviour
      // whose job is repetition.
      // ONE OR TWO. Even at three this stops reading as an echo and becomes a
      // stack of identical lines, which is the single most repetitive-looking
      // thing the engine can do and the first thing the operator named.
      n: 1 + Math.round(beat.visualIntent.intensity),
      dx: (1 / ctx.grid.cols) * 0.5,
      dy: (1 / ctx.grid.rows) * 0.35,
      decay: 0.16,
    };
  },
  OVERPRINT(stage, beat, ctx) {
    const top = stage.units.filter((u) => !u.dead).sort((a, b) => b.layer - a.layer).slice(0, 2);
    if (top.length < 2) return;
    top[1].box.x = top[0].box.x + (ctx.rng() - 0.5) * 0.12;
    top[1].box.y = top[0].box.y + (ctx.rng() - 0.5) * 0.07;
    top[1].density = Math.min(1, top[1].density + 0.2);
  },
};

/** Introduce this beat's phrases.
 *
 *  STAGGERED, with anticipation and overshoot. Everything arriving on the
 *  same frame with the same curve is the single clearest tell of automated
 *  type; offsetting each element by a beat of its own is most of what
 *  separates motion design from a transition.
 */
function introduce(stage, beat, ctx, motion) {
  for (const [i, p] of beat.text.phrases.entries()) {
    const role = i === 0 ? "key" : "support";
    const u = makeUnit(p.text, role, beat, ctx.grid, ctx.rng, ctx.opts, ctx.reg, ctx.arc.scale, ctx.world, ctx.style);
    u.box.w = Math.min(1.6, u.text.length * u.size * 0.46);
    u.box.h = u.size * 1.25;
    u.motion = { ...motion, t0: beat.startMs, delay: i * (ctx.attackMs * 0.32) };
    if (!bindToForm(u, ctx)) placeInFrame(u, ctx, stage);
    migrate(stage, u, ctx, beat);
    stage.units.push(u);
  }
}

/** TRANSFORM, DO NOT REPLACE.
 *
 *  Everything used to arrive from nowhere: a unit was created at its final
 *  box and faded up, while whatever had been there died separately. So the
 *  film could only ever CUT TO a fresh arrangement — nothing on screen was
 *  ever the thing that had been there a moment ago, and nothing converged,
 *  travelled or became anything. That is most of why a long stretch reads as
 *  one moment held rather than as a sequence going somewhere.
 *
 *  A new unit may instead claim an existing one as its ORIGIN and travel
 *  from it — inheriting its position and scale at the boundary and arriving
 *  at its own over the attack. The source is retired as the new one lands,
 *  so what the eye follows is one thing becoming another.
 *
 *  How willing the film is to do this rises across its length: at the start
 *  nothing has a past to come from, and by the end almost everything does.
 */
function migrate(stage, u, ctx, beat) {
  if (ctx.rng() > ctx.arc.morph * 0.85) return;
  const pool = stage.units.filter((x) => !x.dead && x.born < beat.startMs);
  if (pool.length === 0) return;
  // Prefer the nearest thing of comparable weight — a headline grows out of
  // a headline, not out of a caption on the far side of the frame.
  const src = pool
    .map((x) => ({
      x,
      d: Math.hypot(x.box.x - u.box.x, x.box.y - u.box.y) + Math.abs(x.size - u.size) * 2.2,
    }))
    .sort((a, b) => a.d - b.d)[0].x;
  u.from = { x: src.box.x, y: src.box.y, size: src.size, rot: src.rot };
  src.die = src.die ?? beat.startMs + ctx.attackMs * 0.8;
}

/** CONVERGENCE. Scattered small print MIGRATES toward the thing that
 *  matters, so a page of evidence visibly becomes a single claim. The
 *  opposite move — one line dispersing into many — is the same mechanism
 *  with the endpoints swapped. */
function converge(stage, beat, ctx, toward, strength) {
  const target = toward ?? stage.units.filter((x) => !x.dead).sort((a, b) => b.protection - a.protection)[0];
  if (!target) return;
  for (const x of stage.units) {
    if (x.dead || x.protection >= 0.6 || x.born >= beat.startMs) continue;
    x.pull = {
      x: target.box.x + target.box.w / 2,
      y: target.box.y + target.box.h / 2,
      k: strength,
      t0: beat.startMs,
      dur: Math.max(600, ctx.durMs * 0.9),
    };
  }
}

/** Put a word ON the structure rather than near it.
 *
 *  Returns false when this unit is not binding, so the placer takes it — the
 *  two are alternatives, not layers. A tip gets a word at its end lying along
 *  its own tangent; a span gets one running with it; an edge or a cell gets
 *  one sitting in it. That relation is the difference between a composition
 *  and two systems that happen to share a canvas.
 */
/** LAYERED PLACEMENT. A unit goes to the zone its importance earns, and obeys
 *  that zone's own alignment and baseline — rather than being scored against a
 *  global occupancy map, which asks "where is there room" when the question a
 *  designer asks is "what is this, and where does that kind of thing go".
 *
 *  The old scored placer is kept for the low end: texture genuinely does want
 *  to go wherever there is room, and forcing it into a zone would tidy away
 *  the material the composition is made of. */
function placeInFrame(u, ctx, stage) {
  if (u.protection < 0.35 && ctx.rng() < 0.55) {
    place(ctx.layout, ctx.grid, stage, u, ctx.rng, ctx.opts);
    return;
  }
  const z = zoneFor(ctx.zones, u, ctx.rng);
  const p = placeInZone(z, u, ctx.rng, ctx.style);
  u.box.x = p.x;
  u.box.y = p.y;
  u.rot = p.rot;
  u.zone = z.role;
}

function bindToForm(u, ctx) {
  const s = ctx.style;
  const anchors = ctx.anchors;
  const fp = ctx.formPlace;
  if (!anchors || anchors.length === 0 || !fp) return false;
  if (ctx.rng() > s.attachment * (u.protection >= 1 ? 0.55 : 1)) return false;
  const a = anchors[Math.floor(ctx.rng() * anchors.length)];
  // Form coordinates are unit-extent and centred, so this is the same
  // transform `drawForm` applies — one convention, both places.
  u.box.x = fp.x + a.x * fp.scale - u.box.w * 0.5;
  u.box.y = fp.y + a.y * fp.scale;
  u.rot = a.kind === "tip" || a.kind === "span" ? a.angle : u.rot;
  u.bound = a.kind;
  return true;
}

function coverage(stage) {
  let a = 0;
  for (const u of stage.units) if (!u.dead) a += u.box.w * u.box.h * u.density;
  return Math.min(1, a);
}

/** AGE AN INHERITED UNIT.
 *
 *  THE MISSING HALF OF INHERITANCE. Carrying units across a beat boundary is
 *  what makes a film instead of a slideshow — but carrying them across
 *  UNCHANGED is what makes the page silt up. Without this, beat one's
 *  headline is still full-size, full-ink and on top at beat five, every new
 *  phrase lands underneath it, and the frame turns to mud that reads as "it
 *  does one thing over and over".
 *
 *  So a unit does not merely persist, it RECEDES: it shrinks, thins, loses
 *  its claim on the frame and gains wear, and after a few beats it goes. A
 *  headline becomes background becomes texture becomes gone — which is what
 *  a motif actually does in a film, and it costs one function.
 */
function age(u, beat) {
  const n = (u.beatsAlive ?? 0) + 1;
  const a = { ...u, beatsAlive: n };
  // The echo belonged to the beat that asked for it. Left on, one phrase
  // repeats down the frame for the rest of the film.
  a.repeat = undefined;
  a.protection = u.protection * 0.45;
  a.density = u.density * (0.78 - n * 0.04);
  a.size = u.size * (u.role === "key" ? 0.66 : 0.86);
  a.layer = Math.max(0, u.layer - 4);
  a.wear = Math.min(1, u.wear + 0.16);
  a.bleed = u.bleed * 0.5;
  a.role = n >= 2 ? "texture" : u.role;
  // Retired on a schedule, not on a threshold, so the exit is staggered
  // across beats rather than the whole page clearing at once.
  if (a.die === null && n >= (u.role === "key" ? 3 : 2)) {
    a.die = beat.startMs + 200 + (n % 3) * 220;
  }
  return a;
}

/* ── the reducer ───────────────────────────────────────────────────────── */

export function buildStages(cut) {
  const grid = buildGrid(cut.seed);
  const opts = { chaos: cut.settings.chaos, density: cut.settings.density };
  let stage = {
    units: [],
    marks: [],
    field: { ...FIELD_REST },
    // Where the plate IS at the top of this beat, and how fast it is going.
    plate: { scale: 1.04, x: 0, y: 0, rot: grid.rotation },
    plateVel: { scale: 0.004, x: 0.004, y: -0.002, rot: 0.02 },
    ink: { polarity: 0, ground: 0.1, ink: 0.95, hold: 0 },
  };
  const stages = [];
  let regName = "STATEMENT";
  let regRun = 0;
  let lastPhrase = null;
  // THE WORLD CHANGES ON A SECTION, not on a beat. Every beat would be noise;
  // never would be the template.
  let worldName = "COLLAGE";
  let lastSection = null;
  let worldRun = 0;
  let beatIndex = -1;
  // A LOOK AND A FORM PER BEAT. Both are points in continuous spaces, drifting
  // while the writing holds and leaping when it moves — so a film visits
  // hundreds of them and repeats none.
  // THE FILM TRAVELS. One low-discrepancy walk drives BOTH spaces, so the
  // look and the form agree about where they are — sampled independently, a
  // clean orderly style kept landing on a chaotic organic form and the frame
  // disagreed with itself.
  const FORM_KEYS = [
    "articulation",
    "orthogonality",
    "profusion",
    "closure",
    "rigidity",
    "recession",
  ];
  const wander = makeWander(FACTORS.length + FORM_KEYS.length, cut.seed);
  // THE PALETTE HAS ITS OWN, SLOWER WALK. Sampled per beat, hue strobed — a
  // film cutting every second through independent random hues is a fault
  // rather than a colour scheme. This advances once every several passages,
  // so the colour drifts while everything else travels.
  const paletteWalk = makeWander(3, cut.seed ^ 0x27d4eb2f);
  // THE MOTIF LEDGER. `cut.motifs` and `beat.motif` have existed and driven
  // nothing at all — a complete grammar sitting one wire short of the screen,
  // which is a failure this codebase has produced before.
  const motifs = makeMotifs(cut, FACTORS.length + FORM_KEYS.length);
  let hueTurn = 0;
  let palette = paletteOf(nextPoint(paletteWalk), hueTurn++);
  let point = nextPoint(wander);
  let style = sampleStyle(mulberry32(cut.seed ^ 0x5f3759df), asBias(point, FACTORS), palette);
  void blend;
  let form = sampleForm(
    mulberry32(cut.seed ^ 0x1b873593),
    asBias(point.slice(FACTORS.length), FORM_KEYS),
  );
  const topicForms = new Map();
  // Where a motif last stood, so a recall can draw a line back to it.
  let lastMotifPlace = null;
  // THE PASSAGE'S OWN IDEA — authored once, then travelled through. A passage
  // used to be N independent samples, so it had no beginning, middle or end
  // and could not develop.
  let idea = null;
  let ideaStart = 0;
  let ideaEnd = 1;
  const recentWorlds = [];
  /** Passage index → the world it was given. The film's memory. */
  const topicWorlds = new Map();

  const filmMs = Math.max(1, cut.durationMs);
  for (const beat of cut.beats) {
    beatIndex += 1;
    const rng = mulberry32(beat.seed);
    // WHERE THE FILM IS. Everything below is biased by a centre that is
    // itself travelling, which is the difference between a film and a style.
    const u = beat.startMs / filmMs;
    const arc = arcAt(u);
    const attackMs = ((1 - cut.settings.pace) * 300 + 60) / (0.6 + arc.rate * 0.7);
    const durMs = Math.max(1, beat.endMs - beat.startMs);

    // A SUB-BEAT IS THE SAME EDITORIAL BEAT, so the composition does not decay
    // through it — it re-composes around what is already there. Ageing on
    // every sub-beat instead retired the headline three subdivisions after it
    // arrived, and the film went text-blind between promoted phrases.
    const isSub = beat.id.includes(".");
    // WHAT KIND OF PAGE THIS IS. A sub-beat keeps its parent's register —
    // the argument has not moved on, only the composition has.
    let turned = false;
    if (!isSub) {
      const next_ = chooseRegister(beat, regName, regRun, rng, vocabularyAt(u));
      turned = next_ !== regName;
      regRun = turned ? 0 : regRun + 1;
      regName = next_;
    }
    const reg = REGISTERS[regName];

    // WHICH TEXT UNIVERSE THIS PASSAGE IS IN.
    const sectionKey = beat.sourceRange.startChar - (beat.sourceRange.startChar % 1);
    // THE WORLD IS NOW CAUSED BY THE WRITING.
    //
    // It used to be `Math.floor(startChar / 420)` — a character counter. The
    // film changed universes every 420 characters whatever the essay was
    // doing, so every change on screen was uncaused, and an uncaused change
    // reads as decoration however much variety sits underneath it.
    const rd = beat.reading ?? { kind: "CLAIM", novelty: 1, returnsTo: null };
    const chosen = chooseWorld(rd, worldName, worldRun, topicWorlds, rng, u);
    worldRun = chosen.world === worldName ? worldRun + 1 : 0;
    worldName = chosen.world;
    // Remember which world this passage got, so that when the essay comes back
    // to it later the picture comes back too. This is the only mechanism by
    // which anything carries through a film.
    topicWorlds.set(rd.passage ?? beatIndex, worldName);
    const world = WORLDS[worldName];

    // WHERE IN THE SPACES THIS MOMENT SITS. The writing decides: a passage
    // that holds drifts a little, one that has moved leaps, and one that
    // RETURNS comes back to its own earlier form grown further — which is what
    // makes a callback read as time passed rather than as a loop.
    // A MOTIF APPEARANCE OUTRANKS EVERYTHING. If this beat carries one, the
    // film goes to that motif's own identity transformed by a verb, rather
    // than to wherever the sequence was heading — because a returning idea
    // deciding what the screen does IS the visual argument.
    let motifOver = null;
    const mo = beat.motif ? motifs.get(beat.motif.id) : null;
    if (mo) {
      const verb = verbFor(mo, beat.motif.treatment, beat.startMs, u);
      const inv = invoke(mo, verb, beat.startMs, rng);
      motifOver = { verb, over: inv.over, id: mo.id };
      point = inv.point;
    }

    const leap = chosen.why === "move" || chosen.why === "open";
    if (chosen.why === "return" && topicForms.has(rd.passage)) {
      // A return goes back to its own place, grown further.
      form = driftForm(topicForms.get(rd.passage), rng, 0.12);
      style = driftStyle(style, rng, 0.2);
    } else if (leap) {
      // A MOVE ADVANCES THE SEQUENCE. This is the only line that decides
      // whether a twenty-minute film keeps discovering: the next point is
      // maximally far from every point already used, by construction, so
      // minute fifteen is somewhere minute two never went.
      // THE WRITING CHOOSES THE REGION; THE SEQUENCE COVERS IT.
      //
      // Measured across three genuinely different essays: their trajectories
      // were 0.44–0.70 apart in a space where two random points average 1.4,
      // because the walk was seeded from `cut.seed`. Two essays with the same
      // seed walked the SAME path and the writing only decided when to step.
      // That is a template however large the space is. The passage's own
      // vocabulary now sets where the film goes; the sequence explores around
      // it, so coverage survives and content decides the neighbourhood.
      // A MOVE AUTHORS A NEW IDEA. The sequence point is where it STARTS; the
      // behaviour decides where it ends up, and every beat between is a
      // position on that path.
      point = motifOver ? point : blend(nextPoint(wander), rd.signature, 0.55);
      idea = authorIdea(point, rd, rng, arc);
      ideaStart = beat.startMs;
      // The passage runs until the writing moves again; estimated from the
      // beat's own span so a one-beat passage still completes its arc.
      ideaEnd = beat.startMs + Math.max(1200, (beat.endMs - beat.startMs) * 6);
      // A NEW PALETTE ON EVERY MOVE. It used to advance once every three, and
      // with eleven moves in a real essay the whole film had four hues — which
      // landed adjacent, so twenty frames came out black, white and one green.
      palette = paletteOf(nextPoint(paletteWalk), hueTurn++);
      style = sampleStyle(
        rng,
        {
          ...asBias(point, FACTORS),
          damage: Math.min(0.92, point[1] * 0.5 + arc.wear * 0.5),
          ...(motifOver?.over ?? {}),
        },
        palette,
      );
      form = sampleForm(rng, {
        ...asBias(point.slice(FACTORS.length), FORM_KEYS),
        ...(motifOver?.over ?? {}),
      });
    } else {
      // A HOLD STILL TRAVELS — a smaller step along a second sequence inside
      // the same region. The passage decides the neighbourhood; standing
      // still inside it for fifty seconds is what made twenty minutes feel
      // like four.
      // THE TRACE. A motif seen recently pulls the film toward itself even in
      // passages that do not carry it — which is the difference between a film
      // with recurring images and a film with a memory. It decays over about a
      // minute, so the pull is strongest just after an appearance.
      const tr = trace(motifs, beat.startMs);
      // A HOLD TRAVELS ALONG THE IDEA, not along a second random sequence.
      // This is the difference between a passage that changes and a passage
      // that GOES somewhere: the beats of one paragraph are now positions on
      // a single journey rather than unrelated samples near each other.
      let p2 = motifOver
        ? point
        : idea
          ? stateAt(idea, (beat.startMs - ideaStart) / Math.max(1, ideaEnd - ideaStart))
          : blend(step(wander, 0.22), rd.signature, 0.35);
      if (!motifOver && tr) p2 = blend(p2, tr.point, tr.weight);
      style = sampleStyle(rng, { ...asBias(p2, FACTORS), ...(motifOver?.over ?? {}) }, palette);
      form = sampleForm(rng, {
        ...asBias(p2.slice(FACTORS.length), FORM_KEYS),
        ...(motifOver?.over ?? {}),
      });
    }
    if (!topicForms.has(rd.passage)) topicForms.set(rd.passage, form);
    const built = buildForm(form);
    // WHERE WORDS MAY BIND TO THE STRUCTURE. Form and type have been two
    // systems sharing a canvas — the form drawn behind, the type placed by
    // its own occupancy logic, neither aware of the other.
    const anchors = attachPoints(built);
    // A form is normalised to unit extent, so scale IS its fraction of the
    // frame. Below about a third it reads as a smudge rather than as a thing;
    // above one it crops, which is a decision rather than a fault.
    // WHERE THE MASS SITS, and how much of the frame it takes. Both were
    // random in a narrow band, so the form was always mid-sized and roughly
    // central — another dimension that never reached an end.
    const ecc = style.eccentric;
    const ang = rng() * Math.PI * 2;
    const formPlace = {
      x: 0.5 + Math.cos(ang) * ecc * 0.55,
      y: 0.5 + Math.sin(ang) * ecc * 0.45,
      scale: lerp2(0.22, 1.9, style.focus) * (0.55 + arc.scale * 0.6),
    };
    void sectionKey;
    void lastSection;
    void recentWorlds;
    void WORLD_MEMORY;

    // AND WHICH SPATIAL STRUCTURE. Drawn per beat from the world's own
    // vocabulary, so a passage keeps a family of geometries rather than one.
    const layoutPool = world.layouts;
    const layout = layoutPool[Math.floor(rng() * layoutPool.length)];

    // WHERE THE FRAME'S MASS SITS. On the contact sheet almost every frame
    // put its weight left of centre, because the placer scores occupancy the
    // same way every time and there was nothing telling it the picture had an
    // anchor. This is that anchor, and it travels with the composition dials
    // rather than being re-rolled.
    // THE FRAME IS DIVIDED BEFORE ANYTHING IS PLACED. Elements scattered by an
    // algorithm is what a plugin does; a designer decides the structure first
    // and fills it second.
    const zones = partition(style, rng);

    const anchorAngle = rng() * Math.PI * 2;
    const anchor = {
      x: 0.5 + Math.cos(anchorAngle) * style.eccentric * 0.42,
      y: 0.5 + Math.sin(anchorAngle) * style.eccentric * 0.36,
      pull: 0.25 + style.focus * 0.6,
    };
    // HOW THIS BOUNDARY IS CUT. One per beat, decided once, so a re-roll of
    // the seed re-cuts the whole film rather than only re-placing it.
    const entry = chooseTransition(beat, turned, rng, opts.chaos);

    // A REGISTER CHANGE IS A PAGE TURN.
    //
    // Registers set the scale, density and furniture of NEW units — so on
    // their own they changed nothing visible, because most of the frame is
    // inherited and inherited type keeps the scale it was born at. A document
    // page still carrying a statement page's headline is a statement page. So
    // the turn is enforced: texture goes, furniture goes, and the one
    // protected line is re-cut to the new register's measure rather than
    // surviving at the old one. This is the "and then the next thing, which
    // would have to be different" made structural.
    const carry = (u) => {
      if (isSub) return { ...u };
      const a = age(u, beat);
      if (!turned) return a;
      if (a.protection < 0.6) {
        a.die = a.die ?? beat.startMs + 90 + rng() * 220;
        return a;
      }
      a.size = lerp(reg.keyScale, 0.35);
      a.bleed = Math.min(a.bleed, reg.bleed);
      return a;
    };


    const next = {
      units:
        beat.visualIntent.continuity === "interrupt"
          ? stage.units.filter((u) => !u.dead && u.protection >= 0.6).map(carry)
          : stage.units.map(carry),
      signs: (stage.signs ?? []).map((g) => ({ ...g })),
      marks: stage.marks
        .filter((m) => !m.dead)
        .map((m) => (turned ? { ...m, die: m.die ?? beat.startMs + 120 + rng() * 260 } : { ...m })),
      field: { ...stage.field },
      fieldTo: { ...stage.field },
      plate: { ...stage.plate },
      plateVel: { ...stage.plateVel },
      ink: { ...stage.ink },
    };
    for (const u of next.units) if (u.die !== null && beat.startMs >= u.die) u.dead = true;
    for (const m of next.marks) if (m.die !== null && beat.startMs >= m.die) m.dead = true;

    // An inversion runs out. The sheet comes back.
    if (next.ink.hold > 0) next.ink.hold -= 1;
    else next.ink.polarity = 0;

    const ctx = {
      grid,
      rng,
      opts: { ...opts, anchor },
      zones,
      reg,
      regName,
      world,
      worldName,
      layout,
      style,
      anchors,
      formPlace,

      arc,
      attackMs,
      durMs,
      /** A steady push through the whole beat — the frame is always
       *  travelling somewhere. Sign and size come from the behaviour. */
      push(st, amount) {
        const per = amount / Math.max(600, durMs);
        st.plateVel.scale = 0.0025 + per * 0.9;
        st.plateVel.x = (rng() - 0.5) * 0.035 * (0.5 + opts.chaos) + per * 0.2;
        st.plateVel.y = (rng() - 0.5) * 0.025 * (0.5 + opts.chaos);
        st.plateVel.rot = (rng() - 0.5) * 0.16 * opts.chaos;
      },
      /** An impulse ON the plate at the top of a beat — a physical shove
       *  that then keeps travelling, rather than a cut to a new position. */
      kick(st, b, amount) {
        void b;
        st.plate.x += (rng() - 0.5) * 0.06 * amount;
        st.plate.y += (rng() - 0.5) * 0.045 * amount;
        st.plate.rot += (rng() - 0.5) * 1.6 * amount * (0.3 + opts.chaos);
        st.plate.scale *= 1 + (rng() - 0.5) * 0.06 * amount;
        ctx.push(st, amount * 0.5);
      },
    };


    // THE FIELD ANSWERS TO THE ARGUMENT, and to nothing else. None of these
    // is a picture of anything; they are the state of a material.
    const vi = beat.visualIntent;
    next.fieldTo.turbulence = clamp01(0.1 + vi.instability * 0.55 + opts.chaos * 0.25);
    next.fieldTo.tone = clamp01(0.32 + vi.intensity * 0.55);
    next.fieldTo.bite = clamp01(arc.bite + vi.instability * 0.3 + vi.intensity * 0.15);
    next.fieldTo.coarse = clamp01(0.25 + vi.density * 0.6);
    next.fieldTo.flowX = (rng() - 0.5) * 0.05 * (0.4 + opts.chaos);
    next.fieldTo.flowY = (rng() - 0.5) * 0.04 * (0.4 + opts.chaos);
    // WEAR ONLY EVER ACCUMULATES. A photocopy of a photocopy — the film has
    // an arrow, and the last minute cannot look like the first.
    // WEAR IS THE FILM'S ARROW. Per-beat accumulation alone drifts; the arc
    // guarantees the last minute cannot look like the first however the
    // beats happen to fall.
    next.fieldTo.wear = Math.min(
      0.88,
      Math.max(next.field.wear + 0.006, arc.wear * 0.8 + vi.instability * 0.08),
    );
    // The register says what kind of paper this page is printed on; the beat
    // still says how unsure the argument is. Both, not one.
    Object.assign(next.fieldTo, applyField(next.fieldTo, reg));
    // The world says what KIND of printing this is; the register says what
    // kind of page; the beat says how sure the argument is. All three.
    Object.assign(next.fieldTo, applyField(next.fieldTo, world));
    // A RETURN IS NOT A REPEAT. When the essay comes back to something, the
    // picture comes back worn — the wear is what shows the time that passed
    // between the two visits, and it is the difference between a callback and
    // a loop.
    if (chosen.why === "return") {
      next.fieldTo.wear = Math.min(0.92, next.fieldTo.wear + 0.18);
      next.fieldTo.bite = Math.min(1, next.fieldTo.bite + 0.12);
    }

    const fn = BEHAVIORS[vi.behavior] || BEHAVIORS.APPEAR;
    fn(next, beat, ctx);
    if (vi.secondary && BEHAVIORS[vi.secondary]) BEHAVIORS[vi.secondary](next, beat, ctx);

    emitMarks(next, beat, ctx);

    // SIGNS — marks that POINT rather than depict. A strike-through says
    // "not this" about something specific; a bracket says "these belong
    // together"; a connector on a recall says "this, again". None names a
    // noun, so none can walk back into the failure that put the same
    // centipede in every film.
    ctx.recallFrom =
      motifOver?.verb === "RECALL" && lastMotifPlace
        ? lastMotifPlace
        : null;
    next.signs = [
      ...(next.signs ?? []).filter((g) => beat.startMs - g.born < 4200),
      ...emitSigns(next, beat, ctx),
    ];
    if (motifOver) {
      const k = next.units.find((u) => !u.dead && u.protection >= 0.9);
      if (k) lastMotifPlace = { x: k.box.x + k.box.w * 0.5, y: k.box.y + k.box.h * 0.5 };
    }

    // THE SETTLE PASS MUST NOT UNDO THIS BEAT.
    //
    // It sorts by protection and kills the weakest, and TEXTURE is protection
    // zero — so it deleted precisely the small body text `ACCUMULATE` had
    // just laid down, every time, and the frame came out empty while the
    // report said the density target was met. It only ever gets to retire
    // what was already there.
    // THE FRAME'S OWN OCCUPANCY, not the beat's density alone. Nothing decided
    // what the PICTURE was doing, so every frame came out at middling density
    // — and a film of a hundred frames all at 50% reads as one texture however
    // much varies underneath it. A film needs nearly-empty frames and packed
    // ones.
    const target = style.occupancy * (0.55 + vi.density * 0.5) * world.crowd;
    const older = () => next.units.filter((u) => !u.dead && u.born < beat.startMs);
    let guard = 24;
    while (coverage(next) > target + 0.3 && guard-- > 0) {
      const weakest = older().sort((a, b) => a.protection - b.protection)[0];
      if (!weakest || weakest.protection >= 1) break;
      weakest.dead = true;
    }

    // THE FILM IS NEVER TEXT-BLIND.
    //
    // A rest introduces nothing, by design — but if the last phrase has also
    // aged out, the frame carries no words at all. Thirty seconds into a film
    // about writing, a wordless screen reads as a fault rather than as
    // negative space, and on this essay it happened on eight beats of
    // thirty-nine.
    //
    // Tested against SURVIVAL, not against the roster: units carry `die`
    // times inside the beat, so a stage with sixteen live units when it is
    // built can be empty by the time anyone looks at it. The roster test
    // passed and the frame was still blank.
    const mid = beat.startMs + (beat.endMs - beat.startMs) * 0.5;
    // A FLOOR, NOT A ZERO CHECK. Firing only when the frame is completely
    // wordless left frames carrying a single fragment on an empty page, which
    // reads as a fault rather than as restraint. Measured: several frames at
    // 98% bare ground with one line on them.
    const surviving = next.units.filter(
      (x) => !x.dead && (x.die === null || x.die > mid),
    ).length;
    const floor = Math.max(2, Math.round(1 + vi.density * 3));
    if (surviving < floor && (lastPhrase || beat.text.body?.length)) {
      const stock = [lastPhrase, ...(beat.text.body ?? [])].filter(Boolean);
      for (let k = surviving; k < floor && stock.length > 0; k++) {
        const u = makeUnit(
          stock[k % stock.length],
          k === surviving ? "support" : "texture",
          beat,
          grid,
          rng,
          opts,
          reg,
          arc.scale,
          world,
          style,
        );
        u.box.w = Math.min(0.9, u.text.length * u.size * 0.5);
        u.box.h = u.size * 1.3;
        u.motion = { kind: "fade", dur: attackMs * 2, t0: beat.startMs, delay: k * 60 };
        placeInFrame(u, { grid, rng, opts: { ...opts, anchor }, layout, zones, style }, next);
        next.units.push(u);
      }
    }
    for (const ph of beat.text.phrases) lastPhrase = ph.text;

    protect(next, beat);
    legibility(next, beat, style);

    stages.push({
      beat,
      stage: next,
      entry,
      world: worldName,
      layout,
      why: motifOver ? `motif:${motifOver.verb}` : chosen.why,
      motif: motifOver,
      idea: idea ? ideaKey(idea) : null,
      process: world.process ?? "photocopy",
      style,
      form,
      built,
      formPlace,
    });
    stage = next;
  }
  return { grid, stages };
}

/** Legibility as a FLOOR ON ONE THING, not a dimmer on everything.
 *
 *  The old pass knocked every overlapping unit down to 0.35 density, which
 *  is how a page ends up technically readable and completely inert. The rule
 *  now is narrower and harder: the key phrase is above everything, at full
 *  ink, at a real size — and only what would genuinely bury it gives way,
 *  and only where it actually covers it.
 */
/** THE READABLE SET.
 *
 *  On a contact sheet of twenty frames, half were illegible: words cropped
 *  mid-letter by the frame edge, type piled on type at the same scale,
 *  phrases mangled by per-glyph jitter. In a still that reads as texture; at
 *  one second a frame it is noise, and noise all looks the same — which is
 *  most of why a film full of genuinely different parameters still felt
 *  repetitive. If you cannot read it there is nothing to tell one frame from
 *  the next.
 *
 *  So the frame has a READABLE SET and a TEXTURE SET, and the difference is
 *  enforced rather than hoped for:
 *
 *   - the readable set is small, does not overlap ITSELF, is not jittered
 *     past recognition, and may not lose more than a quarter of its width
 *     off the edge;
 *   - everything else must be genuinely small, so it reads as material
 *     rather than as a word competing to be read.
 *
 *  Texture is still free to overlap, bleed and dissolve. This is a floor
 *  under legibility, not a tidiness pass — that distinction is what went
 *  wrong the first time, when protecting the key line dimmed the whole page.
 */
function legibility(stage, beat, style) {
  const live = stage.units.filter((u) => !u.dead);
  const readable = live
    .filter((u) => u.protection >= 0.5)
    .sort((a, b) => b.protection - a.protection || b.size - a.size);

  // At most three things on a frame ask to be read. A fourth is a crowd.
  const keep = readable.slice(0, 3);
  for (const u of readable.slice(3)) {
    u.role = "texture";
    u.protection = 0.2;
    u.size = Math.min(u.size, 0.05);
  }

  for (const [i, u] of keep.entries()) {
    // A readable line is not mangled. Jitter and curvature are wonderful on
    // texture and fatal on the one phrase the frame is about.
    u.style = { ...u.style, glyphJitter: Math.min(u.style.glyphJitter, 0.12), curvature: Math.min(u.style.curvature, 0.18) };
    // NO MORE THAN A QUARTER OFF THE EDGE. Bleed is vocabulary; losing the
    // first three letters of the only phrase on screen is not.
    const w = u.box.w;
    u.box.x = Math.max(-w * 0.25, Math.min(1 - w * 0.75, u.box.x));
    u.box.y = Math.max(-0.02, Math.min(0.96 - u.box.h * 0.5, u.box.y));

    // And they do not sit on each other.
    for (let j = 0; j < i; j++) {
      const o = keep[j];
      const ox = Math.min(u.box.x + u.box.w, o.box.x + o.box.w) - Math.max(u.box.x, o.box.x);
      const oy = Math.min(u.box.y + u.box.h, o.box.y + o.box.h) - Math.max(u.box.y, o.box.y);
      if (ox > 0 && oy > 0) {
        // Push apart along whichever axis costs less.
        if (oy < ox) u.box.y += u.box.y > o.box.y ? oy + 0.02 : -(oy + 0.02);
        else u.box.x += u.box.x > o.box.x ? ox + 0.02 : -(ox + 0.02);
        u.box.y = Math.max(-0.02, Math.min(0.96 - u.box.h * 0.5, u.box.y));
      }
    }
  }

  // Anything not in the readable set is material, and must look like it.
  const cap = 0.035 + (style?.scaleSpread ?? 3) * 0.002;
  for (const u of live) {
    if (keep.includes(u)) continue;
    if (u.size > cap) u.size = cap;
  }
}

function protect(stage, beat) {
  if (beat.text.legibility === "denied") return;
  const key = stage.units.find((u) => !u.dead && u.role === "key" && u.born === beat.startMs);
  if (!key) return;
  key.layer = 100;
  key.wear = Math.min(key.wear, 0.2);
  key.size = Math.max(key.size, 0.09);
  key.density = 1;
  for (const u of stage.units) {
    if (u === key || u.dead || u.protection >= 1) continue;
    const ox =
      Math.max(0, Math.min(u.box.x + u.box.w, key.box.x + key.box.w) - Math.max(u.box.x, key.box.x));
    const oy =
      Math.max(0, Math.min(u.box.y + u.box.h, key.box.y + key.box.h) - Math.max(u.box.y, key.box.y));
    const cover = (ox * oy) / Math.max(1e-6, key.box.w * key.box.h);
    // Only a unit covering more than a third of the key line is a threat.
    if (cover > 0.34) u.density = Math.min(u.density, 0.4);
  }
}

/* ── resolving ─────────────────────────────────────────────────────────── */

const smoothstep = (u) => u * u * (3 - 2 * u);
/** Overshoot. Type that arrives and settles has weight; type that eases to a
 *  stop has none. This is follow-through, and it is one line. */
const backOut = (u) => {
  const c = 1.9;
  const p = u - 1;
  return 1 + p * p * ((c + 1) * p + c);
};

export function resolveAt(stages, tMs) {
  let active = stages[0];
  for (const s of stages) if (tMs >= s.beat.startMs) active = s;
  if (!active) return null;
  const st = active.stage;
  const dt = (tMs - active.beat.startMs) / 1000;
  const beatDur = Math.max(1, active.beat.endMs - active.beat.startMs) / 1000;
  const k = Math.min(1, Math.max(0, dt / beatDur));

  // THE PLATE IS ALWAYS MOVING. Resolved analytically from the beat's own
  // start position and velocity, so it is continuous within a beat and
  // inherited across one.
  const plate = {
    scale: st.plate.scale * (1 + st.plateVel.scale * dt),
    x: st.plate.x + st.plateVel.x * dt,
    y: st.plate.y + st.plateVel.y * dt,
    rot: st.plate.rot + st.plateVel.rot * dt,
  };

  // THE EDIT, if this moment is still inside one. A transition rides ON the
  // plate the beat is already moving rather than replacing it, so a cut never
  // stops the film dead to perform itself.
  const tr = resolveTransition(active.entry, active.beat.startMs, tMs, active.beat.seed);
  if (tr) {
    plate.scale *= tr.plate.scale;
    plate.x += tr.plate.x;
    plate.y += tr.plate.y;
    plate.rot += tr.plate.rot;
  }

  // The field eases from where it was toward where this beat wants it, over
  // the beat — a material that changes state, not a setting that switches.
  const e = smoothstep(k);
  const field = {};
  for (const key of Object.keys(st.fieldTo)) {
    field[key] = st.field[key] + (st.fieldTo[key] - st.field[key]) * e;
  }

  const bstep = boilStep(tMs);
  const out = [];
  for (const u of st.units) {
    if (u.dead) continue;
    if (u.die !== null && tMs >= u.die) continue;
    const age = (tMs - u.born) / 1000;
    let alpha = 1;
    let scale = 1;
    if (u.motion) {
      const local = (tMs - (u.motion.t0 ?? u.born) - (u.motion.delay ?? 0)) / Math.max(1, u.motion.dur);
      const p = Math.max(0, Math.min(1, local));
      if (u.motion.kind === "snap") {
        alpha = Math.min(1, p * 2.2);
        scale = 0.82 + backOut(p) * 0.18;
      } else {
        alpha = smoothstep(p);
        scale = 0.955 + smoothstep(p) * 0.045;
      }
    }
    if (u.die !== null) {
      const left = (u.die - tMs) / 280;
      if (left < 1) alpha *= Math.max(0, left);
    }
    // TYPE BOIL. A few tenths of a percent of the frame, quantised to the
    // same step the material uses, at the unit's own phase. Individually
    // invisible; collectively the difference between printed and pasted.
    const bo = boilOffset(bstep + u.phase, u.phase);
    const jx = (bo.x % 1 - 0.5) * 0.0035;
    const jy = (bo.y % 1 - 0.5) * 0.0035;

    let bx = u.box.x + u.drift.x * age + jx;
    let by = u.box.y + u.drift.y * age + jy;
    let bsize = 1;

    // MIGRATION. The unit travels from what it came out of to where it
    // belongs, over its own attack. This is the whole difference between a
    // thing appearing and a thing BECOMING — the eye follows one object
    // across the boundary instead of watching one vanish and another arrive.
    if (u.from) {
      const mp = smoothstep(
        Math.max(0, Math.min(1, (tMs - u.born) / Math.max(1, u.motion?.dur ?? 1) / 1.6)),
      );
      bx += (u.from.x - u.box.x) * (1 - mp);
      by += (u.from.y - u.box.y) * (1 - mp);
      bsize *= 1 + (u.from.size / Math.max(1e-4, u.size) - 1) * (1 - mp);
    }

    // CONVERGENCE. Scattered material drawn toward — or pushed away from —
    // what matters, across the beat rather than at its boundary. A page of
    // evidence visibly becomes one claim.
    if (u.pull) {
      const pp = smoothstep(Math.max(0, Math.min(1, (tMs - u.pull.t0) / u.pull.dur)));
      const k = u.pull.k * pp;
      bx += (u.pull.x - (bx + u.box.w / 2)) * k;
      by += (u.pull.y - (by + u.box.h / 2)) * k;
    }

    out.push({
      ...u,
      box: { x: bx, y: by, w: u.box.w, h: u.box.h },
      rot: u.rot + u.drift.rot * age + (u.from ? (u.from.rot - u.rot) * 0.4 : 0),
      alpha,
      drawScale: scale * bsize * (1 + u.drift.scale * age * 0.1),
    });
  }

  const marks = [];
  for (const m of st.marks) {
    if (m.dead) continue;
    if (m.die !== null && tMs >= m.die) continue;
    const age = (tMs - m.born) / 1000;
    const local = (tMs - (m.motion?.t0 ?? m.born)) / Math.max(1, m.motion?.dur ?? 1);
    const p = Math.max(0, Math.min(1, local));
    let alpha = m.motion?.kind === "fade" ? smoothstep(p) : Math.min(1, p * 3);
    if (m.die !== null) {
      const left = (m.die - tMs) / 280;
      if (left < 1) alpha *= Math.max(0, left);
    }
    marks.push({
      ...m,
      grow: m.motion?.kind === "snap" ? 1 : smoothstep(p),
      alpha,
      dx: m.drift.x * age,
      dy: m.drift.y * age,
      // A screen's dots breathe. A static dot screen is a texture map.
      dot: Math.min(1, m.density * (0.7 + 0.3 * Math.sin(age * 1.7 + m.born * 0.001))),
    });
  }

  return {
    signs: st.signs ?? [],
    units: out.sort((a, b) => a.layer - b.layer),
    marks: marks.sort((a, b) => a.layer - b.layer),
    stage: st,
    plate,
    field,
    edit: tr,
    process: active.process ?? "photocopy",
    style: active.style,
    form: active.form,
    built: active.built,
    formPlace: active.formPlace,
    // How far through its own beat this moment is — the form grows on it.
    grown: k,
    beat: active.beat,
  };
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));


/** Which of the essay's sections a beat belongs to. Sections are the natural
 *  unit for a world change — they are the writing's own structure, and using
 *  them means the film's universes line up with the argument's parts rather
 *  than with a timer. */
function sectionOf(cut, beat) {
  const motifs = cut.motifs ?? [];
  void motifs;
  return Math.floor(beat.sourceRange.startChar / 420);
}


/** The film's palette at a point on its own slow walk. Hue, a second hue for
 *  the ink, and saturation — which is its own dimension so a stretch of film
 *  can be fully monochrome and the next fully saturated. */
function paletteOf(p, turn) {
  // THE GOLDEN ANGLE, so successive palettes are maximally separated on the
  // wheel by construction. A random hue per palette clusters — four random
  // draws from 360° land within a quadrant more often than not, which is
  // exactly what happened: a whole film in one green.
  const hue = (turn * 137.508 + p[0] * 40) % 360;
  return {
    hue,
    // The ink's hue is either near the ground's or across from it, never
    // the small awkward interval between, where two colours merely disagree.
    hue2: (hue + (p[1] < 0.5 ? 18 + p[1] * 40 : 150 + p[1] * 60)) % 360,
    sat: p[2] < 0.18 ? 0 : 0.2 + p[2] * 0.8,
  };
}


/** Pull a sequence point toward what the writing is about.
 *
 *  `w` is how much the vocabulary decides. At 0 the film ignores its essay
 *  and walks the seed's path; at 1 it stops covering the space and clusters
 *  wherever the words happen to project. Both failures are real and the
 *  midpoint is the design: the writing picks the neighbourhood, the sequence
 *  guarantees the film keeps finding new places inside it.
 */
function blend(point, signature, w) {
  if (!signature || signature.length === 0) return point;
  return point.map((v, i) => {
    const s = signature[i % signature.length];
    return Math.max(0, Math.min(1, v * (1 - w) + s * w));
  });
}


const lerp2 = (a, b, t) => a + (b - a) * t;
