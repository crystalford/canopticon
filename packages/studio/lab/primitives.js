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
const INK = "#eef1f3",
  EMB = "#d8624a",
  MUT = "#9ba3aa",
  COOL = "#6f9ec4",
  BG = "#0d0f11";
function bg(ctx, w, h, a) {
  ctx.fillStyle = a ? "rgba(13,15,17," + a + ")" : BG;
  ctx.fillRect(0, 0, w, h);
}
function lab(ctx, t, x, y, c) {
  ctx.font = "8px JetBrains Mono";
  ctx.textBaseline = "top";
  ctx.fillStyle = c || "#69717a";
  ctx.fillText(t, x, y);
}
function reg(id, family, io, params, make, note, phase) {
  PRIMS[id] = { id, family, io, params, make, note, phase: phase || 0 };
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
      img = null,
      lastKey = "";
    return {
      frame(ctx, w, h, t) {
        const key = [p.scale, p.octaves, p.turbulence, p.seed].join();
        if (key !== lastKey) {
          lastKey = key;
          n = vnoise(p.seed | 0 || 1337);
        }
        const cell = 4;
        for (let y = 0; y < h; y += cell)
          for (let x = 0; x < w; x += cell) {
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
            const g = Math.round(cl01(v) * 230) + 6;
            ctx.fillStyle = "rgb(" + g + "," + (g + 4) + "," + (g + 7) + ")";
            ctx.fillRect(x, y, cell, cell);
          }
      },
    };
  },
  "Seeded value-noise fbm. Feeds particle motion, displacement, camera drift.",
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
      frame(ctx, w, h, t) {
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const gap = Math.round(30 - p.density * 18);
        ctx.strokeStyle = "rgba(155,163,170,.5)";
        ctx.lineWidth = 1;
        for (let y = gap / 2; y < h; y += gap)
          for (let x = gap / 2; x < w; x += gap) {
            const a =
              fbm(n, (x / w) * 6 * p.scale, (y / h) * 6 * p.scale + t * 0.1, 3, p.turbulence) *
              Math.PI *
              2.2;
            const L = gap * 0.6;
            ctx.beginPath();
            ctx.moveTo(x - (Math.cos(a) * L) / 2, y - (Math.sin(a) * L) / 2);
            ctx.lineTo(x + (Math.cos(a) * L) / 2, y + (Math.sin(a) * L) / 2);
            ctx.stroke();
            ctx.fillStyle = "#d8624a";
            ctx.fillRect(x + (Math.cos(a) * L) / 2 - 1, y + (Math.sin(a) * L) / 2 - 1, 2, 2);
          }
      },
    };
  },
  "Directional field derived from noise. The substrate every particle chain moves through.",
);

reg(
  "glyph_to_points",
  "A · TYPOGRAPHIC",
  "TEXT → GEOMETRY",
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
      frame(ctx, w, h, t) {
        const k = p.text + w;
        if (k !== key) {
          key = k;
          const tg = glyphPoints(p.text, w, h, 5),
            r = mulberry(4242);
          ps = tg.map(([x, y]) => ({
            x: w / 2 + (r() - 0.5) * w * 1.1,
            y: h / 2 + (r() - 0.5) * h * 1.4,
            vx: 0,
            vy: 0,
            tx: x,
            ty: y,
          }));
        }
        ctx.fillStyle = "rgba(13,15,17,.22)";
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
            sp > 0.25 ? "rgba(216,98,74," + (0.4 + sp * 0.6) + ")" : "rgba(238,241,243,.8)";
          ctx.fillRect(q.x, q.y, 1.7, 1.7);
        }
      },
    };
  },
  "Particles seek glyph geometry. This is how text forms out of chaos — the Canopticon signature move.",
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
      frame(ctx, w, h, t) {
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
        for (const q of ps) {
          const a =
            fbm(n, (q.x / w) * 5, (q.y / h) * 5 + t * 0.08, 3, p.turbulence) * Math.PI * 2.4;
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
        }
      },
    };
  },
  "Advection through a field. Chain it after particle_seek and a word dissolves into drift.",
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
    return {
      frame(ctx, w, h, t) {
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
      },
    };
  },
  "Motion history as an image buffer. Cheap, and what makes movement read as authored.",
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
    return {
      frame(ctx, w, h, t) {
        ctx.fillStyle = "#0d0f11";
        ctx.fillRect(0, 0, w, h);
        const c = Math.round(p.cell);
        ctx.font = c + 1 + "px JetBrains Mono";
        ctx.textBaseline = "top";
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            let v =
              fbm(n, (x / w) * 7 * p.scale, (y / h) * 7 * p.scale + t * 0.15, 3, 0.5) * 0.5 + 0.5;
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
  "— → ARTIFACT",
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
    frame(ctx, w, h, t) {
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(0, 0, w, h);
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
  "TEXT → ANIMATION",
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
      const size = Math.min(34, w / (p.text.length * 0.52));
      ctx.font = "600 " + size + 'px "Space Grotesk",sans-serif';
      const widths = units.map(
        (u) => ctx.measureText(u + (p.unit < 1.5 && p.unit >= 0.5 ? " " : "")).width,
      );
      let total = widths.reduce((a, b) => a + b, 0),
        x = (w - total) / 2;
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
