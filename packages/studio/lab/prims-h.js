/* CANOPTICON — the kinetic chain, executing.
 *
 *   glyph_geometry → geometry_morph → geometry_draw
 *   —  → GEOMETRY  →    GEOMETRY    →   ANIMATION
 *
 * These pass POINTS between them, not pictures of points. A morph between
 * two rasterised point clouds has nothing to interpolate — you would be
 * cross-fading two images and calling it a transformation. Passing the
 * geometry is what makes the type in the signature mean something at
 * runtime.
 *
 * The register is Fiore's Medium is the Massage: stark figure-ground,
 * violent shifts of typographic scale, halftone, text set sideways and
 * upside down, a page that is a shock rather than a composition. It suits
 * fast cutting for the same reason his spreads work — each frame is one
 * assertion, held briefly, and the pacing does the arguing.
 */

/* ── text as point geometry ─────────────────────────────────────────── */
reg(
  "glyph_geometry",
  "A · TYPOGRAPHIC",
  "— → GEOMETRY",
  {
    text: { s: "MEANING" },
    sampling: { v: 4, lo: 2, hi: 10, int: 1 },
    scale: { v: 0.72, lo: 0.2, hi: 1 },
    rotate: { v: 0, lo: 0, hi: 3, int: 1 },
  },
  (p) => {
    let pts = [];
    let key = "";
    return {
      frame(ctx, w, h, t) {
        const k = [p.text, p.sampling, p.scale, p.rotate, w, h].join();
        if (k !== key) {
          key = k;
          pts = layoutGlyphs(p.text, w, h, Math.round(p.sampling), p.scale, Math.round(p.rotate));
        }
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#eef1f3";
        for (const q of pts) ctx.fillRect(q.x, q.y, 2, 2);
        lab(ctx, `${pts.length} PTS · GEOMETRY OUT`, 10, h - 14);
        // The point of the payload: hand the POINTS downstream, not the
        // picture of them.
        return { geometry: pts };
      },
    };
  },
  "Text as a point set. Emits the geometry itself, not a picture of it — a downstream morph needs points it can interpolate, and a rasterised cloud has none.",
);

/** Rasterise text once, sample it, and keep each point's identity. Rotation
 *  is applied to the layout rather than the canvas so the sampled points
 *  come back in a stable order — a morph between two clouds depends on
 *  index correspondence, and rotating the context would scramble it. */
function layoutGlyphs(text, w, h, step, scale, rotate) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  // Fill the frame edge to edge. Fiore's scale is the argument: a word that
  // occupies the whole page is not the same statement as one set politely.
  let size = Math.floor((w * 1.6) / Math.max(1, text.length));
  size = Math.min(size, h * scale);
  x.font = `700 ${size}px "Space Grotesk", sans-serif`;
  x.save();
  x.translate(w / 2, h / 2);
  if (rotate) x.rotate((rotate * Math.PI) / 2);
  x.fillText(text, 0, 0);
  x.restore();

  const d = x.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let px = 0; px < w; px += step) {
      if (d[(y * w + px) * 4] > 128) pts.push({ x: px, y, x0: px, y0: y });
    }
  }
  return pts;
}

/* ── morph: geometry in, geometry out ───────────────────────────────── */
reg(
  "geometry_morph",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    amount: { v: 0.5, lo: 0, hi: 1 },
    mode: { v: 0, lo: 0, hi: 2, int: 1 },
    turbulence: { v: 0.45, lo: 0, hi: 1 },
    period: { v: 0.5, lo: 0.05, hi: 1 },
  },
  (p) => {
    const noise = vnoise(4242);
    return {
      frame(ctx, w, h, t, upstream) {
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const src = upstream && upstream.geometry;
        if (!src || src.length === 0) {
          lab(ctx, "geometry_morph: no upstream GEOMETRY", 10, h / 2);
          return { geometry: [] };
        }

        // Cycles so a fast cut lands on a different phase each shot.
        const phase = (Math.sin(t * p.period * 2.2) * 0.5 + 0.5) * p.amount;
        const mode = Math.round(p.mode);
        const out = src.map((q, i) => {
          let nx = q.x0;
          let ny = q.y0;
          if (mode === 0) {
            // SHEAR — the whole word leans, which reads as pressure.
            nx += (q.y0 - h / 2) * phase * 0.9;
          } else if (mode === 1) {
            // SCATTER along a noise field: the word coming apart.
            const a =
              fbm(noise, (q.x0 / w) * 3, (q.y0 / h) * 3 + t * 0.15, 3, p.turbulence) * Math.PI * 2;
            nx += Math.cos(a) * phase * 120;
            ny += Math.sin(a) * phase * 120;
          } else {
            // COLLAPSE toward the centre line — compression, the essay's
            // own metaphor for fitting through the aperture.
            ny += (h / 2 - q.y0) * phase;
            nx += Math.sin(i * 0.05 + t) * phase * 14;
          }
          return { x: nx, y: ny, x0: q.x0, y0: q.y0 };
        });

        ctx.fillStyle = "#eef1f3";
        for (const q of out) ctx.fillRect(q.x, q.y, 2, 2);
        lab(ctx, `MORPH ${["SHEAR", "SCATTER", "COLLAPSE"][mode]} ${phase.toFixed(2)}`, 10, h - 14);
        return { geometry: out };
      },
    };
  },
  "Consumes point geometry and returns point geometry. Each point keeps its origin, so a morph interpolates rather than cross-fading — which is the difference between a transformation and a dissolve.",
);

/* ── draw: the Fiore plate ──────────────────────────────────────────── */
reg(
  "geometry_draw",
  "B · VECTOR",
  "GEOMETRY → ANIMATION",
  {
    weight: { v: 0.55, lo: 0.1, hi: 1 },
    halftone: { v: 0.6, lo: 0, hi: 1 },
    invert: { v: 0, lo: 0, hi: 1, int: 1 },
    trail: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      const inverted = p.invert > 0.5;
      const ink = inverted ? "#0d0f11" : "#eef1f3";
      const paper = inverted ? "#eef1f3" : "#0d0f11";

      // Trail as a held wash rather than a clear: on a fast cut it leaves
      // just enough of the previous phase to read as motion.
      ctx.fillStyle = paper;
      ctx.globalAlpha = 1 - p.trail * 0.75;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const pts = upstream && upstream.geometry;
      if (!pts || pts.length === 0) {
        lab(ctx, "geometry_draw: no upstream GEOMETRY", 10, h / 2, inverted ? "#0d0f11" : undefined);
        return;
      }

      // Halftone: dot size keyed to distance travelled, so a point that has
      // moved further prints heavier. The mark carries the deformation
      // rather than merely showing its result.
      const base = 1 + p.weight * 3.4;
      for (const q of pts) {
        const moved = Math.hypot(q.x - q.x0, q.y - q.y0);
        const r = base * (1 + Math.min(1.6, moved / 90) * p.halftone);
        ctx.fillStyle = ink;
        if (p.halftone > 0.05) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
        }
      }
      lab(ctx, `${pts.length} PTS · ${inverted ? "REVERSED" : "PLATE"}`, 10, h - 14, inverted ? "#3a4045" : undefined);
    },
  }),
  "Prints point geometry as a halftone plate. Dot weight keyed to how far each point has travelled, so the mark carries the deformation rather than only showing its result. Invert for the reversed spreads that alternate through Fiore's pages.",
);
