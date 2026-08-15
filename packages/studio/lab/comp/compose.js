/* THE COMPOSITOR.
 *
 * Every previous attempt at this engine failed for one reason: SELECTION.
 * If each beat CHOOSES a treatment, the film is a gallery — however large
 * the gallery, however clever the chooser. Four rebuilds proved it.
 *
 * So nothing here chooses a picture. There is ONE composition, alive for
 * the whole film, and behaviours MUTATE it. The same behaviour applied to a
 * different incoming state produces a different picture with no additional
 * vocabulary at all. Continuity is the default; discontinuity has to be
 * asked for.
 *
 * A unit is never destroyed at a beat boundary. It has a `die` time or it
 * does not. That one decision is the difference between a film and a
 * slideshow.
 */

import { mulberry32 } from "../core/rng.js";

/* ── the grid ──────────────────────────────────────────────────────── */

/** Derived ONCE from the film seed. Two seeds are architecturally
 *  different films — not the same film with the words moved, which is the
 *  failure the seed test exists to catch. */
export function buildGrid(seed) {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const cols = 3 + Math.floor(r() * 5); // 3..7
  return {
    cols,
    rows: Math.max(3, Math.round(cols * 0.62)),
    margin: 0.04 + r() * 0.07,
    symmetry: ["axial", "offset", "diagonal"][Math.floor(r() * 3)],
    rotation: (r() - 0.5) * 1.2, // degrees, the whole plate
    baseline: 0.3 + r() * 0.4,
  };
}

/* ── placement — solved, not chosen ────────────────────────────────── */

/** Occupancy of the frame, in grid cells, from what is already placed.
 *  This is the term a gallery cannot have: the composition answers itself. */
function occupancy(grid, units) {
  const a = Array.from({ length: grid.cols }, () => new Float32Array(grid.rows));
  for (const u of units) {
    if (u.dead) continue;
    const c0 = Math.max(0, Math.floor(u.box.x * grid.cols));
    const c1 = Math.min(grid.cols - 1, Math.ceil((u.box.x + u.box.w) * grid.cols) - 1);
    const r0 = Math.max(0, Math.floor(u.box.y * grid.rows));
    const r1 = Math.min(grid.rows - 1, Math.ceil((u.box.y + u.box.h) * grid.rows) - 1);
    for (let c = c0; c <= c1; c++) {
      for (let rr = r0; rr <= r1; rr++) a[c][rr] += u.density * (0.4 + u.protection * 0.6);
    }
  }
  return a;
}

/** Place a unit by scoring every grid-aligned candidate box against what is
 *  already on the frame. No position presets exist anywhere in this engine;
 *  this function is the only thing that decides where anything goes. */
export function place(grid, stage, unit, rng, opts) {
  const occ = occupancy(grid, stage.units);
  const wEmpty = 1.2 - opts.density * 0.6; // a dense film WANTS to crowd
  const wTension = 0.2 + opts.chaos * 0.5;
  const wMemory = unit.motifId && unit.lastBox ? 0.9 : 0;

  // The composition's current centre of mass — asymmetry is scored against
  // it, so the frame stays in tension rather than settling into the middle.
  let cx = 0.5;
  let cy = 0.5;
  let mass = 0;
  for (const u of stage.units) {
    if (u.dead) continue;
    const m = u.density * u.box.w * u.box.h;
    cx += (u.box.x + u.box.w / 2) * m;
    cy += (u.box.y + u.box.h / 2) * m;
    mass += m;
  }
  if (mass > 0) {
    cx /= mass + 1;
    cy /= mass + 1;
  }

  const spanC = Math.max(1, Math.round(unit.box.w * grid.cols));
  const spanR = Math.max(1, Math.round(unit.box.h * grid.rows));
  let best = null;
  for (let c = 0; c + spanC <= grid.cols; c++) {
    for (let r = 0; r + spanR <= grid.rows; r++) {
      let local = 0;
      let clash = 0;
      for (let i = 0; i < spanC; i++) {
        for (let j = 0; j < spanR; j++) {
          local += occ[c + i][r + j];
          if (occ[c + i][r + j] > 0.5) clash += 1;
        }
      }
      local /= spanC * spanR;
      const x = c / grid.cols;
      const y = r / grid.rows;
      const asym = Math.hypot(x + unit.box.w / 2 - cx, y + unit.box.h / 2 - cy);
      const memory = wMemory
        ? 1 - Math.min(1, Math.hypot(x - unit.lastBox.x, y - unit.lastBox.y))
        : 0;
      const score =
        wEmpty * (1 - Math.min(1, local)) +
        wMemory * memory +
        wTension * Math.min(1, asym * 1.6) +
        0.3 * (grid.symmetry === "axial" && Math.abs(x + unit.box.w / 2 - 0.5) < 0.08 ? 1 : 0) -
        1.6 * (clash / (spanC * spanR)) * unit.protection;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) best = { x: grid.margin, y: grid.baseline, score: 0 };

  // CHAOS IS A DEVIATION BUDGET, not randomness: the same seed composes the
  // same film at chaos 0 and chaos 1, and only the departures grow. Scaled
  // by (1 - protection) so the key phrase is the last thing to move.
  const slackX = (rng() - 0.5) * opts.chaos * (1 / grid.cols) * 0.6 * (1 - unit.protection);
  const slackY = (rng() - 0.5) * opts.chaos * (1 / grid.rows) * 0.6 * (1 - unit.protection);
  // THE MARGIN IS THE COMPOSITION'S EDGE, not a safety clamp. Grid cells
  // run to the frame edge, so a unit placed in row 0 sits hard against the
  // top with its ascenders cropped — which reads as a rendering fault, not
  // as a full-bleed decision. The margin is honoured on both axes, and a
  // deliberate bleed is CROP's job, not an accident of placement.
  const m = grid.margin;
  unit.box.x = Math.max(m, Math.min(1 - m - unit.box.w, best.x + slackX));
  unit.box.y = Math.max(m, Math.min(1 - m - unit.box.h, best.y + slackY));
  unit.rot = (rng() - 0.5) * opts.chaos * 6 * (1 - unit.protection);
  return unit;
}

/* ── behaviours — operators over the stage, not renderers ──────────── */

const ROLE_PROTECTION = { key: 1, support: 0.6, fragment: 0.2, texture: 0 };

function makeUnit(text, role, beat, grid, rng) {
  return {
    id: `${beat.id}:${role}:${text.slice(0, 12)}`,
    text,
    role,
    protection: ROLE_PROTECTION[role] ?? 0.3,
    face: role === "key" ? "poster" : role === "support" ? "grotesque" : "mono",
    // Archivo Black IS the black weight — it ships as a single 400 face, so
    // asking for 900 gets a synthesised bold or a silent fallback rather
    // than the real thing. Weight is per-face, not a global scale.
    weight: role === "key" ? 400 : 500,
    case: role === "key" ? "upper" : "as",
    tracking: role === "key" ? 0.2 + rng() * 0.4 : 0.1,
    box: { x: grid.margin, y: grid.baseline, w: 0, h: 0 },
    size: 0.1,
    rot: 0,
    layer: role === "key" ? 10 : 5,
    density: 1,
    wear: 0,
    born: beat.startMs,
    die: null,
    dead: false,
    motion: null,
    lastBox: null,
  };
}

/** Each behaviour is 10–40 lines and mutates the stage. None of them names
 *  a font, a colour or a pixel coordinate. */
const BEHAVIORS = {
  APPEAR(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
  },
  SLAM(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: Math.min(120, ctx.attackMs * 0.35) });
    // The frame is SHOVED ASIDE by the arrival. Nothing is cleared — the
    // existing composition is pushed, worn and dimmed, which is what makes
    // an entrance read as force rather than as a new slide.
    for (const u of stage.units) {
      if (u.born >= beat.startMs || u.dead) continue;
      u.wear = Math.min(1, u.wear + 0.08 * beat.visualIntent.intensity);
      u.density = Math.max(0.15, u.density - 0.15);
    }
  },
  SURGE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: ctx.attackMs * 0.5 });
    for (const u of stage.units) if (!u.dead) u.size *= 1.06;
  },
  FREEZE(stage, beat) {
    // A rest produces NO operator. The stage holds; nothing is introduced.
    // Negative space is an editorial decision and this is where it is made.
    void stage;
    void beat;
  },
  ACCUMULATE(stage, beat, ctx) {
    // A LOOP AGAINST A MEASURED QUANTITY, which is why "one phrase → many →
    // dense → overwhelming" is one continuous behaviour and not four canned
    // pictures.
    const target = beat.visualIntent.density;
    let guard = 24;
    while (coverage(stage) < target - 0.03 && guard-- > 0) {
      const source = stage.units.filter((u) => !u.dead).sort((a, b) => b.protection - a.protection)[0];
      if (!source) break;
      const echo = {
        ...source,
        id: `${source.id}#${guard}`,
        role: "texture",
        protection: 0,
        layer: 1,
        density: Math.max(0.2, source.density * 0.72),
        size: source.size * (0.78 + ctx.rng() * 0.14),
        box: { ...source.box },
        born: beat.startMs,
        motion: { kind: "fade", dur: ctx.attackMs, t0: beat.startMs },
      };
      place(ctx.grid, stage, echo, ctx.rng, ctx.opts);
      stage.units.push(echo);
      stage.field.wear = Math.min(1, stage.field.wear + 0.03);
    }
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
  },
  COLLAPSE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
    // "One phrase survives" is WHAT IS NOT KILLED — not a new picture of a
    // surviving phrase.
    const alive = stage.units.filter((u) => !u.dead).sort((a, b) => b.protection - a.protection);
    alive.slice(1).forEach((u, i) => {
      u.die = beat.startMs + 120 + i * 60;
    });
  },
  INVERT(stage, beat, ctx) {
    stage.ink.polarity ^= 1;
    introduce(stage, beat, ctx, { kind: "snap", dur: ctx.attackMs * 0.4 });
  },
  INTERRUPT(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "snap", dur: 60 });
  },
  FRAGMENT(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs });
  },
  REASSEMBLE(stage, beat, ctx) {
    introduce(stage, beat, ctx, { kind: "fade", dur: ctx.attackMs * 1.4 });
  },
  ECHO(stage, beat, ctx) {
    // Creates no units — sets `repeat` on one that exists.
    const u = stage.units.filter((x) => !x.dead).sort((a, b) => b.protection - a.protection)[0];
    if (!u) return;
    u.repeat = {
      n: 2 + Math.round(beat.visualIntent.intensity * 5),
      dx: (1 / ctx.grid.cols) * 0.5,
      dy: (1 / ctx.grid.rows) * 0.35,
      decay: 0.16,
    };
  },
  OVERPRINT(stage, beat, ctx) {
    const top = stage.units.filter((u) => !u.dead).sort((a, b) => b.layer - a.layer).slice(0, 2);
    if (top.length < 2) return;
    top[1].box.x = top[0].box.x + (ctx.rng() - 0.5) * 0.1;
    top[1].box.y = top[0].box.y + (ctx.rng() - 0.5) * 0.06;
    top[1].density = Math.min(1, top[1].density + 0.2);
  },
};

function introduce(stage, beat, ctx, motion) {
  for (const [i, p] of beat.text.phrases.entries()) {
    const role = i === 0 ? "key" : "support";
    const u = makeUnit(p.text, role, beat, ctx.grid, ctx.rng);
    u.size = beat.visualIntent.scale * (role === "key" ? 1 : 0.45);
    // A first, rough box so the placer has an extent to score. The painter
    // measures for real; this is only to reserve plausible space.
    u.box.w = Math.min(0.86, u.text.length * u.size * 0.42);
    u.box.h = u.size * 1.25;
    u.motion = { ...motion, t0: beat.startMs };
    place(ctx.grid, stage, u, ctx.rng, ctx.opts);
    stage.units.push(u);
  }
}

/** Rough ink coverage, from unit extents. The density loop closes against
 *  this rather than against a multiplier. */
function coverage(stage) {
  let a = 0;
  for (const u of stage.units) if (!u.dead) a += u.box.w * u.box.h * u.density;
  return Math.min(1, a);
}

/* ── the reducer ───────────────────────────────────────────────────── */

export function buildStages(cut) {
  const grid = buildGrid(cut.seed);
  const opts = { chaos: cut.settings.chaos, density: cut.settings.density };
  let stage = {
    units: [],
    marks: [],
    field: { wear: 0, grain: 0.16, halftone: 0, registration: 0, bleed: 0 },
    plate: { scale: 1, x: 0, y: 0, rot: grid.rotation },
    ink: { polarity: 0, ground: 0.94, ink: 0.06 },
  };
  const stages = [];

  for (const beat of cut.beats) {
    const rng = mulberry32(beat.seed);
    const attackMs = (1 - cut.settings.pace) * 260 + 40;
    const ctx = { grid, rng, opts, attackMs };

    // INHERITANCE IS THE DEFAULT. Only `interrupt` clears, and even then it
    // keeps what is protected.
    const next = {
      units:
        beat.visualIntent.continuity === "interrupt"
          ? stage.units.filter((u) => !u.dead && u.protection >= 0.6).map((u) => ({ ...u }))
          : stage.units.map((u) => ({ ...u })),
      marks: [...stage.marks],
      field: { ...stage.field },
      plate: { ...stage.plate },
      ink: { ...stage.ink },
    };
    // Retire what has died.
    for (const u of next.units) if (u.die !== null && beat.startMs >= u.die) u.dead = true;

    const fn = BEHAVIORS[beat.visualIntent.behavior] || BEHAVIORS.APPEAR;
    fn(next, beat, ctx);
    if (beat.visualIntent.secondary && BEHAVIORS[beat.visualIntent.secondary]) {
      BEHAVIORS[beat.visualIntent.secondary](next, beat, ctx);
    }

    // Instability is a SEPARATE channel from chaos: chaos is the film's
    // register, instability is this argument becoming unsure. A phrase
    // degrades because the argument destabilises, not because a filter is on.
    next.field.wear = Math.min(0.9, next.field.wear + beat.visualIntent.instability * 0.1);

    // DENSITY SETTLES by retiring the LOWEST protection first, so it can
    // never eat the key phrase.
    const target = beat.visualIntent.density;
    const alive = () => next.units.filter((u) => !u.dead);
    let guard = 24;
    while (coverage(next) > target + 0.06 && guard-- > 0) {
      const weakest = alive().sort((a, b) => a.protection - b.protection)[0];
      if (!weakest || weakest.protection >= 1) break;
      weakest.dead = true;
    }

    // LEGIBILITY, LAST, WITH AUTHORITY over everything above it.
    protect(next, beat);

    stages.push({ beat, stage: next });
    stage = next;
  }
  return { grid, stages };
}

/** The pass that prevents the old engine's catastrophic failure: choosing
 *  the right phrase and then destroying it downstream. It runs last and it
 *  is allowed to move everything else. */
function protect(stage, beat) {
  if (beat.text.legibility === "denied") return;
  const key = stage.units.find((u) => !u.dead && u.role === "key" && u.born === beat.startMs);
  if (!key) return;
  key.layer = 100; // above everything
  key.wear = Math.min(key.wear, 0.15);
  key.size = Math.max(key.size, 0.045);
  key.density = 1;
  // Anything overlapping the protected box loses density rather than the
  // key phrase losing size.
  for (const u of stage.units) {
    if (u === key || u.dead || u.protection >= 1) continue;
    const overlap =
      Math.max(0, Math.min(u.box.x + u.box.w, key.box.x + key.box.w) - Math.max(u.box.x, key.box.x)) *
      Math.max(0, Math.min(u.box.y + u.box.h, key.box.y + key.box.h) - Math.max(u.box.y, key.box.y));
    if (overlap > 0.004) u.density = Math.min(u.density, 0.35);
  }
}

/* ── resolving a stage at a time ───────────────────────────────────── */

const smoothstep = (u) => u * u * (3 - 2 * u);

/** ANALYTIC, NOT INTEGRATED — and this is mandatory, not stylistic. The
 *  exporter draws frame 900 as t=30.000s by index, and the offline stills
 *  script draws frames out of order. Anything accumulating per-frame state
 *  would render differently depending on which frames were asked for. */
export function resolveAt(stages, tMs) {
  let active = stages[0];
  for (const s of stages) if (tMs >= s.beat.startMs) active = s;
  if (!active) return null;
  const out = [];
  for (const u of active.stage.units) {
    if (u.dead) continue;
    if (u.die !== null && tMs >= u.die) continue;
    let alpha = 1;
    let scale = 1;
    if (u.motion) {
      const local = (tMs - (u.motion.t0 ?? u.born)) / Math.max(1, u.motion.dur);
      const p = Math.max(0, Math.min(1, local));
      const eased = u.motion.kind === "snap" ? Math.pow(p, 0.25) : smoothstep(p);
      alpha = eased;
      scale = u.motion.kind === "snap" ? 0.94 + eased * 0.06 : 0.97 + eased * 0.03;
    }
    // Dying units thin out rather than vanishing on a frame boundary.
    if (u.die !== null) {
      const left = (u.die - tMs) / 260;
      if (left < 1) alpha *= Math.max(0, left);
    }
    out.push({ ...u, alpha, drawScale: scale });
  }
  return { units: out.sort((a, b) => a.layer - b.layer), stage: active.stage, beat: active.beat };
}
