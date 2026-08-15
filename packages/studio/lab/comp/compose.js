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
import { emitMarks } from "./marks.js";
import { applyField, chooseRegister, lerp, REGISTERS } from "./register.js";

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

/** Place a unit by scoring grid-aligned candidates.
 *
 *  THE SIGN ON THE OVERLAP TERM IS THE WHOLE ARGUMENT. It used to be
 *  negative for everything — every unit pushed away from every other, which
 *  produces a tidy, evenly-spaced, inert page. It is now negative only in
 *  proportion to what the unit is PROTECTING. A texture unit is rewarded for
 *  landing on top of something; the key phrase is the only thing that
 *  genuinely repels, and even it only repels what would bury it.
 */
export function place(grid, stage, unit, rng, opts) {
  const occ = occupancy(grid, stage.units);
  const wEmpty = 0.5 - opts.density * 0.55;
  const wTension = 0.35 + opts.chaos * 0.7;

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

  // BLEED IS A CANDIDATE, NOT AN ERROR. Letting the loop start below zero
  // and end past the last column is what allows a headline to run off the
  // edge — the single most characteristic move in this visual language, and
  // one the old margin clamp made structurally impossible.
  const over = Math.round(grid.cols * grid.bleed * unit.bleed);
  let best = null;
  for (let c = -over; c + spanC <= grid.cols + over; c++) {
    for (let r = 0; r + spanR <= grid.rows; r++) {
      let local = 0;
      for (let i = 0; i < spanC; i++) {
        for (let j = 0; j < spanR; j++) {
          const cc = c + i;
          const rr = r + j;
          if (cc < 0 || cc >= grid.cols || rr < 0 || rr >= grid.rows) continue;
          local += occ[cc][rr];
        }
      }
      local /= spanC * spanR;
      const x = c / grid.cols;
      const y = r / grid.rows;
      const asym = Math.hypot(x + unit.box.w / 2 - cx, y + unit.box.h / 2 - cy);
      // How far off-frame this candidate runs, 0..1.
      const outside =
        Math.max(0, -x) + Math.max(0, x + unit.box.w - 1);
      const score =
        wEmpty * (1 - Math.min(1, local)) +
        wTension * Math.min(1, asym * 1.6) +
        // A protected unit wants clear ground; an unprotected one is happy
        // to land on the pile, and SHOULD, or the page never layers.
        // Texture WANTS to land on the pile — but not on the same square inch
        // as the last five fragments, which turns small print into mush.
        (0.5 - unit.protection * 1.7) * Math.min(1, local) +
        unit.bleed * grid.bleed * Math.min(1, outside * 3) +
        0.25 * (grid.symmetry === "axial" && Math.abs(x + unit.box.w / 2 - 0.5) < 0.08 ? 1 : 0);
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) best = { x: grid.margin, y: grid.baseline, score: 0 };

  const slackX = (rng() - 0.5) * opts.chaos * (1 / grid.cols) * 0.9 * (1 - unit.protection * 0.5);
  const slackY = (rng() - 0.5) * opts.chaos * (1 / grid.rows) * 0.9 * (1 - unit.protection * 0.5);
  unit.box.x = best.x + slackX;
  unit.box.y = Math.max(-0.08, Math.min(1 - unit.box.h * 0.35, best.y + slackY));
  unit.rot = (rng() - 0.5) * opts.chaos * 9 * (1 - unit.protection * 0.7);
  return unit;
}

/* ── units ─────────────────────────────────────────────────────────────── */

const ROLE_PROTECTION = { key: 1, support: 0.6, fragment: 0.2, texture: 0.36 };

function makeUnit(text, role, beat, grid, rng, opts, reg) {
  const intent = beat.visualIntent;
  const R = reg ?? REGISTERS.COLLISION;
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
      ? lerp(R.keyScale, Math.min(1, intent.scale * 0.7 + intent.intensity * 0.5))
      : role === "support"
        ? lerp(R.supportScale, intent.scale)
        : Math.max(0.03, 0.030 + rng() * 0.026);
  return {
    id: `${beat.id}:${role}:${text.slice(0, 12)}`,
    text,
    role,
    protection: ROLE_PROTECTION[role] ?? 0.3,
    face:
      role === "key"
        ? "poster"
        : role === "support"
          ? rng() < 0.35
            ? "news"
            : "grotesque"
          : "mono",
    weight: role === "key" ? 400 : role === "support" ? 500 : 500,
    case: role === "key" ? "upper" : "as",
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
      role === "key" ? Math.min(1, base * 2.6) * Math.max(0, 1 - text.length / 34) * R.bleed : 0,
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
    const want = Math.round(lerp(ctx.reg.texture, beat.visualIntent.density));

    // BODY COPY SETS IN COLUMNS. Placing each fragment independently against
    // the occupancy map scatters them, and several landing in one coarse grid
    // cell overprint into mush that reads as noise rather than as small
    // print. Real small text is a COLUMN: one left edge, one leading, lines
    // stacked. So the first line is placed, and the rest of its column
    // follows it down — which is also why it reads as a document.
    let col = null;
    let line = 0;
    for (let i = 0; i < want && stock.length > 0; i++) {
      const u = makeUnit(stock[i % stock.length], "texture", beat, ctx.grid, ctx.rng, ctx.opts, ctx.reg);
      u.box.w = Math.min(0.9, u.text.length * u.size * 0.5);
      u.box.h = u.size * 1.3;
      const perCol = 3 + Math.floor(ctx.rng() * 4);
      if (col === null || line >= perCol) {
        place(ctx.grid, stage, u, ctx.rng, ctx.opts);
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
    const u = makeUnit(p.text, role, beat, ctx.grid, ctx.rng, ctx.opts, ctx.reg);
    u.box.w = Math.min(1.6, u.text.length * u.size * 0.46);
    u.box.h = u.size * 1.25;
    u.motion = { ...motion, t0: beat.startMs, delay: i * (ctx.attackMs * 0.32) };
    place(ctx.grid, stage, u, ctx.rng, ctx.opts);
    stage.units.push(u);
  }
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

  for (const beat of cut.beats) {
    const rng = mulberry32(beat.seed);
    const attackMs = (1 - cut.settings.pace) * 300 + 60;
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
      const next_ = chooseRegister(beat, regName, regRun, rng);
      turned = next_ !== regName;
      regRun = turned ? 0 : regRun + 1;
      regName = next_;
    }
    const reg = REGISTERS[regName];

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
      opts,
      reg,
      regName,
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
    next.fieldTo.bite = clamp01(0.1 + vi.instability * 0.4 + vi.intensity * 0.2);
    next.fieldTo.coarse = clamp01(0.25 + vi.density * 0.6);
    next.fieldTo.flowX = (rng() - 0.5) * 0.05 * (0.4 + opts.chaos);
    next.fieldTo.flowY = (rng() - 0.5) * 0.04 * (0.4 + opts.chaos);
    // WEAR ONLY EVER ACCUMULATES. A photocopy of a photocopy — the film has
    // an arrow, and the last minute cannot look like the first.
    next.fieldTo.wear = Math.min(0.85, next.field.wear + 0.012 + vi.instability * 0.02);
    // The register says what kind of paper this page is printed on; the beat
    // still says how unsure the argument is. Both, not one.
    Object.assign(next.fieldTo, applyField(next.fieldTo, reg));

    const fn = BEHAVIORS[vi.behavior] || BEHAVIORS.APPEAR;
    fn(next, beat, ctx);
    if (vi.secondary && BEHAVIORS[vi.secondary]) BEHAVIORS[vi.secondary](next, beat, ctx);

    emitMarks(next, beat, ctx);

    // THE SETTLE PASS MUST NOT UNDO THIS BEAT.
    //
    // It sorts by protection and kills the weakest, and TEXTURE is protection
    // zero — so it deleted precisely the small body text `ACCUMULATE` had
    // just laid down, every time, and the frame came out empty while the
    // report said the density target was met. It only ever gets to retire
    // what was already there.
    const target = vi.density * reg.crowd;
    const older = () => next.units.filter((u) => !u.dead && u.born < beat.startMs);
    let guard = 24;
    while (coverage(next) > target + 0.3 && guard-- > 0) {
      const weakest = older().sort((a, b) => a.protection - b.protection)[0];
      if (!weakest || weakest.protection >= 1) break;
      weakest.dead = true;
    }

    protect(next, beat);

    stages.push({ beat, stage: next });
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

    out.push({
      ...u,
      box: {
        x: u.box.x + u.drift.x * age + jx,
        y: u.box.y + u.drift.y * age + jy,
        w: u.box.w,
        h: u.box.h,
      },
      rot: u.rot + u.drift.rot * age,
      alpha,
      drawScale: scale * (1 + u.drift.scale * age * 0.1),
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
    units: out.sort((a, b) => a.layer - b.layer),
    marks: marks.sort((a, b) => a.layer - b.layer),
    stage: st,
    plate,
    field,
    beat: active.beat,
  };
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));
