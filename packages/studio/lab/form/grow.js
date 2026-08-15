/* FORM — a generator, not a library.
 *
 * THE HOLE THIS FILLS. Every frame this engine has ever produced is words
 * arranged on a surface. It has never depicted anything: no object, no growth,
 * no matter, no structure. That is why nine rounds of adding worlds,
 * treatments, layouts, processes and style dimensions never once stopped the
 * films reading as the same thing — a thousand typographic dials cannot add a
 * subject to a picture that has none.
 *
 * WHY NOT A LIBRARY OF SHAPES. Because that failure is already documented in
 * this repository's own history. The earlier engine's entire object vocabulary
 * was TWO generators, `creature_chain` and `mounted_fixture`, so every film
 * ever made contained the same centipede and the same smoke detector. The
 * operator saw them so many times they stopped trusting the system. A larger
 * table would only move that ceiling; it would not remove it, and a table
 * cannot produce a form its author did not type out.
 *
 * SO: ONE GROWTH PROCESS, CONTINUOUS PARAMETERS. Nothing here is named after
 * a thing. There is no `flower()` and no `blob()`. There is a recursive
 * structure that branches, curls, closes, subdivides and accumulates, and the
 * recognisable things are REGIONS OF ITS PARAMETER SPACE:
 *
 *   radial symmetry + short trunk + opening tips     → reads as a flower
 *   high membrane + high wobble + low branching      → reads as an amoeba
 *   rectilinear 1 + closed cells + shallow depth     → reads as a sheet
 *   high branch + wide angle + downward bias         → reads as a root system
 *   …and the space between any two of those, which has no name and is most
 *   of the volume.
 *
 * THAT LAST LINE IS THE WHOLE CLAIM, and it is falsifiable: if those four are
 * not reachable from the parameters alone — if any of them needs a special
 * case — then this is a library wearing a generator's clothes and should be
 * called one.
 *
 * Output is geometry, never pixels: polylines with width, closed polygons and
 * dots. The renderer lays them into the same ink plate as the type, so
 * knockout, boil, registration and the press apply to form and text alike
 * without a second code path — standing rule 11.
 *
 * Analytic in time. `growAt(form, t)` returns the portion of the structure
 * grown by t, so frame 900 drawn directly is frame 900.
 */

import { mulberry32 } from "../core/rng.js";

const TAU = Math.PI * 2;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const lerp = (a, b, t) => a + (b - a) * t;
const mid = (r) => (r() + r()) / 2;
const polar = (r) => {
  const v = mid(r);
  return v < 0.5 ? v * 0.55 : 1 - (1 - v) * 0.55;
};

/** THE LATENT FACTORS OF FORM. Four numbers deciding what kind of thing this
 *  is, with everything else derived — the same discipline `style/space.js`
 *  uses, and for the same reason: sampling fifteen independent parameters
 *  gives fifteen dimensions of mush, because what a preset table really
 *  encodes is which combinations hold together. */
export function sampleForm(rng, bias = {}) {
  const f = {
    /** amorphous ↔ articulated. Whether this is a mass or a structure. */
    articulation: clamp01((bias.articulation ?? polar(rng)) + (rng() - 0.5) * 0.14),
    /** organic ↔ orthogonal. Whether it grew or was ruled. */
    orthogonality: clamp01((bias.orthogonality ?? polar(rng)) + (rng() - 0.5) * 0.14),
    /** sparse ↔ profuse. How much of it there is. */
    profusion: clamp01((bias.profusion ?? mid(rng)) + (rng() - 0.5) * 0.14),
    /** open ↔ closed. Whether it is a line or has an inside. */
    closure: clamp01((bias.closure ?? polar(rng)) + (rng() - 0.5) * 0.14),
    /** GROWN ↔ BUILT. The factor whose absence made this whole space
     *  botanical. A branching process can only produce biology — reeds, pods,
     *  roots, anemones — because branching IS what a plant does. A thing that
     *  was assembled rather than grown has a SPINE with repeated members
     *  attached at intervals, not tips that split: that is a truss, a ladder,
     *  a comb, a fence, a chassis, a bridge. Same recursion, different rule
     *  about where children go. */
    rigidity: clamp01((bias.rigidity ?? polar(rng)) + (rng() - 0.5) * 0.14),
    /** FLAT ↔ RECEDING. A vanishing point applied to every coordinate. This
     *  is the difference between a diagram of a road and a road: perspective
     *  is not decoration, it is what makes a structure read as occupying
     *  space rather than as a shape on a page. */
    recession: clamp01((bias.recession ?? mid(rng) * 0.9) + (rng() - 0.5) * 0.14),
  };
  return derive(f, rng);
}

/** A NEARBY form. A return in the writing brings back the same region of the
 *  space GROWN FURTHER, which is what makes a callback read as time having
 *  passed rather than as a loop. */
export function driftForm(form, rng, amount) {
  const f = {};
  for (const k of Object.keys(form.f)) {
    f[k] = clamp01(form.f[k] + (rng() - 0.5) * 2 * amount);
  }
  return derive(f, rng, form.seed);
}

function derive(f, rng, keepSeed) {
  const j = (n) => (rng() - 0.5) * n;
  const a = f.articulation;
  const o = f.orthogonality;
  const p = f.profusion;
  const c = f.closure;

  return {
    f,
    seed: keepSeed ?? Math.floor(rng() * 2 ** 31),

    /** How many independent starts, and how they are arranged. Radial
     *  symmetry is what turns a branch into a bloom. */
    seeds: 1 + Math.round(lerp(0, 9, p * 0.7 + (1 - a) * 0.4 + j(0.15))),
    radial: rng() < lerp(0.15, 0.8, c * 0.7 + (1 - o) * 0.4),

    /** Children per node, decaying with depth. Zero is a single stroke. */
    // Branch and depth together decide the mark count exponentially, so the
    // top of both ranges is where a form stops being a structure and becomes
    // a filled rectangle. Measured: three or four samples in twenty read as
    // solid white. The ranges are bounded against each other rather than
    // independently.
    branch: lerp(0, 2.7, a * 1.1 + p * 0.35 + j(0.12)),
    branchDecay: lerp(0.35, 1, a + j(0.1)),
    depth: 1 + Math.round(lerp(0, 5, a * 0.8 + p * 0.5 + j(0.2))),

    /** Angles. Orthogonality snaps them to right angles, continuously — at
     *  0.5 the structure is half-ruled, which has no name. */
    spread: lerp(4, 145, (1 - o) * 0.9 + j(0.12)),
    bias: lerp(-90, 90, rng()) * (1 - c * 0.6),
    snap: o,

    /** Segment shape. Curl is accumulated rotation along a limb. */
    length: lerp(0.04, 0.42, p * 0.5 + (1 - a) * 0.5 + j(0.12)),
    lengthRatio: lerp(0.45, 1.05, a + j(0.12)),
    thickness: lerp(0.0012, 0.038, (1 - a) * 0.8 + c * 0.5 + j(0.1)),
    thickRatio: lerp(0.3, 0.98, a * 0.8 + j(0.1)),
    curl: lerp(0, 2.6, (1 - o) * (1 - a) * 1.4 + j(0.15)),
    wobble: lerp(0, 0.5, (1 - o) * c + j(0.12)),

    /** What a terminal becomes. Continuous, so a tip can be half-open. */
    tipSwell: clamp01(c * 1.2 - a * 0.4 + j(0.2)),
    tipOpen: clamp01(c * (1 - a) * 1.6 - 0.15 + j(0.2)),

    /** MEMBRANE. Above zero the structure has an inside: the outer nodes are
     *  joined into a closed boundary. This is the single dial between a
     *  drawn line and a body. */
    membrane: clamp01(c * 1.35 - a * 0.55 + j(0.15)),
    /** CELLS. Orthogonal closure fills the subdivisions instead of the hull,
     *  which is how a ruled structure becomes a sheet with things on it. */
    cells: clamp01(o * c * 1.5 - 0.2 + j(0.15)),

    /** A gravity or attractor bending every direction. */
    fieldStrength: lerp(0, 0.9, (1 - o) * 0.7 + j(0.15)),
    fieldAngle: rng() * TAU,

    /** Instances across the frame, and how they scatter. */
    repeat: 1 + Math.round(lerp(0, 9, p * p * 1.3 + j(0.2))),
    scatter: lerp(0.02, 0.55, p * 0.6 + (1 - o) * 0.4),
    /** Whether instances arrive over the beat rather than all at once. */
    accumulate: clamp01(p * 1.1 + j(0.2)),
    /** How the whole thing is drawn in over its beat. */
    growth: lerp(0.25, 1, p * 0.5 + a * 0.4 + j(0.2)),

    /* ── BUILT rather than GROWN ─────────────────────────────────────── */
    /** At 1 a limb does not split at its tip — it carries members along its
     *  length at regular intervals. Ladder, truss, comb, fence, ribcage. */
    rigid: f.rigidity,
    /** How many members per span, and how far they stick out. */
    members: 1 + Math.round(lerp(0, 13, f.rigidity * 0.7 + p * 0.5 + j(0.15))),
    memberLen: lerp(0.12, 1.15, (1 - f.rigidity) * 0.4 + c * 0.5 + j(0.15)),
    /** Whether members alternate sides, cross, or all point the same way —
     *  the difference between a comb, a truss and a fence. */
    memberSkew: lerp(-1, 1, rng()),
    /** A second parallel spine, so a span has two chords and the members
     *  become a truss between them rather than teeth on a comb. */
    chords: rng() < f.rigidity * 0.75 ? 2 : 1,
    chordGap: lerp(0.12, 0.75, c * 0.6 + j(0.2)),

    /* ── space ───────────────────────────────────────────────────────── */
    /** Perspective. Everything is pulled toward a vanishing point by an
     *  amount that grows with distance from it. */
    recede: f.recession * lerp(0.2, 1, j(0.3) + 0.5),
    vanishX: lerp(-0.3, 1.3, rng()),
    vanishY: lerp(-0.1, 0.9, rng()),
    /** Repeated enclosure: a rectangle subdivided into a grid of smaller
     *  ones. Facades, windows, panels, sheets, screens. */
    grid: clamp01(o * f.rigidity * 1.6 - 0.15 + j(0.15)),
    gridCols: 1 + Math.round(lerp(0, 11, o * 0.6 + p * 0.6)),
    gridRows: 1 + Math.round(lerp(0, 9, o * 0.5 + p * 0.5)),
  };
}

/* ── building ─────────────────────────────────────────────────────────── */

/** Build the geometry. Pure, deterministic, and independent of time — `growAt`
 *  is what reveals it. Coordinates are frame fractions with the origin at the
 *  form's own anchor, so the compositor places it like anything else. */
export function buildForm(form) {
  const rng = mulberry32(form.seed);
  // A HARD BUDGET, because a recursive generator's cost is exponential in a
  // parameter the sampler is free to set. branch 4.2 at depth 7 across 15
  // instances is over a million limbs and it crashed the renderer outright.
  // The budget is a property of the medium — a frame can only hold so many
  // marks before it is a grey rectangle — so bounding here is honest rather
  // than a workaround.
  const budget = { left: 2600 };
  const limbs = [];
  const dots = [];
  const hulls = [];
  const rects = [];

  for (let inst = 0; inst < form.repeat; inst++) {
    const ox = inst === 0 ? 0 : (rng() - 0.5) * form.scatter * 2;
    const oy = inst === 0 ? 0 : (rng() - 0.5) * form.scatter * 2;
    const born = inst / Math.max(1, form.repeat) * form.accumulate;
    const tips = [];

    const starts = form.radial ? form.seeds : 1;
    for (let s = 0; s < starts; s++) {
      const a0 = form.radial
        ? (s / starts) * TAU + form.bias * (Math.PI / 180)
        : form.bias * (Math.PI / 180);
      grow(form, rng, limbs, dots, tips, ox, oy, a0, form.length, form.thickness, 0, born, budget);
    }

    // MEMBRANE — the outer tips joined into a boundary. A structure with an
    // inside is a different KIND of object from a structure without one, and
    // this is the one dial that crosses between them.
    if (form.membrane > 0.12 && tips.length >= 3) {
      hulls.push({ pts: hull(tips, ox, oy, form, rng), born, fill: form.membrane });
    }
    // A GRID OF ENCLOSURES. A rectangle divided into smaller rectangles is a
    // facade, a sheet of panels, a screen, a window wall — and it is what a
    // BUILT thing has that a grown thing does not.
    if (form.grid > 0.2) {
      const gw = form.length * 3.2;
      const gh = form.length * 2.4;
      const gx = ox - gw / 2;
      const gy = oy - gh / 2;
      for (let c2 = 0; c2 < form.gridCols; c2++) {
        for (let r2 = 0; r2 < form.gridRows; r2++) {
          if (budget.left-- <= 0) break;
          const cw = gw / form.gridCols;
          const ch = gh / form.gridRows;
          rects.push({
            x: gx + c2 * cw,
            y: gy + r2 * ch,
            w: cw * 0.86,
            h: ch * 0.86,
            born: born + ((c2 + r2) / (form.gridCols + form.gridRows)) * 0.4,
            fill: rng() < form.grid * 0.55,
          });
        }
      }
    }

    // CELLS — orthogonal subdivision filled. A ruled structure becomes a
    // sheet with things printed on it.
    if (form.cells > 0.15) {
      const n = 1 + Math.round(form.cells * 5);
      for (let k = 0; k < n; k++) {
        const w = form.length * lerp(0.6, 2.4, rng());
        const h = form.length * lerp(0.4, 1.8, rng());
        rects.push({
          x: ox + (rng() - 0.5) * form.scatter,
          y: oy + (rng() - 0.5) * form.scatter,
          w,
          h,
          born: born + rng() * 0.2,
          fill: rng() < form.cells * 0.7,
        });
      }
    }
  }
  // NORMALISE TO THE FRAME.
  //
  // A form's coordinates are in its own growth units — a `length` of 0.06 at
  // depth 3 spans something like 0.2, and at depth 5 something like 0.9. Left
  // unnormalised, one sample fills the frame and the next is a speck in the
  // corner, and inside a film the speck is indistinguishable from a form that
  // was never generated. So the built structure reports its own extent and is
  // rescaled to a known fraction of the frame. This is what lets the
  // compositor place a form the way it places anything else.
  // PERSPECTIVE, applied to everything before normalisation so the whole
  // structure recedes together. A flat diagram of a bridge is a shape; the
  // same geometry with a vanishing point is a bridge.
  if (form.recede > 0.04) {
    const vx = (form.vanishX - 0.5) * 2;
    const vy = (form.vanishY - 0.5) * 2;
    const warp = (q) => {
      const d = Math.hypot(q.x - vx, q.y - vy);
      const k = 1 / (1 + d * form.recede * 2.2);
      return { ...q, x: vx + (q.x - vx) * k, y: vy + (q.y - vy) * k };
    };
    for (const l of limbs) l.pts = l.pts.map(warp);
    for (const h of hulls) h.pts = h.pts.map(warp);
    for (const d of dots) Object.assign(d, warp(d));
    for (const r of rects) {
      const a2 = warp({ x: r.x, y: r.y });
      const b2 = warp({ x: r.x + r.w, y: r.y + r.h });
      r.x = a2.x;
      r.y = a2.y;
      r.w = b2.x - a2.x;
      r.h = b2.y - a2.y;
    }
  }

  const b = extent(limbs, dots, hulls, rects);
  const span = Math.max(b.w, b.h) || 1;
  const k = 1 / span;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const mapPt = (q) => ({ ...q, x: (q.x - cx) * k, y: (q.y - cy) * k });
  return {
    form,
    limbs: limbs.map((l) => ({ ...l, pts: l.pts.map(mapPt), w: l.w * k })),
    dots: dots.map((d) => ({ ...mapPt(d), r: d.r * k })),
    hulls: hulls.map((h) => ({ ...h, pts: h.pts.map(mapPt) })),
    rects: rects.map((r) => ({
      ...r,
      x: (r.x - cx) * k,
      y: (r.y - cy) * k,
      w: r.w * k,
      h: r.h * k,
    })),
  };
}

function extent(limbs, dots, hulls, rects) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const see = (x, y) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (const l of limbs) for (const q of l.pts) see(q.x, q.y);
  for (const d of dots) see(d.x, d.y);
  for (const h of hulls) for (const q of h.pts) see(q.x, q.y);
  for (const r of rects) {
    see(r.x, r.y);
    see(r.x + r.w, r.y + r.h);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function grow(form, rng, limbs, dots, tips, x, y, angle, len, thick, depth, born, budget) {
  if (depth > form.depth || len < 0.004 || budget.left <= 0) return;
  budget.left -= 1;

  // SNAP. At orthogonality 1 every direction is a right angle; at 0 none is;
  // in between the structure is partly ruled, which is the interesting part.
  const quarter = Math.PI / 2;
  const snapped = Math.round(angle / quarter) * quarter;
  const a = lerp(angle, snapped, form.snap);

  // The limb is a polyline, so curl and wobble are real shape rather than a
  // rotation applied to a straight line.
  const steps = 3 + Math.round(form.curl * 4);
  const pts = [{ x, y }];
  let cx = x;
  let cy = y;
  let ca = a;
  for (let i = 0; i < steps; i++) {
    const seg = len / steps;
    ca += (form.curl / steps) * (rng() < 0.5 ? -1 : 1) * 0.5;
    ca += Math.sin(form.fieldAngle - ca) * form.fieldStrength * 0.25;
    cx += Math.cos(ca) * seg + (rng() - 0.5) * form.wobble * seg;
    cy += Math.sin(ca) * seg + (rng() - 0.5) * form.wobble * seg;
    pts.push({ x: cx, y: cy });
  }
  limbs.push({ pts, w: thick, born: born + depth * 0.11 * form.growth, depth });

  // MEMBERS ALONG THE SPAN — the built rule. Instead of splitting at the tip,
  // the limb carries struts at intervals, which is what a truss, a ladder, a
  // comb, a fence and a chassis all are. Blended continuously with branching,
  // so a half-rigid thing is part-grown and part-assembled and has no name.
  if (form.rigid > 0.25) {
    const n = Math.round(form.members * form.rigid);
    for (let m = 1; m <= n; m++) {
      if (budget.left-- <= 0) break;
      const t = m / (n + 1);
      const px = pts[Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)))];
      const perp = ca + Math.PI / 2;
      const ml = len * form.memberLen;
      const side = form.memberSkew >= 0 || m % 2 === 0 ? 1 : -1;
      limbs.push({
        pts: [
          { x: px.x - Math.cos(perp) * ml * (side > 0 ? 0 : 1), y: px.y - Math.sin(perp) * ml * (side > 0 ? 0 : 1) },
          { x: px.x + Math.cos(perp) * ml * side, y: px.y + Math.sin(perp) * ml * side },
        ],
        w: thick * 0.7,
        born: born + t * 0.3 * form.growth,
        depth: depth + 1,
      });
    }
    // A SECOND CHORD turns teeth into a span.
    if (form.chords === 2) {
      const off = len * form.chordGap;
      const perp = ca + Math.PI / 2;
      limbs.push({
        pts: pts.map((q) => ({ x: q.x + Math.cos(perp) * off, y: q.y + Math.sin(perp) * off })),
        w: thick,
        born: born + depth * 0.11 * form.growth,
        depth,
      });
    }
  }

  const kids = Math.round(form.branch * form.branchDecay ** depth * (1 - form.rigid * 0.75));
  if (kids <= 0 || depth === form.depth) {
    tips.push({ x: cx, y: cy });
    // A TIP IS A CONTINUOUS THING. Swell gives it a body, open gives it
    // radiating strokes; both at once is a bloom, neither is a bare end.
    if (form.tipSwell > 0.1) {
      dots.push({ x: cx, y: cy, r: thick * lerp(1.5, 9, form.tipSwell), born: born + 0.45 });
    }
    if (form.tipOpen > 0.12) {
      const n = 3 + Math.round(form.tipOpen * 7);
      for (let k = 0; k < n; k++) {
        const pa = (k / n) * TAU + ca;
        const pl = len * lerp(0.25, 0.9, form.tipOpen);
        if (budget.left-- <= 0) break;
        limbs.push({
          pts: [
            { x: cx, y: cy },
            { x: cx + Math.cos(pa) * pl, y: cy + Math.sin(pa) * pl },
          ],
          w: thick * 0.8,
          born: born + 0.55,
          depth: depth + 1,
        });
      }
    }
    return;
  }

  for (let k = 0; k < kids; k++) {
    const t = kids === 1 ? 0.5 : k / (kids - 1);
    const off = (t - 0.5) * form.spread * (Math.PI / 180);
    grow(
      form,
      rng,
      limbs,
      dots,
      tips,
      cx,
      cy,
      ca + off,
      len * form.lengthRatio,
      thick * form.thickRatio,
      depth + 1,
      born,
      budget,
    );
  }
}

/** A wobbling closed boundary through the outermost points. Not a convex hull
 *  — a convex hull of a branching structure is a balloon. This walks the tips
 *  by angle and pulls the radius around, which is what gives a membrane its
 *  lobes. */
function hull(tips, ox, oy, form, rng) {
  const by = tips
    .map((p) => ({ a: Math.atan2(p.y - oy, p.x - ox), r: Math.hypot(p.x - ox, p.y - oy) }))
    .sort((m, n) => m.a - n.a);
  const n = Math.max(8, by.length * 2);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI;
    let r = 0;
    let w = 0;
    for (const t of by) {
      const d = 1 / (0.05 + Math.abs(angleDiff(a, t.a)));
      r += t.r * d;
      w += d;
    }
    r = (w > 0 ? r / w : form.length) * (1 + (rng() - 0.5) * form.wobble * 1.6);
    out.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r });
  }
  return out;
}

const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

/** What has grown by `t` (0..1 across the beat). Everything carries a `born`
 *  time, so the structure draws itself in rather than appearing. */
export function growAt(built, t) {
  const alive = (o) => t >= o.born;
  const frac = (o) => clamp01((t - o.born) / Math.max(0.06, built.form.growth * 0.5));
  return {
    limbs: built.limbs.filter(alive).map((l) => ({ ...l, grown: frac(l) })),
    dots: built.dots.filter(alive).map((d) => ({ ...d, grown: frac(d) })),
    hulls: built.hulls.filter(alive).map((h) => ({ ...h, grown: frac(h) })),
    rects: built.rects.filter(alive).map((r) => ({ ...r, grown: frac(r) })),
  };
}

/** A fingerprint, for measuring whether the engine visits new regions or
 *  circles a few. */
export function formKey(form) {
  return Object.keys(form.f)
    .map((k) => Math.round(form.f[k] * 16))
    .join(",");
}
