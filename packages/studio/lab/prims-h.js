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
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = INK;
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
        ctx.fillStyle = BG;
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
            //
            // Displacing EVERY point turns the word into confetti at any
            // meaningful amount — there is nothing left to come apart FROM,
            // so it reads as noise rather than as disintegration. Instead a
            // PROPORTION of points leaves, rising with the amount, while
            // the rest hold the silhouette. Which points leave is fixed per
            // index, so a point that has gone does not flicker back.
            const departed = (i * 2654435761) % 1000 < phase * 1000 * 1.15;
            if (departed) {
              const a =
                fbm(noise, (q.x0 / w) * 3, (q.y0 / h) * 3 + t * 0.15, 3, p.turbulence) *
                Math.PI *
                2;
              nx += Math.cos(a) * phase * 150;
              ny += Math.sin(a) * phase * 150;
            } else {
              // The remainder trembles rather than sitting perfectly still —
              // a held point next to a departing one reads as printed
              // otherwise, and the plate stops being one image.
              nx += Math.sin(t * 1.7 + i) * phase * 3;
              ny += Math.cos(t * 1.4 + i) * phase * 3;
            }
          } else {
            // COLLAPSE toward the centre line — compression, the essay's
            // own metaphor for fitting through the aperture.
            //
            // Capped at 0.78 rather than running to 1. A full collapse puts
            // every point on one row: the word is not compressed, it is
            // gone, and the plate says nothing. Squashed to a fifth of its
            // height still reads AS the word, which is the difference
            // between compression and deletion — and compression is the
            // thing the line is actually about.
            ny += (h / 2 - q.y0) * Math.min(0.78, phase);
            nx += Math.sin(i * 0.05 + t) * phase * 14;
          }
          return { x: nx, y: ny, x0: q.x0, y0: q.y0 };
        });

        ctx.fillStyle = INK;
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
      const ink = inverted ? BG : INK;
      const paper = inverted ? INK : BG;

      // Trail as a held wash rather than a clear: on a fast cut it leaves
      // just enough of the previous phase to read as motion.
      ctx.fillStyle = paper;
      ctx.globalAlpha = 1 - p.trail * 0.75;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      /* PATHS ARE STROKED, POINTS ARE PRINTED.
       *
       * A path is resolution-independent: at 4K it is a clean line, and
       * at 640×360 it is the same line. A point set is a raster sample of
       * something that was already drawn, so it coarsens as the frame
       * grows. Both are legitimate — the dot plate is a real treatment —
       * but the vector is now the default when the upstream has one. */
      const paths = upstream && upstream.paths;
      if (paths && paths.length) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(0.6, (0.4 + p.weight * 2.6) * (Math.min(w, h) / 400));
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (const path of paths) {
          if (path.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(path[0][0], path[0][1]);
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
          ctx.stroke();
        }
        lab(ctx, `${paths.length} PATHS · VECTOR`, 10, h - 14, inverted ? MUT : undefined);
        return { paths, geometry: upstream.geometry || [] };
      }

      const pts = upstream && upstream.geometry;
      if (!pts || pts.length === 0) {
        lab(
          ctx,
          "geometry_draw: no upstream GEOMETRY",
          10,
          h / 2,
          inverted ? BG : undefined,
        );
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
      lab(
        ctx,
        `${pts.length} PTS · ${inverted ? "REVERSED" : "PLATE"}`,
        10,
        h - 14,
        inverted ? MUT : undefined,
      );
    },
  }),
  "Prints point geometry as a halftone plate. Dot weight keyed to how far each point has travelled, so the mark carries the deformation rather than only showing its result. Invert for the reversed spreads that alternate through Fiore's pages.",
);

/* ── COMPOSITION, as two general operations ───────────────────────────
 *
 * The gallery's biggest weakness was not a broken primitive. It was that
 * every frame contained ONE FORM, CENTRED, AT ONE SCALE, on empty ground.
 * Every geometry source draws itself where it wants to be, so the grammar
 * could decide WHAT to build and had no way to decide how big it is,
 * where it sits, or how much of the frame it commands.
 *
 * These two are general on purpose — they take a point set and return a
 * point set, so they serve every representation rather than any subject.
 * Neither knows what it is transforming.
 */

reg(
  "place",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    scale: { v: 1, lo: 0.05, hi: 4 },
    x: { v: 0.5, lo: -0.4, hi: 1.4 },
    y: { v: 0.5, lo: -0.4, hi: 1.4 },
    crop: { v: 0, lo: 0, hi: 1, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, _t, upstream) {
      bg(ctx, w, h);
      const pts = (upstream && upstream.geometry) || [];
      const anyPaths = (upstream && upstream.paths) || null;
      if (!pts.length && !anyPaths) return { geometry: [] };
      // The form's own bounds, so `scale` means "this fraction of the
      // frame" rather than "this multiple of whatever it happened to be".
      let mnx = 1e9;
      let mny = 1e9;
      let mxx = -1e9;
      let mxy = -1e9;
      const bound = (X, Y) => {
        if (X < mnx) mnx = X;
        if (X > mxx) mxx = X;
        if (Y < mny) mny = Y;
        if (Y > mxy) mxy = Y;
      };
      for (const q of pts) bound(q.x, q.y);
      if (anyPaths) for (const path of anyPaths) for (const [X, Y] of path) bound(X, Y);
      const fw = Math.max(1, mxx - mnx);
      const fh = Math.max(1, mxy - mny);
      const k = (p.scale * Math.min(w, h)) / Math.max(fw, fh);
      const cx = (mnx + mxx) / 2;
      const cy = (mny + mxy) / 2;
      const tx = p.x * w;
      const ty = p.y * h;
      const mapx = (X) => tx + (X - cx) * k;
      const mapy = (Y) => ty + (Y - cy) * k;
      const inPaths = (upstream && upstream.paths) || null;
      const outPaths = inPaths
        ? inPaths
            .map((path) => path.map(([X, Y]) => [mapx(X), mapy(Y)]))
            .filter((path) => path.length > 1)
        : null;
      const out = [];
      for (const q of pts) {
        const x = tx + (q.x - cx) * k;
        const y = ty + (q.y - cy) * k;
        // CROP IS A COMPOSITIONAL ACT. A form running off the edge is a
        // decision — it says the thing is bigger than the frame — so the
        // points outside are DROPPED rather than clamped into a smear.
        if (p.crop > 0.5 && (x < -4 || y < -4 || x > w + 4 || y > h + 4)) continue;
        out.push({ x, y, x0: tx + (q.x0 - cx) * k, y0: ty + (q.y0 - cy) * k, v: q.v });
      }
      return outPaths ? { paths: outPaths, geometry: out } : { geometry: out };
    },
  }),
  "Scales, positions and optionally crops a point set against the frame. The one operation that lets a composition decide how much of the frame a form commands and where the eye lands, without any primitive knowing what it is drawing.",
);

reg(
  "contour",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    thin: { v: 0.6, lo: 0, hi: 1 },
    construction: { v: 0.35, lo: 0, hi: 1 },
    seed: { v: 7, lo: 1, hi: 9999, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, _t, upstream) {
      bg(ctx, w, h);
      const pts = (upstream && upstream.geometry) || [];
      if (!pts.length) return { geometry: [] };
      // THE EDGE OF THE FORM, NOT THE FORM. This is the difference
      // between LITERAL and GEOMETRIC: a filled silhouette says "the
      // thing"; its outline plus construction lines says "the thing's
      // shape". They were collapsing into the same filled blob because
      // nothing could take one to the other.
      const cell = Math.max(4, Math.round(10 - p.thin * 6));
      const grid = new Set();
      for (const q of pts) grid.add(`${Math.round(q.x / cell)},${Math.round(q.y / cell)}`);
      const out = [];
      for (const q of pts) {
        const gx = Math.round(q.x / cell);
        const gy = Math.round(q.y / cell);
        // A point is on the edge when a neighbouring cell is empty.
        const edge =
          !grid.has(`${gx - 1},${gy}`) ||
          !grid.has(`${gx + 1},${gy}`) ||
          !grid.has(`${gx},${gy - 1}`) ||
          !grid.has(`${gx},${gy + 1}`);
        if (edge) out.push(q);
      }
      // CONSTRUCTION LINES — the marks a drawing is built on. Deterministic
      // from the bounds, so the same form always gets the same scaffold.
      if (p.construction > 0.02 && out.length) {
        let mnx = 1e9;
        let mny = 1e9;
        let mxx = -1e9;
        let mxy = -1e9;
        for (const q of out) {
          if (q.x < mnx) mnx = q.x;
          if (q.x > mxx) mxx = q.x;
          if (q.y < mny) mny = q.y;
          if (q.y > mxy) mxy = q.y;
        }
        const lines = 2 + Math.round(p.construction * 5);
        const step = Math.max(3, Math.round(9 - p.construction * 5));
        for (let i = 0; i < lines; i++) {
          const f = (i + 1) / (lines + 1);
          const yy = mny + (mxy - mny) * f;
          const xx = mnx + (mxx - mnx) * f;
          for (let x = mnx; x <= mxx; x += step) out.push({ x, y: yy, x0: x, y0: yy, v: 0.35 });
          for (let y = mny; y <= mxy; y += step) out.push({ x: xx, y, x0: xx, y0: y, v: 0.35 });
        }
      }
      return { geometry: out };
    },
  }),
  "Reduces a filled form to its own edge, and optionally lays construction lines across its bounds. The operation that separates depicting a thing from describing its shape — and the reason LITERAL and GEOMETRIC stop being the same picture.",
);

/* ── THE MISSING SOURCE ───────────────────────────────────────────────
 *
 * `SOLID` reached for `shape_morph`, which is GEOMETRY → GEOMETRY. With
 * no upstream it drew its own default and the literal column stayed a
 * sampled disc — the same "contractually correct, visually empty" shape
 * of failure as before.
 *
 * The palette had NO POLYGON SOURCE. Every bounded body in the system
 * came from `wireframe` (a box or a sphere), a boolean of two circles,
 * or a raster sample of something else. That is a genuinely missing
 * general capability rather than a missing noun, so it gets built: a
 * body with a counted number of faces, a corner radius, and a taper —
 * which is a triangle, a hexagon, a slab, a lozenge, a near-circle, or
 * the thing between any two of them.
 */
reg(
  "polygon",
  "B · VECTOR",
  "— → GEOMETRY",
  {
    sides: { v: 6, lo: 3, hi: 24, int: 1 },
    radius: { v: 0.34, lo: 0.05, hi: 0.9 },
    corner: { v: 0, lo: 0, hi: 1 },
    taper: { v: 0, lo: -0.8, hi: 0.8 },
    turn: { v: 0, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = p.radius * Math.min(w, h);
      const N = Math.max(3, Math.round(p.sides));
      const spin = p.turn * t * 0.6;
      const verts = [];
      for (let i = 0; i < N; i++) {
        const a = spin + (i / N) * Math.PI * 2 - Math.PI / 2;
        // Taper narrows the upper half and widens the lower, or the
        // reverse — the difference between a wedge, a slab and a plinth.
        const lean = 1 + p.taper * -Math.sin(a);
        verts.push([cx + Math.cos(a) * R * lean, cy + Math.sin(a) * R * lean]);
      }
      // A corner radius, as real geometry rather than a stroke setting:
      // each vertex becomes a short arc between its two edges.
      const path = [];
      if (p.corner < 0.02) {
        path.push(...verts, verts[0]);
      } else {
        const r = Math.min(0.5, p.corner * 0.5);
        for (let i = 0; i < N; i++) {
          const a = verts[(i + N - 1) % N];
          const b = verts[i];
          const c = verts[(i + 1) % N];
          const p1 = [b[0] + (a[0] - b[0]) * r, b[1] + (a[1] - b[1]) * r];
          const p2 = [b[0] + (c[0] - b[0]) * r, b[1] + (c[1] - b[1]) * r];
          path.push(p1);
          for (let k = 1; k < 5; k++) {
            const f = k / 5;
            const q = (1 - f) * (1 - f);
            const m = 2 * (1 - f) * f;
            const n2 = f * f;
            path.push([q * p1[0] + m * b[0] + n2 * p2[0], q * p1[1] + m * b[1] + n2 * p2[1]]);
          }
          path.push(p2);
        }
        path.push(path[0]);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      lab(ctx, `${N}-GON`, 10, h - 16);
      return vector([path], 7);
    },
  }),
  "A bounded body with a counted number of faces, a corner radius and a taper. The palette's missing polygon source: a triangle, a slab, a lozenge, a near-circle, or anything between. General enough to serve the literal, geometric and structural readings without being about any subject.",
);
