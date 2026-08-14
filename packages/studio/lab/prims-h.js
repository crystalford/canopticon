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
    /* WHAT THE MARK IS MADE OF.
     *
     * Every element in every representation was drawn the same way — a
     * thin stroke or a small dot — so two representations could differ in
     * ARRANGEMENT and never in SUBSTANCE. That is most of why five
     * columns of the gallery still read as one family.
     *
     * Material is NOT a colour and NOT a texture pasted on top. It
     * changes how the mark behaves: whether it is a line or a body,
     * whether its edge is hard or diffuse, whether it accumulates,
     * whether it is transparent, whether it is broken into a grid.
     *
     *   0 INK      a drawn stroke, weight varying with travel
     *   1 PAPER    printed marks with grain and a physical edge
     *   2 GLASS    transparent bodies that overlap and add
     *   3 LIGHT    diffuse glow, no edge
     *   4 SCREEN   quantised to a pixel grid
     *   5 METAL    hard filled geometry with a bright edge
     *   6 DUST     fine particles, diffusing
     *   7 DATA     discrete nodes with a mark at each
     */
    material: { v: 0, lo: 0, hi: 7, int: 1 },
    /* HOW FAR BACK IT SITS — atmospheric hierarchy.
     *
     * Every element in every frame was drawn at full strength with a hard
     * edge, so a scene of five elements had five things all shouting the
     * same volume and the eye had nowhere to land. Scale and position
     * alone do not make a focal point; CONTRAST does, and contrast is a
     * relation between elements rather than a property of one.
     *
     * Recede is deliberately not "opacity". It does what distance does:
     * softens the edge and washes the element toward the GROUND, so a
     * subordinate element reads as further away rather than as the same
     * element turned down. Applied as a final pass over whatever the
     * material branch drew, so it works identically for a stroked path, a
     * filled body and a halftone plate — one control, one place. */
    recede: { v: 0, lo: 0, hi: 1 },
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

      /* The plate itself is never blurred — only what is drawn onto it.
       * `recede` is applied around the marks and lifted before the label
       * so the audit text stays legible at any depth. */
      /* RECEDING IS BLUR AND WEIGHT, NOT A WASH OVER THE WHOLE FRAME.
       *
       * `settle()` used to flood the ENTIRE canvas with ground colour at
       * `recede * 0.78`. The compiler assigns `recede = (1 - emphasis) *
       * 0.62` in `applyEmphasis`, so any element that was not the focus
       * poured up to 48% of the ground over everything drawn before it —
       * not over itself, over the frame. Measured: the palette resolves
       * near-white ink `#e7e8e6` on `#252e24`, about 12:1, and the frames
       * came out around `#8a9088`. That is where "low-contrast grey on
       * near-black" came from, and it was a hierarchy control doing
       * exactly what it was told, one layer too broadly.
       *
       * A thing that is further away is softer and lighter-weight. It is
       * not a thing with fog poured over the room. So the blur stays, the
       * marks themselves are drawn at a reduced alpha, and nothing is
       * painted over the frame afterwards. */
      const far = p.recede;
      if (far > 0.01) ctx.filter = `blur(${(far * far * 5 * Math.min(w, h)) / 400}px)`;
      // How present this element's own marks are. Floored well above zero:
      // an element that cannot be seen is not a quiet element, it is a
      // missing one — the same floor `applyEmphasis` keeps on opacity.
      const presence = 1 - far * 0.45;
      const settle = () => {
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      };

      /* PATHS ARE STROKED, POINTS ARE PRINTED.
       *
       * A path is resolution-independent: at 4K it is a clean line, and
       * at 640×360 it is the same line. A point set is a raster sample of
       * something that was already drawn, so it coarsens as the frame
       * grows. Both are legitimate — the dot plate is a real treatment —
       * but the vector is now the default when the upstream has one. */
      const paths = upstream && upstream.paths;
      if (paths && paths.length) {
        const M = Math.round(p.material);
        const k = Math.min(w, h) / 400;
        const base = Math.max(0.6, (0.4 + p.weight * 2.6) * k);
        ctx.lineJoin = "round";
        ctx.lineCap = M === 1 ? "butt" : "round";
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        // GLASS and LIGHT add rather than cover, so overlapping bodies
        // brighten where they meet — which is what makes them read as
        // transparent rather than as flat shapes at low opacity.
        if (M === 2 || M === 3) ctx.globalCompositeOperation = KEY > 0.5 ? "multiply" : "screen";
        if (M === 3) {
          ctx.shadowColor = ink;
          ctx.shadowBlur = base * 6;
        }
        // Presence, not fog. A receded element draws its own marks
        // lighter; it does not paint over the ones already on the plate.
        ctx.globalAlpha = (M === 2 ? 0.45 : M === 3 ? 0.6 : 1) * presence;
        for (const path of paths) {
          if (path.length < 2) continue;
          ctx.beginPath();
          if (M === 4) {
            // SCREEN — the path resolved onto a pixel grid, so a curve
            // becomes a staircase and the frame reads as a display.
            const g = Math.max(3, 10 * k - p.weight * 4);
            let px = null;
            for (const [x, y] of path) {
              const qx = Math.round(x / g) * g;
              const qy = Math.round(y / g) * g;
              if (px && qx === px[0] && qy === px[1]) continue;
              if (px) ctx.lineTo(qx, qy);
              else ctx.moveTo(qx, qy);
              px = [qx, qy];
            }
          } else {
            ctx.moveTo(path[0][0], path[0][1]);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
          }
          if (M === 5 || M === 2) {
            // METAL and GLASS are BODIES, not outlines.
            ctx.closePath();
            ctx.globalAlpha = M === 2 ? 0.32 : 0.9;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.lineWidth = base * (M === 5 ? 1.6 : 0.8);
            ctx.strokeStyle = M === 5 ? INK : ink;
            ctx.stroke();
          } else if (M === 6 || M === 7) {
            // DUST and DATA are not lines at all — they are the points
            // the line passes through, loose or marked.
            ctx.beginPath();
            for (const [x, y] of path) {
              const r = M === 6 ? base * 0.45 : base * 1.1;
              const jx = M === 6 ? ((x * 7919) % 13) - 6 : 0;
              const jy = M === 6 ? ((y * 7907) % 13) - 6 : 0;
              ctx.moveTo(x + jx + r, y + jy);
              ctx.arc(x + jx, y + jy, r, 0, 6.3);
            }
            ctx.globalAlpha = M === 6 ? 0.5 : 1;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.lineWidth = M === 1 ? base * 1.9 : base;
            ctx.stroke();
            if (M === 1) {
              // PAPER — grain broken back into the stroke, deterministic
              // so the same mark prints the same way twice.
              ctx.globalAlpha = 0.35;
              ctx.strokeStyle = paper;
              ctx.lineWidth = base * 0.7;
              ctx.setLineDash([base * 2, base * 3]);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 1;
              ctx.strokeStyle = ink;
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
        settle();
        lab(ctx, `${paths.length} PATHS · VECTOR`, 10, h - 14, inverted ? MUT : undefined);
        return { paths, geometry: upstream.geometry || [] };
      }

      const pts = upstream && upstream.geometry;
      if (!pts || pts.length === 0) {
        ctx.filter = "none";
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
        ctx.globalAlpha = presence;
        if (p.halftone > 0.05) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
        }
      }
      settle();
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

/* ── APERTURE, AS A RELATION BETWEEN TWO SPACES ───────────────────────
 *
 * NOT a window, and deliberately not a better rectangle. An aperture is
 * the operation that creates:
 *
 *     inside / outside · visible / hidden
 *     foreground / background · revealed / concealed · through / behind
 *
 * A window is ONE CONSEQUENCE of it. So are a doorway, a screen, a hole,
 * a portal, a redaction, a thing partly concealed, and a thing in the
 * act of being revealed — none of which needs its own generator.
 *
 * HOW IT WORKS WITH THE STACK, which is the whole reason it can be a
 * relation at all. It paints a SURFACE across the frame and cuts an
 * opening in it filled with the film's ground colour. `knockout()` then
 * makes the ground transparent when this element is composited, so
 * whatever sits behind it in the scene graph shows through the opening
 * and is hidden everywhere else. Two elements, one relation, no masks
 * and no new compositing path.
 */
reg(
  "aperture",
  "B · VECTOR",
  "— → IMAGE",
  {
    sides: { v: 4, lo: 3, hi: 32, int: 1 },
    size: { v: 0.42, lo: 0.05, hi: 1.2 },
    x: { v: 0.5, lo: 0, hi: 1 },
    y: { v: 0.5, lo: 0, hi: 1 },
    // 0 = the surface is solid and the opening is clean. Higher values
    // erode the edge, so an opening can be a tear as well as a cut.
    erode: { v: 0, lo: 0, hi: 1 },
    // How present the surface is. At 0 the aperture is all opening —
    // nothing is concealed — which is the honest reading of a sentence
    // that reveals without withholding.
    surface: { v: 0.85, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      if (p.surface > 0.02) {
        // THE SURFACE — what conceals. Drawn in the film's mid tone so it
        // reads as material rather than as a black card.
        ctx.globalAlpha = p.surface;
        ctx.fillStyle = MUT;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      // THE OPENING — cut back to the ground, which the compositor's
      // knockout turns transparent. What is behind is now visible only
      // here, which IS the relation.
      const cx = p.x * w;
      const cy = p.y * h;
      const R = p.size * Math.min(w, h) * 0.5;
      const N = Math.max(3, Math.round(p.sides));
      const jag = p.erode * R * 0.28;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        // Deterministic erosion — a seeded wobble on the radius, not a
        // random one, so the same opening is the same opening.
        const k = jag ? Math.sin(i * 12.9898 + N) * jag : 0;
        const r = R + k;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = BG;
      ctx.fill();
      // The edge of the opening, so the aperture reads as an edge rather
      // than as an absence of paint.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      lab(ctx, `APERTURE ${N} · ${Math.round(p.surface * 100)}% SURFACE`, 10, h - 16);
    },
  }),
  "A surface with an opening cut through it. The general operation for inside/outside, visible/hidden, foreground/background and reveal/conceal — a window, a doorway, a screen, a hole and a redaction are consequences of it rather than definitions. What sits behind it in the scene graph shows through the opening and is concealed everywhere else.",
);

/* ── A SYSTEM, NOT A SCATTER ──────────────────────────────────────────
 *
 * `force_layout` threw points at the frame, so the diagrammatic column
 * read as noise in every gallery: a relationship was represented by dots
 * that were not related to each other in any visible way.
 *
 * A diagram is CLUSTERS AND EDGES. Nodes gather into groups, groups are
 * joined, and the drawing shows which things belong together and which
 * things are merely connected. That is general — it serves a network, an
 * organisation, a distribution, a supply chain, a family of documents and
 * a crowd, without knowing what any of them are.
 *
 * Emits real PATHS, so the edges are strokes at any resolution rather
 * than a raster sample of a line.
 */
reg(
  "graph_field",
  "G · NETWORK",
  "DATA → GEOMETRY",
  {
    clusters: { v: 3, lo: 1, hi: 9, int: 1 },
    per: { v: 6, lo: 2, hi: 30, int: 1 },
    spread: { v: 0.6, lo: 0.1, hi: 1 },
    // How much of the graph is drawn as edges rather than left as loose
    // nodes. At 0 it is a distribution; at 1 it is a network.
    linked: { v: 0.6, lo: 0, hi: 1 },
    seed: { v: 11, lo: 1, hi: 9999, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      const rnd = mulberry(Math.round(p.seed));
      const K = Math.max(1, Math.round(p.clusters));
      const N = Math.max(2, Math.round(p.per));
      // Cluster centres on a ring, so the groups are legibly separate
      // rather than piled on the middle.
      const centres = [];
      for (let k = 0; k < K; k++) {
        const a = (k / K) * Math.PI * 2 + rnd() * 0.4;
        const r = Math.min(w, h) * 0.3 * p.spread * (K === 1 ? 0 : 1);
        centres.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r]);
      }
      // Node values come off the upstream DATA when there is any, so a
      // chart of the essay's own terms sizes its nodes by their weight.
      const data = (upstream && upstream.data) || [];
      const nodes = [];
      for (let k = 0; k < K; k++) {
        const [cx, cy] = centres[k];
        const spanR = Math.min(w, h) * 0.14 * p.spread;
        for (let i = 0; i < N; i++) {
          const a = rnd() * Math.PI * 2;
          const rr = Math.sqrt(rnd()) * spanR;
          const d = data[(k * N + i) % (data.length || 1)];
          nodes.push({
            x: cx + Math.cos(a) * rr,
            y: cy + Math.sin(a) * rr,
            k,
            v: d && d.value ? Math.max(0.25, Math.min(1, d.value / 100)) : 0.5,
          });
        }
      }
      const paths = [];
      // WITHIN a cluster: every node to its own centre. That is what
      // makes a group read as a group.
      for (const nd of nodes) {
        if (rnd() > p.linked) continue;
        paths.push([[nd.x, nd.y], centres[nd.k]]);
      }
      // BETWEEN clusters: the ring, so the groups are a system rather
      // than three unrelated piles.
      if (K > 1 && p.linked > 0.2) {
        for (let k = 0; k < K; k++) paths.push([centres[k], centres[(k + 1) % K]]);
      }
      ctx.strokeStyle = MUT;
      ctx.lineWidth = 0.9;
      for (const path of paths) {
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        ctx.lineTo(path[1][0], path[1][1]);
        ctx.stroke();
      }
      // Nodes on top of their edges, sized by value.
      for (const nd of nodes) {
        ctx.fillStyle = nd.v > 0.75 ? EMB : INK;
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, 1.5 + nd.v * 3.5, 0, 6.3);
        ctx.fill();
      }
      // Cluster centres, marked, so the hierarchy is visible.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (const [cx, cy] of centres) {
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, 6.3);
        ctx.stroke();
      }
      lab(ctx, `${K} CLUSTERS · ${nodes.length} NODES · ${paths.length} EDGES`, 10, h - 16);
      // The edges as real geometry, plus the node positions.
      const geo = nodes.map((nd) => ({ x: nd.x, y: nd.y, x0: nd.x, y0: nd.y, v: nd.v }));
      return { paths, geometry: geo };
    },
  }),
  "Nodes gathered into clusters and joined by drawn edges. A diagram is groups and connections, not a scatter — this serves a network, an organisation, a distribution, a supply chain or a crowd without knowing what any of them are.",
);

/* ── DIVIDE, AS THE OPERATION THAT MAKES A BODY CONSTRUCTED ───────────
 *
 * The gallery's literal column was one convex polygon in every row —
 * cleaner after materiality and hierarchy, and still a blob. Materiality
 * says what a body is MADE of; hierarchy says which body the frame is
 * ABOUT. Neither can say that a body HAS PARTS, and having parts is most
 * of what separates a depicted thing from a shape.
 *
 * NOT a floor generator, a bar-chart generator or a grid generator. One
 * operation with the same standing as `aperture`: a body, divided, its
 * members separated by a gap. A building has floors, a chart has bars, a
 * chain has links, a facade has bays, a document has columns and a
 * rosette has petals — every one of them is this, and not one of them
 * needs to be named.
 *
 * The division count comes off the prose the same way a face count does.
 * "Nine numbered rooms" divides into nine.
 *
 * Exact for convex bodies, which is what `polygon` emits, via
 * Sutherland–Hodgman half-plane clipping. A concave body clips
 * approximately rather than throwing — degrade, flag, continue.
 */

/** Clip a closed path to the half-plane where `inside(pt) >= 0`. */
function _clipHalf(path, inside) {
  const out = [];
  const n = path.length;
  if (!n) return out;
  for (let i = 0; i < n; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    const da = inside(a);
    const db = inside(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Shrink a path toward its own centroid — the gap between members. */
function _inset(path, k) {
  if (!path.length || k <= 0) return path;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of path) {
    cx += x;
    cy += y;
  }
  cx /= path.length;
  cy /= path.length;
  const s = 1 - k;
  return path.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);
}

reg(
  "subdivide",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    /* 0 BANDS across · 1 BANDS down · 2 CELLS · 3 WEDGES */
    axis: { v: 0, lo: 0, hi: 3, int: 1 },
    parts: { v: 4, lo: 1, hi: 24, int: 1 },
    gap: { v: 0.12, lo: 0, hi: 0.6 },
    /* Members thin toward one end, so a division can be even (a grid) or
     * graded (a stack that lightens as it rises, a chart that falls). */
    grade: { v: 0, lo: -1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, _t, upstream) {
      bg(ctx, w, h);
      const src = (upstream && upstream.paths) || null;
      if (!src || !src.length) {
        // Honest about what it could not use, like the narration ladders.
        lab(ctx, "subdivide: no upstream PATHS", 10, h / 2);
        return upstream && upstream.geometry ? { geometry: upstream.geometry } : { geometry: [] };
      }
      const N = Math.max(1, Math.round(p.parts));
      const A = Math.round(p.axis);
      const out = [];

      for (const path0 of src) {
        const path = path0.length > 1 && path0[0] === path0[path0.length - 1]
          ? path0.slice(0, -1)
          : path0;
        if (path.length < 3) {
          out.push(path0);
          continue;
        }
        let mnx = 1e9;
        let mny = 1e9;
        let mxx = -1e9;
        let mxy = -1e9;
        let cx = 0;
        let cy = 0;
        for (const [x, y] of path) {
          if (x < mnx) mnx = x;
          if (x > mxx) mxx = x;
          if (y < mny) mny = y;
          if (y > mxy) mxy = y;
          cx += x;
          cy += y;
        }
        cx /= path.length;
        cy /= path.length;

        if (A === 3) {
          // WEDGES — the body cut about its own centre.
          for (let i = 0; i < N; i++) {
            const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
            const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2;
            // Each wedge is the body clipped by two half-planes through
            // the centroid. N === 1 has no wedge to cut.
            let m = path;
            if (N > 1) {
              m = _clipHalf(m, ([x, y]) => (x - cx) * Math.sin(a0) - (y - cy) * Math.cos(a0));
              m = _clipHalf(m, ([x, y]) => -((x - cx) * Math.sin(a1) - (y - cy) * Math.cos(a1)));
            }
            if (m.length >= 3) out.push([..._inset(m, p.gap * 0.5), _inset(m, p.gap * 0.5)[0]]);
          }
          continue;
        }

        // BANDS and CELLS. `grade` leans the division so the members are
        // not all the same size — the difference between a grid and a
        // stack that settles.
        const rows = A === 2 ? Math.max(1, Math.round(Math.sqrt(N))) : A === 0 ? N : 1;
        const cols = A === 2 ? Math.max(1, Math.ceil(N / Math.max(1, Math.round(Math.sqrt(N))))) : A === 1 ? N : 1;
        const at = (i, n) => {
          const f = i / n;
          // grade > 0 crowds the divisions toward the start, < 0 the end.
          return p.grade === 0 ? f : f ** (1 + p.grade * 0.85);
        };
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const y0 = mny + (mxy - mny) * at(r, rows);
            const y1 = mny + (mxy - mny) * at(r + 1, rows);
            const x0 = mnx + (mxx - mnx) * at(c, cols);
            const x1 = mnx + (mxx - mnx) * at(c + 1, cols);
            let m = path;
            if (rows > 1) {
              m = _clipHalf(m, ([, y]) => y - y0);
              m = _clipHalf(m, ([, y]) => y1 - y);
            }
            if (cols > 1) {
              m = _clipHalf(m, ([x]) => x - x0);
              m = _clipHalf(m, ([x]) => x1 - x);
            }
            if (m.length >= 3) {
              const k = _inset(m, p.gap * 0.5);
              out.push([...k, k[0]]);
            }
          }
        }
      }

      if (!out.length) {
        // The body could not be cut — hand it back rather than emitting
        // nothing, because a division that fails should cost the frame
        // its detail, never its subject.
        lab(ctx, `subdivide: ${src.length} PATHS UNCUT`, 10, h - 16);
        return { paths: src, geometry: (upstream && upstream.geometry) || [] };
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (const m of out) {
        ctx.beginPath();
        m.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      lab(ctx, `${out.length} MEMBERS · ${["BANDS", "COLUMNS", "CELLS", "WEDGES"][A]}`, 10, h - 16);
      return vector(out, 7);
    },
  }),
  "A body divided into members with a gap between them, across, down, into cells or about its own centre. The operation that makes a form read as CONSTRUCTED rather than as a shape — floors, bays, links, bars, columns, petals — without being about any of them. The division count comes off the prose.",
);
