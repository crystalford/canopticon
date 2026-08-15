/* MARKS — the non-text material.
 *
 * The last rebuild declared `marks: []` on the stage and never once pushed
 * to it. That empty array is the whole reason the films came out as plain
 * text on a page: the engine's entire visual vocabulary was "draw a word",
 * so a page with two words on it had two things on it and nothing else.
 *
 * WHY THIS IS NOT A MENU OF PICTURES AGAIN. A mark is never chosen to
 * represent what a sentence is ABOUT. There is no noun anywhere in this
 * file. A mark is a GEOMETRIC CONSEQUENCE of the composition that already
 * exists — a rule sits under a headline because a headline has a baseline
 * to sit under; a bar bleeds off an edge because the composition has mass on
 * that edge and nothing holding it; a block appears where the occupancy map
 * says the frame is empty and the beat is heavy. Change the layout and the
 * marks change with it, because they are read off the layout. That is the
 * difference between editorial furniture and a clip-art library.
 *
 * All of them move. A mark that appears at full extent is a slide; a mark
 * that draws itself in is printing.
 */

const MARK_LAYER = { screen: 0, block: 2, bar: 3, rule: 8, frame: 9 };

let nextId = 0;

function mark(kind, box, beat, ctx, extra) {
  return {
    id: `m${nextId++}`,
    kind,
    box,
    rot: 0,
    weight: 1,
    density: 1,
    layer: MARK_LAYER[kind] ?? 4,
    born: beat.startMs,
    die: null,
    dead: false,
    // Marks draw themselves ON, in the axis they run. A rule that fades up
    // is a graphic; a rule that extends is a press laying ink down.
    motion: { kind: "draw", axis: "x", dur: ctx.attackMs * 1.2, t0: beat.startMs },
    drift: { x: 0, y: 0 },
    ...extra,
  };
}

/** Read the composition and lay furniture into it.
 *
 *  Called after the behaviour has introduced its units, so it is always
 *  responding to a real layout rather than predicting one.
 */
export function emitMarks(stage, beat, ctx) {
  const live = stage.units.filter((u) => !u.dead);
  if (live.length === 0 && stage.marks.filter((m) => !m.dead).length > 2) return;
  const r = ctx.rng;
  const intent = beat.visualIntent;
  const heavy = intent.intensity;
  // HOW MUCH FURNITURE THIS KIND OF PAGE CARRIES. A document is ruled and
  // screened; a statement page is one line and a hairline. Without this the
  // same furniture appears on every register and they converge back into one
  // look no matter how differently the type is set.
  const M = ctx.reg?.marks ?? { rule: 0.6, bar: 0.5, block: 0.5, screen: 0.4, frame: 0.3 };

  // ── a rule under the strongest thing on the frame ────────────────────
  // Editorial furniture in its oldest form. It takes its width from the
  // unit it belongs to, so it is never a decoration floating on its own.
  const key = live.slice().sort((a, b) => b.protection - a.protection)[0];
  if (key && r() < M.rule * (0.6 + heavy * 0.5)) {
    const under = r() < 0.72;
    stage.marks.push(
      mark(
        "rule",
        {
          x: key.box.x - 0.01,
          y: under ? key.box.y + key.box.h + 0.012 : key.box.y - 0.02,
          w: Math.min(1.15, key.box.w + 0.02 + r() * 0.25),
          h: 0.002 + heavy * 0.014,
        },
        beat,
        ctx,
        { weight: 0.85 + heavy * 0.15 },
      ),
    );
  }

  // ── a bar that bleeds off an edge ────────────────────────────────────
  // Bleed is vocabulary, not overflow. It runs PAST the frame deliberately,
  // which is the single cheapest thing that stops a composition reading as
  // a slide with margins.
  if (r() < M.bar * (0.35 + intent.density * 0.6)) {
    const vertical = r() < 0.42;
    const thick = 0.02 + r() * (0.05 + heavy * 0.16);
    const along = -0.15 + r() * 0.5;
    stage.marks.push(
      mark(
        "bar",
        vertical
          ? { x: along, y: -0.2, w: thick, h: 1.4 }
          : { x: -0.2, y: along, w: 1.4, h: thick },
        beat,
        ctx,
        {
          density: 0.55 + r() * 0.45,
          motion: {
            kind: "draw",
            axis: vertical ? "y" : "x",
            dur: ctx.attackMs * (1.4 + r()),
            t0: beat.startMs,
          },
          drift: { x: vertical ? 0 : (r() - 0.5) * 0.03, y: vertical ? (r() - 0.5) * 0.03 : 0 },
        },
      ),
    );
  }

  // ── a solid block where the frame is empty and the beat is loud ──────
  // Mass, not illustration. It is placed by the same occupancy the type is
  // placed by, so it fills the composition's actual hole rather than a
  // remembered one.
  if (heavy > 0.5 && r() < M.block * heavy) {
    const hole = emptiest(ctx.grid, live);
    const w = (1 / ctx.grid.cols) * (1 + Math.round(r() * 2));
    const h = (1 / ctx.grid.rows) * (1 + Math.round(r() * 2));
    stage.marks.push(
      mark("block", { x: hole.x, y: hole.y, w, h }, beat, ctx, {
        density: 0.7 + r() * 0.3,
        rot: (r() - 0.5) * 3 * ctx.opts.chaos,
        motion: { kind: "wipe", axis: r() < 0.5 ? "x" : "y", dur: ctx.attackMs, t0: beat.startMs },
      }),
    );
  }

  // ── a halftone screen patch ──────────────────────────────────────────
  // The one mark that is pure material: a region where the ink is screened
  // rather than solid. It is what a photograph leaves behind when there is
  // no photograph.
  if (r() < M.screen * (0.3 + intent.density * 0.6)) {
    const hole = emptiest(ctx.grid, live);
    stage.marks.push(
      mark(
        "screen",
        {
          x: hole.x - 0.05,
          y: hole.y - 0.05,
          w: 0.25 + r() * 0.5,
          h: 0.2 + r() * 0.45,
        },
        beat,
        ctx,
        {
          density: 0.35 + r() * 0.4,
          rot: (r() - 0.5) * 8,
          motion: { kind: "fade", axis: "x", dur: ctx.attackMs * 2, t0: beat.startMs },
          drift: { x: (r() - 0.5) * 0.05, y: (r() - 0.5) * 0.05 },
        },
      ),
    );
  }

  // ── register marks, on an interrupt ──────────────────────────────────
  // Crop and registration marks say "this is a printed sheet" in one stroke
  // and cost four short lines. They arrive on a cut, never on a hold.
  if (intent.continuity === "interrupt" && r() < M.frame * 1.6) {
    stage.marks.push(
      mark("frame", { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }, beat, ctx, {
        density: 0.5,
        motion: { kind: "snap", axis: "x", dur: 70, t0: beat.startMs },
        die: beat.startMs + 900 + ctx.rng() * 1200,
      }),
    );
  }

  // Furniture ages out. Without this the page silts up and every film ends
  // the same way — covered.
  const alive = stage.marks.filter((m) => !m.dead);
  const cap = 5 + Math.round(intent.density * 7);
  if (alive.length > cap) {
    alive
      .slice()
      .sort((a, b) => a.born - b.born)
      .slice(0, alive.length - cap)
      .forEach((m) => {
        if (m.die === null) m.die = beat.startMs + 200 + ctx.rng() * 400;
      });
  }
}

/** The emptiest cell block on the grid, from what is currently placed. The
 *  same occupancy notion the type placer uses — one idea, one implementation. */
function emptiest(grid, units) {
  const occ = Array.from({ length: grid.cols }, () => new Float32Array(grid.rows));
  for (const u of units) {
    const c0 = Math.max(0, Math.floor(u.box.x * grid.cols));
    const c1 = Math.min(grid.cols - 1, Math.ceil((u.box.x + u.box.w) * grid.cols) - 1);
    const r0 = Math.max(0, Math.floor(u.box.y * grid.rows));
    const r1 = Math.min(grid.rows - 1, Math.ceil((u.box.y + u.box.h) * grid.rows) - 1);
    for (let c = c0; c <= c1; c++) for (let rr = r0; rr <= r1; rr++) occ[c][rr] += 1;
  }
  let best = { x: 0, y: 0, v: Infinity };
  for (let c = 0; c < grid.cols; c++) {
    for (let rr = 0; rr < grid.rows; rr++) {
      if (occ[c][rr] < best.v) best = { x: c / grid.cols, y: rr / grid.rows, v: occ[c][rr] };
    }
  }
  return best;
}

/* ── drawing ─────────────────────────────────────────────────────────── */

/** Draw one resolved mark as VALUES into the ink plate. Like the type, a
 *  mark never picks a colour — it lays down ink and the material pass
 *  decides what survives. */
export function drawMark(p, m, w, h, inkValue) {
  const x = m.box.x * w;
  const y = m.box.y * h;
  let bw = m.box.w * w;
  let bh = m.box.h * h;

  // The reveal happens in the mark's own axis: a rule extends along its
  // length, a wipe uncovers a block. Alpha is the fallback, not the default.
  if (m.motion?.kind === "draw") {
    if (m.motion.axis === "y") bh *= m.grow;
    else bw *= m.grow;
  } else if (m.motion?.kind === "wipe") {
    if (m.motion.axis === "y") bh *= m.grow;
    else bw *= m.grow;
  }

  p.save();
  p.globalAlpha = Math.max(0, Math.min(1, m.alpha * m.density));
  p.translate(x + bw / 2 + m.dx * w, y + bh / 2 + m.dy * h);
  if (m.rot) p.rotate((m.rot * Math.PI) / 180);
  p.translate(-bw / 2, -bh / 2);

  if (m.kind === "screen") {
    // A dot screen, drawn as real dots on a rotated grid — the size of each
    // dot is the tone. Drawing it here rather than filtering it later is why
    // it can sit UNDER the type instead of on top of everything.
    const pitch = Math.max(3, Math.round(h * 0.012));
    p.fillStyle = inkValue;
    for (let yy = 0; yy < bh; yy += pitch) {
      for (let xx = 0; xx < bw; xx += pitch) {
        const rr = (m.dot * pitch) / 2;
        if (rr < 0.35) continue;
        p.beginPath();
        p.arc(xx + pitch / 2, yy + pitch / 2, rr, 0, Math.PI * 2);
        p.fill();
      }
    }
  } else if (m.kind === "frame") {
    const t = Math.max(1, h * 0.0022);
    const arm = Math.min(bw, bh) * 0.07;
    p.strokeStyle = inkValue;
    p.lineWidth = t;
    for (const [cx, cy, sx, sy] of [
      [0, 0, 1, 1],
      [bw, 0, -1, 1],
      [0, bh, 1, -1],
      [bw, bh, -1, -1],
    ]) {
      p.beginPath();
      p.moveTo(cx + sx * arm, cy);
      p.lineTo(cx, cy);
      p.lineTo(cx, cy + sy * arm);
      p.stroke();
    }
  } else {
    p.fillStyle = inkValue;
    p.fillRect(0, 0, Math.max(1, bw), Math.max(1, bh));
  }
  p.restore();
}
