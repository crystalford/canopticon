/* SIGNS — marks that POINT rather than depict.
 *
 * Semiotics splits signs three ways: ICONIC (it resembles what it means — a
 * drawing of a tree), SYMBOLIC (convention decides — a letter, a cross), and
 * INDEXICAL (it is caused by, or points at, what it means — smoke for fire, an
 * arrow, a footprint).
 *
 * The indexical register is the one this engine can use and has none of, and
 * the reason is precise: an indexical mark carries real meaning WITHOUT
 * DEPICTING A THING. A strike-through says "not this" about something
 * specific. A bracket says "these belong together". An arrow says "this leads
 * to that". None of them names a noun, so none of them can walk back into the
 * failure that produced the same centipede in every film — and all of them do
 * the job that failure was reaching for.
 *
 * They are also genuinely INDEXICAL in the technical sense: each one attaches
 * to a real unit on the frame and is positioned from that unit's own box. A
 * strike-through floating in space is decoration; a strike-through crossing a
 * particular phrase is an argument.
 *
 * WHAT DECIDES WHICH. The passage's KIND, which `read/passage.ts` already
 * computes from surface features anyone can check: a negation gets a strike,
 * an enumeration gets a tally, a quantity gets a measure, a concession gets a
 * bracket. And a motif being RECALLED gets a connector — a line drawn back to
 * where it sat before, which is the visual system saying "this, again".
 */

const TAU = Math.PI * 2;

/** Choose the signs this beat's kind calls for, and attach them to real units.
 *
 *  Returns geometry in frame fractions. Drawn into the ink plate with
 *  everything else, so knockout, the press and the light apply.
 */
export function emitSigns(stage, beat, ctx) {
  const live = stage.units.filter((u) => !u.dead && u.protection >= 0.35);
  if (live.length === 0) return [];
  const rng = ctx.rng;
  const kind = beat.reading?.kind ?? "CLAIM";
  const out = [];
  const target = live[Math.floor(rng() * live.length)];
  const b = target.box;

  // How willing this style is to annotate at all. A clean composed frame
  // should not be scribbled on; a rough one should.
  const appetite = 0.28 + (1 - (ctx.style?.gridStrength ?? 0.5)) * 0.5;
  if (rng() > appetite) return out;

  switch (kind) {
    case "NEGATION":
      // NOT THIS. The oldest editorial mark there is.
      out.push({
        kind: rng() < 0.62 ? "strike" : "cross",
        x: b.x - 0.012,
        y: b.y + b.h * 0.55,
        w: b.w + 0.024,
        h: b.h,
        weight: 0.004 + rng() * 0.01,
      });
      break;

    case "CONCESSION":
      // THESE BELONG TOGETHER, and are set aside from the rest.
      out.push({
        kind: "bracket",
        x: b.x - 0.02,
        y: b.y - 0.02,
        w: b.w + 0.04,
        h: b.h + 0.04,
        weight: 0.003 + rng() * 0.005,
      });
      break;

    case "ENUMERATION": {
      // A COUNT, made of marks rather than of a number.
      const n = 3 + Math.floor(rng() * 6);
      out.push({
        kind: "tally",
        x: b.x,
        y: b.y + b.h + 0.03,
        w: Math.min(0.4, n * 0.022),
        h: 0.045,
        n,
        weight: 0.0035,
      });
      break;
    }

    case "QUANTITY":
      // A DIMENSION LINE. It measures something, which is what a figure does.
      out.push({
        kind: "measure",
        x: b.x,
        y: b.y + b.h + 0.035,
        w: b.w,
        h: 0.03,
        weight: 0.003,
      });
      break;

    case "QUESTION":
      // POINTING AT, without saying what.
      out.push({
        kind: rng() < 0.5 ? "caret" : "ring",
        x: b.x + b.w * (0.2 + rng() * 0.6),
        y: b.y + b.h * 0.5,
        w: Math.max(0.06, b.w * 0.35),
        h: Math.max(0.06, b.h * 1.5),
        weight: 0.004,
      });
      break;

    case "ATTRIBUTED":
      // SOMEONE ELSE SAID THIS. Not the film's own voice.
      out.push({
        kind: "quoteRule",
        x: b.x - 0.03,
        y: b.y - 0.01,
        w: 0.006,
        h: b.h + 0.02,
        weight: 0.006,
      });
      break;

    default:
      // A CLAIM gets emphasis, and only sometimes — a film that underlines
      // everything has underlined nothing.
      if (rng() < 0.35) {
        out.push({
          kind: "underline",
          x: b.x,
          y: b.y + b.h + 0.014,
          w: b.w * (0.5 + rng() * 0.6),
          h: 0.004,
          weight: 0.005 + rng() * 0.012,
        });
      }
      break;
  }

  // A CONNECTOR ON A RECALL. The film drawing a line back to where an idea
  // sat before is the visual system saying "this, again" — which is the
  // difference between a repeat and a memory, made explicit as a mark.
  if (ctx.recallFrom && live.length > 0) {
    out.push({
      kind: "connector",
      x: ctx.recallFrom.x,
      y: ctx.recallFrom.y,
      w: b.x + b.w * 0.5 - ctx.recallFrom.x,
      h: b.y + b.h * 0.5 - ctx.recallFrom.y,
      weight: 0.0025,
      arrow: true,
    });
  }

  for (const s of out) {
    s.born = beat.startMs;
    s.grow = ctx.attackMs * (1.2 + rng());
  }
  return out;
}

/** Draw a sign as coverage. Everything is a stroke, because an indexical mark
 *  is a gesture rather than a shape — a hand pointing, not an object. */
export function drawSign(p, s, w, h, t, ink = "#fff") {
  const g = Math.max(0, Math.min(1, (t - s.born) / Math.max(1, s.grow)));
  if (g <= 0) return;
  const X = s.x * w;
  const Y = s.y * h;
  const W = s.w * w;
  const H = s.h * h;
  p.save();
  p.strokeStyle = ink;
  p.fillStyle = ink;
  p.lineWidth = Math.max(1, s.weight * h);
  p.lineCap = "round";
  p.beginPath();

  switch (s.kind) {
    case "strike":
      p.moveTo(X, Y);
      p.lineTo(X + W * g, Y + H * 0.06);
      break;
    case "cross":
      p.moveTo(X, Y - H * 0.5);
      p.lineTo(X + W * g, Y + H * 0.5);
      p.moveTo(X + W * g, Y - H * 0.5);
      p.lineTo(X, Y + H * 0.5);
      break;
    case "underline":
      p.moveTo(X, Y);
      p.lineTo(X + W * g, Y);
      break;
    case "quoteRule":
      p.moveTo(X, Y);
      p.lineTo(X, Y + H * g);
      break;
    case "bracket": {
      const arm = W * 0.14;
      p.moveTo(X + arm, Y);
      p.lineTo(X, Y);
      p.lineTo(X, Y + H * g);
      p.lineTo(X + arm * g, Y + H * g);
      p.moveTo(X + W - arm, Y);
      p.lineTo(X + W, Y);
      p.lineTo(X + W, Y + H * g);
      p.lineTo(X + W - arm * g, Y + H * g);
      break;
    }
    case "tally": {
      const n = Math.max(1, Math.round((s.n ?? 4) * g));
      for (let i = 0; i < n; i++) {
        const x = X + (i * W) / Math.max(1, s.n ?? 4);
        // Every fifth mark crosses the previous four, the way a tally does.
        if ((i + 1) % 5 === 0) {
          p.moveTo(x - W / (s.n ?? 4) * 4.2, Y + H);
          p.lineTo(x + W / (s.n ?? 4) * 0.3, Y);
        } else {
          p.moveTo(x, Y);
          p.lineTo(x, Y + H);
        }
      }
      break;
    }
    case "measure": {
      const e = X + W * g;
      p.moveTo(X, Y + H * 0.5);
      p.lineTo(e, Y + H * 0.5);
      p.moveTo(X, Y);
      p.lineTo(X, Y + H);
      p.moveTo(e, Y);
      p.lineTo(e, Y + H);
      break;
    }
    case "caret":
      p.moveTo(X - W * 0.5 * g, Y + H * 0.5);
      p.lineTo(X, Y);
      p.lineTo(X + W * 0.5 * g, Y + H * 0.5);
      break;
    case "ring":
      p.ellipse(X, Y, (W * 0.6) | 0 || 4, (H * 0.6) | 0 || 4, 0, 0, TAU * g);
      break;
    case "connector": {
      const ex = X + W * g;
      const ey = Y + H * g;
      p.moveTo(X, Y);
      // A slight bow, because a drawn line between two things is never
      // straight and a straight one reads as a rule rather than a gesture.
      p.quadraticCurveTo((X + ex) / 2 + H * 0.12, (Y + ey) / 2 - W * 0.12, ex, ey);
      p.stroke();
      if (s.arrow && g > 0.85) {
        const a = Math.atan2(ey - Y, ex - X);
        const L = Math.min(w, h) * 0.02;
        p.beginPath();
        p.moveTo(ex, ey);
        p.lineTo(ex - Math.cos(a - 0.4) * L, ey - Math.sin(a - 0.4) * L);
        p.moveTo(ex, ey);
        p.lineTo(ex - Math.cos(a + 0.4) * L, ey - Math.sin(a + 0.4) * L);
      }
      break;
    }
    default:
      break;
  }
  p.stroke();
  p.restore();
}
