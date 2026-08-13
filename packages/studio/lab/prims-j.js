/* CANOPTICON — TWO INPUTS. The compositing family that takes a second one.
 *
 * Everything in this palette until now ran in a LINE: node[0] hands its
 * buffer to node[1], which hands its buffer to node[2]. That expresses one
 * relation — "then" — and it is why the compiler's own honesty measure
 * reported that roughly half of a real film's chain links were a source
 * painting over the stage before it. A noise field followed by a text
 * layout is not a text layout ON a noise field. It is a noise field that
 * got covered up.
 *
 * A film needs the other relation: AND. A gravity field AND the sentence.
 * A document AND the figure pulled out of it. That is a second input, and
 * a second input is a shape the executor did not have.
 *
 *   [ noise_field ] ──────────────┐        the GROUND, its own chain
 *                                  ▼
 *   [ glyph_to_points ] → [ layer_over ] → out
 *          the SUBJECT        A ⊕ B
 *
 * WHAT THE TYPE SYSTEM STILL DOES HERE. Two of these take pixels for their
 * second input, and pixels are what every primitive produces — so their B
 * branch is unconstrained, and that is stated rather than dressed up as a
 * check. The other two take a FIELD, structurally, and read its numbers
 * rather than its picture. Their branch MUST terminate in something that
 * actually emits a field, and the compiler refuses the chain if it does
 * not. `field_displace` over a branch that only draws a picture of a field
 * would silently do nothing, which is exactly the failure this family was
 * built to end.
 */

/* ── reading a field ──────────────────────────────────────────────────
 *
 * Both field payloads in the palette are sampled grids — scalar (a value
 * per cell) or vector (an angle per cell). One sampler for both, so a
 * compositor does not care which kind of field it was handed. */
function fieldSample(field, x, y, w, h) {
  if (!field) return { v: 0.5, ang: 0 };
  const gx = Math.min(field.cols - 1, Math.max(0, Math.floor((x / w) * field.cols)));
  const gy = Math.min(field.rows - 1, Math.max(0, Math.floor((y / h) * field.rows)));
  const i = gy * field.cols + gx;
  if (field.kind === "vector") {
    const a = field.ang[i] || 0;
    return { v: (Math.sin(a) + 1) / 2, ang: a };
  }
  const v = field.data ? field.data[i] : 0.5;
  return { v, ang: v * Math.PI * 2 };
}

/** THE FIELD'S ACTUAL RANGE, not its assumed one.
 *
 *  Written after looking at a frame rather than at the code. `field_erode`
 *  was thresholding against 0..1 on the assumption that a scalar field
 *  fills its range — and `noise_field` at default settings spans about
 *  0.35 to 0.71. Every cell therefore sat under the threshold by a similar
 *  small margin, so instead of eating the image in the shape of the field
 *  it applied a uniform 33% fade to all of it. It typechecked, it ran, the
 *  branch was genuinely delivered, and the result was a slightly dimmer
 *  picture that looked exactly like a working feature.
 *
 *  Measured once per field object and cached on it: a field is a frozen
 *  grid for the frame that produced it. */
function fieldRange(field) {
  if (field.__range) return field.__range;
  const src = field.kind === "vector" ? field.ang : field.data;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < src.length; i++) {
    const v = field.kind === "vector" ? (Math.sin(src[i]) + 1) / 2 : src[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!(hi > lo)) {
    lo = 0;
    hi = 1;
  }
  const range = { lo, hi, span: hi - lo };
  Object.defineProperty(field, "__range", { value: range, enumerable: false });
  return range;
}

/** The pixels of an input, whichever side it came from. A payload always
 *  carries its canvas; a missing one is a branch that failed to build, and
 *  drawing nothing is better than throwing inside a frame. */
function plate(payload) {
  return payload && payload.canvas ? payload.canvas : null;
}

/** Said on the frame when a compositor was given only one input. A
 *  two-input primitive with one input is not an error — it is a chain
 *  someone is still building — but it must not look like it worked. */
function halfLit(ctx, w, h, which) {
  ctx.fillStyle = "rgba(216,98,74,.9)";
  ctx.font = '500 10px "JetBrains Mono",monospace';
  ctx.fillText(`NO ${which} INPUT — SHOWING WHAT THERE IS`, 10, 16);
}

window.fieldSample = fieldSample;

/* ── B behind A ───────────────────────────────────────────────────────
 *
 * The plainest of the five and the one that earns the family. A ground
 * that used to be painted over now sits behind the subject and stays
 * visible, at an opacity the director controls.
 */
reg(
  "layer_over",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    opacity: { v: 0.6, lo: 0, hi: 1 },
    // 0 — the branch sits BEHIND the chain's own image, which is the
    // reading almost every scene wants: the subject in front of its
    // ground. 1 puts it in front, which is a deliberate act of veiling.
    front: { v: 0, lo: 0, hi: 1, int: 1 },
    // The ground rarely wants to be as loud as the subject. Sinking it a
    // little is what makes the composite read as depth rather than as two
    // images fighting.
    sink: { v: 0.35, lo: 0, hi: 1 },
  },
  (p) => ({
    two: "IMAGE",
    frame(ctx, w, h, t, a, b) {
      const A = plate(a);
      const B = plate(b);
      bg(ctx, w, h);
      if (!A || !B) {
        if (A) ctx.drawImage(A, 0, 0, w, h);
        if (B) ctx.drawImage(B, 0, 0, w, h);
        halfLit(ctx, w, h, A ? "SECOND" : "FIRST");
        return;
      }
      const under = p.front > 0.5 ? A : B;
      const over = p.front > 0.5 ? B : A;
      ctx.globalAlpha = 1 - p.sink * 0.6;
      ctx.drawImage(under, 0, 0, w, h);
      ctx.globalAlpha = p.front > 0.5 ? p.opacity : 1;
      ctx.drawImage(over, 0, 0, w, h);
      ctx.globalAlpha = 1;
      if (p.front <= 0.5) {
        // The subject wins, but the ground is still there — so the ground
        // is re-asserted at the operator's opacity in a mode that adds
        // light rather than covering it.
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = p.opacity * 0.5;
        ctx.drawImage(B, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    },
  }),
  "Two images at once, which the linear chain could not express. The ground stays visible behind the subject instead of being painted over — the difference between a chain and a stack.",
);

/* ── B blended into A ─────────────────────────────────────────────────
 *
 * `blend` already existed in this family and took ONE input, which meant
 * it blended an image with nothing. This is the same idea with the second
 * operand it always needed.
 */
const BLEND_MODES = ["screen", "multiply", "overlay", "difference", "lighter", "soft-light"];
reg(
  "layer_blend",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    mode: { v: 0, lo: 0, hi: 5, int: 1 },
    opacity: { v: 0.7, lo: 0, hi: 1 },
  },
  (p) => ({
    two: "IMAGE",
    frame(ctx, w, h, t, a, b) {
      const A = plate(a);
      const B = plate(b);
      bg(ctx, w, h);
      if (A) ctx.drawImage(A, 0, 0, w, h);
      if (!B) {
        halfLit(ctx, w, h, "SECOND");
        return;
      }
      ctx.globalCompositeOperation = BLEND_MODES[Math.round(p.mode)] || "screen";
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(B, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  }),
  "The second operand blend always needed. Mode is a meaning, not a setting: screen is light arriving, multiply is something being darkened by what is behind it, difference is two versions of a thing that disagree.",
);

/* ── B's brightness cuts A ────────────────────────────────────────────
 *
 * The subject appears only where the ground is bright. Redaction, in
 * other words — a shape from one source revealing a picture from another,
 * which is the motif this whole publication is built on.
 */
reg(
  "layer_mask",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    threshold: { v: 0.45, lo: 0, hi: 1 },
    softness: { v: 0.3, lo: 0, hi: 1 },
    invert: { v: 0, lo: 0, hi: 1, int: 1 },
  },
  (p) => {
    let mask = null;
    return {
      two: "IMAGE",
      frame(ctx, w, h, t, a, b) {
        const A = plate(a);
        const B = plate(b);
        bg(ctx, w, h);
        if (!A || !B) {
          if (A) ctx.drawImage(A, 0, 0, w, h);
          halfLit(ctx, w, h, A ? "SECOND" : "FIRST");
          return;
        }

        // The mask is built at quarter resolution and scaled up. A
        // luminance read needs the pixels back off the GPU, which is the
        // expensive part; a quarter-res mask with a soft edge is
        // indistinguishable at playback size and four times cheaper.
        const mw = Math.max(2, Math.round(w / 4));
        const mh = Math.max(2, Math.round(h / 4));
        if (!mask || mask.width !== mw) {
          mask = document.createElement("canvas");
          mask.width = mw;
          mask.height = mh;
        }
        const mx = mask.getContext("2d", { willReadFrequently: true });
        mx.clearRect(0, 0, mw, mh);
        mx.drawImage(B, 0, 0, mw, mh);
        const img = mx.getImageData(0, 0, mw, mh);
        const d = img.data;
        const soft = 0.02 + p.softness * 0.4;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
          let k = (lum - p.threshold) / soft + 0.5;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          if (p.invert > 0.5) k = 1 - k;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = Math.round(k * 255);
        }
        mx.putImageData(img, 0, 0);

        ctx.drawImage(A, 0, 0, w, h);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      },
    };
  },
  "The subject appears only where the second image is bright. One source supplies the shape and another the picture — redaction as a compositing operation rather than a drawn rectangle.",
);

/* ── the field WARPS the image ────────────────────────────────────────
 *
 * The one the palette most obviously wanted and could not say: a gravity
 * field and a sentence, where the field genuinely moves the letters.
 *
 * This reads the field's NUMBERS, not its picture — which is why its
 * second input is typed FIELD and the compiler refuses a branch that only
 * paints one.
 */
reg(
  "field_displace",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    amount: { v: 0.4, lo: 0, hi: 1 },
    tile: { v: 0.4, lo: 0.05, hi: 1 },
    // How much the displacement grows across the shot. At 0 the image is
    // warped and holds; at 1 it comes apart as the scene runs.
    progress: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    two: "FIELD",
    frame(ctx, w, h, t, a, b, dur) {
      const A = plate(a);
      const field = b && b.field ? b.field : null;
      bg(ctx, w, h);
      if (!A) {
        halfLit(ctx, w, h, "FIRST");
        return;
      }
      if (!field) {
        ctx.drawImage(A, 0, 0, w, h);
        halfLit(ctx, w, h, "FIELD");
        return;
      }

      const step = Math.max(4, Math.round((6 + p.tile * 42) * (w / 1280)));
      const span = Math.max(0.25, dur || 3);
      const ramp = 1 - p.progress + p.progress * Math.min(1, t / span);
      const push = p.amount * step * 3 * ramp;

      // Strength normalised to the field's own range, for the same reason
      // erosion is: a field that only ever varies between 0.35 and 0.71
      // would otherwise displace everything by nearly the same amount, and
      // a uniform shift is not a displacement, it is a nudge.
      const { lo, span: range } = fieldRange(field);
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const s = fieldSample(field, x + step / 2, y + step / 2, w, h);
          const n = (s.v - lo) / range;
          const dx = Math.cos(s.ang) * push * (n * 0.7 + 0.3);
          const dy = Math.sin(s.ang) * push * (n * 0.7 + 0.3);
          // A tile is taken from where the field points FROM and put where
          // it points TO, which is what makes the picture travel along the
          // field rather than shimmer in place.
          ctx.drawImage(
            A,
            x,
            y,
            step,
            step,
            Math.round(x + dx),
            Math.round(y + dy),
            step + 1,
            step + 1,
          );
        }
      }
    },
  }),
  "A field and an image at once: the field's own vectors move the picture. This is the primitive the palette was missing — a gravity field combined with a sentence, where the field actually moves the letters rather than being painted over by them.",
);

/* ── the field EATS the image ─────────────────────────────────────────
 *
 * Dissolution driven by a real field rather than by a random mask. Where
 * the field is weak the image goes first, so the picture comes apart in
 * the shape of the thing acting on it.
 */
reg(
  "field_erode",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    depth: { v: 0.7, lo: 0, hi: 1 },
    grain: { v: 0.4, lo: 0.05, hi: 1 },
    // 0 — erosion holds steady across the shot. 1 — it runs from nothing
    // to complete, which is the only honest way to spell "dissolves".
    sweep: { v: 1, lo: 0, hi: 1 },
  },
  (p) => {
    // Erosion happens on a scratch layer, not on the output.
    //
    // The first version punched holes straight through the frame, so the
    // eroded areas came out TRANSPARENT — and a transparent hole in the
    // last stage of a chain is not "gone", it is "whatever was on the film
    // canvas a frame ago". The export smeared. A compositor erodes one
    // input to REVEAL the other; that is what makes it a compositor rather
    // than a hole punch.
    let scratch = null;
    return {
      two: "FIELD",
      frame(ctx, w, h, t, a, b, dur) {
        const A = plate(a);
        const B = plate(b);
        const field = b?.field ? b.field : null;
        bg(ctx, w, h);
        if (!A) {
          halfLit(ctx, w, h, "FIRST");
          return;
        }
        if (!field) {
          ctx.drawImage(A, 0, 0, w, h);
          halfLit(ctx, w, h, "FIELD");
          return;
        }

        if (!scratch || scratch.width !== w || scratch.height !== h) {
          scratch = document.createElement("canvas");
          scratch.width = w;
          scratch.height = h;
        }
        const sx = scratch.getContext("2d");
        sx.clearRect(0, 0, w, h);
        sx.drawImage(A, 0, 0, w, h);

        const span = Math.max(0.25, dur || 3);
      // The threshold sweeps across the field's OWN range, so erosion runs
      // from nothing to complete whatever range this particular field
      // happens to occupy. Thresholding against an assumed 0..1 is what
      // turned this into a uniform fade.
      const { lo, span: range } = fieldRange(field);
      const cut = lo + range * p.depth * (1 - p.sweep + p.sweep * Math.min(1, t / span));
      // The edge is a gradient over a slice of the range rather than a
      // staircase — wide enough to read as erosion, narrow enough that
      // most of the erased area is actually gone.
        const edge = Math.max(1e-3, range * 0.18);
        const step = Math.max(4, Math.round((6 + p.grain * 30) * (w / 1280)));
        sx.globalCompositeOperation = "destination-out";
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const s = fieldSample(field, x + step / 2, y + step / 2, w, h);
            if (s.v >= cut) continue;
            const k = Math.min(1, (cut - s.v) / edge);
            sx.fillStyle = `rgba(0,0,0,${k.toFixed(3)})`;
            sx.fillRect(x, y, step, step);
          }
        }
        sx.globalCompositeOperation = "source-over";

        // What the erosion reveals: the field's own picture, held under.
        // The subject does not vanish into nothing, it gives way to the
        // thing that was acting on it — which is the whole reading of the
        // operation and the reason it belongs in a compositing family
        // rather than in a mask.
        if (B) {
          ctx.globalAlpha = 0.55;
          ctx.drawImage(B, 0, 0, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(scratch, 0, 0, w, h);
      },
    };
  },
  "Dissolution in the shape of the thing causing it. The subject is eaten where the field is weakest and the field itself shows through, so a sentence comes apart along the thing acting on it rather than under a random mask.",
);
