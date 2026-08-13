/* CANOPTICON — procedural primitives. Deterministic: seeded PRNG, no Math.random. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function vnoise(seed) {
  const p = new Uint8Array(512),
    r = mulberry(seed);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const f = (t) => t * t * (3 - 2 * t),
    g = (h, x, y) => (h & 1 ? -x : x) + (h & 2 ? -y : y);
  return (x, y) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = f(x),
      v = f(y),
      A = p[X] + Y,
      B = p[X + 1] + Y;
    const n =
      (1 - v) * ((1 - u) * g(p[A], x, y) + u * g(p[B], x - 1, y)) +
      v * ((1 - u) * g(p[A + 1], x, y - 1) + u * g(p[B + 1], x - 1, y - 1));
    return n * 0.7;
  };
}
function fbm(n, x, y, oct, turb) {
  let a = 1,
    f = 1,
    s = 0,
    m = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    m += a;
    a *= 0.5 + turb * 0.16;
    f *= 2;
  }
  return s / m;
}

/* text → point cloud (glyph_to_points) */
function glyphPoints(text, w, h, step, font) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  let size = Math.floor(w / (text.length * 0.62));
  size = Math.min(size, h * 0.62);
  x.font = "700 " + size + "px " + (font || "'Space Grotesk',sans-serif");
  x.fillText(text, w / 2, h / 2);
  const d = x.getImageData(0, 0, w, h).data,
    pts = [];
  for (let y = 0; y < h; y += step)
    for (let px = 0; px < w; px += step) if (d[(y * w + px) * 4 + 3] > 128) pts.push([px, y]);
  return pts;
}

/* ── primitive registry ───────────────────────────────── */
const PRIMS = {};

/* ── THE FILM'S COLOUR, NOT THE PRIMITIVE'S ───────────────────────────
 *
 * These five were `const`, and between them they decided the tonal world
 * of every frame Canopticon has ever produced. Measured across all 129
 * primitives at 854×480: 105 of them rendered below luminance 40/255 and
 * 86 below contrast 20. That is the "grey murk" complaint, and it was
 * never 129 decisions — it was this block, unreachable from anywhere.
 *
 * They are now `let`, written once per scene by `setPalette()` from the
 * four directorial numbers the film carries (see palette.js). Every
 * `bg()` call and every `INK` / `EMB` / `MUT` / `COOL` reference in the
 * ten primitive modules picks the change up on the next frame, because
 * they resolve the identifier at draw time rather than capturing it.
 *
 * A primitive still decides WHAT it draws. It no longer decides what
 * colour the film is.
 */
let INK = "#eef1f3";
let EMB = "#d8624a";
let MUT = "#9ba3aa";
let COOL = "#6f9ec4";
let BG = "#0d0f11";
/** Barely off the ground — grids, hairlines, the marks that give a frame
 *  depth without asking to be read. Previously every primitive that
 *  wanted one hardcoded its own near-black. */
let DIM = "#191d21";
let BG_RGB = [13, 15, 17];
/** How light the world is (0 dark → 1 paper). A primitive that needs to
 *  know whether it is drawing light onto dark or marks onto paper asks
 *  this instead of trying to infer it from the ground colour. */
let KEY = 0.12;

function setPalette(p) {
  if (!p) return;
  INK = p.ink;
  EMB = p.accent;
  MUT = p.muted;
  COOL = p.cool;
  BG = p.bg;
  DIM = p.dim;
  BG_RGB = p.bgRgb;
  KEY = p.key;
}

function bg(ctx, w, h, a) {
  ctx.fillStyle = a ? `rgba(${BG_RGB[0]},${BG_RGB[1]},${BG_RGB[2]},${a})` : BG;
  ctx.fillRect(0, 0, w, h);
}
function lab(ctx, t, x, y, c) {
  ctx.font = "8px JetBrains Mono";
  ctx.textBaseline = "top";
  ctx.fillStyle = c || "#69717a";
  ctx.fillText(t, x, y);
}
/* ── THE PAYLOAD CONTRACT ─────────────────────────────────────────────
 *
 * A primitive's declared OUTPUT TYPE must equal the payload it actually
 * emits. Until now it did not, and the gap was the largest single fact
 * about this palette:
 *
 *   129 primitives · 42 declared GEOMETRY / FIELD / ARTIFACT / ENTITY
 *   and returned nothing but pixels.
 *
 * Which meant a chain could type-check completely and the downstream node
 * receive NOTHING. It then fell back to its own synthetic default, and the
 * film rendered something plausible that no part of the compiler chose —
 * `tile` returning the stock "90 DAYS", `geometry_draw: no upstream
 * GEOMETRY` on a chain the type checker had already approved, and the
 * raster bridges that were only ever necessary because a canvas is the
 * one thing that really travelled between two nodes.
 *
 * `noise_field` was fixed by hand for exactly this reason and its comment
 * says why. This does the same thing for the rest, in one place, at
 * registration — because thirty-four separate edits to thirty-four
 * drawing loops is how a mechanical problem becomes a rewrite.
 *
 * THE FORM A PRIMITIVE DREW *IS* ITS GEOMETRY. Sampling the canvas the
 * primitive just painted is not manufacturing a fake payload to satisfy a
 * type — it is reading back the thing it actually made, which is exactly
 * what `image_to_points` and `glyph_to_points` already do on purpose. A
 * primitive that computes a better point set of its own simply returns it
 * and this never fires.
 */

/** Sample the drawn form to a point set: [{x, y, x0, y0, v}].
 *
 *  Points carry their ORIGIN because a morph interpolates from where a
 *  point started — the same contract `glyph_to_points` established.
 *
 *  Sampled through a small offscreen rather than off the full-size canvas:
 *  one getImageData on a ~200px buffer instead of a 1280×720 one, which
 *  keeps the contract affordable at render resolution. */
const _formBuf = document.createElement("canvas");
const _formCtx = _formBuf.getContext("2d", { willReadFrequently: true });
function formPoints(ctx, w, h) {
  if (!w || !h) return [];
  const SW = 200;
  const sw = Math.min(SW, w);
  const sh = Math.max(1, Math.round((h / w) * sw));
  _formBuf.width = sw;
  _formBuf.height = sh;
  _formCtx.clearRect(0, 0, sw, sh);
  try {
    _formCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
  } catch (_) {
    return [];
  }
  const d = _formCtx.getImageData(0, 0, sw, sh).data;
  const kx = w / sw;
  const ky = h / sh;
  const pts = [];
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const a = d[i + 3];
      if (a < 24) continue;
      // Luminance against the palette's own ground. A primitive that
      // painted its background and nothing else emits no geometry, which
      // is the honest answer for an empty frame.
      const v = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
      if (v < 0.14) continue;
      const px = x * kx;
      const py = y * ky;
      pts.push({ x: px, y: py, x0: px, y0: py, v });
    }
  }
  return pts;
}

/** The declared output types of an io string ("GEOMETRY → ANIMATION"). */
function declaredOut(io) {
  return String(io)
    .split("→")
    .pop()
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function reg(id, family, io, params, make, note, phase) {
  const emits = declaredOut(io);
  // ONLY GEOMETRY IS BACKFILLED. FIELD and DATA are numeric structures a
  // canvas cannot be read back into — a primitive claiming those has to
  // compute them, and `noise_field` and `data_series` do. A declaration
  // that cannot be honoured is a declaration that must change, not one to
  // paper over.
  const backfill = emits.includes("GEOMETRY");
  PRIMS[id] = {
    id,
    family,
    io,
    params,
    note,
    phase: phase || 0,
    make: backfill
      ? (p) => {
          const inst = make(p);
          const inner = inst.frame;
          if (typeof inner !== "function") return inst;
          inst.frame = function (ctx, w, h, t, a, b, dur) {
            const out = inner.call(this, ctx, w, h, t, a, b, dur);
            // A primitive that already emits its own geometry is left
            // entirely alone — its point set is better than a resample.
            if (out && out.geometry) return out;
            const geometry = formPoints(ctx, w, h);
            return out ? Object.assign({}, out, { geometry }) : { geometry };
          };
          return inst;
        }
      : make,
  };
}

reg(
  "noise_field",
  "C · GENERATIVE",
  "— → FIELD",
  {
    scale: { v: 0.42, lo: 0.05, hi: 1 },
    octaves: { v: 3, lo: 1, hi: 6, int: 1 },
    turbulence: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => {
    let n = vnoise(p.seed | 0 || 1337),
      lastKey = "";
    return {
      frame(ctx, w, h, t) {
        const key = [p.scale, p.octaves, p.turbulence, p.seed].join();
        if (key !== lastKey) {
          lastKey = key;
          n = vnoise(p.seed | 0 || 1337);
        }
        const cell = 4;
        // THE FIELD ITSELF, not only a picture of it.
        //
        // This declared "— → FIELD" and returned nothing, so every
        // downstream consumer regenerated its own noise from a different
        // seed and the four-primitive DISSOLVED chain was four unrelated
        // images stacked, rendering as its last element. Sampling it once
        // here and handing the grid on is what makes the chain a chain.
        const cols = Math.ceil(w / cell);
        const rows = Math.ceil(h / cell);
        const data = new Float32Array(cols * rows);
        for (let gy = 0; gy < rows; gy++)
          for (let gx = 0; gx < cols; gx++) {
            const x = gx * cell;
            const y = gy * cell;
            const v =
              fbm(
                n,
                (x / w) * 8 * p.scale,
                (y / h) * 8 * p.scale + t * 0.12,
                p.octaves | 0,
                p.turbulence,
              ) *
                0.5 +
              0.5;
            data[gy * cols + gx] = cl01(v);
            const g = Math.round(data[gy * cols + gx] * 230) + 6;
            ctx.fillStyle = "rgb(" + g + "," + (g + 4) + "," + (g + 7) + ")";
            ctx.fillRect(x, y, cell, cell);
          }
        return { field: { kind: "scalar", cols, rows, cell, w, h, data } };
      },
    };
  },
  "Seeded value-noise fbm, emitted as a sampled grid. Downstream primitives read THIS field rather than each generating their own — which is the difference between a chain and four pictures in a stack.",
);

reg(
  "flow_field",
  "C · GENERATIVE",
  "FIELD → FIELD",
  {
    scale: { v: 0.35, lo: 0.05, hi: 1 },
    turbulence: { v: 0.55, lo: 0, hi: 1 },
    density: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t, upstream) {
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const gap = Math.round(30 - p.density * 18);
        ctx.strokeStyle = "rgba(155,163,170,.5)";
        ctx.lineWidth = 1;
        // A DIRECTION FIELD DERIVED FROM THE SCALAR ONE.
        //
        // Angles come from the gradient of the upstream field when there is
        // one, so the flow genuinely follows the noise it was handed rather
        // than following a private copy that happens to look similar. With
        // no upstream it falls back to its own noise, which is what makes
        // it still legible standing alone in the Lab.
        const up = upstream && upstream.field && upstream.field.kind === "scalar" ? upstream.field : null;
        const sample = (x, y) => {
          if (!up) {
            return (
              fbm(n, (x / w) * 6 * p.scale, (y / h) * 6 * p.scale + t * 0.1, 3, p.turbulence) *
              Math.PI *
              2.2
            );
          }
          const gx = Math.min(up.cols - 2, Math.max(1, Math.round((x / w) * up.cols)));
          const gy = Math.min(up.rows - 2, Math.max(1, Math.round((y / h) * up.rows)));
          // Gradient of the field: the direction it climbs, rotated a
          // quarter turn so particles travel ALONG contours rather than
          // straight up them — which is what reads as flow.
          const dx = up.data[gy * up.cols + gx + 1] - up.data[gy * up.cols + gx - 1];
          const dy = up.data[(gy + 1) * up.cols + gx] - up.data[(gy - 1) * up.cols + gx];
          return Math.atan2(dy, dx) + Math.PI / 2 + t * 0.05 * p.turbulence;
        };
        const cols = Math.max(2, Math.ceil(w / gap));
        const rows = Math.max(2, Math.ceil(h / gap));
        const ang = new Float32Array(cols * rows);
        for (let gy = 0; gy < rows; gy++)
          for (let gx = 0; gx < cols; gx++)
            ang[gy * cols + gx] = sample(gx * gap + gap / 2, gy * gap + gap / 2);
        for (let y = gap / 2; y < h; y += gap)
          for (let x = gap / 2; x < w; x += gap) {
            const a = sample(x, y);
            const L = gap * 0.6;
            ctx.beginPath();
            ctx.moveTo(x - (Math.cos(a) * L) / 2, y - (Math.sin(a) * L) / 2);
            ctx.lineTo(x + (Math.cos(a) * L) / 2, y + (Math.sin(a) * L) / 2);
            ctx.stroke();
            ctx.fillStyle = "#d8624a";
            ctx.fillRect(x + (Math.cos(a) * L) / 2 - 1, y + (Math.sin(a) * L) / 2 - 1, 2, 2);
          }
        lab(ctx, up ? "DERIVED FROM UPSTREAM FIELD" : "OWN NOISE · NO UPSTREAM", 10, h - 12);
        return { field: { kind: "vector", cols, rows, cell: gap, w, h, ang } };
      },
    };
  },
  "A direction field. Derived from the gradient of the scalar field it is handed, rotated so particles travel along contours rather than straight up them — which is what reads as flow. Falls back to its own noise when nothing is upstream.",
);

reg(
  "glyph_to_points",
  "A · TYPOGRAPHIC",
  "— → GEOMETRY",
  {
    text: { s: "PERMANENT" },
    sampling: { v: 5, lo: 3, hi: 12, int: 1 },
    jitter: { v: 0, lo: 0, hi: 1 },
  },
  (p) => {
    let pts = [],
      key = "";
    return {
      frame(ctx, w, h, t) {
        const k = p.text + p.sampling;
        if (k !== key) {
          key = k;
          pts = glyphPoints(p.text, w, h, Math.round(p.sampling));
        }
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const r = mulberry(9);
        for (const [x, y] of pts) {
          const jx = (r() - 0.5) * p.jitter * 26,
            jy = (r() - 0.5) * p.jitter * 26;
          ctx.fillStyle = "rgba(238,241,243,.85)";
          ctx.fillRect(x + jx, y + jy, 1.6, 1.6);
        }
        ctx.fillStyle = "#3a4045";
        ctx.font = "9px JetBrains Mono";
        ctx.fillText(pts.length + " PTS", 10, h - 10);
      },
    };
  },
  "The highest-value primitive in the atlas: it turns language into geometry any other primitive can consume.",
);

reg(
  "particle_seek",
  "D · PARTICLE",
  "GEOMETRY → GEOMETRY",
  {
    text: { s: "NINETY DAYS" },
    damping: { v: 0.86, lo: 0.7, hi: 0.97 },
    force: { v: 0.055, lo: 0.01, hi: 0.2 },
    scatter: { v: 1, lo: 0, hi: 1 },
  },
  (p) => {
    let ps = [],
      key = "";
    return {
      frame(ctx, w, h, t, upstream) {
        // SEEK THE GEOMETRY IT WAS GIVEN.
        //
        // It declared "GEOMETRY → GEOMETRY" and then rasterised its own
        // `text` parameter into targets, so `glyph_to_points →
        // particle_seek` — twenty-one scenes of the IHAP film, and the
        // Atlas's own signature move — was two primitives forming two
        // different words that happened to share a font.
        const given = upstream && upstream.geometry;
        const k = given ? "up:" + given.length + ":" + w : p.text + w;
        if (k !== key) {
          key = k;
          const tg = given
            ? given.map((q) => [q.x0 ?? q.x, q.y0 ?? q.y])
            : glyphPoints(p.text, w, h, 5);
          const r = mulberry(4242);
          ps = tg.map(([x, y]) => ({
            x: w / 2 + (r() - 0.5) * w * 1.1,
            y: h / 2 + (r() - 0.5) * h * 1.4,
            vx: 0,
            vy: 0,
            tx: x,
            ty: y,
          }));
        }
        // A heavier clear: at .22 the trail from the scattered start never
        // faded, so the formed word sat inside a fog of where it came from.
        ctx.fillStyle = "rgba(13,15,17,.38)";
        ctx.fillRect(0, 0, w, h);
        for (const q of ps) {
          const sx = q.tx,
            sy = q.ty;
          q.vx = (q.vx + (sx - q.x) * p.force) * p.damping;
          q.vy = (q.vy + (sy - q.y) * p.force) * p.damping;
          q.x += q.vx;
          q.y += q.vy;
          const sp = Math.min(1, Math.hypot(q.vx, q.vy) / 6);
          ctx.fillStyle =
            sp > 0.25 ? "rgba(216,98,74," + (0.5 + sp * 0.5) + ")" : "rgba(238,241,243,.95)";
          // Sampled at a 5px step and drawn at 1.7px, the settled word was a
          // sparse grey stipple — legible in a Lab tile at full size and
          // nearly invisible in a frame. The mark has to cover the step it
          // was sampled at, or the letterform never closes.
          ctx.fillRect(q.x, q.y, 3.2, 3.2);
        }
        return { geometry: ps.map((q) => ({ x: q.x, y: q.y, x0: q.tx, y0: q.ty })) };
      },
    };
  },
  "Particles seek the point geometry they are handed — text out of chaos, the Canopticon signature move. Emits its own positions so a trail downstream draws these particles, not a second population.",
);

reg(
  "particle_flow",
  "D · PARTICLE",
  "FIELD → GEOMETRY",
  {
    count: { v: 0.45, lo: 0.05, hi: 1 },
    speed: { v: 0.5, lo: 0.1, hi: 1 },
    turbulence: { v: 0.5, lo: 0, hi: 1 },
    trail: { v: 0.06, lo: 0.01, hi: 0.4 },
  },
  (p) => {
    let ps = [],
      n = vnoise(1337),
      init = false;
    return {
      frame(ctx, w, h, t, upstream) {
        const N = Math.round(80 + p.count * 900);
        if (!init || ps.length !== N) {
          init = true;
          const r = mulberry(77);
          ps = Array.from({ length: N }, () => ({ x: r() * w, y: r() * h, l: r() * 180 }));
        }
        ctx.fillStyle = "rgba(13,15,17," + p.trail + ")";
        ctx.fillRect(0, 0, w, h);
        const r2 = mulberry(1234 + ((t * 60) | 0));
        ctx.lineWidth = 1;
        // ADVECT THROUGH THE FIELD IT WAS GIVEN.
        //
        // It declared "FIELD → GEOMETRY" and then generated its own noise,
        // so the flow field one stage upstream was decoration and this was
        // an unrelated system that happened to look similar. Reading the
        // vector field is what makes "advection through a field" true.
        const vf =
          upstream && upstream.field && upstream.field.kind === "vector" ? upstream.field : null;
        const angleAt = (x, y) => {
          if (!vf) {
            return fbm(n, (x / w) * 5, (y / h) * 5 + t * 0.08, 3, p.turbulence) * Math.PI * 2.4;
          }
          const gx = Math.min(vf.cols - 1, Math.max(0, Math.floor((x / w) * vf.cols)));
          const gy = Math.min(vf.rows - 1, Math.max(0, Math.floor((y / h) * vf.rows)));
          return vf.ang[gy * vf.cols + gx];
        };
        const out = [];
        for (const q of ps) {
          const a = angleAt(q.x, q.y);
          const nx = q.x + Math.cos(a) * (0.6 + p.speed * 3.4),
            ny = q.y + Math.sin(a) * (0.6 + p.speed * 3.4);
          ctx.strokeStyle = "rgba(238,241,243,.22)";
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          q.x = nx;
          q.y = ny;
          q.l--;
          if (q.l < 0 || q.x < 0 || q.x > w || q.y < 0 || q.y > h) {
            q.x = r2() * w;
            q.y = r2() * h;
            q.l = 60 + r2() * 180;
          }
          out.push({ x: q.x, y: q.y, x0: q.x, y0: q.y });
        }
        lab(ctx, vf ? out.length + " PTS · ADVECTED BY UPSTREAM FIELD" : out.length + " PTS · OWN NOISE", 10, h - 12);
        // The declared GEOMETRY, actually emitted, so particle_trail draws
        // THESE particles rather than a second population of its own.
        return { geometry: out };
      },
    };
  },
  "Advection through a field — the one it is handed, when it is handed one. Emits the particle positions so a downstream trail draws these particles and not a second population that merely resembles them.",
);

reg(
  "particle_trail",
  "D · PARTICLE",
  "GEOMETRY → IMAGE",
  {
    decay: { v: 0.055, lo: 0.01, hi: 0.3 },
    spread: { v: 0.4, lo: 0, hi: 1 },
    count: { v: 0.4, lo: 0.05, hi: 1 },
  },
  (p) => {
    let ps = [],
      init = false;
    // Trails of the points it is GIVEN. It declared "GEOMETRY → IMAGE" and
    // then animated its own lissajous population, so at the end of the
    // flagship chain — noise → flow → particles → trail — the thing on
    // screen was a decorative orbit that had never met any of the three
    // stages before it.
    //
    // The decay wash is the whole idea: never clearing the buffer fully is
    // what turns positions into motion history, so the trail is drawn from
    // the upstream points and the previous frame is allowed to survive.
    let history = null;
    return {
      frame(ctx, w, h, t, upstream) {
        const pts = upstream && upstream.geometry;
        if (!history || history.width !== w || history.height !== h) {
          history = document.createElement("canvas");
          history.width = w;
          history.height = h;
        }
        const hx = history.getContext("2d");

        if (pts && pts.length) {
          hx.fillStyle = "rgba(13,15,17," + p.decay + ")";
          hx.fillRect(0, 0, w, h);
          const size = 1 + p.spread * 2.2;
          for (const q of pts) {
            hx.fillStyle = "rgba(216,98,74,.55)";
            hx.fillRect(q.x, q.y, size, size);
          }
          ctx.drawImage(history, 0, 0);
          lab(ctx, pts.length + " PTS · MOTION HISTORY", 10, h - 12);
          return;
        }

        const N = Math.round(30 + p.count * 260);
        if (!init || ps.length !== N) {
          init = true;
          const r = mulberry(21);
          ps = Array.from({ length: N }, () => ({
            a: r() * 6.28,
            rad: r() * 0.5 + 0.1,
            sp: 0.2 + r() * 0.8,
            ph: r() * 6.28,
          }));
        }
        ctx.fillStyle = "rgba(13,15,17," + p.decay + ")";
        ctx.fillRect(0, 0, w, h);
        for (const q of ps) {
          const ang = q.ph + t * q.sp;
          const R = Math.min(w, h) * q.rad * (1 + p.spread * Math.sin(t * 0.7 + q.ph) * 0.6);
          const x = w / 2 + Math.cos(ang) * R * 1.5,
            y = h / 2 + Math.sin(ang * 1.3) * R;
          ctx.fillStyle = "rgba(216,98,74,.5)";
          ctx.fillRect(x, y, 1.5, 1.5);
        }
        lab(ctx, "OWN POPULATION · NO UPSTREAM GEOMETRY", 10, h - 12);
      },
    };
  },
  "Motion history as an image buffer, drawn from the points it is handed. The decay wash is the idea: never clearing fully is what turns positions into movement.",
);

reg(
  "ascii_render",
  "J · RASTER",
  "IMAGE → GEOMETRY",
  {
    cell: { v: 8, lo: 5, hi: 18, int: 1 },
    scale: { v: 0.4, lo: 0.05, hi: 1 },
    ramp: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    const R = " .·:-=+*#%@";
    let scratch = null;
    return {
      // TRANSCRIBES WHAT IT WAS HANDED. It declared IMAGE → GEOMETRY and
      // read its own noise, so as an operator it replaced the thing it was
      // supposed to be re-reading. With an upstream it now transcribes the
      // real luminance; with nothing upstream it falls back to its own
      // field, so it still reads as itself standing alone in the Lab.
      frame(ctx, w, h, t, upstream) {
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const c = Math.round(p.cell);
        let im = null;
        if (upstream?.canvas) {
          if (!scratch || scratch.width !== w || scratch.height !== h) {
            scratch = document.createElement("canvas");
            scratch.width = w;
            scratch.height = h;
          }
          const sx = scratch.getContext("2d", { willReadFrequently: true });
          sx.clearRect(0, 0, w, h);
          sx.drawImage(upstream.canvas, 0, 0, w, h);
          im = sx.getImageData(0, 0, w, h);
        }
        ctx.font = c + 1 + "px JetBrains Mono";
        ctx.textBaseline = "top";
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            let v = im
              ? (im.data[((y | 0) * w + (x | 0)) * 4] * 0.299 +
                  im.data[((y | 0) * w + (x | 0)) * 4 + 1] * 0.587 +
                  im.data[((y | 0) * w + (x | 0)) * 4 + 2] * 0.114) /
                255
              : fbm(n, (x / w) * 7 * p.scale, (y / h) * 7 * p.scale + t * 0.15, 3, 0.5) * 0.5 + 0.5;
            v = Math.pow(v, 0.5 + p.ramp * 1.5);
            const ch = R[Math.min(R.length - 1, Math.floor(v * R.length))];
            ctx.fillStyle =
              v > 0.72 ? "rgba(216,98,74,.9)" : "rgba(155,163,170," + (0.25 + v * 0.6) + ")";
            ctx.fillText(ch, x, y);
          }
      },
    };
  },
  "Closes the loop: any image becomes typography again. Very much the house sensibility.",
);

reg(
  "document_surface",
  "I · DOCUMENTS",
  // Declared ARTIFACT and emitted pixels. Every consumer of "ARTIFACT"
  // reads `upstream.canvas`, so the type was a name for "a picture from
  // the documents family" and nothing more. IMAGE is what it is.
  "— → IMAGE",
  {
    age: { v: 0.5, lo: 0, hi: 1 },
    columns: { v: 1, lo: 1, hi: 3, int: 1 },
    redaction: { v: 0.25, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      const age = p.age;
      ctx.fillStyle =
        "rgb(" + (238 - age * 40) + "," + (235 - age * 44) + "," + (226 - age * 48) + ")";
      ctx.fillRect(0, 0, w, h);
      const r = mulberry(88);
      const cols = Math.round(p.columns),
        pad = 26,
        cw = (w - pad * 2 - (cols - 1) * 18) / cols;
      ctx.fillStyle = "rgba(30,26,22,.86)";
      ctx.fillRect(pad, 18, cw * 0.7, 9);
      for (let c = 0; c < cols; c++) {
        let y = 42;
        const x0 = pad + c * (cw + 18);
        while (y < h - 14) {
          const lw = cw * (0.62 + r() * 0.38);
          if (r() < p.redaction * 0.5) {
            ctx.fillStyle = "#14120f";
            ctx.fillRect(x0, y - 1, lw, 6);
          } else {
            ctx.fillStyle = "rgba(40,34,28," + (0.3 + r() * 0.3) + ")";
            ctx.fillRect(x0, y, lw, 2.4);
          }
          y += 8;
        }
      }
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 1.1);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(40,28,14," + age * 0.5 + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  }),
  "Documents are constructed, not photographed — so they can be animated structurally. A table can reorganise; a redaction can slide.",
);

reg(
  "timeline_linear",
  "H · TIMELINE",
  "DATA → GEOMETRY",
  {
    marks: { v: 0.5, lo: 0.1, hi: 1 },
    fragment: { v: 0, lo: 0, hi: 1 },
    orientation: { v: 0, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(0, 0, w, h);

      // A REAL CHRONOLOGY when the chain supplies one. The years in an
      // institutional essay are not a texture — 2017, 2019, 2024, 2025,
      // 2026 is the argument's skeleton, and spacing the marks by the
      // actual interval is what makes a six-year build-up followed by a
      // one-year "end" look like what it is.
      const years = (upstream && upstream.data ? upstream.data : []).filter(
        (f) => f.kind === "year" && Number.isFinite(f.value),
      );
      if (years.length >= 2) {
        const lo = Math.min(...years.map((f) => f.value));
        const hi = Math.max(...years.map((f) => f.value));
        const span = Math.max(1, hi - lo);
        const y0 = h * 0.55;
        ctx.strokeStyle = "rgba(155,163,170,.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, y0);
        ctx.lineTo(w - 24, y0);
        ctx.stroke();
        for (const f of years) {
          const x = 24 + (w - 48) * ((f.value - lo) / span);
          const last = f.value === hi;
          ctx.fillStyle = last ? "#d8624a" : "rgba(238,241,243,.75)";
          ctx.fillRect(x - 0.75, y0 - (last ? 22 : 11), 1.5, last ? 22 : 11);
          ctx.fillStyle = last ? "#d8624a" : "rgba(155,163,170,.7)";
          ctx.font = "9px JetBrains Mono";
          // The printed string, not the parsed year.
          ctx.fillText(f.text, x - 10, y0 - (last ? 27 : 16));
        }
        lab(ctx, `${years.length} DATED MARKS · ${lo}–${hi}`, 10, h - 12);
        return { geometry: samplePixels(ctx.canvas, w, h, 5, 0.3) };
      }

      const N = Math.round(6 + p.marks * 36),
        y0 = h * 0.55,
        r = mulberry(303);
      ctx.strokeStyle = "rgba(155,163,170,.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        const x = 24 + (w - 48) * (i / (N - 1));
        const br = (r() - 0.5) * p.fragment * h * 0.5;
        const yy = y0 + br;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + (w - 48) / (N - 1), yy + (r() - 0.5) * p.fragment * 20);
        ctx.stroke();
        const tall = r() > 0.72;
        ctx.fillStyle = tall ? "#d8624a" : "rgba(238,241,243,.7)";
        ctx.fillRect(x - 0.75, yy - (tall ? 16 : 7), 1.5, tall ? 16 : 7);
        if (tall) {
          ctx.fillStyle = "rgba(155,163,170,.65)";
          ctx.font = "8px JetBrains Mono";
          ctx.fillText((2003 + i) | 0, x - 9, yy - 21);
        }
      }
    },
  }),
  "The primary motif carrier. Orientation, mark type, and behaviour are all axes — a timeline can fragment.",
);

reg(
  "text_stagger",
  "A · TYPOGRAPHIC",
  "— → ANIMATION",
  {
    text: { s: "RENEWED FORTY-ONE TIMES" },
    stagger: { v: 0.4, lo: 0, hi: 1 },
    unit: { v: 1, lo: 0, hi: 2, int: 1 },
    overshoot: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(0, 0, w, h);
      const units = p.unit < 0.5 ? p.text.split("") : p.unit < 1.5 ? p.text.split(" ") : [p.text];
      const cyc = (t * 0.42) % 1.9;
      ctx.textBaseline = "middle";
      // MEASURE, THEN SHRINK. The size was estimated from the character
      // count and never checked, so a phrase wider than the guess ran off
      // both edges — which became most of the film the moment the engine
      // started passing the scene's own words instead of a short default.
      const gap = p.unit < 1.5 && p.unit >= 0.5 ? " " : "";
      let size = Math.min(34, w / (Math.max(1, p.text.length) * 0.52));
      let widths;
      let total;
      let guard = 24;
      const measure = () => {
        ctx.font = "600 " + size + 'px "Space Grotesk",sans-serif';
        widths = units.map((u) => ctx.measureText(u + gap).width);
        total = widths.reduce((a, b) => a + b, 0);
      };
      measure();
      while (guard-- > 0 && total > w * 0.94 && size > 7) {
        size *= 0.92;
        measure();
      }
      let x = (w - total) / 2;
      units.forEach((u, i) => {
        const d = (i / Math.max(1, units.length - 1)) * p.stagger * 0.9;
        const pr = cl01((cyc - d) / 0.55);
        const e = 1 - Math.pow(1 - pr, 3),
          ov = Math.sin(pr * Math.PI) * p.overshoot * 13;
        ctx.globalAlpha = e;
        ctx.fillStyle = "#eef1f3";
        ctx.fillText(
          u + (p.unit < 1.5 && p.unit >= 0.5 ? " " : ""),
          x,
          h / 2 + (1 - e) * 26 - ov * 0,
        );
        x += widths[i];
      });
      ctx.globalAlpha = 1;
    },
  }),
  'Stagger unit and ease profile are where "generated" becomes "authored". Motion craft is a modifier layer, not a primitive.',
);

function cl01(v) {
  return Math.max(0, Math.min(1, v));
}
Object.assign(window, { reg, bg, lab, cl01, INK, EMB, MUT, COOL, BG });
Object.assign(window, { PRIMS, glyphPoints, vnoise, fbm, mulberry });
