/* CANOPTICON — families F (data), G (network), H (timeline), N (audio). */
const DATA = [2, 1, 3, 2, 2, 1, 4, 3, 2, 5, 3, 2, 4, 6, 3, 2, 5, 4, 3, 6, 4, 2];
const YEARS = DATA.map((_, i) => 2003 + i);

/* ── F. DATA ────────────────────────────────────────── */
reg(
  "chart_cartesian",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    kind: { v: 0, lo: 0, hi: 3, int: 1 },
    reveal: { v: 1, lo: 0.05, hi: 1 },
    grid: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      // Real figures when the chain supplies them, the synthetic series
      // when it doesn't. `upstreamData` normalises both to {text,value}.
      const rows = upstreamData(upstream, DATA);
      const live = !!(upstream && upstream.data && upstream.data.length);
      const V = rows.map((r) => (Number.isFinite(r.value) ? r.value : 0));
      const K = Math.round(p.kind),
        px = 34,
        py = 18,
        pw = w - px - 18,
        // A live series prints its own labels under the bars, so the plot
        // gives up a gutter for them rather than stacking them onto the
        // footer line.
        ph = h - py - (live ? 46 : 30);
      const mx = Math.max(...V, 1);
      // A bar is EMPHASISED when it is the largest in the set, rather than
      // above a hardcoded 5. With real money on the axis, "≥ 5" made every
      // bar emphatic and the accent stopped meaning anything.
      const hot = (v) => v >= mx * 0.999;
      const span = Math.max(1, V.length - 1);
      if (p.grid > 0.02) {
        ctx.strokeStyle = "rgba(155,163,170," + p.grid * 0.16 + ")";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = py + ph - (i / 4) * ph;
          ctx.beginPath();
          ctx.moveTo(px, y);
          ctx.lineTo(px + pw, y);
          ctx.stroke();
          lab(ctx, axisTick((i / 4) * mx), 8, y - 4);
        }
      }
      const N = Math.max(1, Math.floor(V.length * p.reveal));
      if (K === 0) {
        const bw = pw / V.length;
        for (let i = 0; i < N; i++) {
          const bh = (V[i] / mx) * ph;
          ctx.fillStyle = hot(V[i]) ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.72)`;
          ctx.fillRect(px + i * bw + 1.5, py + ph - bh, bw - 3, bh);
          // The verbatim string under its own bar. This is the whole point
          // of carrying `text` through the payload: the reader sees the
          // figure the essay printed, not a rounded axis value.
          if (live) lab(ctx, rows[i].text, px + i * bw + 2, py + ph + 13);
        }
      } else if (K === 1) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const x = px + (i / span) * pw,
            y = py + ph - (V[i] / mx) * ph;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        for (let i = 0; i < N; i++) {
          const x = px + (i / span) * pw,
            y = py + ph - (V[i] / mx) * ph;
          ctx.fillStyle = hot(V[i]) ? EMB : BG;
          ctx.strokeStyle = hot(V[i]) ? EMB : INK;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, 6.3);
          ctx.fill();
          ctx.stroke();
        }
      } else if (K === 2) {
        ctx.beginPath();
        ctx.moveTo(px, py + ph);
        for (let i = 0; i < N; i++) {
          const x = px + (i / span) * pw,
            y = py + ph - (V[i] / mx) * ph;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(px + ((N - 1) / span) * pw, py + ph);
        ctx.closePath();
        ctx.fillStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.22)`;
        ctx.fill();
        ctx.strokeStyle = EMB;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const r = mulberry(5);
        for (let i = 0; i < N; i++) {
          const x = px + (i / span) * pw;
          // Dots are PROPORTIONAL, not one-per-unit. The original loop ran
          // `j < DATA[i]` over a synthetic array whose values were single
          // digits; handed $750,000,000 it would have tried to draw seven
          // hundred and fifty million circles.
          const dots = Math.max(1, Math.round((V[i] / mx) * 24));
          for (let j = 0; j < dots; j++) {
            ctx.fillStyle = `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.6)`;
            ctx.beginPath();
            ctx.arc(x + (r() - 0.5) * 7, py + ph - ((j + 0.5) / 24) * ph, 2.2, 0, 6.3);
            ctx.fill();
          }
        }
      }
      lab(
        ctx,
        ["BAR", "LINE", "AREA", "SCATTER"][K] +
          (live ? ` · ${V.length} FIGURES · VERBATIM LABELS` : " · RENEWALS BY YEAR 2003–2024"),
        10,
        h - 14,
      );
      // The signature says DATA → GEOMETRY and until now that was a lie:
      // the chart drew pixels and emitted nothing, so no downstream
      // GEOMETRY consumer could ever actually receive one. Sampling its own
      // marks makes the declared type real — and it means a bar chart can
      // be sheared, scattered or collapsed by the kinetic family like any
      // other point set. The figures ride along so a consumer that wants
      // the numbers rather than the shape still has them.
      return { data: rows, geometry: samplePixels(ctx.canvas, w, h, 5, 0.35) };
    },
  }),
  "Bar, line, area, scatter from one data input. The chart type is a parameter, so it can change mid-shot. Bars are labelled with the source strings, never with a reformatting of the parsed value.",
);

/** Format an in-progress count in the shape of the figure it is counting
 *  to, at `progress` through the roll-up. countLike("$282,345.84", 0.5)
 *  → "$141,172.92". Prefix,
 *  grouping, decimal places and any trailing unit word are taken from the
 *  source string, so an intermediate frame reads as the same KIND of
 *  quantity — and only the magnitude is in motion. */
function countLike(text, progress) {
  const m = /^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/.exec(text);
  if (!m) return text;
  const [, prefix, digits, suffix] = m;
  const dot = digits.indexOf(".");
  const places = dot < 0 ? 0 : digits.length - dot - 1;
  // Ease the PRINTED number, not the parsed magnitude — the suffix
  // ("million", "B", "+") carries the scale and stays put, so "$1.1
  // billion" counts through "$0.7 billion" rather than through 700000000.
  const target = Number.parseFloat(digits.replace(/,/g, ""));
  const [whole, frac] = (target * progress).toFixed(places).split(".");
  const body = digits.includes(",") ? Number(whole).toLocaleString("en-US") : whole;
  return prefix + body + (frac ? `.${frac}` : "") + suffix;
}

/** Axis ticks for a magnitude that may be nine digits long. The axis is the
 *  one place a rounded number is honest — it is a scale, not a finding —
 *  but it still has to fit. */
function axisTick(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + "M";
  if (v >= 1e4) return (v / 1e3).toFixed(0) + "K";
  return String(Math.round(v));
}

reg(
  "chart_radial",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    kind: { v: 0, lo: 0, hi: 2, int: 1 },
    inner: { v: 0.35, lo: 0.05, hi: 0.7 },
    spread: { v: 1, lo: 0.2, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const R = Math.min(w, h) * 0.42,
        r0 = R * p.inner,
        mx = Math.max(...DATA),
        K = Math.round(p.kind);
      DATA.forEach((v, i) => {
        const a0 = (i / DATA.length) * 6.283 * p.spread - 1.57,
          a1 = a0 + (6.283 / DATA.length) * p.spread * 0.86;
        const rr = r0 + (v / mx) * (R - r0);
        ctx.fillStyle = v >= 5 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.6)`;
        if (K === 0) {
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, rr, a0, a1);
          ctx.arc(w / 2, h / 2, r0, a1, a0, true);
          ctx.closePath();
          ctx.fill();
        } else if (K === 1) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(w / 2 + Math.cos(a0) * r0, h / 2 + Math.sin(a0) * r0);
          ctx.lineTo(w / 2 + Math.cos(a0) * rr, h / 2 + Math.sin(a0) * rr);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(
            w / 2 + Math.cos(a0) * (r0 + R) * 0.5,
            h / 2 + Math.sin(a0) * (r0 + R) * 0.5,
            (v / mx) * 11,
            0,
            6.3,
          );
          ctx.fill();
        }
      });
      ctx.strokeStyle = "rgba(155,163,170,.2)";
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r0, 0, 6.3);
      ctx.stroke();
      lab(ctx, ["RADIAL BAR", "ROSE SPOKES", "POLAR SCATTER"][K], 10, h - 14);
    },
  }),
  "Radial encoding reads as cyclical rather than progressive — right when the subject is a repeating cycle.",
);

reg(
  "chart_flow",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    bands: { v: 4, lo: 2, hi: 8, int: 1 },
    smooth: { v: 0.6, lo: 0, hi: 1 },
    offset: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const B = Math.round(p.bands),
        N = DATA.length,
        r = mulberry(17);
      const series = Array.from({ length: B }, (_, b) =>
        DATA.map((v, i) => v * (0.35 + r() * 1.3) * (1 + Math.sin(t * 0.35 + b + i * 0.3) * 0.14)),
      );
      const tot = DATA.map((_, i) => series.reduce((a, s) => a + s[i], 0)),
        mx = Math.max(...tot);
      const base = series.map(() => 0),
        acc = DATA.map(() => 0);
      series.forEach((s, b) => {
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * w;
          const off = (1 - p.offset) * 0 + (h * 0.5 - (tot[i] / mx) * h * 0.42);
          const y = off + (acc[i] / mx) * h * 0.84;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        for (let i = N - 1; i >= 0; i--) {
          const x = (i / (N - 1)) * w;
          const off = h * 0.5 - (tot[i] / mx) * h * 0.42;
          ctx.lineTo(x, off + ((acc[i] + s[i]) / mx) * h * 0.84);
        }
        ctx.closePath();
        ctx.fillStyle =
          b === B - 1 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.55)` : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + (0.1 + b * 0.09) + ")";
        ctx.fill();
        for (let i = 0; i < N; i++) acc[i] += s[i];
      });
      lab(ctx, B + " BANDS · STREAM", 10, h - 14);
    },
  }),
  "Stream and sankey-like flows. Composition over time, where the shape of the whole is the point.",
);

reg(
  "counter",
  "F · DATA",
  "DATA → ANIMATION",
  {
    target: { v: 41, lo: 1, hi: 400, int: 1 },
    rate: { v: 0.4, lo: 0.05, hi: 1 },
    format: { v: 0, lo: 0, hi: 2, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      // A real figure from upstream if there is one, the synthetic target
      // otherwise. Standalone in the Lab this behaves exactly as it did.
      const fig = upstream && upstream.data && upstream.data[0];

      // A real figure ARRIVES AND HOLDS. The synthetic demo loops forever,
      // which is right for a palette browser and wrong for an edit: at the
      // default rate the looping cycle only reaches 1 after seven seconds,
      // so inside a two-second shot the counter never once showed the
      // figure it was counting to. A shot that never lands is a shot that
      // shows the viewer a wrong number and then cuts away from it.
      const settleS = fig ? 0.6 + (1 - p.rate) * 2.2 : 0;
      const cyc = fig ? cl01(t / settleS) : cl01(((t * p.rate * 0.5) % 2.2) / 1.4);
      const e = 1 - Math.pow(1 - cyc, 4);
      let s;
      let caption;
      if (fig) {
        // THE LAST FRAME IS THE SUBSTRING, EXACTLY.
        //
        // Two wrong ways to do this, both tried. Counting `value` and
        // formatting the result turns $282,345.84 into $282,346 — the
        // compiler quietly correcting the finding. Easing each printed
        // digit independently is worse: it renders $272,344.74, which is
        // not on the way to anything, and which a viewer reads as a real
        // figure because it has the shape of one. A wrong number that
        // looks authoritative is the single worst thing this primitive
        // could put on screen.
        //
        // So the roll-up eases the magnitude and re-formats it into the
        // SOURCE STRING'S OWN SHAPE — same currency mark, same grouping,
        // same decimal places, same trailing "million" — and once the ease
        // has effectively landed the verbatim text is printed rather than
        // reconstructed. What the viewer holds at the end of the shot is
        // the essay's characters, not a rendering that agrees with them.
        s = e > 0.995 ? fig.text : countLike(fig.text, e);
        caption = fig.kind.toUpperCase();
      } else {
        const v = Math.round(p.target * e);
        const F = Math.round(p.format);
        s = F === 0 ? String(v) : F === 1 ? v.toLocaleString() : "$" + (v * 1000).toLocaleString();
        caption = "RENEWALS SINCE 2003";
      }

      ctx.font =
        "600 " + Math.min(h * 0.46, w / (s.length * 0.62)) + 'px "Space Grotesk",sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      ctx.fillText(s, w / 2, h * 0.46);
      ctx.font = '500 11px "JetBrains Mono",monospace';
      ctx.fillStyle = EMB;
      ctx.fillText(caption, w / 2, h * 0.78);
      ctx.textAlign = "left";
      lab(ctx, fig ? "VERBATIM · EASED" : "EASED · NOT LINEAR", 10, h - 14);
    },
  }),
  "An animated number. Trivial to build, and it carries more weight than a chart when the figure is the argument. Counts up through the digits of the figure as the essay printed it, so the last frame is the source string and not a rounding of it.",
);

reg(
  "small_multiples",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    cols: { v: 6, lo: 2, hi: 10, int: 1 },
    highlight: { v: 0.5, lo: 0, hi: 1 },
    reveal: { v: 1, lo: 0.05, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const C = Math.round(p.cols),
        R = Math.ceil(DATA.length / C);
      const cw = w / C,
        ch = (h - 16) / R,
        r = mulberry(23);
      DATA.forEach((v, i) => {
        if (i / DATA.length > p.reveal) return;
        const cx = (i % C) * cw,
          cy = Math.floor(i / C) * ch;
        ctx.strokeStyle = "rgba(155,163,170,.12)";
        ctx.strokeRect(cx + 3, cy + 3, cw - 6, ch - 6);
        const hot = v / Math.max(...DATA) > p.highlight;
        ctx.strokeStyle = hot ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.5)`;
        ctx.lineWidth = hot ? 1.6 : 1;
        ctx.beginPath();
        for (let j = 0; j < 9; j++) {
          const x = cx + 6 + (j / 8) * (cw - 12),
            y = cy + ch - 8 - ((j === 4 ? v : v * (0.4 + r() * 0.8)) / 6) * (ch - 16);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        lab(ctx, String(YEARS[i]), cx + 6, cy + 6);
      });
      lab(ctx, DATA.length + " PANELS · SHARED SCALE", 10, h - 12);
    },
  }),
  "A grid of the same chart. Comparison without a single overloaded frame.",
);

reg(
  "heatmap",
  "F · DATA",
  "DATA → IMAGE",
  {
    cols: { v: 12, lo: 4, hi: 26, int: 1 },
    contrast: { v: 0.5, lo: 0.1, hi: 1 },
    gap: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(51);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const C = Math.round(p.cols),
          R = Math.max(3, Math.round((C * h) / w));
        const cw = w / C,
          chh = h / R,
          g = p.gap * Math.min(cw, chh) * 0.3;
        for (let y = 0; y < R; y++)
          for (let x = 0; x < C; x++) {
            let v = fbm(n, x * 0.4, y * 0.4 + t * 0.05, 2, 0.5) * 0.5 + 0.5;
            v = cl01((v - 0.5) * (1 + p.contrast * 3) + 0.5);
            ctx.fillStyle =
              v > 0.72 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},` + v + ")" : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + v * 0.55 + ")";
            ctx.fillRect(x * cw + g / 2, y * chh + g / 2, cw - g, chh - g);
          }
        lab(ctx, C + "×" + R + " MATRIX", 10, h - 14);
      },
    };
  },
  "Matrix and calendar views. Density across two axes, which is usually where the anomaly hides.",
);

reg(
  "data_to_particles",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    perUnit: { v: 0.4, lo: 0.05, hi: 1 },
    gather: { v: 0.6, lo: 0, hi: 1 },
    jitter: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => {
    let ps = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const per = Math.round(6 + p.perUnit * 90),
          tot = DATA.reduce((a, b) => a + b, 0) * per;
        if (tot !== N) {
          N = tot;
          const r = mulberry(71);
          ps = [];
          DATA.forEach((v, i) => {
            for (let j = 0; j < v * per; j++) ps.push({ x: r() * w, y: r() * h, col: i, k: r() });
          });
        }
        bg(ctx, w, h, 0.3);
        const cw = w / DATA.length;
        for (const q of ps) {
          const tx = q.col * cw + cw * 0.5 + (q.k - 0.5) * cw * 0.8,
            ty = h * 0.9 - q.k * h * 0.72;
          q.x += (q.x * (1 - p.gather) + tx * p.gather - q.x) * 0.06 + (q.k - 0.5) * p.jitter * 1.4;
          q.y +=
            (q.y * (1 - p.gather) + ty * p.gather - q.y) * 0.06 +
            Math.sin(t + q.k * 9) * p.jitter * 0.7;
          ctx.fillStyle = DATA[q.col] >= 5 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.6)` : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.45)`;
          ctx.fillRect(q.x, q.y, 1.4, 1.4);
        }
        lab(ctx, N.toLocaleString() + " PARTICLES · ONE PER UNIT", 10, h - 14);
      },
    };
  },
  "One particle per unit counted. A population stops being a bar and becomes a quantity you can watch move.",
);

reg(
  "data_to_field",
  "F · DATA",
  "DATA → FIELD",
  {
    influence: { v: 0.5, lo: 0.1, hi: 1 },
    resolution: { v: 16, lo: 8, hi: 40, int: 1 },
    show: { v: 0, lo: 0, hi: 1, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      const R = Math.round(p.resolution),
        C = Math.round((R * w) / h);
      const gap = w / C;
      // THE NUMBERS IT WAS HANDED, not the module's stand-in array. It
      // declares DATA on its input and read a global — the input half of
      // the same contract the output half was failing.
      const figs = upstream && upstream.data;
      const src =
        Array.isArray(figs) && figs.length
          ? figs.map((d) => (typeof d === "number" ? d : Number(d.value) || 0))
          : DATA;
      // THE FIELD ITSELF, not only a picture of it. The angle per cell is
      // already computed below to draw the hatch; it was simply never
      // collected, so `DATA → FIELD` was a promise no consumer could
      // collect on. Same shape `flow_field` emits, so the two are
      // interchangeable upstream of anything that reads a vector field.
      const ang = new Float32Array(C * R);
      for (let y = 0; y < R; y++)
        for (let x = 0; x < C; x++) {
          const u = (x / C) * src.length,
            i = Math.floor(u),
            f = u - i;
          const v = (src[i] || 0) * (1 - f) + (src[i + 1] || 0) * f;
          const a = (v / 6) * Math.PI * 2 * p.influence + t * 0.3;
          ang[y * C + x] = a;
          const px = x * gap + gap / 2,
            py = y * (h / R) + h / R / 2;
          if (p.show < 0.5) {
            ctx.strokeStyle = "rgba(155,163,170," + (0.2 + v / 8) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - Math.cos(a) * gap * 0.35, py - Math.sin(a) * gap * 0.35);
            ctx.lineTo(px + Math.cos(a) * gap * 0.35, py + Math.sin(a) * gap * 0.35);
            ctx.stroke();
          } else {
            ctx.fillStyle =
              v > 4 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},` + v / 8 + ")" : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + v / 14 + ")";
            ctx.fillRect(x * gap, y * (h / R), gap, h / R);
          }
        }
      lab(ctx, "DATA AS DISPLACEMENT SOURCE", 10, h - 14);
      return { field: { kind: "vector", cols: C, rows: R, cell: gap, w, h, ang } };
    },
  }),
  "Data used as a field rather than a chart. Everything downstream — particles, type, geometry — inherits the numbers, because the field is emitted rather than merely drawn.",
);

reg(
  "data_to_type",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    mode: { v: 0, lo: 0, hi: 1, int: 1 },
    weightScale: { v: 0.5, lo: 0, hi: 1 },
    packing: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const mx = Math.max(...DATA);
      if (p.mode < 0.5) {
        let x = 10,
          y = h * 0.24;
        DATA.forEach((v, i) => {
          const s = 8 + (v / mx) * h * 0.3 * (1 + p.weightScale);
          ctx.font = (v >= 5 ? "700 " : "400 ") + s + 'px "Space Grotesk",sans-serif';
          const wd = ctx.measureText(String(YEARS[i])).width + 6 * p.packing;
          if (x + wd > w - 10) {
            x = 10;
            y += h * 0.3;
          }
          ctx.fillStyle = v >= 5 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + (0.35 + (v / mx) * 0.6) + ")";
          ctx.fillText(String(YEARS[i]), x, y);
          x += wd;
        });
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        DATA.forEach((v, i) => {
          const s = 6 + (v / mx) * 22 * (1 + p.weightScale);
          ctx.font = "600 " + s + 'px "Space Grotesk",sans-serif';
          const a = (i / DATA.length) * 6.283 - 1.57,
            R = Math.min(w, h) * (0.18 + (v / mx) * 0.26) * p.packing * 1.6;
          ctx.fillStyle = v >= 5 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.7)`;
          ctx.fillText(String(v), w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R);
        });
        ctx.textAlign = "left";
      }
      lab(ctx, "FIGURES AS TYPOGRAPHIC COMPOSITION", 10, h - 14);
    },
  }),
  "Numbers set as type rather than plotted. Reading the figure and seeing the magnitude become one act.",
);

reg(
  "chart_morph",
  "F · DATA",
  "DATA → ANIMATION",
  { rate: { v: 0.35, lo: 0.1, hi: 1 }, hold: { v: 0.4, lo: 0, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const px = 24,
        py = 18,
        pw = w - 42,
        ph = h - py - 28,
        mx = Math.max(...DATA);
      const raw = (t * p.rate * 0.5) % 2,
        c = cl01((raw > 1 ? 2 - raw : raw) * (1 + p.hold) - p.hold * 0.5);
      const bw = pw / DATA.length;
      ctx.beginPath();
      DATA.forEach((v, i) => {
        const bh = (v / mx) * ph,
          x = px + i * bw,
          y = py + ph - bh;
        ctx.fillStyle =
          v >= 5 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},` + (1 - c) + ")" : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + 0.7 * (1 - c) + ")";
        ctx.fillRect(x + 1.5, y, bw - 3, bh);
      });
      ctx.strokeStyle = `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + c + ")";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      DATA.forEach((v, i) => {
        const x = px + i * bw + bw / 2,
          y = py + ph - (v / mx) * ph;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      lab(
        ctx,
        "BAR → LINE " + (c * 100).toFixed(0) + "% · THE TRANSITION IS THE ARGUMENT",
        10,
        h - 12,
      );
    },
  }),
  "A bar chart becoming a line chart is a claim about what the data is — discrete events or a trend.",
);

reg(
  "annotated_callout",
  "F · DATA",
  "DATA → GEOMETRY",
  {
    index: { v: 12, lo: 0, hi: 21, int: 1 },
    style: { v: 0, lo: 0, hi: 2, int: 1 },
    reveal: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const px = 30,
        py = 26,
        pw = w - 48,
        ph = h - py - 32,
        mx = Math.max(...DATA),
        bw = pw / DATA.length;
      DATA.forEach((v, i) => {
        const bh = (v / mx) * ph;
        ctx.fillStyle = i === Math.round(p.index) ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.28)`;
        ctx.fillRect(px + i * bw + 1.5, py + ph - bh, bw - 3, bh);
      });
      const i = Math.round(p.index),
        v = DATA[i],
        x = px + i * bw + bw / 2,
        y = py + ph - (v / mx) * ph;
      const S = Math.round(p.style),
        r = cl01(p.reveal);
      ctx.strokeStyle = EMB;
      ctx.lineWidth = 1;
      if (S === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y - 6 - 34 * r);
        ctx.lineTo(x + 70 * r, y - 40 * r);
        ctx.stroke();
      } else if (S === 1) {
        ctx.beginPath();
        ctx.arc(x, y, (12 + v) * r, 0, 6.283 * r);
        ctx.stroke();
      } else {
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + pw * r, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (r > 0.6) {
        ctx.font = '500 11px "JetBrains Mono",monospace';
        ctx.fillStyle = INK;
        ctx.fillText(
          YEARS[i] + " · " + v + " RENEWALS",
          Math.min(w - 140, x + 8),
          Math.max(16, y - 46),
        );
      }
      lab(ctx, ["LEADER LINE", "CIRCLE", "BASELINE"][S] + " CALLOUT", 10, h - 12);
    },
  }),
  "A label landing on one data point. The difference between showing data and making a claim about it.",
);

/* ── G. NETWORK & RELATIONAL ────────────────────────── */
function seedGraph(n, seed) {
  const r = mulberry(seed),
    nodes = Array.from({ length: n }, (_, i) => ({
      i,
      x: r(),
      y: r(),
      vx: 0,
      vy: 0,
      g: Math.floor(r() * 4),
    }));
  const edges = [];
  for (let i = 1; i < n; i++) {
    const j = Math.floor(r() * i);
    edges.push([i, j]);
  }
  for (let k = 0; k < n * 0.4; k++) {
    const a = Math.floor(r() * n),
      b = Math.floor(r() * n);
    if (a !== b) edges.push([a, b]);
  }
  return { nodes, edges };
}
reg(
  "force_layout",
  "G · NETWORK",
  "DATA → GEOMETRY",
  {
    nodes: { v: 0.35, lo: 0.05, hi: 1 },
    charge: { v: 0.5, lo: 0.1, hi: 1 },
    link: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => {
    let G = null,
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(12 + p.nodes * 110);
        if (n !== N) {
          N = n;
          G = seedGraph(n, 404);
          G.nodes.forEach((q) => {
            q.x *= w;
            q.y *= h;
          });
        }
        bg(ctx, w, h);
        for (let s = 0; s < 2; s++) {
          for (const [a, b] of G.edges) {
            const A = G.nodes[a],
              B = G.nodes[b];
            const dx = B.x - A.x,
              dy = B.y - A.y,
              d = Math.max(1, Math.hypot(dx, dy)),
              f = (d - 60) * 0.0016 * p.link * 3;
            A.vx += (dx / d) * f;
            A.vy += (dy / d) * f;
            B.vx -= (dx / d) * f;
            B.vy -= (dy / d) * f;
          }
          for (let i = 0; i < G.nodes.length; i++)
            for (let j = i + 1; j < G.nodes.length; j++) {
              const A = G.nodes[i],
                B = G.nodes[j],
                dx = B.x - A.x,
                dy = B.y - A.y,
                d2 = Math.max(80, dx * dx + dy * dy);
              const f = (p.charge * 180) / d2;
              A.vx -= dx * f * 0.02;
              A.vy -= dy * f * 0.02;
              B.vx += dx * f * 0.02;
              B.vy += dy * f * 0.02;
            }
          for (const q of G.nodes) {
            q.vx += (w / 2 - q.x) * 0.0012;
            q.vy += (h / 2 - q.y) * 0.0012;
            q.vx *= 0.86;
            q.vy *= 0.86;
            q.x += q.vx;
            q.y += q.vy;
          }
        }
        ctx.strokeStyle = "rgba(155,163,170,.22)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const [a, b] of G.edges) {
          ctx.moveTo(G.nodes[a].x, G.nodes[a].y);
          ctx.lineTo(G.nodes[b].x, G.nodes[b].y);
        }
        ctx.stroke();
        G.nodes.forEach((q) => {
          ctx.fillStyle = q.g === 0 ? EMB : q.g === 1 ? COOL : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.8)`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 2.4, 0, 6.3);
          ctx.fill();
        });
        lab(ctx, N + " NODES · " + G.edges.length + " EDGES · SEEDED randomSource", 10, h - 14);
      },
    };
  },
  "d3-force is deterministic when its random source is seeded. Precompute headless, serialise positions, then render.",
  1,
);

reg(
  "hierarchy_layout",
  "G · NETWORK",
  "DATA → GEOMETRY",
  {
    kind: { v: 0, lo: 0, hi: 2, int: 1 },
    depth: { v: 4, lo: 2, hi: 6, int: 1 },
    split: { v: 0.5, lo: 0.2, hi: 0.8 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const K = Math.round(p.kind),
        D = Math.round(p.depth),
        r = mulberry(31);
      if (K === 0) {
        (function tree(x, y, wd, d) {
          if (d <= 0) return;
          const n = 2 + (r() > 0.6 ? 1 : 0),
            step = wd / n;
          for (let i = 0; i < n; i++) {
            const cx = x - wd / 2 + step * (i + 0.5),
              cy = y + h / (D + 1);
            ctx.strokeStyle = "rgba(155,163,170,.4)";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(cx, cy);
            ctx.stroke();
            ctx.fillStyle = d === 1 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.8)`;
            ctx.beginPath();
            ctx.arc(cx, cy, 2.4, 0, 6.3);
            ctx.fill();
            tree(cx, cy, step * 0.92, d - 1);
          }
        })(w / 2, 14, w * 0.94, D);
      } else if (K === 1) {
        (function tm(x, y, wd, hh, d, vert) {
          if (d <= 0 || wd < 3 || hh < 3) {
            ctx.strokeStyle = "rgba(155,163,170,.35)";
            ctx.strokeRect(x, y, wd, hh);
            if (r() > 0.72) {
              ctx.fillStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.35)`;
              ctx.fillRect(x, y, wd, hh);
            }
            return;
          }
          const f = p.split * (0.6 + r() * 0.8);
          if (vert) {
            tm(x, y, wd * f, hh, d - 1, !vert);
            tm(x + wd * f, y, wd * (1 - f), hh, d - 1, !vert);
          } else {
            tm(x, y, wd, hh * f, d - 1, !vert);
            tm(x, y + hh * f, wd, hh * (1 - f), d - 1, !vert);
          }
        })(2, 2, w - 4, h - 18, D + 2, true);
      } else {
        (function pack(x, y, R, d) {
          if (d <= 0 || R < 3) return;
          ctx.strokeStyle = `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},` + (0.12 + d * 0.1) + ")";
          ctx.beginPath();
          ctx.arc(x, y, R, 0, 6.3);
          ctx.stroke();
          const n = 2 + Math.floor(r() * 2);
          for (let i = 0; i < n; i++) {
            const a = r() * 6.283,
              rr = R * p.split;
            pack(x + Math.cos(a) * (R - rr), y + Math.sin(a) * (R - rr), rr, d - 1);
          }
        })(w / 2, h / 2, Math.min(w, h) * 0.44, D);
      }
      lab(ctx, ["TREE", "TREEMAP", "CIRCLE PACK"][K] + " · DEPTH " + D, 10, h - 12);
    },
  }),
  "Tree, treemap, pack, partition. Containment and subordination — the shape of an organisation.",
  1,
);

reg(
  "graph_reveal",
  "G · NETWORK",
  "GEOMETRY → ANIMATION",
  {
    rate: { v: 0.4, lo: 0.05, hi: 1 },
    order: { v: 0, lo: 0, hi: 1, int: 1 },
    nodes: { v: 0.3, lo: 0.05, hi: 1 },
  },
  (p) => {
    let G = null,
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(10 + p.nodes * 70);
        if (n !== N) {
          N = n;
          G = seedGraph(n, 77);
        }
        bg(ctx, w, h);
        const cyc = (t * p.rate * 0.35) % 1.5,
          pr = cl01(cyc);
        const R = Math.min(w, h) * 0.42;
        const pos = G.nodes.map((q, i) => [
          w / 2 + Math.cos((i / n) * 6.283) * R * (0.5 + q.x * 0.5),
          h / 2 + Math.sin((i / n) * 6.283) * R * (0.5 + q.y * 0.5) * 0.9,
        ]);
        const shown = Math.floor(pr * n);
        G.edges.forEach(([a, b]) => {
          const ord = p.order < 0.5 ? Math.max(a, b) : Math.min(a, b);
          if (ord > shown) return;
          ctx.strokeStyle = "rgba(155,163,170,.3)";
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(pos[a][0], pos[a][1]);
          ctx.lineTo(pos[b][0], pos[b][1]);
          ctx.stroke();
        });
        pos.forEach(([x, y], i) => {
          if (i > shown) return;
          const fresh = i > shown - 3;
          ctx.fillStyle = fresh ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.8)`;
          ctx.beginPath();
          ctx.arc(x, y, fresh ? 4 : 2.4, 0, 6.3);
          ctx.fill();
        });
        lab(ctx, "STAGED · " + shown + " / " + n + " NODES", 10, h - 14);
      },
    };
  },
  "Staged appearance of nodes and edges. A network arriving in order is an explanation; all at once is a wall.",
  1,
);

reg(
  "topology_shift",
  "G · NETWORK",
  "GEOMETRY → ANIMATION",
  {
    rate: { v: 0.3, lo: 0.05, hi: 1 },
    nodes: { v: 0.35, lo: 0.05, hi: 1 },
    contrast: { v: 0.6, lo: 0, hi: 1 },
  },
  (p) => {
    let G = null,
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(14 + p.nodes * 70);
        if (n !== N) {
          N = n;
          G = seedGraph(n, 123);
        }
        bg(ctx, w, h);
        const c = Math.sin(t * p.rate * 1.4) * 0.5 + 0.5,
          R = Math.min(w, h) * 0.42;
        const pos = G.nodes.map((q, i) => {
          const ax = w / 2 + Math.cos((i / n) * 6.283) * R,
            ay = h / 2 + Math.sin((i / n) * 6.283) * R;
          const cols = Math.ceil(Math.sqrt(n));
          const bx = (((i % cols) + 0.5) / cols) * w,
            by = ((Math.floor(i / cols) + 0.5) / Math.ceil(n / cols)) * h;
          return [ax + (bx - ax) * c, ay + (by - ay) * c];
        });
        ctx.strokeStyle = "rgba(155,163,170," + (0.14 + p.contrast * 0.2) + ")";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        G.edges.forEach(([a, b]) => {
          ctx.moveTo(pos[a][0], pos[a][1]);
          ctx.lineTo(pos[b][0], pos[b][1]);
        });
        ctx.stroke();
        pos.forEach(([x, y], i) => {
          ctx.fillStyle = i % 7 ? `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.85)` : EMB;
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, 6.3);
          ctx.fill();
        });
        lab(ctx, "RING → GRID · " + (c * 100).toFixed(0) + "% REORGANISED", 10, h - 14);
      },
    };
  },
  "A network reorganising itself. Same actors, different structure — dramatically the most useful network move.",
  1,
);

reg(
  "sankey_flow",
  "G · NETWORK",
  "DATA → GEOMETRY",
  {
    nodes: { v: 4, lo: 2, hi: 7, int: 1 },
    thickness: { v: 0.5, lo: 0.1, hi: 1 },
    curve: { v: 0.6, lo: 0, hi: 1 },
    route: { s: "" },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);

      // A ROUTE, when the prose gave one. "Ottawa → IRCC → Hotels → Housed"
      // is not decoration and it is not a random weave: it is a claim about
      // where money goes, and the whole argument of a shell-game essay is
      // that two such routes have the same endpoint. Drawing it as one
      // labelled channel per stage is the only version of this primitive
      // that can be WRONG about the essay, which is what makes it worth
      // drawing at all.
      const stops = (p.route || "")
        .split(/→|->|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (stops.length >= 2) {
        const fig = upstream && upstream.data && upstream.data[0];
        const colw = w / stops.length;
        const y = h * 0.5;
        // One channel, thinning slightly at each hop — administration takes
        // a cut of attention, never of the total. The endpoint is the point.
        for (let c = 0; c < stops.length - 1; c++) {
          const th = (10 + 22 * p.thickness) * (1 - c * 0.06);
          ctx.strokeStyle = c === stops.length - 2 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.42)` : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.16)`;
          ctx.lineWidth = th;
          ctx.beginPath();
          ctx.moveTo(colw * c + colw * 0.5, y);
          ctx.bezierCurveTo(
            colw * c + colw * (0.5 + p.curve),
            y - 16 * p.curve,
            colw * (c + 1) + colw * (0.5 - p.curve),
            y + 16 * p.curve,
            colw * (c + 1) + colw * 0.5,
            y,
          );
          ctx.stroke();
        }
        stops.forEach((s, i) => {
          ctx.fillStyle = INK;
          ctx.fillRect(colw * i + colw * 0.5 - 2, y - 34, 4, 68);
          ctx.save();
          ctx.translate(colw * i + colw * 0.5 + 8, y - 40);
          ctx.font = '500 10px "JetBrains Mono",monospace';
          ctx.fillStyle = i === stops.length - 1 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.8)`;
          ctx.fillText(s.toUpperCase().slice(0, 22), 0, 0);
          ctx.restore();
        });
        lab(ctx, (fig ? fig.text + " · " : "") + stops.length + " STAGES · ROUTED", 10, h - 12);
        return { geometry: samplePixels(ctx.canvas, w, h, 5, 0.3) };
      }

      const L = Math.round(p.nodes),
        r = mulberry(88);
      const cols = 3,
        colw = w / cols;
      for (let c = 0; c < cols - 1; c++)
        for (let i = 0; i < L; i++)
          for (let j = 0; j < L; j++) {
            if (r() > 0.42) continue;
            const th = (2 + r() * 16) * p.thickness;
            const y0 = ((i + 0.5) / L) * h,
              y1 = ((j + 0.5) / L) * h;
            ctx.strokeStyle = th > 10 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.3)` : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.13)`;
            ctx.lineWidth = th;
            ctx.beginPath();
            ctx.moveTo(colw * c + 18, y0);
            ctx.bezierCurveTo(
              colw * c + 18 + colw * p.curve,
              y0,
              colw * (c + 1) + 18 - colw * p.curve,
              y1,
              colw * (c + 1) + 18,
              y1,
            );
            ctx.stroke();
          }
      for (let c = 0; c < cols; c++)
        for (let i = 0; i < L; i++) {
          ctx.fillStyle = INK;
          ctx.fillRect(colw * c + 14, ((i + 0.5) / L) * h - 14, 4, 28);
        }
      lab(ctx, "FLOW BETWEEN " + L + " CATEGORIES · 3 STAGES", 10, h - 12);
    },
  }),
  "Quantity moving between categories. Money, people, authority — where it enters and where it ends up. Given a route lifted from the prose it draws that route, labelled; given none it weaves an unnamed flow.",
  1,
);

/* ── H. TIMELINE ────────────────────────────────────── */
reg(
  "timeline_radial",
  "H · TIMELINE",
  "DATA → GEOMETRY",
  {
    span: { v: 0.85, lo: 0.3, hi: 1 },
    marks: { v: 0.6, lo: 0.1, hi: 1 },
    labels: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const R = Math.min(w, h) * 0.4,
        N = Math.round(6 + p.marks * 40);
      ctx.strokeStyle = "rgba(155,163,170,.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, -1.57, -1.57 + 6.283 * p.span);
      ctx.stroke();
      const r = mulberry(9);
      for (let i = 0; i < N; i++) {
        const a = -1.57 + (i / (N - 1)) * 6.283 * p.span,
          big = r() > 0.76;
        const r0 = R - (big ? 13 : 5),
          r1 = R + (big ? 7 : 2);
        ctx.strokeStyle = big ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.65)`;
        ctx.lineWidth = big ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
        ctx.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
        ctx.stroke();
        if (big && p.labels > 0.5) {
          ctx.save();
          ctx.translate(w / 2 + Math.cos(a) * (R + 18), h / 2 + Math.sin(a) * (R + 18));
          ctx.rotate(a + 1.57);
          ctx.font = "7px JetBrains Mono";
          ctx.fillStyle = MUT;
          ctx.textAlign = "center";
          ctx.fillText(String(2003 + i), 0, 0);
          ctx.restore();
          ctx.textAlign = "left";
        }
      }
      lab(ctx, "RADIAL · " + (p.span * 100).toFixed(0) + "% OF CIRCLE", 10, h - 12);
    },
  }),
  "The same timeline, wrapped. Radial reads as a cycle closing; linear reads as a line continuing.",
);

reg(
  "roadmap_build",
  "H · TIMELINE",
  "DATA → ANIMATION",
  {
    rate: { v: 0.35, lo: 0.05, hi: 1 },
    lanes: { v: 3, lo: 1, hi: 5, int: 1 },
    density: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const L = Math.round(p.lanes),
        r = mulberry(42),
        pr = cl01((t * p.rate * 0.3) % 1.4);
      for (let l = 0; l < L; l++) {
        const y = ((l + 0.7) / (L + 0.4)) * h;
        ctx.strokeStyle = "rgba(155,163,170,.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(w - 14, y);
        ctx.stroke();
        const n = Math.round(2 + p.density * 6);
        for (let i = 0; i < n; i++) {
          const x0 = 20 + r() * (w - 120),
            wd = 30 + r() * 90;
          if (x0 / w > pr) continue;
          const vis = Math.min(wd, pr * w - x0);
          ctx.fillStyle = l === 0 ? `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.7)` : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.4)`;
          ctx.fillRect(x0, y - 6, Math.max(2, vis), 12);
        }
      }
      lab(ctx, "LEFT-TO-RIGHT CONSTRUCTION · " + (pr * 100).toFixed(0) + "%", 10, h - 12);
    },
  }),
  "Bars constructing left to right. Plans, phases, overlapping mandates — a schedule that assembles as it is described.",
);

/* ── N. AUDIO ───────────────────────────────────────── */
reg(
  "audio_analyze",
  "N · AUDIO",
  "AUDIO → ANIMATION",
  {
    smoothing: { v: 0.5, lo: 0, hi: 1 },
    bands: { v: 32, lo: 8, hi: 64, int: 1 },
    drive: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => {
    let sm = [],
      n = vnoise(808);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const B = Math.round(p.bands);
        if (sm.length !== B) sm = new Array(B).fill(0);
        const speech =
          Math.max(0, Math.sin(t * 2.1) * 0.5 + 0.5 - 0.12) * (Math.sin(t * 7.3) * 0.2 + 0.8);
        for (let i = 0; i < B; i++) {
          const raw = Math.abs(fbm(n, i * 0.3, t * 2.4, 2, 0.6)) * 2 * speech * (1 - (i / B) * 0.6);
          sm[i] = sm[i] * (p.smoothing * 0.85) + raw * (1 - p.smoothing * 0.85);
        }
        const bw = w / B;
        sm.forEach((v, i) => {
          const bh = cl01(v) * h * 0.55;
          ctx.fillStyle = v > 0.4 ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.5)`;
          ctx.fillRect(i * bw + 0.5, h * 0.66 - bh, bw - 1, bh);
        });
        const amp = cl01((sm.reduce((a, b) => a + b, 0) / B) * 3);
        const R = 14 + amp * p.drive * h * 0.24;
        ctx.strokeStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},` + (0.3 + amp * 0.6) + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.84, R, 0, 6.3);
        ctx.stroke();
        lab(ctx, "NARRATION AMPLITUDE → VISUAL PARAMETER · " + amp.toFixed(2), 10, h - 12);
      },
    };
  },
  "The loop closed the other way: the narration drives the image. Cheap, and immediately makes a film feel scored.",
);

reg(
  "synth_bed",
  "N · AUDIO",
  "— → AUDIO",
  {
    density: { v: 0.4, lo: 0.05, hi: 1 },
    pitch: { v: 0.4, lo: 0, hi: 1 },
    motion: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const V = Math.round(2 + p.density * 7);
      for (let i = 0; i < V; i++) {
        const f = (0.4 + p.pitch * 3) * (1 + i * 0.5),
          ph = i * 1.7;
        ctx.strokeStyle = i === 0 ? EMB : "rgba(155,163,170," + (0.5 - i * 0.05) + ")";
        ctx.lineWidth = i === 0 ? 1.6 : 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y =
            h / 2 +
            Math.sin(x * 0.02 * f + t * (1 + p.motion * 3) + ph) * h * (0.3 / (1 + i * 0.5));
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      lab(ctx, V + " VOICES · TONE.JS Offline() · NO REAL-TIME DEPENDENCY", 10, h - 12);
    },
  }),
  "An ambient tone bed rendered offline, so it is as reproducible as the picture.",
  1,
);

reg(
  "sonify",
  "N · AUDIO",
  "DATA → AUDIO",
  {
    mapping: { v: 0, lo: 0, hi: 2, int: 1 },
    rate: { v: 0.4, lo: 0.1, hi: 1 },
    range: { v: 0.6, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const M = Math.round(p.mapping),
        mx = Math.max(...DATA);
      const head = (t * p.rate * 0.4) % 1,
        idx = Math.floor(head * DATA.length);
      const bw = w / DATA.length;
      DATA.forEach((v, i) => {
        const on = i === idx;
        const y =
          M === 0
            ? h - (v / mx) * h * p.range * 0.9
            : M === 1
              ? h / 2
              : h - (i / DATA.length) * h * 0.8;
        const r = M === 1 ? 4 + v * 2.2 * p.range : 3.4;
        ctx.fillStyle = on ? EMB : `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},.4)`;
        ctx.beginPath();
        ctx.arc(
          i * bw + bw / 2,
          M === 1 ? h / 2 + (v - 3) * 11 * p.range : y,
          on ? r * 1.5 : r,
          0,
          6.3,
        );
        ctx.fill();
        if (on) {
          ctx.strokeStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.4)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(i * bw + bw / 2, M === 1 ? h / 2 + (v - 3) * 11 * p.range : y, r * 3.2, 0, 6.3);
          ctx.stroke();
        }
      });
      ctx.strokeStyle = `rgba(${ACCENT_RGB[0]},${ACCENT_RGB[1]},${ACCENT_RGB[2]},.55)`;
      ctx.beginPath();
      ctx.moveTo(head * w, 0);
      ctx.lineTo(head * w, h);
      ctx.stroke();
      lab(ctx, ["PITCH", "PAN", "RHYTHM"][M] + " MAPPING · " + DATA.length + " EVENTS", 10, h - 12);
    },
  }),
  "Data mapped to pitch, pan or rhythm. Phase 1 — but the interface is defined now so the hook exists.",
  1,
);
