/* CANOPTICON — families A (typographic), B (vector), O (motion craft). */
const TXT = (t) => ({ s: t });
function fit(ctx, text, w, max) {
  const s = Math.min(max, w / (text.length * 0.58));
  ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
  return s;
}

/* ── A. TYPOGRAPHIC ─────────────────────────────────── */
reg(
  "text_layout",
  "A · TYPOGRAPHIC",
  "TEXT → GEOMETRY",
  {
    text: TXT("THE TEMPORARY MEASURE"),
    mode: { v: 0, lo: 0, hi: 5, int: 1 },
    tracking: { v: 0.3, lo: 0, hi: 1 },
    scale: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const words = p.text.split(" "),
        M = Math.round(p.mode);
      ctx.fillStyle = INK;
      ctx.textBaseline = "middle";
      const names = ["CENTERED", "EDITORIAL", "ASYMMETRIC", "STACKED", "CIRCULAR", "SCATTERED"];
      if (M === 0) {
        const s = fit(ctx, p.text, w * 0.9, 44);
        ctx.textAlign = "center";
        ctx.letterSpacing = p.tracking * 8 + "px";
        ctx.fillText(p.text, w / 2, h / 2);
      } else if (M === 1) {
        ctx.textAlign = "left";
        let y = h * 0.24;
        words.forEach((v, i) => {
          const s = h * 0.16 * p.scale * (i === 0 ? 1.6 : 1);
          ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
          ctx.fillStyle = i ? MUT : INK;
          ctx.fillText(v, w * 0.09, y);
          y += s * 1.15;
        });
      } else if (M === 2) {
        ctx.textAlign = "left";
        words.forEach((v, i) => {
          const s = h * 0.13 * p.scale * (1 + (i % 2) * 0.7);
          ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
          ctx.fillStyle = i % 2 ? EMB : INK;
          ctx.fillText(v, w * (0.06 + (i % 3) * 0.18), h * (0.22 + i * 0.19));
        });
      } else if (M === 3) {
        ctx.textAlign = "center";
        words.forEach((v, i) => {
          const s = h * 0.2 * p.scale;
          ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
          ctx.fillStyle = INK;
          ctx.fillText(v, w / 2, h * (0.2 + i * 0.2));
        });
      } else if (M === 4) {
        const R = Math.min(w, h) * 0.34;
        ctx.textAlign = "center";
        ctx.font = "600 " + 14 * p.scale * 2 + 'px "Space Grotesk",sans-serif';
        const cs = p.text.split("");
        cs.forEach((ch, i) => {
          const a = (i / cs.length) * 6.283 - 1.57;
          ctx.save();
          ctx.translate(w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R);
          ctx.rotate(a + 1.57);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        });
      } else {
        const r = mulberry(31);
        ctx.textAlign = "left";
        words.forEach((v) => {
          const s = h * 0.09 * p.scale * (0.6 + r() * 1.6);
          ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
          ctx.fillStyle = r() > 0.7 ? EMB : INK;
          ctx.fillText(v, r() * w * 0.7, h * (0.15 + r() * 0.7));
        });
      }
      ctx.letterSpacing = "0px";
      ctx.textAlign = "left";
      lab(ctx, names[M], 10, h - 16);
    },
  }),
  "Layout is a parameter, not a template. Eleven named modes share one geometry output.",
);

reg(
  "glyph_to_path",
  "A · TYPOGRAPHIC",
  "TEXT → GEOMETRY",
  { text: TXT("STATUTE"), weight: { v: 0.4, lo: 0.05, hi: 1 }, dash: { v: 0.4, lo: 0, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const s = fit(ctx, p.text, w * 0.86, 72);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 0.5 + p.weight * 2.5;
      ctx.setLineDash(p.dash > 0.02 ? [6 + p.dash * 30, 4 + p.dash * 22] : []);
      ctx.lineDashOffset = -t * 40;
      ctx.strokeStyle = INK;
      ctx.strokeText(p.text, w / 2, h / 2);
      ctx.setLineDash([]);
      ctx.textAlign = "left";
      lab(ctx, "OUTLINE · " + p.text.length + " GLYPHS", 10, h - 16);
    },
  }),
  "Glyph outlines as path commands — the input to stroke reveal, extrusion, and point sampling.",
);

reg(
  "text_stagger_units",
  "A · TYPOGRAPHIC",
  "TEXT → ANIMATION",
  {
    text: TXT("NOBODY VOTED AGAINST"),
    unit: { v: 1, lo: 0, hi: 2, int: 1 },
    spread: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const cyc = (t * 0.5) % 2;
      const us =
        p.unit < 0.5 ? p.text.split("") : p.unit < 1.5 ? p.text.split(" ") : p.text.split("\n");
      const s = fit(ctx, p.text, w * 0.9, 30);
      ctx.textBaseline = "middle";
      const ws = us.map((u) => ctx.measureText(u + " ").width);
      let x = (w - ws.reduce((a, b) => a + b, 0)) / 2;
      us.forEach((u, i) => {
        const d = (i / Math.max(1, us.length - 1)) * p.spread;
        const pr = cl01((cyc - d) / 0.5);
        ctx.globalAlpha = pr;
        ctx.fillStyle = INK;
        ctx.fillText(u + " ", x, h / 2 + (1 - pr) * 20);
        x += ws[i];
      });
      ctx.globalAlpha = 1;
      lab(ctx, ["CHARACTER", "WORD", "LINE"][Math.round(p.unit)] + " STAGGER", 10, h - 16);
    },
  }),
  "The stagger unit changes the meaning of the reveal — characters read mechanical, words read spoken.",
);

reg(
  "text_scramble",
  "A · TYPOGRAPHIC",
  "TEXT → ANIMATION",
  {
    text: TXT("LONGSTANDING"),
    rate: { v: 0.5, lo: 0.1, hi: 1 },
    charset: { v: 0, lo: 0, hi: 2, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const sets = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789#%&@$*", "░▒▓█▚▞◢◣"];
      const cs = sets[Math.round(p.charset)],
        cyc = (t * p.rate * 0.5) % 1.6,
        tg = p.text;
      const s = fit(ctx, tg, w * 0.85, 46);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const r = mulberry(Math.floor(t * 22));
      let out = "";
      for (let i = 0; i < tg.length; i++) {
        const lock = cyc * tg.length > i * 1.05;
        out += lock ? tg[i] : cs[Math.floor(r() * cs.length)];
      }
      ctx.fillStyle = INK;
      ctx.fillText(out, w / 2, h / 2);
      ctx.textAlign = "left";
      lab(ctx, "RESOLVING · SEEDED", 10, h - 16);
    },
  }),
  "Randomisation that resolves — seeded, so the same build produces the same noise every time.",
);

reg(
  "variable_axis",
  "A · TYPOGRAPHIC",
  "TEXT → ANIMATION",
  {
    text: TXT("PERMANENT"),
    weight: { v: 0.5, lo: 0, hi: 1 },
    animate: { v: 1, lo: 0, hi: 1 },
    width: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const wt = p.animate > 0.5 ? Math.sin(t * 0.9) * 0.5 + 0.5 : p.weight;
      const weight = 300 + Math.round(wt * 4) * 100;
      const s = Math.min(58, w / (p.text.length * (0.42 + p.width * 0.3)));
      ctx.font = weight + " " + s + 'px "Space Grotesk",sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = (p.width - 0.5) * 7 + "px";
      ctx.fillStyle = INK;
      ctx.fillText(p.text, w / 2, h / 2);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "left";
      lab(ctx, "wght " + weight + " · tracking " + ((p.width - 0.5) * 7).toFixed(1), 10, h - 16);
    },
  }),
  "Weight, width and optical size are animatable axes — type that breathes rather than fades.",
);

reg(
  "text_morph",
  "A · TYPOGRAPHIC",
  "TEXT → ANIMATION",
  { from: TXT("TEMPORARY"), to: TXT("PERMANENT"), rate: { v: 0.4, lo: 0.1, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const c = Math.sin(t * p.rate * 2) * 0.5 + 0.5;
      const s = fit(ctx, p.from.length > p.to.length ? p.from : p.to, w * 0.85, 44);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 1 - c;
      ctx.fillStyle = INK;
      ctx.fillText(p.from, w / 2, h / 2 - c * 10);
      ctx.globalAlpha = c;
      ctx.fillStyle = EMB;
      ctx.fillText(p.to, w / 2, h / 2 + (1 - c) * 10);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      lab(ctx, "PATH MORPH " + (c * 100).toFixed(0) + "%", 10, h - 16);
    },
  }),
  "Path-level interpolation between two typographic states. One word becoming another is an argument.",
);

reg(
  "text_mask",
  "A · TYPOGRAPHIC",
  "TEXT → MASK",
  {
    text: TXT("EVIDENCE"),
    source: { v: 0, lo: 0, hi: 1, int: 1 },
    scale: { v: 0.4, lo: 0.1, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      // A loop is the plainest time transform there is: wrap the clock.
      warp(t, dur) {
        return dur > 0 ? t % dur : t;
      },
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const o = off.getContext("2d");
        if (p.source < 0.5) {
          const c = 6;
          for (let y = 0; y < h; y += c)
            for (let x = 0; x < w; x += c) {
              const v =
                fbm(n, (x / w) * 7 * p.scale, (y / h) * 7 * p.scale + t * 0.1, 3, 0.5) * 0.5 + 0.5;
              o.fillStyle =
                v > 0.55
                  ? EMB
                  : "rgb(" + ((v * 150) | 0) + "," + ((v * 160) | 0) + "," + ((v * 170) | 0) + ")";
              o.fillRect(x, y, c, c);
            }
        } else {
          for (let i = 0; i < 60; i++) {
            o.strokeStyle = "rgba(216,98,74," + (0.2 + i / 120) + ")";
            o.lineWidth = 1;
            o.beginPath();
            o.moveTo(0, (i / 60) * h + Math.sin(t + i * 0.3) * 8);
            o.lineTo(w, (i / 60) * h + Math.cos(t * 0.7 + i * 0.2) * 8);
            o.stroke();
          }
        }
        o.globalCompositeOperation = "destination-in";
        const s = fit(o, p.text, w * 0.9, 64);
        o.textAlign = "center";
        o.textBaseline = "middle";
        o.fillStyle = "#fff";
        o.fillText(p.text, w / 2, h / 2);
        ctx.drawImage(off, 0, 0);
        lab(ctx, "TYPE AS ALPHA CHANNEL", 10, h - 16);
      },
    };
  },
  "Type used as a compositing mask: the letterform becomes the window onto another primitive.",
);

reg(
  "text_displace",
  "A · TYPOGRAPHIC",
  "GEOMETRY + FIELD → GEOMETRY",
  { text: TXT("SETTLED"), amount: { v: 0.35, lo: 0, hi: 1 }, scale: { v: 0.4, lo: 0.05, hi: 1 } },
  (p) => {
    let pts = [],
      key = "",
      n = vnoise(99);
    return {
      frame(ctx, w, h, t) {
        const k = p.text + w;
        if (k !== key) {
          key = k;
          pts = glyphPoints(p.text, w, h, 4);
        }
        bg(ctx, w, h);
        for (const [x, y] of pts) {
          const dx =
            fbm(n, (x / w) * 5 * p.scale, (y / h) * 5 * p.scale + t * 0.1, 3, 0.6) * p.amount * 70;
          const dy =
            fbm(n, (x / w) * 5 * p.scale + 9, (y / h) * 5 * p.scale - t * 0.1, 3, 0.6) *
            p.amount *
            70;
          ctx.fillStyle = Math.abs(dx) > 20 ? "rgba(216,98,74,.8)" : "rgba(238,241,243,.8)";
          ctx.fillRect(x + dx, y + dy, 1.6, 1.6);
        }
        lab(ctx, "GLYPH GEOMETRY × NOISE FIELD", 10, h - 16);
      },
    };
  },
  "Deform letterforms by a field. The distortion is the argument, not an effect.",
);

/* ── B. VECTOR / GEOMETRIC ──────────────────────────── */
function curvePts(mode, w, h, k, t) {
  const P = [],
    N = 420,
    R = Math.min(w, h) * 0.36;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * (mode === 2 ? 6 : 1);
    let r = R;
    if (mode === 0) r = R * Math.cos(k * a);
    else if (mode === 1) r = R * (1 + 0.4 * Math.sin(k * a + t));
    else r = R * (i / N);
    const x = w / 2 + Math.cos(a + (mode === 2 ? t * 0.2 : 0)) * r,
      y = h / 2 + Math.sin(a * (mode === 3 ? 1.5 : 1)) * r;
    P.push([x, y]);
  }
  return P;
}
reg(
  "parametric_curve",
  "B · VECTOR",
  "— → GEOMETRY",
  {
    mode: { v: 0, lo: 0, hi: 3, int: 1 },
    k: { v: 4, lo: 1, hi: 9, int: 1 },
    reveal: { v: 1, lo: 0.05, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const P = curvePts(Math.round(p.mode), w, h, p.k, t);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const N = Math.floor(P.length * p.reveal);
      P.slice(0, N).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      if (N > 0) {
        const [x, y] = P[N - 1];
        ctx.fillStyle = EMB;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, 6.3);
        ctx.fill();
      }
      lab(
        ctx,
        ["ROSE", "POLAR WAVE", "SPIRAL", "LISSAJOUS"][Math.round(p.mode)] +
          " · k=" +
          Math.round(p.k),
        10,
        h - 16,
      );
    },
  }),
  "Rose curves, spirals, Lissajous figures. Mathematical form as a documentary register.",
);

reg(
  "path_draw",
  "B · VECTOR",
  "GEOMETRY → ANIMATION",
  {
    speed: { v: 0.4, lo: 0.05, hi: 1 },
    width: { v: 0.3, lo: 0.05, hi: 1 },
    mode: { v: 0, lo: 0, hi: 2, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const P = curvePts(Math.round(p.mode), w, h, 5, t * 0.2);
      const rev = (t * p.speed * 0.4) % 1.25;
      ctx.lineWidth = 0.5 + p.width * 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(155,163,170,.18)";
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = EMB;
      ctx.beginPath();
      P.slice(0, Math.floor(P.length * cl01(rev))).forEach(([x, y], i) =>
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
      );
      ctx.stroke();
      lab(ctx, "STROKE REVEAL " + (cl01(rev) * 100).toFixed(0) + "%", 10, h - 16);
    },
  }),
  "Dash-offset reveal. The cheapest primitive in the atlas and one of the most legible.",
);

reg(
  "path_traverse",
  "B · VECTOR",
  "GEOMETRY → ANIMATION",
  {
    speed: { v: 0.4, lo: 0.05, hi: 1 },
    count: { v: 0.3, lo: 0.05, hi: 1 },
    orient: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const P = curvePts(0, w, h, 4, 0);
      ctx.strokeStyle = "rgba(155,163,170,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      const N = 1 + Math.round(p.count * 11);
      for (let i = 0; i < N; i++) {
        const idx = Math.floor(((t * p.speed * 0.25 + i / N) % 1) * P.length);
        const [x, y] = P[idx],
          [x2, y2] = P[(idx + 4) % P.length];
        const a = Math.atan2(y2 - y, x2 - x);
        ctx.save();
        ctx.translate(x, y);
        if (p.orient > 0.5) ctx.rotate(a);
        ctx.fillStyle = i ? MUT : EMB;
        ctx.fillRect(-5, -1.2, 10, 2.4);
        ctx.restore();
      }
      lab(ctx, "N=" + N + " TRAVERSING", 10, h - 16);
    },
  }),
  "Objects moving along a path, optionally oriented to its tangent. Routes, flows, sequence.",
);

reg(
  "shape_morph",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    sides_a: { v: 3, lo: 3, hi: 12, int: 1 },
    sides_b: { v: 8, lo: 3, hi: 12, int: 1 },
    rate: { v: 0.4, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = 64,
        R = Math.min(w, h) * 0.33,
        c = Math.sin(t * p.rate * 2) * 0.5 + 0.5;
      const poly = (sides, i) => {
        const a = (i / N) * 6.283;
        const seg = Math.PI / sides;
        const r = (R * Math.cos(seg)) / Math.cos((a % (2 * seg)) - seg);
        return r;
      };
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const ra = poly(Math.round(p.sides_a), i),
          rb = poly(Math.round(p.sides_b), i);
        const r = ra + (rb - ra) * c,
          a = (i / N) * 6.283 - 1.57;
        const x = w / 2 + Math.cos(a) * r,
          y = h / 2 + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "rgba(216,98,74,.10)";
      ctx.fill();
      lab(
        ctx,
        Math.round(p.sides_a) +
          "-GON → " +
          Math.round(p.sides_b) +
          "-GON · " +
          (c * 100).toFixed(0) +
          "%",
        10,
        h - 16,
      );
    },
  }),
  "Arbitrary shape-to-shape with automatic point remapping. Structure changing while identity holds.",
);

reg(
  "recursive_geometry",
  "B · VECTOR",
  "— → GEOMETRY",
  {
    depth: { v: 7, lo: 2, hi: 11, int: 1 },
    angle: { v: 0.42, lo: 0.05, hi: 1 },
    decay: { v: 0.72, lo: 0.5, hi: 0.9 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      ctx.strokeStyle = "rgba(238,241,243,.7)";
      const sway = Math.sin(t * 0.5) * 0.06;
      let count = 0;
      (function br(x, y, len, ang, d) {
        if (d <= 0 || len < 2) return;
        count++;
        const x2 = x + Math.cos(ang) * len,
          y2 = y + Math.sin(ang) * len;
        ctx.lineWidth = Math.max(0.4, d * 0.35);
        ctx.strokeStyle =
          d < 3 ? "rgba(216,98,74,.75)" : "rgba(238,241,243," + (0.25 + d * 0.07) + ")";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        br(x2, y2, len * p.decay, ang - p.angle + sway, d - 1);
        br(x2, y2, len * p.decay, ang + p.angle + sway, d - 1);
      })(w / 2, h * 0.96, h * 0.24, -Math.PI / 2, Math.round(p.depth));
      lab(ctx, "DEPTH " + Math.round(p.depth) + " · " + count + " SEGMENTS", 10, h - 16);
    },
  }),
  "Subdivision and branching. Institutional structure, growth, proliferation — without an illustration.",
);

reg(
  "boolean_ops",
  "B · VECTOR",
  "GEOMETRY → GEOMETRY",
  {
    op: { v: 0, lo: 0, hi: 3, int: 1 },
    offset: { v: 0.4, lo: 0, hi: 1 },
    size: { v: 0.5, lo: 0.2, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const R = Math.min(w, h) * 0.26 * p.size,
        dx = p.offset * R * 1.6 + Math.sin(t * 0.4) * R * 0.2;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const o = off.getContext("2d");
      const OPS = ["union", "subtract", "intersect", "xor"],
        M = Math.round(p.op);
      o.fillStyle = EMB;
      o.beginPath();
      o.arc(w / 2 - dx, h / 2, R, 0, 6.3);
      o.fill();
      o.globalCompositeOperation = ["source-over", "destination-out", "source-in", "xor"][M];
      o.fillStyle = INK;
      o.beginPath();
      o.arc(w / 2 + dx, h / 2, R, 0, 6.3);
      o.fill();
      ctx.drawImage(off, 0, 0);
      ctx.strokeStyle = "rgba(155,163,170,.3)";
      ctx.lineWidth = 1;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.arc(w / 2 + s * dx, h / 2, R, 0, 6.3);
        ctx.stroke();
      });
      lab(ctx, OPS[M].toUpperCase(), 10, h - 16);
    },
  }),
  "Union, subtract, intersect, xor. Overlap and exclusion made geometric rather than metaphorical.",
);

/* ── O. MOTION CRAFT ────────────────────────────────── */
function easeCurve(kind, x, amt) {
  if (kind === 0) return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  if (kind === 1) {
    const c = 1.70158 * (1 + amt * 2);
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  }
  if (kind === 2) {
    const c = (2 * Math.PI) / (0.3 + amt * 0.5);
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c) + 1;
  }
  if (kind === 3) {
    const a = -amt * 0.28;
    return x < 0.28 ? a * Math.sin((x / 0.28) * Math.PI) : (x - 0.28) / 0.72;
  }
  return x;
}
function motionDemo(kindFn, name) {
  return (p) => ({
    /* MOTION CRAFT IS A TIME TRANSFORM, NOT A PIXEL ONE.
     *
     * These six primitives declare ANIMATION → ANIMATION and, run as an
     * ordinary chain stage, painted this curve diagram straight over
     * whatever came before them — so appending `ease_profile` to a chain,
     * which every visual language's tail does, silently replaced the shot
     * with a picture of an easing curve. The chain typechecked. It was
     * still a fake, in exactly the way `entity_render` was.
     *
     * The fix is not a better draw call. An ease cannot be applied to a
     * frame that has already been rendered; it has to be applied to the
     * TIME the frame is rendered at. So a motion-craft instance exposes
     * `warp`, the executor uses it to reshape the clock the upstream
     * stages run on, and `frame` stays what it always was — a legible
     * explanation of the parameter, for when the primitive is inspected on
     * its own in the Lab.
     *
     * `dur` is the shot's length, so the curve spans the shot rather than
     * an arbitrary second. */
    warp(t, dur) {
      if (!(dur > 0)) return t;
      return kindFn(cl01(t / dur), p) * dur;
    },
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const cyc = (t * 0.42) % 1.7,
        x = cl01(cyc / 1.1),
        v = kindFn(x, p);
      const px = 24,
        pw = w - 48,
        py = h * 0.3,
        ph = h * 0.34;
      ctx.strokeStyle = "rgba(155,163,170,.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);
      ctx.strokeStyle = MUT;
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const u = i / 90,
          vv = kindFn(u, p);
        const X = px + u * pw,
          Y = py + ph - cl01(vv * 0.9 + 0.05) * ph;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
      const X = px + x * pw,
        Y = py + ph - cl01(v * 0.9 + 0.05) * ph;
      ctx.fillStyle = EMB;
      ctx.beginPath();
      ctx.arc(X, Y, 3, 0, 6.3);
      ctx.fill();
      const ty = h * 0.8;
      ctx.fillStyle = "rgba(155,163,170,.2)";
      ctx.fillRect(px, ty - 1, pw, 2);
      ctx.fillStyle = INK;
      ctx.fillRect(px + cl01(v) * (pw - 30), ty - 9, 30, 18);
      lab(ctx, name, 10, h - 16);
    },
  });
}
reg(
  "ease_profile",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { kind: { v: 0, lo: 0, hi: 2, int: 1 }, amount: { v: 0.5, lo: 0, hi: 1 } },
  motionDemo((x, p) => easeCurve(Math.round(p.kind), x, p.amount), "NAMED CURVE · NOT BEZIER SOUP"),
  "Named curves the director can reason about. Raw cubic-bezier values are an implementation detail.",
);
reg(
  "overshoot",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { amount: { v: 0.5, lo: 0, hi: 1 } },
  motionDemo((x, p) => easeCurve(1, x, p.amount), "PASS TARGET · SETTLE BACK"),
  "Pass the target and settle. Applied globally from the restraint parameter, it gives a film one motion character.",
);
reg(
  "damping",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { amount: { v: 0.5, lo: 0, hi: 1 } },
  motionDemo((x, p) => easeCurve(2, x, 1 - p.amount), "SPRING SETTLE"),
  "Spring settle characteristics — how energy leaves a movement.",
);
reg(
  "anticipation",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { amount: { v: 0.5, lo: 0, hi: 1 } },
  motionDemo((x, p) => easeCurve(3, x, p.amount), "COUNTER-MOVE FIRST"),
  "A small counter-move before the main move. Cheap, and the single clearest signal of authored motion.",
);
reg(
  "follow_through",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { lag: { v: 0.4, lo: 0.05, hi: 1 }, layers: { v: 3, lo: 2, hi: 6, int: 1 } },
  (p) => ({
    // Follow-through as a time transform: the shot runs slightly behind
    // the clock and catches up at the end. See motionDemo for why these
    // warp time rather than drawing over the frame.
    warp(t, dur) {
      if (!(dur > 0)) return t;
      const u = cl01(t / dur);
      return (u - Math.sin(u * Math.PI) * p.lag * 0.12) * dur;
    },
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.layers);
      for (let i = 0; i < N; i++) {
        const d = i * p.lag * 0.34;
        const x = cl01(easeCurve(0, cl01((((t * 0.5) % 1.9) - d) / 1.1), 0.5));
        const y = h * (0.22 + i * (0.56 / Math.max(1, N - 1)));
        ctx.fillStyle = "rgba(155,163,170,.14)";
        ctx.fillRect(24, y - 1, w - 48, 2);
        ctx.fillStyle = i ? "rgba(155,163,170,.8)" : EMB;
        ctx.fillRect(24 + x * (w - 48 - 26), y - 7, 26, 14);
      }
      lab(ctx, "SECONDARY ELEMENTS TRAIL THE PRIMARY", 10, h - 16);
    },
  }),
  "Secondary elements continue after the primary stops. This is the difference between tweened and animated.",
);
reg(
  "seamless_loop",
  "O · MOTION CRAFT",
  "ANIMATION → ANIMATION",
  { period: { v: 0.4, lo: 0.1, hi: 1 }, complexity: { v: 0.4, lo: 0, hi: 1 } },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const T = 2 + p.period * 6,
          ph = (t % T) / T,
          a = ph * 6.283;
        for (let i = 0; i < 70; i++) {
          const u = i / 70;
          const r =
            Math.min(w, h) * (0.12 + u * 0.26) +
            Math.sin(a * (1 + Math.round(p.complexity * 3)) + u * 9) * h * 0.06;
          const x = w / 2 + Math.cos(a + u * 6.283) * r,
            y = h / 2 + Math.sin(a + u * 6.283) * r * 0.6;
          ctx.fillStyle = u > 0.7 ? "rgba(216,98,74,.6)" : "rgba(238,241,243,.45)";
          ctx.fillRect(x, y, 2, 2);
        }
        ctx.strokeStyle = "rgba(155,163,170,.25)";
        ctx.strokeRect(14, h - 24, w - 28, 10);
        ctx.fillStyle = EMB;
        ctx.fillRect(14, h - 24, (w - 28) * ph, 10);
        lab(ctx, "PERIOD " + T.toFixed(1) + "s · FIRST FRAME ≡ LAST", 10, h - 38);
      },
    };
  },
  "First frame identical to last. Cacheable ambient beds that cost one cycle to render and run forever.",
);
