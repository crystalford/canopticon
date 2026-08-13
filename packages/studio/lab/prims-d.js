/* CANOPTICON — families I (documents), L (3D), M (compositing), P (interface), Q (cut), R (maps). */

/* ── I. DOCUMENTS ───────────────────────────────────── */
function paper(ctx, w, h, age) {
  ctx.fillStyle = "rgb(" + (238 - age * 44) + "," + (235 - age * 48) + "," + (226 - age * 52) + ")";
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 1.15);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(40,28,14," + age * 0.5 + ")");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function lines(ctx, x, y, wd, n, r, c) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = c || "rgba(40,34,28," + (0.3 + r() * 0.3) + ")";
    ctx.fillRect(x, y + i * 8, wd * (0.55 + r() * 0.45), 2.4);
  }
}

reg(
  "document_layout",
  "I · DOCUMENTS",
  "— → ARTIFACT",
  {
    kind: { v: 0, lo: 0, hi: 3, int: 1 },
    columns: { v: 2, lo: 1, hi: 3, int: 1 },
    age: { v: 0.35, lo: 0, hi: 1 },
    // The headline. It was the string "THE REGISTER", so twenty-one
    // GROUNDED scenes of a real film were the same masthead over the same
    // grey lines — the rung that carries a documentary's most literal
    // register had exactly one look.
    heading: { s: "THE REGISTER" },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      paper(ctx, w, h, p.age);
      const r = mulberry(15),
        K = Math.round(p.kind),
        C = Math.round(p.columns);
      const pad = 18;
      ctx.fillStyle = "rgba(24,20,16,.9)";
      if (K === 0) {
        // Shrink the masthead to the width it has. A headline clipped at
        // the frame edge reads as broken software, not as a crop.
        let hs = Math.round(h * 0.11);
        ctx.font = "700 " + hs + 'px "Space Grotesk",sans-serif';
        let g2 = 20;
        while (g2-- > 0 && ctx.measureText(p.heading).width > w - pad * 2 && hs > 8) {
          hs *= 0.9;
          ctx.font = "700 " + Math.round(hs) + 'px "Space Grotesk",sans-serif';
        }
        // Baseline set explicitly and the rule placed BELOW the type's
        // real depth. With a default alphabetic baseline the headline hung
        // past a rule at a fixed fraction of the height, so every GROUNDED
        // scene printed its own headline struck through.
        ctx.textBaseline = "alphabetic";
        const hy = h * 0.055 + hs;
        ctx.fillText(p.heading, pad, hy);
        ctx.fillRect(pad, hy + hs * 0.28, w - pad * 2, 1.4);
        const cw = (w - pad * 2 - (C - 1) * 12) / C;
        const top = hy + hs * 0.28 + 12;
        for (let c = 0; c < C; c++)
          lines(ctx, pad + c * (cw + 12), top, cw, Math.floor((h - top - 10) / 8), r);
      } else if (K === 1) {
        ctx.font = '600 11px "JetBrains Mono",monospace';
        ctx.fillText("MEMORANDUM", pad, 20);
        ctx.fillRect(pad, 26, w - pad * 2, 1);
        ["TO", "FROM", "DATE", "RE"].forEach((f, i) => {
          ctx.font = "9px JetBrains Mono";
          ctx.fillStyle = "rgba(24,20,16,.6)";
          ctx.fillText(f, pad, 44 + i * 13);
          ctx.fillStyle = "rgba(24,20,16,.85)";
          ctx.fillRect(pad + 34, 40 + i * 13, 60 + r() * 90, 2.2);
        });
        lines(ctx, pad, h * 0.46, w - pad * 2, Math.floor((h * 0.46) / 8), r);
      } else if (K === 2) {
        const rows = Math.floor((h - 30) / 16),
          cols = 4;
        for (let i = 0; i < rows; i++)
          for (let c = 0; c < cols; c++) {
            ctx.fillStyle =
              i === 0 ? "rgba(24,20,16,.85)" : "rgba(40,34,28," + (0.3 + r() * 0.35) + ")";
            ctx.fillRect(
              pad + c * ((w - pad * 2) / cols),
              22 + i * 16,
              ((w - pad * 2) / cols) * (0.4 + r() * 0.42),
              i === 0 ? 3 : 2.2,
            );
          }
        ctx.strokeStyle = "rgba(40,34,28,.3)";
        for (let i = 0; i < rows; i++) {
          ctx.beginPath();
          ctx.moveTo(pad, 32 + i * 16);
          ctx.lineTo(w - pad, 32 + i * 16);
          ctx.stroke();
        }
      } else {
        lines(ctx, pad, 26, w * 0.62 - pad, Math.floor((h - 40) / 8), r);
        ctx.fillStyle = "rgba(40,34,28,.18)";
        ctx.fillRect(w * 0.66, 26, w - pad - w * 0.66, h - 52);
        ctx.font = "8px JetBrains Mono";
        ctx.fillStyle = "rgba(24,20,16,.55)";
        for (let i = 0; i < Math.floor((h - 60) / 12); i++)
          ctx.fillText("note " + (i + 1), w * 0.68, 42 + i * 12);
      }
      lab(ctx, ["NEWSPAPER", "MEMO", "TABLE", "MARGINALIA"][K], 10, h - 14, "rgba(24,20,16,.5)");
    },
  }),
  "Columns, headers, tables, marginalia. A generated document can reorganise itself; a scan cannot.",
);

reg(
  "annotation",
  "I · DOCUMENTS",
  "— → GEOMETRY",
  {
    kind: { v: 0, lo: 0, hi: 3, int: 1 },
    roughness: { v: 0.5, lo: 0, hi: 1 },
    draw: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      paper(ctx, w, h, 0.3);
      const r = mulberry(29);
      lines(ctx, 20, 26, w - 40, Math.floor((h - 46) / 8), r);
      const K = Math.round(p.kind),
        rr = mulberry(7),
        pr = cl01(p.draw);
      ctx.strokeStyle = "rgba(178,58,38,.85)";
      ctx.lineWidth = 1.6 + p.roughness * 1.4;
      ctx.lineCap = "round";
      const jx = () => (rr() - 0.5) * p.roughness * 7;
      if (K === 0) {
        ctx.beginPath();
        for (let i = 0; i <= 40 * pr; i++) {
          const a = (i / 40) * 6.283;
          ctx.lineTo(
            w * 0.5 + Math.cos(a) * w * 0.24 + jx(),
            h * 0.5 + Math.sin(a) * h * 0.19 + jx(),
          );
        }
        ctx.stroke();
      } else if (K === 1) {
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          for (let i = 0; i <= 16 * pr; i++)
            ctx.lineTo(24 + (i / 16) * (w - 90), h * (0.34 + l * 0.16) + jx());
          ctx.stroke();
        }
      } else if (K === 2) {
        ctx.beginPath();
        const x0 = 26,
          y0 = h * 0.3,
          x1 = w - 40,
          y1 = h * 0.66;
        ctx.moveTo(x0 + jx(), y0 + jx());
        ctx.lineTo(x0 + (x1 - x0) * pr + jx(), y0 + jx());
        ctx.lineTo(x0 + (x1 - x0) * pr + jx(), y0 + (y1 - y0) * pr + jx());
        if (pr > 0.8) {
          ctx.lineTo(x0 + jx(), y1 + jx());
          ctx.closePath();
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        const ex = w * 0.72,
          ey = h * 0.36;
        ctx.moveTo(w * 0.16, h * 0.74);
        ctx.quadraticCurveTo(
          w * 0.4,
          h * 0.5,
          w * 0.16 + (ex - w * 0.16) * pr,
          h * 0.74 + (ey - h * 0.74) * pr,
        );
        ctx.stroke();
        if (pr > 0.85) {
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 11, ey + 3);
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 5, ey + 11);
          ctx.stroke();
        }
      }
      lab(
        ctx,
        ["CIRCLE", "UNDERLINE", "BOX", "ARROW"][K] + " · SEEDED ROUGHNESS",
        10,
        h - 14,
        "rgba(24,20,16,.5)",
      );
    },
  }),
  "Hand-drawn marks with seeded roughness. The gesture of a reader, which no stock graphic supplies.",
);

reg(
  "redaction",
  "I · DOCUMENTS",
  "— → ANIMATION",
  {
    coverage: { v: 0.35, lo: 0, hi: 1 },
    mode: { v: 0, lo: 0, hi: 2, int: 1 },
    rate: { v: 0.4, lo: 0.05, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      paper(ctx, w, h, 0.28);
      const r = mulberry(61),
        M = Math.round(p.mode);
      const rows = Math.floor((h - 40) / 9);
      const pr = cl01((t * p.rate * 0.4) % 1.6);
      for (let i = 0; i < rows; i++) {
        const y = 26 + i * 9,
          lw = (w - 40) * (0.55 + r() * 0.45);
        ctx.fillStyle = "rgba(40,34,28,.42)";
        ctx.fillRect(20, y, lw, 2.4);
        if (r() < p.coverage) {
          const bx = 20 + r() * lw * 0.4,
            bw = lw * (0.2 + r() * 0.5);
          const grow = M === 0 ? 1 : M === 1 ? pr : cl01((pr * rows - i) / 2);
          ctx.fillStyle = "#14120f";
          ctx.fillRect(bx, y - 3, Math.max(0, bw * cl01(grow)), 8);
        }
      }
      lab(
        ctx,
        ["STATIC", "SWEEP", "CASCADE"][M] + " · " + (p.coverage * 100).toFixed(0) + "% COVERAGE",
        10,
        h - 14,
        "rgba(24,20,16,.5)",
      );
    },
  }),
  "A blackout bar that moves is a different statement from one that was always there.",
);

reg(
  "camera_move",
  "I · DOCUMENTS",
  "ARTIFACT → ANIMATION",
  {
    kind: { v: 0, lo: 0, hi: 2, int: 1 },
    rate: { v: 0.3, lo: 0.05, hi: 1 },
    amount: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      const K = Math.round(p.kind);
      // MOVE THE CAMERA OVER WHAT IT WAS HANDED.
      //
      // It declared "ARTIFACT → ANIMATION" and then drew its own document —
      // the same "ORDER 03-114" every time — so `document_surface →
      // document_layout → camera_move`, the GROUNDED rung and the most-used
      // chain in a real film, ended with a camera pushing across a document
      // that had nothing to do with the two stages before it. Sixteen
      // scenes of the IHAP film used that seam.
      let doc;
      if (upstream && upstream.canvas) {
        // Oversampled so a push has somewhere to go: a camera move over an
        // image exactly the size of the frame can only crop.
        doc = document.createElement("canvas");
        doc.width = Math.round(w * 1.7);
        doc.height = Math.round(h * 1.7);
        doc.getContext("2d").drawImage(upstream.canvas, 0, 0, doc.width, doc.height);
      } else {
        doc = document.createElement("canvas");
        doc.width = w * 1.7;
        doc.height = h * 1.7;
        const o = doc.getContext("2d");
        paper(o, doc.width, doc.height, 0.4);
        const r = mulberry(3);
        o.fillStyle = "rgba(24,20,16,.9)";
        o.font = '700 26px "Space Grotesk",sans-serif';
        o.fillText("ORDER 03-114", 26, 44);
        lines(o, 26, 64, doc.width - 52, Math.floor((doc.height - 90) / 9), r);
        o.fillStyle = "#14120f";
        o.fillRect(26, doc.height * 0.42, doc.width * 0.42, 11);
      }
      const ph = (t * p.rate * 0.22) % 1,
        e = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      ctx.save();
      if (K === 0) {
        const s = 1 + e * p.amount * 0.5;
        ctx.translate(w / 2, h / 2);
        ctx.scale(s, s);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(doc, 0, 0, w, h);
      } else if (K === 1) {
        ctx.drawImage(
          doc,
          -e * p.amount * (doc.width - w),
          -h * 0.06,
          doc.width,
          doc.height * (h / doc.height) * 1.6,
        );
      } else {
        ctx.drawImage(doc, 0, 0, w, h);
        ctx.restore();
        ctx.save();
        const cw = w * (0.24 + e * p.amount * 0.6),
          chh = h * (0.2 + e * p.amount * 0.6);
        ctx.fillStyle = "rgba(8,9,10,.72)";
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(w / 2 - cw / 2, h / 2 - chh / 2, cw, chh);
        ctx.clip();
        ctx.drawImage(doc, 0, 0, w, h);
        ctx.restore();
        ctx.strokeStyle = EMB;
        ctx.lineWidth = 1;
        ctx.strokeRect(w / 2 - cw / 2, h / 2 - chh / 2, cw, chh);
      }
      ctx.restore();
      lab(ctx, ["PUSH", "PAN", "CROP REVEAL"][K], 10, h - 14);
    },
  }),
  "Push, pan, crop-reveal across a generated artifact. Attention directed without cutting.",
);

reg(
  "comparison_matrix",
  "I · DOCUMENTS",
  "DATA → ANIMATION",
  {
    rows: { v: 5, lo: 2, hi: 9, int: 1 },
    cols: { v: 4, lo: 2, hi: 6, int: 1 },
    fill: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const R = Math.round(p.rows),
        C = Math.round(p.cols),
        r = mulberry(44);
      const x0 = 76,
        y0 = 28,
        cw = (w - x0 - 14) / C,
        chh = (h - y0 - 22) / R,
        pr = cl01(p.fill);
      ctx.strokeStyle = "rgba(155,163,170,.18)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= R; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, y0 + i * chh);
        ctx.lineTo(w - 14, y0 + i * chh);
        ctx.stroke();
      }
      for (let j = 0; j <= C; j++) {
        ctx.beginPath();
        ctx.moveTo(x0 + j * cw, y0);
        ctx.lineTo(x0 + j * cw, h - 22);
        ctx.stroke();
      }
      for (let j = 0; j < C; j++) lab(ctx, "v" + (j + 1), x0 + j * cw + 7, y0 - 13);
      for (let i = 0; i < R; i++) lab(ctx, "CRIT " + (i + 1), 8, y0 + i * chh + chh / 2 - 4);
      let k = 0;
      const tot = R * C;
      for (let i = 0; i < R; i++)
        for (let j = 0; j < C; j++) {
          k++;
          if (k / tot > pr) continue;
          const yes = r() > 0.42;
          const cx = x0 + j * cw + cw / 2,
            cy = y0 + i * chh + chh / 2;
          if (yes) {
            ctx.strokeStyle = EMB;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy);
            ctx.lineTo(cx - 1, cy + 4);
            ctx.lineTo(cx + 5, cy - 4);
            ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(155,163,170,.35)";
            ctx.fillRect(cx - 4, cy - 1, 8, 2);
          }
        }
      lab(ctx, "GRID FILLING · " + (pr * 100).toFixed(0) + "%", 10, h - 10);
    },
  }),
  "A matrix that fills in cell by cell. Comparison delivered at the pace of the narration.",
);

/* ── L. 3D / SPATIAL ────────────────────────────────── */
function proj(x, y, z, w, h, cam) {
  const d = 3.2 / (3.2 + z * cam);
  return [w / 2 + x * d * Math.min(w, h) * 0.42, h / 2 + y * d * Math.min(w, h) * 0.42, d];
}
reg(
  "point_cloud",
  "L · 3D",
  "— → GEOMETRY",
  {
    count: { v: 0.4, lo: 0.05, hi: 1 },
    spin: { v: 0.4, lo: 0, hi: 1 },
    form: { v: 0, lo: 0, hi: 2, int: 1 },
  },
  (p) => {
    let pts = [],
      N = 0,
      F = -1;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(200 + p.count * 3400),
          f = Math.round(p.form);
        if (n !== N || f !== F) {
          N = n;
          F = f;
          const r = mulberry(202);
          pts = Array.from({ length: n }, () => {
            if (f === 0) {
              const a = r() * 6.283,
                b = Math.acos(2 * r() - 1);
              return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
            }
            if (f === 1) return [(r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2];
            const a = r() * 6.283,
              rr = Math.sqrt(r());
            return [Math.cos(a) * rr, (r() - 0.5) * 0.3, Math.sin(a) * rr];
          });
        }
        bg(ctx, w, h);
        const A = t * p.spin * 0.5;
        for (const [x, y, z] of pts) {
          const X = x * Math.cos(A) - z * Math.sin(A),
            Z = x * Math.sin(A) + z * Math.cos(A);
          const [px, py, d] = proj(X, y, Z, w, h, 0.6);
          ctx.fillStyle =
            d > 1.05 ? "rgba(216,98,74," + (d - 0.6) + ")" : "rgba(238,241,243," + d * 0.5 + ")";
          ctx.fillRect(px, py, d * 1.4, d * 1.4);
        }
        lab(
          ctx,
          ["SPHERE", "CUBE", "DISC"][f] + " · " + N.toLocaleString() + " POINTS",
          10,
          h - 14,
        );
      },
    };
  },
  "Depth without footage. A point cloud is a form the audience reads as scanned rather than drawn.",
  1,
);

reg(
  "wireframe",
  "L · 3D",
  "— → GEOMETRY",
  {
    form: { v: 0, lo: 0, hi: 2, int: 1 },
    spin: { v: 0.4, lo: 0, hi: 1 },
    subdiv: { v: 6, lo: 3, hi: 14, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const A = t * p.spin * 0.6,
        S = Math.round(p.subdiv),
        F = Math.round(p.form);
      const seg = [];
      if (F === 0) {
        const c = [
          [-1, -1, -1],
          [1, -1, -1],
          [1, 1, -1],
          [-1, 1, -1],
          [-1, -1, 1],
          [1, -1, 1],
          [1, 1, 1],
          [-1, 1, 1],
        ];
        [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
          [4, 5],
          [5, 6],
          [6, 7],
          [7, 4],
          [0, 4],
          [1, 5],
          [2, 6],
          [3, 7],
        ].forEach(([a, b]) => seg.push([c[a], c[b]]));
      } else if (F === 1) {
        for (let i = 0; i < S; i++)
          for (let j = 0; j < S; j++) {
            const f = (u, v) => [
              Math.sin(v * Math.PI) * Math.cos(u * 6.283),
              Math.cos(v * Math.PI),
              Math.sin(v * Math.PI) * Math.sin(u * 6.283),
            ];
            seg.push([f(i / S, j / S), f((i + 1) / S, j / S)]);
            seg.push([f(i / S, j / S), f(i / S, (j + 1) / S)]);
          }
      } else {
        for (let i = 0; i < S; i++)
          for (let j = 0; j < S; j++) {
            const f = (u, v) => [
              (u - 0.5) * 2,
              Math.sin(u * 7 + t) * Math.cos(v * 6) * 0.4,
              (v - 0.5) * 2,
            ];
            seg.push([f(i / S, j / S), f((i + 1) / S, j / S)]);
            seg.push([f(i / S, j / S), f(i / S, (j + 1) / S)]);
          }
      }
      ctx.lineWidth = 0.9;
      for (const [a, b] of seg) {
        const rot = (v) => [
          v[0] * Math.cos(A) - v[2] * Math.sin(A),
          v[1],
          v[0] * Math.sin(A) + v[2] * Math.cos(A),
        ];
        const A2 = rot(a),
          B2 = rot(b);
        const [x1, y1, d1] = proj(A2[0], A2[1], A2[2], w, h, 0.55),
          [x2, y2] = proj(B2[0], B2[1], B2[2], w, h, 0.55);
        ctx.strokeStyle = "rgba(238,241,243," + cl01(d1 - 0.45) + ")";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      lab(ctx, ["BOX", "SPHERE", "SURFACE"][F] + " · " + seg.length + " EDGES", 10, h - 14);
    },
  }),
  "Wireframe reads as diagram, not render — exactly the register a documentary wants for a physical system.",
  1,
);

reg(
  "extrude",
  "L · 3D",
  "GEOMETRY → GEOMETRY",
  { text: { s: "1997" }, depth: { v: 0.45, lo: 0.05, hi: 1 }, spin: { v: 0.3, lo: 0, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const A = Math.sin(t * p.spin * 0.8) * 0.5,
        D = Math.round(6 + p.depth * 40);
      const s = Math.min(h * 0.5, w / (p.text.length * 0.62));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = D; i >= 0; i--) {
        const k = i / D;
        ctx.font = "700 " + s + 'px "Space Grotesk",sans-serif';
        ctx.fillStyle = i
          ? "rgba(" + (40 + k * 30) + "," + (44 + k * 30) + "," + (50 + k * 32) + ",1)"
          : INK;
        ctx.fillText(
          p.text,
          w / 2 + Math.sin(A) * i * 1.6,
          h / 2 + Math.cos(A) * i * 0.5 - i * 0.25,
        );
      }
      ctx.textAlign = "left";
      lab(ctx, "GLYPH PATHS EXTRUDED · " + D + " STEPS", 10, h - 14);
    },
  }),
  "Glyph paths pushed into depth. Validates that the renderer interface accepts a spatial backend at all.",
);

reg(
  "camera_3d",
  "L · 3D",
  "— → ANIMATION",
  {
    orbit: { v: 0.4, lo: 0, hi: 1 },
    dolly: { v: 0.4, lo: 0, hi: 1 },
    grid: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const A = t * p.orbit * 0.5,
        Z = 0.4 + Math.sin(t * p.dolly * 0.7) * 0.3 * p.dolly;
      if (p.grid > 0.5) {
        ctx.strokeStyle = "rgba(155,163,170,.2)";
        ctx.lineWidth = 0.8;
        for (let i = -5; i <= 5; i++) {
          const a = [i / 5, 0.6, -1],
            b = [i / 5, 0.6, 1];
          const rot = (v) => [
            v[0] * Math.cos(A) - v[2] * Math.sin(A),
            v[1],
            v[0] * Math.sin(A) + v[2] * Math.cos(A),
          ];
          const A2 = rot(a),
            B2 = rot(b),
            C2 = rot([-1, 0.6, i / 5]),
            D2 = rot([1, 0.6, i / 5]);
          const [x1, y1] = proj(A2[0], A2[1], A2[2], w, h, Z + 0.4),
            [x2, y2] = proj(B2[0], B2[1], B2[2], w, h, Z + 0.4);
          const [x3, y3] = proj(C2[0], C2[1], C2[2], w, h, Z + 0.4),
            [x4, y4] = proj(D2[0], D2[1], D2[2], w, h, Z + 0.4);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.moveTo(x3, y3);
          ctx.lineTo(x4, y4);
          ctx.stroke();
        }
      }
      const r = mulberry(6);
      for (let i = 0; i < 24; i++) {
        const x = (r() - 0.5) * 1.8,
          z = (r() - 0.5) * 1.8,
          hh = 0.2 + r() * 0.9;
        const rot = (v) => [
          v[0] * Math.cos(A) - v[2] * Math.sin(A),
          v[1],
          v[0] * Math.sin(A) + v[2] * Math.cos(A),
        ];
        const b = rot([x, 0.6, z]),
          tp = rot([x, 0.6 - hh, z]);
        const [x1, y1, d] = proj(b[0], b[1], b[2], w, h, Z + 0.4),
          [x2, y2] = proj(tp[0], tp[1], tp[2], w, h, Z + 0.4);
        ctx.strokeStyle = i % 6 ? "rgba(238,241,243," + cl01(d * 0.7) + ")" : EMB;
        ctx.lineWidth = 1.4 + d;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      lab(ctx, "ORBIT " + (A % 6.283).toFixed(2) + " · DOLLY " + Z.toFixed(2), 10, h - 14);
    },
  }),
  "A camera is an animation output, so it can be driven by the same curves as everything else.",
  1,
);

reg(
  "exploded_view",
  "L · 3D",
  "GEOMETRY → ANIMATION",
  {
    layers: { v: 5, lo: 2, hi: 9, int: 1 },
    separation: { v: 0.5, lo: 0, hi: 1 },
    tilt: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.layers);
      const sep = p.separation * (Math.sin(t * 0.5) * 0.35 + 0.65);
      for (let i = N - 1; i >= 0; i--) {
        const y = h / 2 + (i - (N - 1) / 2) * h * 0.09 * (1 + sep * 3.4);
        const wd = w * 0.5,
          hh = h * 0.14 * p.tilt * 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, y - hh / 2);
        ctx.lineTo(w / 2 + wd / 2, y);
        ctx.lineTo(w / 2, y + hh / 2);
        ctx.lineTo(w / 2 - wd / 2, y);
        ctx.closePath();
        ctx.fillStyle =
          i === 0 ? "rgba(216,98,74,.30)" : "rgba(238,241,243," + (0.05 + i * 0.02) + ")";
        ctx.fill();
        ctx.strokeStyle = i === 0 ? EMB : "rgba(238,241,243,.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (sep > 0.15) {
          ctx.strokeStyle = "rgba(155,163,170,.25)";
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(w / 2 + wd / 2, y);
          ctx.lineTo(w * 0.9, y);
          ctx.stroke();
          ctx.setLineDash([]);
          lab(ctx, "LAYER " + (i + 1), w * 0.9 + 5, y - 4);
        }
      }
      lab(ctx, "STACKED SYSTEM · SEPARATION " + sep.toFixed(2), 10, h - 14);
    },
  }),
  "Pulling a stacked system apart. Jurisdictions, protocol layers, decision tiers — structure made spatial.",
  1,
);

reg(
  "layer_peel",
  "L · 3D",
  "GEOMETRY → ANIMATION",
  {
    layers: { v: 4, lo: 2, hi: 7, int: 1 },
    rate: { v: 0.3, lo: 0.05, hi: 1 },
    curl: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.layers),
        cyc = (t * p.rate * 0.3) % 1.4;
      for (let i = N - 1; i >= 0; i--) {
        const pr = cl01(cyc * N - (N - 1 - i));
        const x0 = w * 0.16,
          y0 = h * 0.14,
          wd = w * 0.68,
          hh = h * 0.72;
        ctx.save();
        ctx.translate(x0, y0);
        if (pr > 0) {
          ctx.translate(wd * pr * 0.9, 0);
          ctx.rotate(-pr * p.curl * 0.5);
        }
        const g = ctx.createLinearGradient(0, 0, wd, 0);
        const base = i === 0 ? [216, 98, 74] : [210, 214, 218];
        g.addColorStop(0, "rgba(" + base.join(",") + "," + (0.1 + i * 0.05) + ")");
        g.addColorStop(1, "rgba(" + base.join(",") + "," + (0.24 + i * 0.05) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, wd, hh);
        ctx.strokeStyle = i === 0 ? EMB : "rgba(238,241,243,.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, wd, hh);
        ctx.restore();
      }
      lab(ctx, N + " LAYERS PEELING", 10, h - 14);
    },
  }),
  "Sheets lifting off one another. Sequential reveal that keeps the whole stack visible.",
  1,
);

/* ── M. COMPOSITING ─────────────────────────────────── */
function layerA(w, h, t, n) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const o = c.getContext("2d");
  o.fillStyle = "#000";
  o.fillRect(0, 0, w, h);
  const cell = 6;
  for (let y = 0; y < h; y += cell)
    for (let x = 0; x < w; x += cell) {
      const v = fbm(n, (x / w) * 4, (y / h) * 4 + t * 0.08, 3, 0.6) * 0.5 + 0.5;
      o.fillStyle = "rgba(216,98,74," + cl01(v) + ")";
      o.fillRect(x, y, cell, cell);
    }
  return c;
}
function layerB(w, h, t) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const o = c.getContext("2d");
  o.fillStyle = "#000";
  o.fillRect(0, 0, w, h);
  o.strokeStyle = "rgba(238,241,243,.85)";
  o.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    o.beginPath();
    o.arc(w / 2, h / 2, (i / 16) * Math.min(w, h) * 0.6 + Math.sin(t + i * 0.4) * 7, 0, 6.3);
    o.stroke();
  }
  o.fillStyle = "#eef1f3";
  o.font = "700 " + Math.round(h * 0.3) + 'px "Space Grotesk",sans-serif';
  o.textAlign = "center";
  o.textBaseline = "middle";
  o.fillText("90 DAYS", w / 2, h / 2);
  return c;
}
reg(
  "blend",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  { mode: { v: 0, lo: 0, hi: 5, int: 1 }, opacity: { v: 1, lo: 0, hi: 1 } },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const MODES = ["multiply", "screen", "difference", "overlay", "lighter", "hard-light"],
          M = Math.round(p.mode);
        ctx.drawImage(layerA(w, h, t, n), 0, 0);
        ctx.globalCompositeOperation = MODES[M];
        ctx.globalAlpha = p.opacity;
        ctx.drawImage(layerB(w, h, t), 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        lab(ctx, MODES[M].toUpperCase() + " · α " + p.opacity.toFixed(2), 10, h - 14);
      },
    };
  },
  "Compositing is a creative primitive, not plumbing. The blend mode changes what the layering means.",
);

reg(
  "mask_apply",
  "M · COMPOSITING",
  "MASK + IMAGE → IMAGE",
  {
    shape: { v: 0, lo: 0, hi: 2, int: 1 },
    feather: { v: 0.3, lo: 0, hi: 1 },
    size: { v: 0.6, lo: 0.2, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const o = off.getContext("2d");
        o.drawImage(layerA(w, h, t, n), 0, 0);
        o.globalCompositeOperation = "destination-in";
        const S = Math.round(p.shape),
          R = Math.min(w, h) * 0.45 * p.size;
        if (S === 0) {
          const g = o.createRadialGradient(w / 2, h / 2, R * (1 - p.feather), w / 2, h / 2, R);
          g.addColorStop(0, "#fff");
          g.addColorStop(1, "rgba(255,255,255,0)");
          o.fillStyle = g;
          o.fillRect(0, 0, w, h);
        } else if (S === 1) {
          const g = o.createLinearGradient(0, h / 2 - R, 0, h / 2 + R);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(0.5, "#fff");
          g.addColorStop(1, "rgba(255,255,255,0)");
          o.fillStyle = g;
          o.fillRect(0, 0, w, h);
        } else {
          o.font = "700 " + Math.round(h * 0.42 * p.size * 1.6) + 'px "Space Grotesk",sans-serif';
          o.textAlign = "center";
          o.textBaseline = "middle";
          o.fillStyle = "#fff";
          o.fillText("HELD", w / 2, h / 2);
        }
        ctx.drawImage(off, 0, 0);
        lab(ctx, ["RADIAL", "BAND", "TYPE"][S] + " MASK", 10, h - 14);
      },
    };
  },
  "Apply an alpha channel from anywhere in the graph — geometry, type, or another primitive entirely.",
);

reg(
  "blur",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  { radius: { v: 0.3, lo: 0, hi: 1 }, kind: { v: 0, lo: 0, hi: 2, int: 1 } },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t, upstream) {
        bg(ctx, w, h);
        const src = upstream?.canvas || layerB(w, h, t),
          K = Math.round(p.kind);
        const R = p.radius * 26;
        if (K === 0) {
          ctx.filter = "blur(" + R.toFixed(1) + "px)";
          ctx.drawImage(src, 0, 0);
          ctx.filter = "none";
        } else if (K === 1) {
          ctx.globalAlpha = 0.14;
          for (let i = 0; i < 10; i++) ctx.drawImage(src, i * R * 0.6 - R * 3, 0);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 0.13;
          for (let i = 0; i < 10; i++) {
            const s = 1 + i * R * 0.006;
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.scale(s, s);
            ctx.translate(-w / 2, -h / 2);
            ctx.drawImage(src, 0, 0);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
        lab(
          ctx,
          ["GAUSSIAN", "DIRECTIONAL", "RADIAL"][K] + " · " + R.toFixed(1) + "px",
          10,
          h - 14,
        );
      },
    };
  },
  "Three blurs with three different meanings: softness, speed, and attention.",
);

reg(
  "color_transform",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    mode: { v: 0, lo: 0, hi: 2, int: 1 },
    amount: { v: 0.7, lo: 0, hi: 1 },
    shift: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t, upstream) {
        bg(ctx, w, h);
        const src = upstream?.canvas || layerB(w, h, t),
          im = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h),
          c = 4,
          M = Math.round(p.mode);
        const PALS = [
          [
            [216, 98, 74],
            [13, 15, 17],
          ],
          [
            [111, 158, 196],
            [238, 241, 243],
          ],
          [
            [217, 164, 65],
            [24, 20, 16],
          ],
        ];
        const [hi, lo] = PALS[M];
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            const g = im.data[((y | 0) * w + (x | 0)) * 4] / 255,
              k = cl01(g + p.shift * 0.4 - 0.2);
            const r = lo[0] + (hi[0] - lo[0]) * k,
              gg = lo[1] + (hi[1] - lo[1]) * k,
              b = lo[2] + (hi[2] - lo[2]) * k;
            const mixed = [
              r * p.amount + g * 255 * (1 - p.amount),
              gg * p.amount + g * 255 * (1 - p.amount),
              b * p.amount + g * 255 * (1 - p.amount),
            ];
            ctx.fillStyle = "rgb(" + mixed.map((v) => v | 0).join(",") + ")";
            ctx.fillRect(x, y, c, c);
          }
        lab(ctx, ["EMBER DUOTONE", "COOL DUOTONE", "ARCHIVE DUOTONE"][M], 10, h - 14);
      },
    };
  },
  "Grade, duotone, palette map. One transform applied film-wide is most of what people call a look.",
);

reg(
  "split_screen",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    panes: { v: 2, lo: 2, hi: 5, int: 1 },
    orientation: { v: 0, lo: 0, hi: 1, int: 1 },
    gap: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const N = Math.round(p.panes),
          V = p.orientation < 0.5;
        const g = p.gap * 8;
        for (let i = 0; i < N; i++) {
          const pw = V ? (w - g * (N - 1)) / N : w,
            ph = V ? h : (h - g * (N - 1)) / N;
          const x = V ? i * (pw + g) : 0,
            y = V ? 0 : i * (ph + g);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, pw, ph);
          ctx.clip();
          ctx.drawImage(i % 2 ? layerA(w, h, t + i * 2, n) : layerB(w, h, t + i), x, y, pw, ph);
          ctx.restore();
          ctx.strokeStyle = "rgba(155,163,170,.2)";
          ctx.strokeRect(x, y, pw, ph);
        }
        lab(ctx, N + " PANES · " + (V ? "VERTICAL" : "HORIZONTAL"), 10, h - 14);
      },
    };
  },
  "Simultaneity. Two things being true at once is often the whole editorial point.",
);

reg(
  "nest",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    depth: { v: 3, lo: 1, hi: 5, int: 1 },
    scale: { v: 0.5, lo: 0.25, hi: 0.8 },
    rotate: { v: 0.2, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const D = Math.round(p.depth);
        (function rec(x, y, wd, hh, d) {
          ctx.save();
          ctx.translate(x + wd / 2, y + hh / 2);
          ctx.rotate((p.rotate - 0.0) * 0.1 * d + Math.sin(t * 0.3) * p.rotate * 0.06);
          ctx.translate(-wd / 2, -hh / 2);
          ctx.drawImage(d % 2 ? layerA(w, h, t + d, n) : layerB(w, h, t + d), 0, 0, wd, hh);
          ctx.strokeStyle = d === D ? EMB : "rgba(238,241,243,.35)";
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, wd, hh);
          if (d > 1)
            rec(
              (wd * (1 - p.scale)) / 2,
              (hh * (1 - p.scale)) / 2,
              wd * p.scale,
              hh * p.scale,
              d - 1,
            );
          ctx.restore();
        })(0, 0, w, h, D);
        lab(ctx, "DEPTH " + D + " · A COMPOSITION AS A LAYER", 10, h - 14);
      },
    };
  },
  "What makes the palette recursive rather than flat: any composition can be a layer inside another.",
);

reg(
  "parallax_layers",
  "M · COMPOSITING",
  "IMAGE → ANIMATION",
  {
    layers: { v: 4, lo: 2, hi: 7, int: 1 },
    depth: { v: 0.5, lo: 0.1, hi: 1 },
    rate: { v: 0.3, lo: 0.05, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, upstream) {
      bg(ctx, w, h);
      const N = Math.round(p.layers);
      const src = upstream && upstream.canvas;

      // PLANE THE IMAGE IT WAS GIVEN.
      //
      // It declared "IMAGE → ANIMATION" and drew its own drifting blocks,
      // so anything upstream was erased — thirteen scenes of the IHAP film
      // ended `particle_trail → parallax_layers`, throwing away the trail
      // and replacing it with rectangles.
      //
      // Depth from differential motion needs planes that differ, and one
      // flat image has no depth in it. So each plane is the SAME image at a
      // different scale and rate, drifting at its own speed: the far plane
      // large and faint and slow, the near one tight and bright and quick.
      // That is a real parallax of the material rather than an invented
      // scene beside it.
      if (src) {
        for (let i = 0; i < N; i++) {
          const k = (i + 1) / N;
          const scale = 1 + (1 - k) * 0.55 * p.depth;
          const dw = w * scale;
          const dh = h * scale;
          const drift = ((t * p.rate * 22 * k * p.depth) % (dw * 0.3)) - dw * 0.15;
          ctx.globalAlpha = i === N - 1 ? 0.9 : 0.1 + k * 0.22;
          ctx.drawImage(src, (w - dw) / 2 + drift, (h - dh) / 2 - (1 - k) * 8, dw, dh);
        }
        ctx.globalAlpha = 1;
        lab(ctx, N + " PLANES OF THE UPSTREAM IMAGE · DIFFERENTIAL RATE", 10, h - 14);
        return;
      }

      const r = mulberry(17);
      for (let i = 0; i < N; i++) {
        const k = (i + 1) / N,
          off = ((t * p.rate * 30 * k * p.depth) % (w * 1.4)) - w * 0.2;
        ctx.fillStyle =
          i === N - 1 ? "rgba(216,98,74,.55)" : "rgba(238,241,243," + (0.06 + k * 0.16) + ")";
        for (let j = 0; j < 7; j++) {
          const bx = off + j * w * 0.22 + r() * 40,
            bw = 18 + r() * 60 * k,
            bh = h * (0.12 + r() * 0.5) * k;
          ctx.fillRect((bx % (w * 1.3)) - w * 0.15, h - bh, bw, bh);
        }
      }
      lab(ctx, N + " PLANES · NO UPSTREAM IMAGE", 10, h - 14);
    },
  }),
  "Depth from differential motion, applied to the image it is handed: the same frame at several scales and rates, so the parallax is of the material rather than an invented scene beside it.",
  1,
);

reg(
  "tile",
  "M · COMPOSITING",
  "IMAGE → IMAGE",
  {
    count: { v: 4, lo: 2, hi: 10, int: 1 },
    mirror: { v: 1, lo: 0, hi: 1 },
    rotate: { v: 0, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const N = Math.round(p.count);
        const src = layerB(w, h, t),
          cw = w / N,
          chh = h / N;
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            ctx.save();
            ctx.translate(x * cw + cw / 2, y * chh + chh / 2);
            if (p.mirror > 0.5) ctx.scale(x % 2 ? -1 : 1, y % 2 ? -1 : 1);
            if (p.rotate > 0.02) ctx.rotate(((x + y) % 4) * 1.5708 * p.rotate);
            ctx.drawImage(src, -cw / 2, -chh / 2, cw, chh);
            ctx.restore();
          }
        ctx.strokeStyle = "rgba(8,9,10,.5)";
        for (let i = 1; i < N; i++) {
          ctx.beginPath();
          ctx.moveTo(i * cw, 0);
          ctx.lineTo(i * cw, h);
          ctx.moveTo(0, i * chh);
          ctx.lineTo(w, i * chh);
          ctx.stroke();
        }
        lab(ctx, N + "×" + N + " · MIRRORED " + (p.mirror > 0.5 ? "ON" : "OFF"), 10, h - 14);
      },
    };
  },
  "Spatial repetition. Scale, multiplicity, the same thing happening everywhere at once.",
);

/* ── P. INTERFACE EMULATION ─────────────────────────── */
reg(
  "device_frame",
  "P · INTERFACE",
  "— → ARTIFACT",
  {
    kind: { v: 0, lo: 0, hi: 2, int: 1 },
    scale: { v: 0.8, lo: 0.4, hi: 1 },
    content: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const K = Math.round(p.kind),
        r = mulberry(21);
      const dims = [
          [0.34, 0.86],
          [0.86, 0.6],
          [0.6, 0.78],
        ][K],
        dw = w * dims[0] * p.scale,
        dh = h * dims[1] * p.scale;
      const x = (w - dw) / 2,
        y = (h - dh) / 2;
      ctx.fillStyle = "#191d21";
      ctx.strokeStyle = "#3a4045";
      ctx.lineWidth = 1.4;
      const rad = K === 0 ? dw * 0.1 : 6;
      ctx.beginPath();
      ctx.roundRect(x, y, dw, dh, rad);
      ctx.fill();
      ctx.stroke();
      const ix = x + 7,
        iy = y + (K === 0 ? 18 : K === 1 ? 16 : 10),
        iw = dw - 14,
        ih = dh - (K === 0 ? 32 : K === 1 ? 24 : 20);
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(ix, iy, iw, ih);
      if (K === 0) {
        ctx.fillStyle = "#3a4045";
        ctx.fillRect(x + dw / 2 - 16, y + 8, 32, 4);
      }
      if (K === 1) {
        [
          ["#d8624a", 12],
          ["#69717a", 24],
          ["#69717a", 36],
        ].forEach(([c, ox]) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x + ox, y + 9, 3, 0, 6.3);
          ctx.fill();
        });
      }
      const n = Math.round(3 + p.content * 11);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle =
          i === 0 ? "rgba(216,98,74,.8)" : "rgba(238,241,243," + (0.14 + r() * 0.3) + ")";
        ctx.fillRect(
          ix + 8,
          iy + 12 + (i * (ih - 20)) / n,
          iw * (0.3 + r() * 0.6) - 16,
          i === 0 ? 7 : 4,
        );
      }
      lab(
        ctx,
        ["PHONE", "DESKTOP", "TABLET"][K] + " CHROME · CONSTRUCTED, NOT CAPTURED",
        10,
        h - 14,
      );
    },
  }),
  "Screen-recording a platform is a rights, quality and reproducibility problem. Constructing it from code is not.",
);

reg(
  "browser_chrome",
  "P · INTERFACE",
  "— → ARTIFACT",
  {
    url: { s: "archive.gov/orders/03-114" },
    tabs: { v: 3, lo: 1, hi: 6, int: 1 },
    scroll: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const T = Math.round(p.tabs),
        r = mulberry(33);
      ctx.fillStyle = "#191d21";
      ctx.fillRect(0, 0, w, 54);
      const tw = Math.min(140, (w - 20) / T);
      for (let i = 0; i < T; i++) {
        ctx.fillStyle = i === 0 ? "#0d0f11" : "#131619";
        ctx.fillRect(8 + i * (tw + 2), 6, tw, 22);
        ctx.fillStyle = i === 0 ? "rgba(238,241,243,.75)" : "rgba(155,163,170,.4)";
        ctx.fillRect(14 + i * (tw + 2), 15, tw * (0.4 + r() * 0.4), 3);
      }
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(8, 32, w - 16, 17);
      ctx.font = "9px JetBrains Mono";
      ctx.fillStyle = "#9ba3aa";
      ctx.fillText(p.url, 16, 44);
      ctx.fillStyle = "#6fbf8f";
      ctx.fillRect(w - 22, 38, 5, 5);
      const sc = p.scroll * 260;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 54, w, h - 54);
      ctx.clip();
      ctx.translate(0, -sc);
      ctx.fillStyle = "#eef1f3";
      ctx.font = '700 20px "Space Grotesk",sans-serif';
      ctx.fillText("Executive Order 03-114", 18, 90);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = "rgba(155,163,170," + (0.25 + r() * 0.3) + ")";
        ctx.fillRect(18, 108 + i * 13, (w - 46) * (0.5 + r() * 0.5), 3);
      }
      ctx.restore();
      ctx.fillStyle = "rgba(216,98,74,.5)";
      ctx.fillRect(w - 4, 54 + p.scroll * (h - 100), 3, 44);
      lab(ctx, "SCROLL POSITION IS A PARAMETER", 10, h - 10);
    },
  }),
  "URL bar, tabs, scroll position — all parameters, so the page can be scrolled by the narration.",
);

reg(
  "ui_surface",
  "P · INTERFACE",
  "DATA → ARTIFACT",
  {
    kind: { v: 0, lo: 0, hi: 2, int: 1 },
    items: { v: 6, lo: 2, hi: 12, int: 1 },
    activity: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const K = Math.round(p.kind),
        N = Math.round(p.items),
        r = mulberry(55);
      if (K === 0) {
        for (let i = 0; i < N; i++) {
          const y = 10 + i * ((h - 20) / N);
          ctx.fillStyle = "#131619";
          ctx.fillRect(10, y, w - 20, (h - 20) / N - 6);
          ctx.fillStyle = i === 0 ? "rgba(216,98,74,.75)" : "rgba(238,241,243,.6)";
          ctx.fillRect(20, y + 9, (w - 60) * (0.3 + r() * 0.55), 4);
          ctx.fillStyle = "rgba(155,163,170,.3)";
          ctx.fillRect(20, y + 19, (w - 60) * (0.2 + r() * 0.4), 3);
          const n = Math.round(r() * 400 * p.activity);
          ctx.font = "8px JetBrains Mono";
          ctx.fillStyle = "#69717a";
          ctx.fillText(String(n), w - 44, y + 14);
        }
      } else if (K === 1) {
        const C = 3,
          R = Math.ceil(N / C);
        for (let i = 0; i < N; i++) {
          const x = 10 + (i % C) * ((w - 20) / C),
            y = 10 + Math.floor(i / C) * ((h - 20) / R);
          ctx.fillStyle = "#131619";
          ctx.fillRect(x, y, (w - 20) / C - 8, (h - 20) / R - 8);
          const v = Math.abs(Math.sin(t * (0.4 + i * 0.2))) * p.activity;
          ctx.fillStyle = v > 0.7 ? EMB : "rgba(238,241,243,.6)";
          ctx.font = "600 " + Math.round((h / R) * 0.28) + 'px "Space Grotesk",sans-serif';
          ctx.fillText((v * 100).toFixed(0) + "%", x + 10, y + ((h - 20) / R) * 0.55);
        }
      } else {
        ctx.fillStyle = "#131619";
        ctx.fillRect(0, 0, w * 0.28, h);
        for (let i = 0; i < N; i++) {
          ctx.fillStyle = i === 1 ? "rgba(216,98,74,.8)" : "rgba(155,163,170,.35)";
          ctx.fillRect(12, 18 + i * 22, w * 0.28 - 30, 4);
        }
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = "rgba(238,241,243," + (0.1 + r() * 0.3) + ")";
          ctx.fillRect(w * 0.32, 20 + i * ((h - 40) / 9), w * 0.62 * (0.4 + r() * 0.6), 5);
        }
      }
      lab(ctx, ["FEED", "METRIC GRID", "APP SHELL"][K] + " · STRUCTURALLY ANIMATABLE", 10, h - 10);
    },
  }),
  "A generated feed can reorder, a metric can tick, a paywall can slide up. A screen recording can do none of that.",
);

reg(
  "spotlight",
  "P · INTERFACE",
  "— → MASK",
  {
    radius: { v: 0.3, lo: 0.08, hi: 0.8 },
    dim: { v: 0.75, lo: 0.2, hi: 0.95 },
    move: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const r = mulberry(12);
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = "rgba(238,241,243," + (0.14 + r() * 0.3) + ")";
        ctx.fillRect(16, 16 + i * ((h - 40) / 14), (w - 40) * (0.35 + r() * 0.6), 5);
      }
      ctx.fillStyle = "rgba(216,98,74,.8)";
      ctx.fillRect(16, 16 + 6 * ((h - 40) / 14), (w - 40) * 0.5, 5);
      const cx = w * 0.5 + Math.sin(t * p.move * 0.8) * w * 0.24,
        cy = 16 + 6 * ((h - 40) / 14) + 3 + Math.cos(t * p.move * 0.6) * h * 0.1;
      const R = Math.min(w, h) * p.radius;
      const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.5);
      g.addColorStop(0, "rgba(8,9,10,0)");
      g.addColorStop(1, "rgba(8,9,10," + p.dim + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(216,98,74,.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.7, 0, 6.3);
      ctx.stroke();
      lab(ctx, "ZOOM + DIM TO ISOLATE ONE ELEMENT", 10, h - 10);
    },
  }),
  "Isolating one element of an interface. The most-needed move in any piece about a platform.",
);

reg(
  "cursor",
  "P · INTERFACE",
  "— → ANIMATION",
  {
    damping: { v: 0.5, lo: 0.1, hi: 0.95 },
    dwell: { v: 0.4, lo: 0.05, hi: 1 },
    click: { v: 1, lo: 0, hi: 1 },
  },
  (p) => {
    let x = 0,
      y = 0,
      tx = 0,
      ty = 0,
      last = 0,
      clicked = 0;
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const r = mulberry(4);
        const targets = [
          [w * 0.22, h * 0.3],
          [w * 0.7, h * 0.28],
          [w * 0.42, h * 0.66],
          [w * 0.78, h * 0.72],
        ];
        targets.forEach(([bx, by], i) => {
          ctx.fillStyle = i === Math.floor(last) % 4 ? "rgba(216,98,74,.3)" : "#131619";
          ctx.fillRect(bx - 42, by - 13, 84, 26);
          ctx.strokeStyle = "rgba(155,163,170,.3)";
          ctx.strokeRect(bx - 42, by - 13, 84, 26);
          lab(ctx, "ACTION " + (i + 1), bx - 30, by - 4);
        });
        if (t - last > 1.2 + p.dwell * 1.4) {
          last = t;
          clicked = t;
        }
        const tgt = targets[Math.floor(last) % 4];
        tx = tgt[0];
        ty = tgt[1];
        const d = 0.05 + (1 - p.damping) * 0.22;
        x += (tx - x) * d;
        y += (ty - y) * d;
        if (p.click > 0.5 && t - clicked < 0.5) {
          const k = (t - clicked) / 0.5;
          ctx.strokeStyle = "rgba(216,98,74," + (1 - k) + ")";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, k * 26, 0, 6.3);
          ctx.stroke();
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 15);
        ctx.lineTo(x + 4, y + 11);
        ctx.lineTo(x + 9, y + 18);
        ctx.lineTo(x + 12, y + 16);
        ctx.lineTo(x + 7, y + 10);
        ctx.lineTo(x + 12, y + 9);
        ctx.closePath();
        ctx.fill();
        lab(ctx, "DAMPED POINTER · TARGETS NAMED ELEMENTS", 10, h - 10);
      },
    };
  },
  "A pointer that targets named elements rather than coordinates, damped so it reads as a hand.",
  1,
);

reg(
  "interaction",
  "P · INTERFACE",
  "— → ANIMATION",
  { kind: { v: 0, lo: 0, hi: 2, int: 1 }, rate: { v: 0.4, lo: 0.05, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const K = Math.round(p.kind),
        cyc = (t * p.rate * 0.6) % 1.6;
      ctx.fillStyle = "#131619";
      ctx.fillRect(w * 0.12, h * 0.3, w * 0.76, h * 0.4);
      ctx.strokeStyle = "rgba(155,163,170,.25)";
      ctx.strokeRect(w * 0.12, h * 0.3, w * 0.76, h * 0.4);
      if (K === 0) {
        const k = cl01(cyc);
        ctx.strokeStyle = "rgba(216,98,74," + (1 - k) + ")";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, k * Math.min(w, h) * 0.3, 0, 6.3);
        ctx.stroke();
      } else if (K === 1) {
        const s = "ORDER 03-114",
          n = Math.floor(cl01(cyc) * s.length);
        ctx.font = '500 15px "JetBrains Mono",monospace';
        ctx.fillStyle = INK;
        ctx.fillText(s.slice(0, n), w * 0.17, h * 0.53);
        if (((t * 3) | 0) % 2)
          ctx.fillRect(w * 0.17 + ctx.measureText(s.slice(0, n)).width + 2, h * 0.53 - 11, 2, 14);
      } else {
        const k = cl01(cyc);
        ctx.fillStyle = "rgba(216,98,74,.85)";
        ctx.fillRect(w * 0.12, h * 0.7 - k * h * 0.4, w * 0.76, 3);
        ctx.fillStyle = "rgba(238,241,243,.1)";
        ctx.fillRect(w * 0.12, h * 0.7 - k * h * 0.4, w * 0.76, k * h * 0.4);
      }
      lab(ctx, ["TAP RIPPLE", "KEYSTROKE ENTRY", "SCROLL"][K], 10, h - 10);
    },
  }),
  "Tap, keystroke, hover, scroll. The grammar of using a thing, rather than a picture of the thing.",
  1,
);

reg(
  "screen_transition",
  "P · INTERFACE",
  "— → ANIMATION",
  { kind: { v: 0, lo: 0, hi: 2, int: 1 }, rate: { v: 0.35, lo: 0.05, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const K = Math.round(p.kind);
      const raw = (t * p.rate * 0.6) % 2,
        c = raw > 1 ? 1 : raw,
        e = c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
      const screen = (x, acc) => {
        ctx.fillStyle = "#131619";
        ctx.fillRect(x, h * 0.12, w * 0.7, h * 0.76);
        ctx.strokeStyle = "rgba(155,163,170,.22)";
        ctx.strokeRect(x, h * 0.12, w * 0.7, h * 0.76);
        const r = mulberry(acc ? 9 : 3);
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle =
            i === 0 && acc ? "rgba(216,98,74,.8)" : "rgba(238,241,243," + (0.14 + r() * 0.3) + ")";
          ctx.fillRect(x + 14, h * 0.2 + i * h * 0.08, w * 0.7 * (0.3 + r() * 0.55), 4);
        }
      };
      if (K === 0) {
        screen(w * 0.15 - e * w, 0);
        screen(w * 0.15 + (1 - e) * w, 1);
      } else if (K === 1) {
        screen(w * 0.15, 0);
        ctx.fillStyle = "rgba(8,9,10," + e * 0.66 + ")";
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w / 2, h * 0.5 + (1 - e) * h * 0.5);
        ctx.fillStyle = "#191d21";
        ctx.fillRect(-w * 0.3, -h * 0.18, w * 0.6, h * 0.36);
        ctx.strokeStyle = EMB;
        ctx.strokeRect(-w * 0.3, -h * 0.18, w * 0.6, h * 0.36);
        ctx.restore();
      } else {
        screen(w * 0.15, 0);
        ctx.save();
        ctx.translate(w - 16 - e * w * 0.4, 16);
        ctx.fillStyle = "#191d21";
        ctx.fillRect(0, 0, w * 0.36, 44);
        ctx.strokeStyle = "rgba(216,98,74,.6)";
        ctx.strokeRect(0, 0, w * 0.36, 44);
        ctx.fillStyle = "rgba(238,241,243,.7)";
        ctx.fillRect(10, 14, w * 0.2, 4);
        ctx.fillRect(10, 26, w * 0.14, 3);
        ctx.restore();
      }
      lab(ctx, ["SCREEN TO SCREEN", "MODAL", "NOTIFICATION"][K], 10, h - 10);
    },
  }),
  "Movement between states of an interface, which is where most platform arguments actually live.",
  1,
);

/* ── Q. CUT GRAMMAR ─────────────────────────────────── */
function shotA(ctx, w, h, t) {
  bg(ctx, w, h);
  ctx.fillStyle = "rgba(238,241,243,.1)";
  for (let i = 0; i < 10; i++)
    ctx.fillRect(12, 16 + (i * (h - 30)) / 10, (w - 24) * (0.4 + ((i * 37) % 50) / 100), 4);
  ctx.fillStyle = INK;
  ctx.font = "600 " + Math.round(h * 0.22) + 'px "Space Grotesk",sans-serif';
  ctx.fillText("A", 16, h * 0.62);
}
function shotB(ctx, w, h, t) {
  ctx.fillStyle = "#191d21";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(216,98,74,.6)";
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, ((i + 1) / 8) * Math.min(w, h) * 0.45, 0, 6.3);
    ctx.stroke();
  }
  ctx.fillStyle = EMB;
  ctx.font = "600 " + Math.round(h * 0.22) + 'px "Space Grotesk",sans-serif';
  ctx.fillText("B", w - 40, h * 0.62);
}
reg(
  "hard_cut",
  "Q · CUT GRAMMAR",
  "— → ANIMATION",
  { rate: { v: 0.4, lo: 0.05, hi: 1 }, flash: { v: 0, lo: 0, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      const cyc = (t * p.rate * 1.2) % 2;
      if (cyc < 1) shotA(ctx, w, h, t);
      else shotB(ctx, w, h, t);
      const since = cyc % 1;
      if (p.flash > 0.02 && since < 0.08) {
        ctx.fillStyle = "rgba(238,241,243," + p.flash * (1 - since / 0.08) * 0.5 + ")";
        ctx.fillRect(0, 0, w, h);
      }
      lab(ctx, "INSTANTANEOUS · NO TRANSITION IS A CHOICE", 10, h - 10);
    },
  }),
  "The default and usually the right one. Listing it as a primitive is what stops transitions being decoration.",
);

reg(
  "match_cut",
  "Q · CUT GRAMMAR",
  "GEOMETRY → ANIMATION",
  { rate: { v: 0.3, lo: 0.05, hi: 1 }, tolerance: { v: 0.5, lo: 0, hi: 1 } },
  (p) => ({
    frame(ctx, w, h, t) {
      const cyc = (t * p.rate * 1.1) % 2,
        side = cyc < 1;
      bg(ctx, w, h);
      const R = Math.min(w, h) * 0.28;
      if (side) {
        ctx.fillStyle = "rgba(238,241,243,.08)";
        for (let i = 0; i < 9; i++) ctx.fillRect(12, 14 + (i * (h - 26)) / 9, (w - 24) * 0.6, 4);
      } else {
        ctx.fillStyle = "#191d21";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.strokeStyle = side ? INK : EMB;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, 6.3);
      ctx.stroke();
      ctx.font = '600 12px "JetBrains Mono",monospace';
      ctx.fillStyle = side ? INK : EMB;
      ctx.fillText(side ? "SHOT A" : "SHOT B", w / 2 - 26, h / 2 + 4);
      ctx.strokeStyle = "rgba(155,163,170,.25)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R * (1 + p.tolerance * 0.28), 0, 6.3);
      ctx.stroke();
      ctx.setLineDash([]);
      lab(ctx, "SHARED GEOMETRY ACROSS THE CUT · NEEDS BOTH SHOTS", 10, h - 10);
    },
  }),
  "Requires geometry from the outgoing AND incoming shot — a real architectural demand, not a transition preset.",
  1,
);

reg(
  "montage",
  "Q · CUT GRAMMAR",
  "— → ANIMATION",
  {
    rate: { v: 0.5, lo: 0.1, hi: 1 },
    shots: { v: 6, lo: 2, hi: 12, int: 1 },
    accel: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      const N = Math.round(p.shots),
        r = mulberry(66);
      const cycle = (t * p.rate * 0.5) % 1;
      let acc = 0,
        dur = [],
        base = 1 / N;
      for (let i = 0; i < N; i++) {
        const d = base * (1 - p.accel * (i / N) * 0.7);
        dur.push(d);
        acc += d;
      }
      dur = dur.map((d) => d / acc);
      let s = 0,
        idx = 0;
      for (let i = 0; i < N; i++) {
        if (cycle >= s && cycle < s + dur[i]) {
          idx = i;
          break;
        }
        s += dur[i];
      }
      bg(ctx, w, h);
      const k = idx / N;
      ctx.fillStyle = "rgba(238,241,243," + (0.05 + k * 0.1) + ")";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 8 + idx * 4; i++) {
        ctx.fillStyle = idx % 3 === 0 ? "rgba(216,98,74,.5)" : "rgba(238,241,243,.35)";
        ctx.fillRect(r() * w, r() * h, r() * w * 0.3 + 8, r() * 8 + 3);
      }
      ctx.font = "600 " + Math.round(h * 0.3) + 'px "Space Grotesk",sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(String(idx + 1), w - 46, h * 0.6);
      ctx.fillStyle = "rgba(155,163,170,.2)";
      ctx.fillRect(0, h - 5, w, 5);
      ctx.fillStyle = EMB;
      ctx.fillRect(0, h - 5, cycle * w, 5);
      lab(ctx, N + " SHOTS UNDER ONE NARRATION LINE", 10, h - 14);
    },
  }),
  "A rhythmic sequence under a single line of narration. Cut rate is a directed parameter, not an afterthought.",
);

reg(
  "cut_rhythm",
  "Q · CUT GRAMMAR",
  "— → ANIMATION",
  {
    frequency: { v: 0.4, lo: 0.05, hi: 1 },
    variance: { v: 0.3, lo: 0, hi: 1 },
    build: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const r = mulberry(11);
      const N = Math.round(6 + p.frequency * 40),
        cyc = (t * 0.16) % 1;
      let x = 0,
        i = 0,
        marks = [];
      while (x < 1 && i < 200) {
        const d = (1 / N) * (1 - p.build * x * 0.7) * (1 + (r() - 0.5) * p.variance * 1.6);
        marks.push(x);
        x += Math.max(0.004, d);
        i++;
      }
      ctx.strokeStyle = "rgba(155,163,170,.25)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();
      marks.forEach((m) => {
        const hot = Math.abs(m - cyc) < 0.012;
        ctx.strokeStyle = hot ? EMB : "rgba(238,241,243,.55)";
        ctx.lineWidth = hot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(m * w, h * 0.5 - (hot ? 26 : 14));
        ctx.lineTo(m * w, h * 0.5 + (hot ? 26 : 14));
        ctx.stroke();
      });
      ctx.strokeStyle = EMB;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cyc * w, 0);
      ctx.lineTo(cyc * w, h);
      ctx.stroke();
      lab(ctx, marks.length + " CUTS · DRIVEN BY motionEnergy AND visualDensity", 10, h - 14);
    },
  }),
  "Cut frequency driven by creative state. This is how a film accelerates without anyone editing faster.",
);

reg(
  "split_screen_temporal",
  "Q · CUT GRAMMAR",
  "— → ANIMATION",
  {
    panes: { v: 2, lo: 2, hi: 4, int: 1 },
    offset: { v: 0.4, lo: 0, hi: 1 },
    sync: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.panes);
      for (let i = 0; i < N; i++) {
        const pw = w / N,
          x = i * pw;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, 0, pw - 2, h);
        ctx.clip();
        ctx.translate(x, 0);
        const lt = t - i * p.offset * 1.4;
        const cyc = (lt * 0.5) % 2;
        if (cyc < 1) shotA(ctx, pw, h, lt);
        else shotB(ctx, pw, h, lt);
        ctx.restore();
      }
      if (p.sync > 0.5) {
        const beat = (t * 0.9) % 1;
        ctx.strokeStyle = "rgba(216,98,74," + (1 - beat) + ")";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
      }
      lab(ctx, N + " PARALLEL TIMELINES · OFFSET " + (p.offset * 1.4).toFixed(1) + "s", 10, h - 10);
    },
  }),
  "Simultaneous parallel action. Two timelines at once, offset — the same event from two clocks.",
  1,
);

/* ── R. MAPS ────────────────────────────────────────── */
function coast(seed, n) {
  const r = mulberry(seed),
    pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    const rr = 0.55 + Math.sin(a * 3 + seed) * 0.16 + Math.sin(a * 7 - seed) * 0.08 + r() * 0.05;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.72]);
  }
  return pts;
}
reg(
  "map_projection",
  "R · MAPS",
  "DATA → GEOMETRY",
  {
    regions: { v: 5, lo: 2, hi: 12, int: 1 },
    detail: { v: 0.5, lo: 0.1, hi: 1 },
    graticule: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const S = Math.min(w, h) * 0.82,
        N = Math.round(p.regions);
      if (p.graticule > 0.5) {
        ctx.strokeStyle = "rgba(155,163,170,.13)";
        ctx.lineWidth = 0.8;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          for (let j = -30; j <= 30; j++) {
            const x = w / 2 + (j / 30) * S * 0.5,
              y = h / 2 + (i / 4) * S * 0.34 + Math.sin((j / 30) * 1.4) * i * 3;
            j === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = -6; i <= 6; i++) {
          ctx.beginPath();
          for (let j = -20; j <= 20; j++) {
            const y = h / 2 + (j / 20) * S * 0.34,
              x = w / 2 + (i / 6) * S * 0.5 + Math.sin((j / 20) * 1.2) * i * 2.4;
            j === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      for (let k = 0; k < N; k++) {
        const pts = coast(k * 7 + 3, Math.round(12 + p.detail * 90));
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.42 + Math.cos(k * 2.1) * 0.4) * S,
            py = h / 2 + (y * 0.42 + Math.sin(k * 1.7) * 0.3) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = k === 0 ? "rgba(216,98,74,.18)" : "rgba(238,241,243,.06)";
        ctx.fill();
        ctx.strokeStyle = k === 0 ? EMB : "rgba(238,241,243,.42)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      lab(ctx, "PINNED VECTOR DATA · PROJECTED IN-PROCESS · NO TILE SERVER", 10, h - 14);
    },
  }),
  "Geography is a primary documentary primitive. Projected from pinned vector data — never a tile server at render time.",
);

reg(
  "map_camera",
  "R · MAPS",
  "— → ANIMATION",
  {
    zoom: { v: 0.4, lo: 0, hi: 1 },
    rate: { v: 0.3, lo: 0, hi: 1 },
    target: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const z = 1 + (Math.sin(t * p.rate * 0.7) * 0.5 + 0.5) * p.zoom * 7;
      const tx = w * (0.3 + p.target * 0.4),
        ty = h * 0.5;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(z, z);
      ctx.translate(-tx, -ty);
      const S = Math.min(w, h) * 0.8;
      for (let k = 0; k < 6; k++) {
        const pts = coast(k * 5 + 2, 60);
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.4 + Math.cos(k * 1.9) * 0.42) * S,
            py = h / 2 + (y * 0.4 + Math.sin(k * 1.3) * 0.32) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(238,241,243,.05)";
        ctx.fill();
        ctx.strokeStyle = "rgba(238,241,243," + 0.3 / Math.sqrt(z) + ")";
        ctx.lineWidth = 1 / z;
        ctx.stroke();
      }
      ctx.fillStyle = EMB;
      ctx.beginPath();
      ctx.arc(tx, ty, 3 / z, 0, 6.3);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(216,98,74,.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(tx, ty, 16, 0, 6.3);
      ctx.stroke();
      lab(ctx, "ZOOM ×" + z.toFixed(2) + " · GLOBE → REGION → STREET", 10, h - 14);
    },
  }),
  "A camera over geography. Scale changes are arguments about jurisdiction and scope.",
);

reg(
  "choropleth",
  "R · MAPS",
  "DATA → IMAGE",
  {
    year: { v: 0.5, lo: 0, hi: 1 },
    steps: { v: 5, lo: 2, hi: 9, int: 1 },
    regions: { v: 9, lo: 3, hi: 18, int: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.regions),
        S = Math.min(w, h) * 0.8,
        r = mulberry(19);
      const yr = Math.floor(p.year * (YEARS.length - 1));
      for (let k = 0; k < N; k++) {
        const pts = coast(k * 3 + 1, 26);
        const seedv = r();
        const v = cl01(seedv * 0.5 + (DATA[yr] / 6) * 0.6 * seedv + 0.1);
        const q = Math.round(v * Math.round(p.steps)) / Math.round(p.steps);
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.3 + ((k % 4) - 1.5) * 0.3) * S,
            py = h / 2 + (y * 0.3 + (Math.floor(k / 4) - 1) * 0.34) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(216,98,74," + q * 0.85 + ")";
        ctx.fill();
        ctx.strokeStyle = "rgba(238,241,243,.28)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      ctx.font = '600 22px "Space Grotesk",sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(String(YEARS[yr]), 14, 30);
      for (let i = 0; i < Math.round(p.steps); i++) {
        ctx.fillStyle = "rgba(216,98,74," + ((i + 1) / Math.round(p.steps)) * 0.85 + ")";
        ctx.fillRect(14 + i * 16, h - 26, 14, 7);
      }
      lab(ctx, "REGION SHADING · ANIMATABLE BY YEAR", 10, h - 12);
    },
  }),
  'Region shading that animates through time. The map redrawn each year is the clearest form of "this spread".',
);

reg(
  "route_draw",
  "R · MAPS",
  "GEOMETRY → ANIMATION",
  {
    rate: { v: 0.35, lo: 0.05, hi: 1 },
    waypoints: { v: 5, lo: 2, hi: 12, int: 1 },
    trail: { v: 0.6, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(p.waypoints),
        r = mulberry(27),
        S = Math.min(w, h) * 0.8;
      for (let k = 0; k < 5; k++) {
        const pts = coast(k * 4 + 6, 30);
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.36 + Math.cos(k * 2.4) * 0.4) * S,
            py = h / 2 + (y * 0.36 + Math.sin(k * 1.6) * 0.3) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(238,241,243,.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const wp = Array.from({ length: N }, (_, i) => [
        w * (0.1 + (i / (N - 1)) * 0.8),
        h * (0.25 + r() * 0.5),
      ]);
      const pr = cl01((t * p.rate * 0.35) % 1.4);
      ctx.strokeStyle = EMB;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      for (let i = 0; i < N - 1; i++) {
        const seg = cl01(pr * (N - 1) - i);
        if (seg <= 0) break;
        const [x0, y0] = wp[i],
          [x1, y1] = wp[i + 1];
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(
          (x0 + x1) / 2,
          Math.min(y0, y1) - 40,
          x0 + (x1 - x0) * seg,
          y0 + (y1 - y0) * seg,
        );
      }
      ctx.stroke();
      ctx.setLineDash([]);
      wp.forEach(([x, y], i) => {
        const on = i / (N - 1) <= pr;
        ctx.fillStyle = on ? EMB : "rgba(155,163,170,.4)";
        ctx.beginPath();
        ctx.arc(x, y, on ? 3.4 : 2, 0, 6.3);
        ctx.fill();
      });
      lab(ctx, "PATH TRACED ACROSS GEOGRAPHY · " + (pr * 100).toFixed(0) + "%", 10, h - 12);
    },
  }),
  "A route drawing itself. Movement, supply, escalation — the map animated at the pace of the account.",
  1,
);

reg(
  "flow_arc",
  "R · MAPS",
  "DATA → GEOMETRY",
  {
    arcs: { v: 0.4, lo: 0.05, hi: 1 },
    height: { v: 0.5, lo: 0.1, hi: 1 },
    direction: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const S = Math.min(w, h) * 0.8,
        r = mulberry(37);
      for (let k = 0; k < 5; k++) {
        const pts = coast(k * 6 + 4, 28);
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.34 + Math.cos(k * 2.2) * 0.42) * S,
            py = h / 2 + (y * 0.34 + Math.sin(k * 1.5) * 0.3) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(238,241,243,.14)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const N = Math.round(4 + p.arcs * 40);
      for (let i = 0; i < N; i++) {
        const x0 = r() * w,
          y0 = r() * h,
          x1 = r() * w,
          y1 = r() * h;
        const mx = (x0 + x1) / 2,
          my = (y0 + y1) / 2 - Math.hypot(x1 - x0, y1 - y0) * p.height * 0.6;
        const big = r() > 0.8;
        ctx.strokeStyle = big ? "rgba(216,98,74,.6)" : "rgba(238,241,243,.18)";
        ctx.lineWidth = big ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(mx, my, x1, y1);
        ctx.stroke();
        if (p.direction > 0.5) {
          const k = (t * 0.4 + i * 0.1) % 1;
          const px = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1,
            py = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1;
          ctx.fillStyle = big ? EMB : "rgba(238,241,243,.6)";
          ctx.fillRect(px - 1, py - 1, 2.4, 2.4);
        }
      }
      lab(ctx, N + " ARCS · MIGRATION · TRADE · TRANSFER", 10, h - 12);
    },
  }),
  "Origin-destination arcs. Movement between places without pretending to be a satellite image.",
  1,
);

reg(
  "pin_drop",
  "R · MAPS",
  "DATA → ANIMATION",
  {
    count: { v: 0.35, lo: 0.05, hi: 1 },
    rate: { v: 0.4, lo: 0.05, hi: 1 },
    labels: { v: 1, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const S = Math.min(w, h) * 0.8,
        r = mulberry(88);
      for (let k = 0; k < 5; k++) {
        const pts = coast(k * 8 + 2, 30);
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          const px = w / 2 + (x * 0.36 + Math.cos(k * 2.6) * 0.4) * S,
            py = h / 2 + (y * 0.36 + Math.sin(k * 1.4) * 0.3) * S;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(238,241,243,.04)";
        ctx.fill();
        ctx.strokeStyle = "rgba(238,241,243,.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const N = Math.round(3 + p.count * 30),
        cyc = (t * p.rate * 0.4) % 1.5;
      for (let i = 0; i < N; i++) {
        const x = w * (0.08 + r() * 0.84),
          y = h * (0.12 + r() * 0.76);
        const k = cl01((cyc * N - i) * 1.6);
        if (k <= 0) continue;
        const drop = 1 - Math.pow(1 - Math.min(1, k), 3);
        ctx.strokeStyle = EMB;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - 24 * (1 - drop) - 14);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = EMB;
        ctx.beginPath();
        ctx.arc(x, y - 14 - 24 * (1 - drop), 3.4, 0, 6.3);
        ctx.fill();
        if (p.labels > 0.5 && k > 0.7) {
          ctx.font = "8px JetBrains Mono";
          ctx.fillStyle = "rgba(238,241,243,.75)";
          ctx.fillText("SITE " + String(i + 1).padStart(2, "0"), x + 7, y - 14);
        }
      }
      lab(ctx, N + " LOCATED EVENTS", 10, h - 12);
    },
  }),
  "Located events arriving in sequence. Where and when, in the order the narration needs them.",
);
