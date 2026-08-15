/* THE RENDERER — ink, paper, and the press between them.
 *
 * Three plates, and the separation is the whole design:
 *
 *   PAPER   the generative field. Always moving, always boiling.
 *   INK     the composition — type and marks — drawn as pure coverage.
 *   PRESS   what happens when one meets the other.
 *
 * The old renderer had no paper at all. It filled a rectangle with a flat
 * value, drew text on it, and perturbed a threshold with noise that had NO
 * TIME TERM — so the "photocopy grain" was one frozen still image held for
 * the whole film, and a six-second hold was six seconds of a JPEG. The
 * animation literature is unambiguous about that failure: removing the
 * frame-to-frame wobble is precisely what makes a drawing read as frozen
 * rather than as still.
 *
 * DEGRADATION STILL HAPPENS AT THRESHOLD TIME, not as an overlay, because
 * that is mechanically what a photocopier does. What is new is that the
 * threshold is driven by a real moving material rather than by static noise.
 */

import { resolveAt } from "../comp/compose.js";
import { drawMark } from "../comp/marks.js";
import { makeField, registration, renderField } from "../core/field.js";
import { layoutText } from "../comp/treatment.js";
import { drawForm } from "../form/draw.js";
import { growAt } from "../form/grow.js";
import { PROCESSES } from "./process.js";
import { FACES } from "../core/type.js";

/** The whole colour system. A ground, an ink, and a polarity. No hue exists
 *  anywhere in this engine; when colour arrives it arrives as one accent
 *  value in this object and nowhere else. */
export function inkOf(stage) {
  const flip = stage.ink.polarity === 1;
  const ground = flip ? stage.ink.ink : stage.ink.ground;
  const ink = flip ? stage.ink.ground : stage.ink.ink;
  return { ground, ink, flip };
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
};

export function drawFrame(ctx, film, frameIndex) {
  const { stages, cut } = film;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const tMs = (frameIndex / cut.fps) * 1000;
  const res = resolveAt(stages, tMs);
  if (!res) return;
  const { units, marks, stage, plate, field, edit, process, built, formPlace, grown } = res;
  const ink = inkOf(stage);

  // The plate runs coarser than the output and is upscaled without
  // smoothing. That is the photocopy's own resolution loss, and it halves
  // the per-pixel cost of everything below.
  const pw = Math.max(2, Math.round(w * 0.7));
  const ph = Math.max(2, Math.round(h * 0.7));

  const buf = ensureBuffers(film, pw, ph);
  const p = buf.inkCtx;

  /* ── 1 · THE INK PLATE — coverage only, white on black ───────────────
   * Drawn as pure coverage rather than as final colour, so the press below
   * can decide what actually takes. Nothing here knows the film's polarity. */
  p.setTransform(1, 0, 0, 1, 0, 0);
  p.fillStyle = "#000";
  p.fillRect(0, 0, pw, ph);

  p.save();
  p.translate(pw / 2 + plate.x * pw, ph / 2 + plate.y * ph);
  p.rotate((plate.rot * Math.PI) / 180);
  p.scale(plate.scale, plate.scale);
  p.translate(-pw / 2, -ph / 2);

  // THE FORM, FIRST AND INTO THE SAME PLATE.
  //
  // Everything this engine ever rendered was words on a surface — it had never
  // once depicted anything, which is why no amount of typographic variety ever
  // stopped the films reading as one thing. The form goes into the ink plate
  // rather than over the finished picture, so knockout, boil, registration and
  // the press treat it exactly as they treat text. A form composited after the
  // press would be a sticker on a photocopy.
  if (built && formPlace) {
    drawForm(p, growAtSafe(built, grown ?? 0), formPlace.x, formPlace.y, formPlace.scale, pw, ph);
  }

  // Marks next — furniture sits under the words, which is what makes a
  // block read as a block rather than as something pasted over the type.
  const solids = [];
  for (const m of marks) {
    if (m.layer >= 8) continue;
    drawMark(p, m, pw, ph, "#fff");
    if (m.kind === "block" || m.kind === "bar") {
      const gw = m.motion?.axis === "y" ? m.box.w : m.box.w * m.grow;
      const gh = m.motion?.axis === "y" ? m.box.h * m.grow : m.box.h;
      solids.push({
        x: m.box.x + m.dx,
        y: m.box.y + m.dy,
        w: gw,
        h: gh,
      });
    }
  }

  /** KNOCKOUT — type reversed out of solid ink, WHERE IT ACTUALLY OVERLAPS.
   *
   *  Ink over ink is invisible: a block and a word are both full coverage, so
   *  a line crossing a solid mass simply disappears. Print reverses the type
   *  out of the solid, and so does this.
   *
   *  THE FIRST VERSION DECIDED THIS PER UNIT, from the centre of its box —
   *  which is right only for type smaller than the block it sits on. A
   *  headline spanning half the frame has its centre somewhere else entirely,
   *  so no knockout fired and light type printed onto a light block: the
   *  white-on-white the operator could not read. A unit is not on or off a
   *  solid, it is PARTLY on one, and the reversal has to follow the geometry
   *  rather than a boolean.
   *
   *  So the type is drawn twice: once normally, then again in destination-out
   *  CLIPPED to each solid. Outside the solid the first pass stands; inside
   *  it, the second erases. Exactly what a press does, and correct for type
   *  of any size. */
  const knockout = (draw) => {
    for (const s of solids) {
      p.save();
      p.beginPath();
      p.rect(s.x * pw, s.y * ph, s.w * pw, s.h * ph);
      p.clip();
      p.globalCompositeOperation = "destination-out";
      draw();
      p.restore();
    }
  };

  /* THE TYPE, VIA ITS TREATMENT.
   *
   * A unit is no longer one `fillText`. `layoutText` returns GLYPH RUNS — one
   * for a line, one per glyph for `perLetter`, one per letter down the page
   * for `column`, one per character along a curve for `arc` — and this loop
   * draws whatever it is handed. That is the whole reason the treatments can
   * be added freely: knockout, boil, migration, convergence and the press all
   * operate here, over runs, so a new way of setting type inherits every one
   * of them without touching this file again.
   */
  for (const u of units) {
    const laid = layoutText(p, u, pw, ph);
    if (laid.runs.length === 0) continue;

    const drawRuns = (dx, dy, alpha) => {
      p.save();
      p.translate(u.box.x * pw + dx, u.box.y * ph + dy);
      if (u.rot) p.rotate((u.rot * Math.PI) / 180);
      p.scale(u.drawScale, u.drawScale);
      p.globalAlpha = Math.max(0, Math.min(1, alpha));
      for (const r of laid.runs) {
        p.save();
        p.letterSpacing = `${((r.tracking ?? 0) * 0.06).toFixed(3)}em`;
        p.font = `${r.weight || 700} ${r.px}px ${FACES[r.face] || FACES.grotesque}`;
        p.textAlign = "left";
        p.textBaseline = "alphabetic";
        p.translate(r.x, r.y);
        if (r.rot) p.rotate((r.rot * Math.PI) / 180);
        if (r.flipY) p.scale(1, -1);
        if (r.alpha !== undefined) p.globalAlpha = Math.max(0, Math.min(1, alpha * r.alpha));
        if (r.stroke) {
          p.strokeStyle = "#fff";
          p.lineWidth = r.stroke;
          p.strokeText(r.text, 0, 0);
        } else {
          p.fillStyle = "#fff";
          p.fillText(r.text, 0, 0);
        }
        p.restore();
      }
      p.restore();
    };

    if (u.repeat) {
      for (let i = u.repeat.n; i >= 1; i--) {
        drawRuns(
          u.repeat.dx * pw * i,
          u.repeat.dy * ph * i,
          u.alpha * u.density * (1 - u.repeat.decay * i),
        );
      }
    }
    drawRuns(0, 0, u.alpha * u.density);
    if (solids.length > 0) knockout(() => drawRuns(0, 0, u.alpha * u.density));
  }

  // Rules and register marks print OVER the type, like real furniture.
  for (const m of marks) {
    if (m.layer < 8) continue;
    drawMark(p, m, pw, ph, "#fff");
  }
  p.restore();

  /* ── 2 · THE PAPER — a live generative field ─────────────────────────
   * Advected by the plate as well as by its own flow, because the sheet and
   * the image printed on it are the same object. */
  renderField(
    buf.field,
    pw,
    ph,
    tMs,
    { ...field, flowX: field.flowX + plate.x * 0.4, flowY: field.flowY + plate.y * 0.4 },
    buf.fieldState,
  );

  /* ── 3 · THE PRESS ───────────────────────────────────────────────────*/
  const inkImg = p.getImageData(0, 0, pw, ph);
  const src = inkImg.data;
  const out = buf.out;
  const dst = out.data;
  const F = buf.field;

  const reg = registration(tMs, cut.seed, field.wear * 2.4 + 0.6);
  const rx = Math.round(reg.x);
  const ry = Math.round(reg.y);

  // THE EDIT AT PRESS TIME. Flash, tear and wipe are not effects laid over a
  // finished picture — they happen where the ink meets the paper, which is
  // why they read as the press misbehaving rather than as a filter.
  const flash = edit?.flash ?? 0;
  const slice = edit?.slice ?? 0;
  const wipeAt = edit?.wipe ?? -1;
  // A TEAR is bands of the sheet landing out of register with each other.
  const bands = 7;
  const bandH = Math.ceil(ph / bands);

  // WHICH PROCESS THIS PASSAGE IS PRINTED BY. Measured across seven worlds,
  // every frame this engine had ever produced was 96–99.9% pure black or pure
  // white, because one press ran on all of them. The process is now the
  // world's, and they disagree about how many values exist between black and
  // white — which is the difference the eye actually reads.
  const proc = PROCESSES[process] || PROCESSES.photocopy;

  const bite = field.bite;
  const wear = field.wear;
  // Edge softness IS ink bleed. A hard binary threshold aliases the type
  // into sawtooth; a soft one spreads the way ink spreads into stock.
  const soft = 0.07 + wear * 0.16;
  const inkB = ink.ink * 255;
  const grdB = ink.ground * 255;
  // The bare sheet is never a flat value — toner speckles and the stock's
  // own tone show through, and that is most of why it reads as paper.
  const speckle = 0.52 + (1 - wear) * 0.30;
  const dropout = 0.48 - (1 - wear) * 0.34;

  for (let y = 0; y < ph; y++) {
    const sy = y + ry;
    const yy = sy < 0 ? 0 : sy >= ph ? ph - 1 : sy;
    const rowS = yy * pw;
    const rowD = y * pw;
    // Each band slips by its own amount, decaying as the impression settles.
    const band = (y / bandH) | 0;
    const slip = slice
      ? Math.round((((band * 2654435761) % 97) / 97 - 0.5) * slice * pw * 0.16)
      : 0;
    for (let x = 0; x < pw; x++) {
      const sx = x + rx + slip;
      const xx = sx < 0 ? 0 : sx >= pw ? pw - 1 : sx;
      // Coverage from the registered ink plate, tone from the paper under it.
      const cov = src[(rowS + xx) << 2] / 255;
      const fv = F[rowD + x];

      // THE MATERIAL DECIDES WHAT SURVIVES. Each process answers this
      // differently: a photocopy gives two values, a screen gives dots, a
      // clean impression keeps the whole continuum.
      let v = proc(cov, fv, { bite, soft, speckle, dropout }, x, y);

      // The lamp. Full ink or full ground for a frame or two — a struck cut.
      if (flash) v = 1 - v;
      // The wipe's leading edge: everything past it is still the bare sheet.
      if (wipeAt >= 0 && x > wipeAt * pw) v = 0;

      const b = grdB + (inkB - grdB) * v;
      const i = (rowD + x) << 2;
      dst[i] = b;
      dst[i + 1] = b;
      dst[i + 2] = b;
      dst[i + 3] = 255;
    }
  }
  buf.outCtx.putImageData(out, 0, 0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `rgb(${grdB | 0},${grdB | 0},${grdB | 0})`;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(buf.outCanvas, 0, 0, w, h);
}

/** Buffers are allocated once per film and reused. Allocating a 480k-entry
 *  Float32Array and two ImageData every frame is a garbage-collection pause
 *  in the middle of every export. */
function ensureBuffers(film, pw, ph) {
  let b = film._buf;
  if (!b || b.pw !== pw || b.ph !== ph) {
    const inkCanvas = document.createElement("canvas");
    inkCanvas.width = pw;
    inkCanvas.height = ph;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = pw;
    outCanvas.height = ph;
    const outCtx = outCanvas.getContext("2d");
    b = {
      pw,
      ph,
      inkCanvas,
      inkCtx: inkCanvas.getContext("2d", { willReadFrequently: true }),
      outCanvas,
      outCtx,
      out: outCtx.createImageData(pw, ph),
      field: new Float32Array(pw * ph),
      fieldState: film._field,
    };
    film._buf = b;
  }
  return b;
}

export function prepareFilm(cut, stagesResult) {
  return {
    cut,
    stages: stagesResult.stages,
    grid: stagesResult.grid,
    _buf: null,
    // ONE field per film, built once. Its noise tiles cost a few
    // milliseconds to generate and would be a stall on every frame.
    _field: makeField(cut.seed),
  };
}


/** Grow a form to a moment, tolerating a stage built before forms existed. */
function growAtSafe(built, t) {
  return growAt(built, t);
}
