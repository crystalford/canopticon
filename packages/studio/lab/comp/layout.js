/* LAYOUTS — where a thing goes.
 *
 * `place()` used to be the engine's ONLY spatial idea: score grid-aligned
 * rectangles against an occupancy map, pick the best, add slack. Every
 * composition the engine has ever made is that one function, which is the
 * other half of "same angles and positioning" — the treatments were single,
 * and so was the geometry they were single in.
 *
 * A layout is a function from (grid, stage, unit, rng, opts) to a position and
 * an angle. They are structures, not presets: `radial` on a dense frame and
 * `radial` on an empty one produce different pages, and none of them reads a
 * noun or a topic. The angle ceiling goes with them — a protected headline
 * used to resolve to about ±1.3° of rotation at maximum chaos, so the film
 * could not put a line up the side of the frame even in principle.
 */

/** Shared occupancy. ONE notion of how full a region is, used by the placer,
 *  by the furniture and by anything added later — two implementations is how
 *  they come to disagree about where the page is empty. */
export function occupancy(grid, units) {
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

export function emptiest(grid, units) {
  const occ = occupancy(grid, units);
  let best = { x: 0.5, y: 0.5, v: Infinity };
  for (let c = 0; c < grid.cols; c++) {
    for (let r = 0; r < grid.rows; r++) {
      if (occ[c][r] < best.v) best = { x: c / grid.cols, y: r / grid.rows, v: occ[c][r] };
    }
  }
  return best;
}

function centroid(stage) {
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
  return mass > 0 ? { x: cx / (mass + 1), y: cy / (mass + 1) } : { x: 0.5, y: 0.5 };
}

/* ── the layouts ──────────────────────────────────────────────────────── */

export const LAYOUTS = {
  /** Scored against occupancy, bleed allowed. The original, and still the
   *  right answer when the page wants to look composed rather than found. */
  grid(grid, stage, unit, rng, opts) {
    const occ = occupancy(grid, stage.units);
    const c0 = centroid(stage);
    const wEmpty = 0.5 - opts.density * 0.55;
    const wTension = 0.35 + opts.chaos * 0.7;
    const spanC = Math.max(1, Math.round(unit.box.w * grid.cols));
    const spanR = Math.max(1, Math.round(unit.box.h * grid.rows));
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
        const asym = Math.hypot(x + unit.box.w / 2 - c0.x, y + unit.box.h / 2 - c0.y);
        const outside = Math.max(0, -x) + Math.max(0, x + unit.box.w - 1);
        const score =
          wEmpty * (1 - Math.min(1, local)) +
          wTension * Math.min(1, asym * 1.6) +
          (0.5 - unit.protection * 1.7) * Math.min(1, local) +
          unit.bleed * grid.bleed * Math.min(1, outside * 3);
        if (!best || score > best.score) best = { x, y, score };
      }
    }
    if (!best) best = { x: grid.margin, y: grid.baseline, score: 0 };
    return { x: best.x, y: best.y, rot: (rng() - 0.5) * opts.chaos * 12 };
  },

  /** Thrown out from the centre of mass along a spoke. */
  radial(grid, stage, unit, rng, opts) {
    const c = centroid(stage);
    const a = rng() * Math.PI * 2;
    const r = 0.12 + rng() * 0.42;
    return {
      x: c.x + Math.cos(a) * r - unit.box.w / 2,
      y: c.y + Math.sin(a) * r,
      rot: ((a * 180) / Math.PI) * (opts.chaos > 0.4 ? 1 : 0.2),
    };
  },

  /** Successive units wind outward. Uses the live unit count as its index, so
   *  the shape emerges from what is already on the page. */
  spiral(grid, stage, unit, rng, opts) {
    const n = stage.units.filter((u) => !u.dead).length;
    const a = n * 2.399963; // golden angle — never repeats a spoke
    const r = 0.03 + Math.sqrt(n) * 0.055;
    return {
      x: 0.5 + Math.cos(a) * r - unit.box.w / 2,
      y: 0.5 + Math.sin(a) * r,
      rot: ((a * 180) / Math.PI) % 90 - 45 * opts.chaos,
    };
  },

  /** Around the rim of a circle, each unit tangent to it. */
  ring(grid, stage, unit, rng, opts) {
    const n = stage.units.filter((u) => !u.dead).length;
    const per = 7 + Math.round(opts.density * 6);
    const a = ((n % per) / per) * Math.PI * 2;
    const r = 0.3 + rng() * 0.08;
    return {
      x: 0.5 + Math.cos(a) * r - unit.box.w / 2,
      y: 0.5 + Math.sin(a) * r * 0.72,
      rot: (a * 180) / Math.PI + 90,
    };
  },

  /** A hard column at a fixed left edge. Body copy's own geometry. */
  columnStack(grid, stage, unit, rng, opts) {
    const col = Math.floor(rng() * Math.max(1, grid.cols - 1));
    const n = stage.units.filter((u) => !u.dead).length;
    return {
      x: col / grid.cols + grid.margin * 0.5,
      y: grid.margin + ((n * 0.11) % (1 - grid.margin * 2)),
      rot: (rng() - 0.5) * opts.chaos * 2,
    };
  },

  /** A run stepping across the frame on a diagonal, each unit rotated to it. */
  diagonalRun(grid, stage, unit, rng, opts) {
    const n = stage.units.filter((u) => !u.dead).length;
    const down = grid.symmetry !== "axial";
    const t = ((n * 0.17) % 1.2) - 0.1;
    return {
      x: t - unit.box.w / 2,
      y: down ? t * 0.85 : 0.9 - t * 0.85,
      rot: (down ? 34 : -34) * (0.4 + opts.chaos * 0.8),
    };
  },

  /** Pinned to an edge and running along it — type as a frame element. */
  edgeRun(grid, stage, unit, rng, opts) {
    const side = Math.floor(rng() * 4);
    const along = rng() * 0.7;
    const m = grid.margin;
    if (side === 0) return { x: along, y: m, rot: (rng() - 0.5) * 3 * opts.chaos };
    if (side === 1) return { x: along, y: 1 - m - unit.box.h, rot: (rng() - 0.5) * 3 * opts.chaos };
    if (side === 2) return { x: m, y: along, rot: -90 };
    return { x: 1 - m, y: along, rot: 90 };
  },

  /** Dead centre, and everything else can deal with it. */
  centreOut(grid, stage, unit, rng, opts) {
    return {
      x: 0.5 - unit.box.w / 2,
      y: 0.5 - unit.box.h / 2,
      rot: (rng() - 0.5) * opts.chaos * 6,
    };
  },

  /** Scattered, denser toward a drifting attractor rather than uniform —
   *  uniform scatter reads as noise, weighted scatter reads as a drift. */
  scatter(grid, stage, unit, rng, opts) {
    const c = centroid(stage);
    const bias = 0.35 + opts.density * 0.4;
    const x = c.x + (rng() + rng() - 1) * bias;
    const y = c.y + (rng() + rng() - 1) * bias * 0.8;
    return { x: x - unit.box.w / 2, y, rot: (rng() - 0.5) * 70 * opts.chaos };
  },

  /** Reflected across the frame's vertical axis from wherever the last thing
   *  landed — the composition answering itself. */
  mirroredPair(grid, stage, unit, rng, opts) {
    const last = stage.units.filter((u) => !u.dead).slice(-1)[0];
    if (!last) return LAYOUTS.centreOut(grid, stage, unit, rng, opts);
    return {
      x: 1 - last.box.x - unit.box.w,
      y: last.box.y + (rng() - 0.5) * 0.05,
      rot: -last.rot,
    };
  },

  /** Inside the last thing placed, smaller. Nesting reads as an aside. */
  nested(grid, stage, unit, rng, opts) {
    const host = stage.units
      .filter((u) => !u.dead)
      .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
    if (!host) return LAYOUTS.centreOut(grid, stage, unit, rng, opts);
    return {
      x: host.box.x + host.box.w * (0.08 + rng() * 0.5),
      y: host.box.y + host.box.h * (0.15 + rng() * 0.6),
      rot: host.rot + (rng() - 0.5) * 8 * opts.chaos,
    };
  },
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS);

/** Apply a layout to a unit. The clamp is deliberately loose — a unit may run
 *  off the frame, because bleed is vocabulary. It may not vanish entirely. */
export function place(name, grid, stage, unit, rng, opts) {
  const fn = LAYOUTS[name] || LAYOUTS.grid;
  const p = fn(grid, stage, unit, rng, opts);
  // Pull toward the frame's anchor. Without it the occupancy score sends every
  // composition to the same region — measured on a contact sheet where almost
  // every frame carried its mass left of centre.
  if (opts.anchor) {
    const k = opts.anchor.pull * (1 - unit.protection * 0.35);
    p.x += (opts.anchor.x - unit.box.w / 2 - p.x) * k;
    p.y += (opts.anchor.y - p.y) * k;
  }
  const slack = (1 - unit.protection * 0.5) * opts.chaos;
  unit.box.x = p.x + (rng() - 0.5) * slack * (1 / grid.cols) * 0.9;
  unit.box.y = Math.max(-0.25, Math.min(1.1, p.y + (rng() - 0.5) * slack * (1 / grid.rows) * 0.9));
  unit.rot = p.rot;
  return unit;
}
