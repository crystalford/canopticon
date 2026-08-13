/* CANOPTICON — families C (generative), D (particle), E (physics), J (raster), K (shader). */

/* ── C. GENERATIVE ──────────────────────────────────── */
reg(
  "voronoi",
  "C · GENERATIVE",
  "— → GEOMETRY",
  {
    cells: { v: 0.35, lo: 0.05, hi: 1 },
    drift: { v: 0.3, lo: 0, hi: 1 },
    fill: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    let sites = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(8 + p.cells * 90);
        if (n !== N) {
          N = n;
          const r = mulberry(55);
          sites = Array.from({ length: n }, () => ({
            x: r(),
            y: r(),
            px: r() * 6.28,
            py: r() * 6.28,
          }));
        }
        bg(ctx, w, h);
        const pts = sites.map((s) => [
          (s.x + Math.sin(t * 0.4 + s.px) * p.drift * 0.05) * w,
          (s.y + Math.cos(t * 0.35 + s.py) * p.drift * 0.05) * h,
        ]);
        const step = 5;
        for (let y = 0; y < h; y += step)
          for (let x = 0; x < w; x += step) {
            let b = 1e9,
              bi = 0,
              b2 = 1e9;
            for (let i = 0; i < pts.length; i++) {
              const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2;
              if (d < b) {
                b2 = b;
                b = d;
                bi = i;
              } else if (d < b2) b2 = d;
            }
            const edge = Math.sqrt(b2) - Math.sqrt(b);
            if (edge < 3.4) {
              ctx.fillStyle = "rgba(238,241,243,.55)";
              ctx.fillRect(x, y, step, step);
            } else if (p.fill > 0.02) {
              const g = ((bi % 9) / 9) * 0.5;
              ctx.fillStyle =
                "rgba(" +
                (80 + g * 120) +
                "," +
                (88 + g * 120) +
                "," +
                (96 + g * 120) +
                "," +
                p.fill * 0.35 +
                ")";
              ctx.fillRect(x, y, step, step);
            }
          }
        lab(ctx, N + " CELLS · SEEDED", 10, h - 16);
      },
    };
  },
  "Cell decomposition. Territory, jurisdiction, coverage — geography without a map.",
);

reg(
  "fractal",
  "C · GENERATIVE",
  "— → GEOMETRY",
  {
    depth: { v: 5, lo: 1, hi: 7, int: 1 },
    ratio: { v: 0.5, lo: 0.2, hi: 0.8 },
    rotate: { v: 0.2, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      let n = 0;
      (function box(x, y, s, d) {
        if (d <= 0) return;
        n++;
        ctx.strokeStyle = "rgba(238,241,243," + (0.12 + d * 0.11) + ")";
        ctx.lineWidth = 0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rotate * d * 0.25 + t * 0.06 * p.rotate);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
        const o = s * p.ratio;
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].forEach(([a, b]) => box(x + a * s * 0.36, y + b * s * 0.36, o, d - 1));
      })(w / 2, h / 2, Math.min(w, h) * 0.52, Math.round(p.depth));
      lab(ctx, "SELF-SIMILAR · " + n + " FORMS", 10, h - 16);
    },
  }),
  "Self-similar recursion. Scale-invariance is the visual argument that a pattern repeats at every level.",
);

reg(
  "l_system",
  "C · GENERATIVE",
  "— → GEOMETRY",
  {
    iterations: { v: 4, lo: 1, hi: 6, int: 1 },
    angle: { v: 0.35, lo: 0.05, hi: 1 },
    grow: { v: 1, lo: 0.05, hi: 1 },
  },
  (p) => {
    let cache = "",
      key = "";
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const it = Math.round(p.iterations),
          k = it + "";
        if (k !== key) {
          key = k;
          let s = "F";
          for (let i = 0; i < it; i++) s = s.replace(/F/g, "FF+[+F-F-F]-[-F+F+F]");
          cache = s.slice(0, 9000);
        }
        const A = p.angle * 0.9,
          st = [];
        let x = w / 2,
          y = h * 0.98,
          a = -Math.PI / 2,
          len = (h * 0.4) / Math.pow(2.1, it - 1);
        const N = Math.floor(cache.length * p.grow);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(238,241,243,.6)";
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const c = cache[i];
          if (c === "F") {
            const nx = x + Math.cos(a) * len,
              ny = y + Math.sin(a) * len;
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            x = nx;
            y = ny;
          } else if (c === "+") a += A;
          else if (c === "-") a -= A;
          else if (c === "[") st.push([x, y, a]);
          else if (c === "]") [x, y, a] = st.pop();
        }
        ctx.stroke();
        lab(ctx, "ITER " + it + " · " + cache.length + " SYMBOLS", 10, h - 16);
      },
    };
  },
  "Grammar-driven growth. A rewriting system is an unusually honest way to visualise a process that compounds.",
);

reg(
  "attractor",
  "C · GENERATIVE",
  "— → GEOMETRY",
  {
    points: { v: 0.4, lo: 0.05, hi: 1 },
    a: { v: 0.5, lo: 0, hi: 1 },
    zoom: { v: 0.5, lo: 0.2, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h, 0.1);
      const N = Math.round(400 + p.points * 5000);
      let x = 0.1,
        y = 0,
        z = 0;
      const s = 10 + p.a * 6,
        r = 28,
        b = 8 / 3,
        dt = 0.0055,
        S = Math.min(w, h) * 0.021 * p.zoom * 2;
      const rot = t * 0.1;
      for (let i = 0; i < N; i++) {
        const dx = s * (y - x),
          dy = x * (r - z) - y,
          dz = x * y - b * z;
        x += dx * dt;
        y += dy * dt;
        z += dz * dt;
        if (i < 60) continue;
        const X = x * Math.cos(rot) - y * Math.sin(rot);
        const px = w / 2 + X * S,
          py = h * 0.62 - (z - 26) * S;
        ctx.fillStyle = i % 7 ? "rgba(238,241,243,.30)" : "rgba(216,98,74,.45)";
        ctx.fillRect(px, py, 1, 1);
      }
      lab(ctx, "LORENZ · " + N + " ITERATIONS · DETERMINISTIC", 10, h - 16);
    },
  }),
  "Strange attractors: bounded systems that never repeat. Deterministic chaos, which is often the actual subject.",
);

reg(
  "cellular",
  "C · GENERATIVE",
  "— → IMAGE",
  {
    rule: { v: 110, lo: 2, hi: 254, int: 1 },
    scale: { v: 3, lo: 2, hi: 8, int: 1 },
    seedmode: { v: 0, lo: 0, hi: 1, int: 1 },
  },
  (p) => {
    let img = null,
      key = "";
    return {
      frame(ctx, w, h, t) {
        const k = [p.rule, p.scale, p.seedmode, w, h].join();
        if (k !== key) {
          key = k;
          const c = Math.round(p.scale),
            cols = Math.ceil(w / c),
            rows = Math.ceil(h / c);
          bg(ctx, w, h);
          const r = mulberry(7);
          let row = Array.from({ length: cols }, (_, i) =>
            p.seedmode < 0.5 ? (i === cols >> 1 ? 1 : 0) : r() > 0.5 ? 1 : 0,
          );
          const R = Math.round(p.rule);
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++)
              if (row[x]) {
                ctx.fillStyle = x % 11 === 0 ? "rgba(216,98,74,.85)" : "rgba(238,241,243,.78)";
                ctx.fillRect(x * c, y * c, c, c);
              }
            row = row.map((_, i) => {
              const idx = (row[(i - 1 + cols) % cols] << 2) | (row[i] << 1) | row[(i + 1) % cols];
              return (R >> idx) & 1;
            });
          }
        }
        lab(ctx, "RULE " + Math.round(p.rule) + " · PRECOMPUTED", 10, h - 16);
      },
    };
  },
  "One-dimensional automata unrolled through time. Expensive per frame, so precompute to an image and hold.",
  1,
);

reg(
  "reaction_diffusion",
  "C · GENERATIVE",
  "— → IMAGE",
  {
    feed: { v: 0.5, lo: 0, hi: 1 },
    kill: { v: 0.5, lo: 0, hi: 1 },
    scale: { v: 0.5, lo: 0.2, hi: 1 },
  },
  (p) => {
    const n = vnoise(404);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        const c = 4;
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            const s = p.scale * 6;
            let v = fbm(n, (x / w) * s, (y / h) * s + t * 0.04, 4, 0.7);
            v = Math.sin(v * 10 + p.feed * 6) * Math.cos(v * 7 - p.kill * 6);
            const b = v > 0 ? 1 : 0,
              g = Math.abs(v);
            ctx.fillStyle = b
              ? "rgba(216,98,74," + (0.15 + g * 0.5) + ")"
              : "rgba(238,241,243," + g * 0.35 + ")";
            ctx.fillRect(x, y, c, c);
          }
        lab(ctx, "GRAY-SCOTT APPROXIMATION · PRECOMPUTE IN PRODUCTION", 10, h - 16);
      },
    };
  },
  "Organic pattern formation. Genuinely expensive — in production this renders once to an image sequence.",
  1,
);

/* ── D. PARTICLE ────────────────────────────────────── */
reg(
  "particle_emitter",
  "D · PARTICLE",
  "— → GEOMETRY",
  {
    rate: { v: 0.4, lo: 0.05, hi: 1 },
    life: { v: 0.5, lo: 0.1, hi: 1 },
    spread: { v: 0.4, lo: 0, hi: 1 },
    gravity: { v: 0.3, lo: -0.2, hi: 1 },
  },
  (p) => {
    let ps = [],
      r = mulberry(19);
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h, 0.14);
        const N = Math.round(1 + p.rate * 6);
        for (let i = 0; i < N; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * p.spread * 3;
          const sp = 1.4 + r() * 2.6;
          ps.push({ x: w / 2, y: h * 0.86, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 1 });
        }
        const dec = 0.004 + (1 - p.life) * 0.016;
        ps = ps.filter((q) => {
          q.vy += p.gravity * 0.05;
          q.x += q.vx;
          q.y += q.vy;
          q.l -= dec;
          if (q.l <= 0) return false;
          ctx.fillStyle =
            q.l > 0.6 ? "rgba(238,241,243," + q.l + ")" : "rgba(216,98,74," + q.l * 0.9 + ")";
          ctx.fillRect(q.x, q.y, 2, 2);
          return true;
        });
        if (ps.length > 2600) ps = ps.slice(-2600);
        lab(ctx, ps.length + " ALIVE · SEEDED SPAWN", 10, h - 16);
      },
    };
  },
  "Spawn, decay, count. The base of every particle chain — and the parameter density maps onto directly.",
);

reg(
  "flocking",
  "D · PARTICLE",
  "— → GEOMETRY",
  {
    count: { v: 0.35, lo: 0.05, hi: 1 },
    cohesion: { v: 0.5, lo: 0, hi: 1 },
    separation: { v: 0.5, lo: 0, hi: 1 },
    speed: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => {
    let b = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(20 + p.count * 200);
        if (n !== N) {
          N = n;
          const r = mulberry(88);
          b = Array.from({ length: n }, () => ({
            x: r() * w,
            y: r() * h,
            vx: (r() - 0.5) * 2,
            vy: (r() - 0.5) * 2,
          }));
        }
        bg(ctx, w, h, 0.22);
        for (let i = 0; i < b.length; i++) {
          const q = b[i];
          let cx = 0,
            cy = 0,
            ax = 0,
            ay = 0,
            sx = 0,
            sy = 0,
            c = 0;
          for (let j = 0; j < b.length; j += 2) {
            if (i === j) continue;
            const o = b[j],
              dx = o.x - q.x,
              dy = o.y - q.y,
              d = dx * dx + dy * dy;
            if (d < 7000) {
              cx += o.x;
              cy += o.y;
              ax += o.vx;
              ay += o.vy;
              c++;
              if (d < 520) {
                sx -= dx;
                sy -= dy;
              }
            }
          }
          if (c) {
            q.vx +=
              (cx / c - q.x) * 0.0006 * p.cohesion * 3 +
              (ax / c - q.vx) * 0.02 +
              sx * 0.0016 * p.separation * 3;
            q.vy +=
              (cy / c - q.y) * 0.0006 * p.cohesion * 3 +
              (ay / c - q.vy) * 0.02 +
              sy * 0.0016 * p.separation * 3;
          }
          const sp = Math.hypot(q.vx, q.vy),
            max = 0.6 + p.speed * 2.6;
          if (sp > max) {
            q.vx = (q.vx / sp) * max;
            q.vy = (q.vy / sp) * max;
          }
          q.x = (q.x + q.vx + w) % w;
          q.y = (q.y + q.vy + h) % h;
          const a = Math.atan2(q.vy, q.vx);
          ctx.strokeStyle = i % 9 ? "rgba(238,241,243,.55)" : "rgba(216,98,74,.9)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - Math.cos(a) * 5, q.y - Math.sin(a) * 5);
          ctx.stroke();
        }
        lab(ctx, N + " AGENTS · SEPARATION · ALIGNMENT · COHESION", 10, h - 16);
      },
    };
  },
  "Boids. Crowd, migration, consensus — emergent behaviour from three local rules and no central plan.",
);

reg(
  "particle_connect",
  "D · PARTICLE",
  "GEOMETRY → GEOMETRY",
  {
    count: { v: 0.3, lo: 0.05, hi: 1 },
    radius: { v: 0.4, lo: 0.1, hi: 1 },
    drift: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    let ps = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(14 + p.count * 90);
        if (n !== N) {
          N = n;
          const r = mulberry(303);
          ps = Array.from({ length: n }, () => ({
            x: r() * w,
            y: r() * h,
            px: r() * 6.28,
            py: r() * 6.28,
          }));
        }
        bg(ctx, w, h);
        const R = 30 + p.radius * 130;
        const pts = ps.map((q) => [
          q.x + Math.sin(t * 0.35 + q.px) * p.drift * 36,
          q.y + Math.cos(t * 0.3 + q.py) * p.drift * 36,
        ]);
        let e = 0;
        for (let i = 0; i < pts.length; i++)
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
            if (d < R) {
              e++;
              ctx.strokeStyle = "rgba(155,163,170," + 0.42 * (1 - d / R) + ")";
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(pts[i][0], pts[i][1]);
              ctx.lineTo(pts[j][0], pts[j][1]);
              ctx.stroke();
            }
          }
        pts.forEach(([x, y], i) => {
          ctx.fillStyle = i % 8 ? INK : EMB;
          ctx.beginPath();
          ctx.arc(x, y, i % 8 ? 1.8 : 3, 0, 6.3);
          ctx.fill();
        });
        lab(ctx, N + " NODES · " + e + " EDGES", 10, h - 16);
      },
    };
  },
  "Neighbour links — the cheap proto-network. Relationship without the cost of a force simulation.",
);

/* ── E. PHYSICS ─────────────────────────────────────── */
reg(
  "spring",
  "E · PHYSICS",
  "— → ANIMATION",
  {
    stiffness: { v: 0.5, lo: 0.05, hi: 1 },
    damping: { v: 0.5, lo: 0.05, hi: 1 },
    mass: { v: 0.4, lo: 0.1, hi: 1 },
  },
  (p) => {
    let x = 0,
      v = 0,
      tg = 1,
      last = 0;
    return {
      frame(ctx, w, h, t) {
        bg(ctx, w, h);
        if (t - last > 1.8) {
          last = t;
          tg = tg > 0.5 ? 0 : 1;
        }
        const k = 0.002 + p.stiffness * 0.05,
          d = 0.55 + p.damping * 0.42,
          m = 0.4 + p.mass * 1.6;
        v = (v + (((tg - x) * k) / m) * 60) * d;
        x += v;
        const X = 40 + cl01(x) * (w - 110);
        ctx.strokeStyle = "rgba(155,163,170,.2)";
        ctx.beginPath();
        ctx.moveTo(40, h / 2);
        ctx.lineTo(w - 70, h / 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(155,163,170,.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          ctx.lineTo(
            40 + u * (X - 40),
            h / 2 + Math.sin(u * Math.PI * 11) * (9 * (1 - Math.abs(x - tg))),
          );
        }
        ctx.stroke();
        ctx.fillStyle = EMB;
        ctx.fillRect(X, h / 2 - 13, 26, 26);
        ctx.strokeStyle = "rgba(216,98,74,.35)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(40 + tg * (w - 110), h * 0.2);
        ctx.lineTo(40 + tg * (w - 110), h * 0.8);
        ctx.stroke();
        ctx.setLineDash([]);
        lab(ctx, "FIXED TIMESTEP · FRAME-RATE INDEPENDENT", 10, h - 16);
      },
    };
  },
  "Free via Remotion. The only physics primitive in Phase 0 — iterative solvers need care to stay deterministic.",
);

reg(
  "gravity_field",
  "E · PHYSICS",
  "— → FIELD",
  {
    mass: { v: 0.5, lo: 0.1, hi: 1 },
    bodies: { v: 2, lo: 1, hi: 4, int: 1 },
    trails: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => {
    let ps = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = 460;
        if (!ps.length) {
          const r = mulberry(12);
          ps = Array.from({ length: n }, () => ({
            x: r() * w,
            y: r() * h,
            vx: r() - 0.5,
            vy: r() - 0.5,
          }));
        }
        bg(ctx, w, h, 0.06 + (1 - p.trails) * 0.3);
        const B = Math.round(p.bodies),
          att = [];
        for (let i = 0; i < B; i++) {
          const a = t * 0.25 + (i / B) * 6.283;
          att.push([w / 2 + Math.cos(a) * w * 0.22, h / 2 + Math.sin(a) * h * 0.24]);
        }
        for (const q of ps) {
          for (const [ax, ay] of att) {
            const dx = ax - q.x,
              dy = ay - q.y,
              d = Math.max(700, dx * dx + dy * dy);
            q.vx += (dx / d) * p.mass * 36;
            q.vy += (dy / d) * p.mass * 36;
          }
          q.vx *= 0.995;
          q.vy *= 0.995;
          q.x += q.vx;
          q.y += q.vy;
          if (q.x < 0 || q.x > w || q.y < 0 || q.y > h) {
            q.x = w / 2;
            q.y = h / 2;
            q.vx = q.vy = 0;
          }
          ctx.fillStyle = "rgba(238,241,243,.32)";
          ctx.fillRect(q.x, q.y, 1.4, 1.4);
        }
        att.forEach(([x, y]) => {
          ctx.fillStyle = EMB;
          ctx.beginPath();
          ctx.arc(x, y, 3.4, 0, 6.3);
          ctx.fill();
        });
        lab(ctx, B + " ATTRACTORS · INVERSE-SQUARE · FIELD OUT", 10, h - 16);

        // THE FIELD ITSELF, not only a picture of one.
        //
        // This declared "— → FIELD" and returned nothing, so its own note —
        // "attraction as a field other primitives can consume" — was
        // describing something that did not exist. Anything downstream got
        // a canvas of dots and fell back to its own synthetic noise.
        //
        // The grid is computed analytically from the attractors rather than
        // sampled off the particles: the particles are a rendering of the
        // field, and reading the field back out of its own picture would be
        // both slower and wrong.
        const cell = 8;
        const cols = Math.ceil(w / cell);
        const rows = Math.ceil(h / cell);
        const ang = new Float32Array(cols * rows);
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const x = gx * cell + cell / 2;
            const y = gy * cell + cell / 2;
            let fx = 0;
            let fy = 0;
            for (const [ax, ay] of att) {
              const dx = ax - x;
              const dy = ay - y;
              const d2 = Math.max(700, dx * dx + dy * dy);
              fx += (dx / d2) * p.mass * 36;
              fy += (dy / d2) * p.mass * 36;
            }
            ang[gy * cols + gx] = Math.atan2(fy, fx);
          }
        }
        return { field: { kind: "vector", cols, rows, cell, w, h, ang } };
      },
    };
  },
  "Attraction as a field other primitives can consume — emitted as a sampled grid of directions computed from the attractors themselves. Influence, gravity of an institution, pull. Combine it with a sentence through field_displace and the pull moves the letters.",
  1,
);

reg(
  "collision",
  "E · PHYSICS",
  "— → ANIMATION",
  {
    count: { v: 0.35, lo: 0.05, hi: 1 },
    restitution: { v: 0.8, lo: 0.3, hi: 1 },
    size: { v: 0.4, lo: 0.1, hi: 1 },
  },
  (p) => {
    let b = [],
      N = 0;
    return {
      frame(ctx, w, h, t) {
        const n = Math.round(4 + p.count * 40);
        if (n !== N) {
          N = n;
          const r = mulberry(66);
          b = Array.from({ length: n }, () => ({
            x: r() * w,
            y: r() * h,
            vx: (r() - 0.5) * 3,
            vy: (r() - 0.5) * 3,
            r: 3 + r() * 10 * p.size * 2,
          }));
        }
        bg(ctx, w, h);
        for (let i = 0; i < b.length; i++) {
          const q = b[i];
          q.x += q.vx;
          q.y += q.vy;
          if (q.x < q.r || q.x > w - q.r) {
            q.vx *= -p.restitution;
            q.x = clampv(q.x, q.r, w - q.r);
          }
          if (q.y < q.r || q.y > h - q.r) {
            q.vy *= -p.restitution;
            q.y = clampv(q.y, q.r, h - q.r);
          }
          for (let j = i + 1; j < b.length; j++) {
            const o = b[j],
              dx = o.x - q.x,
              dy = o.y - q.y,
              d = Math.hypot(dx, dy);
            if (d < q.r + o.r && d > 0) {
              const nx = dx / d,
                ny = dy / d,
                ov = (q.r + o.r - d) / 2;
              q.x -= nx * ov;
              q.y -= ny * ov;
              o.x += nx * ov;
              o.y += ny * ov;
              const vx = q.vx - o.vx,
                vy = q.vy - o.vy,
                dot = vx * nx + vy * ny;
              if (dot > 0) {
                q.vx -= dot * nx * p.restitution;
                q.vy -= dot * ny * p.restitution;
                o.vx += dot * nx * p.restitution;
                o.vy += dot * ny * p.restitution;
              }
            }
          }
          ctx.strokeStyle = i % 6 ? "rgba(238,241,243,.6)" : EMB;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r, 0, 6.3);
          ctx.stroke();
        }
        lab(ctx, N + " BODIES · e=" + p.restitution.toFixed(2), 10, h - 16);
      },
    };
  },
  "Elastic collision with a fixed timestep. Contention, capacity, pressure in a bounded system.",
  1,
);
function clampv(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

reg(
  "orbital",
  "E · PHYSICS",
  "— → ANIMATION",
  {
    bodies: { v: 0.4, lo: 0.05, hi: 1 },
    speed: { v: 0.4, lo: 0.05, hi: 1 },
    eccentricity: { v: 0.3, lo: 0, hi: 0.9 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      bg(ctx, w, h);
      const N = Math.round(3 + p.bodies * 22),
        R = Math.min(w, h) * 0.42;
      ctx.fillStyle = EMB;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 4, 0, 6.3);
      ctx.fill();
      const r = mulberry(9);
      for (let i = 0; i < N; i++) {
        const rr = 0.16 + r() * 0.84,
          a0 = r() * 6.283;
        const a = a0 + ((t * p.speed * 1.6) / Math.pow(rr, 1.5)) * 0.24;
        const rx = R * rr,
          ry = R * rr * (1 - p.eccentricity);
        ctx.strokeStyle = "rgba(155,163,170,.13)";
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, 6.3);
        ctx.stroke();
        ctx.fillStyle = i % 5 ? "rgba(238,241,243,.85)" : COOL;
        ctx.beginPath();
        ctx.arc(
          w / 2 + Math.cos(a) * rx,
          h / 2 + Math.sin(a) * ry,
          1.8 + (i % 5 ? 0 : 1.4),
          0,
          6.3,
        );
        ctx.fill();
      }
      lab(ctx, N + " BODIES · KEPLERIAN PERIODS", 10, h - 16);
    },
  }),
  "Orbits at Keplerian rates. Cycles, returns, anniversaries — anything that comes back around.",
  1,
);

/* ── J. RASTER / PIXEL ──────────────────────────────── */
function srcImage(w, h, t, n) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const o = c.getContext("2d");
  o.fillStyle = "#000";
  o.fillRect(0, 0, w, h);
  const cell = 6;
  for (let y = 0; y < h; y += cell)
    for (let x = 0; x < w; x += cell) {
      const v = fbm(n, (x / w) * 4, (y / h) * 4 + t * 0.08, 4, 0.6) * 0.5 + 0.5;
      const g = Math.round(cl01(v) * 255);
      o.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
      o.fillRect(x, y, cell, cell);
    }
  o.fillStyle = "#fff";
  o.font = "700 " + Math.round(h * 0.3) + 'px "Space Grotesk",sans-serif';
  o.textAlign = "center";
  o.textBaseline = "middle";
  o.fillText("1997", w / 2, h / 2);
  return c;
}
/** THE RASTER FAMILY READS WHAT IT WAS HANDED.
 *
 *  Every one of these declared IMAGE → IMAGE and every one of them
 *  synthesised its own plate — a noise field with "1997" set across it —
 *  and rastered THAT. So `dither` after a constructed smoke detector did
 *  not dither the detector. It painted a dithered 1997 over it, at full
 *  cost, and the chain typechecked.
 *
 *  That is the difference between an OPERATOR and a slide. An operation
 *  you can apply to a fixture, a document, a chart or a sentence is the
 *  whole premise of separating constructions from operations; one that
 *  replaces all four with the same picture is a decorative link, and the
 *  compiler has been counting them as such for weeks.
 *
 *  The synthetic plate stays as the FALLBACK, so each of these still reads
 *  as itself standing alone in the Lab with nothing upstream — the same
 *  arrangement `upstreamData` uses for the DATA family, and the reason
 *  this could be fixed in one place rather than seven. */
function rasterPrim(id, note, params, fn, phase) {
  reg(
    id,
    "J · RASTER",
    "IMAGE → IMAGE",
    params,
    (p) => {
      const n = vnoise(1337);
      let scratch = null;
      return {
        frame(ctx, w, h, t, upstream) {
          const given = upstream?.canvas;
          let src;
          if (given) {
            // The upstream buffer is the size the chain runs at; the
            // pixels are read back once per frame into a scratch canvas so
            // getImageData never touches the live buffer being drawn into.
            if (!scratch || scratch.width !== w || scratch.height !== h) {
              scratch = document.createElement("canvas");
              scratch.width = w;
              scratch.height = h;
            }
            const sx = scratch.getContext("2d", { willReadFrequently: true });
            sx.clearRect(0, 0, w, h);
            sx.drawImage(given, 0, 0, w, h);
            src = scratch;
          } else {
            src = srcImage(w, h, t, n);
          }
          const im = src
            .getContext("2d", { willReadFrequently: true })
            .getImageData(0, 0, w, h);
          fn(ctx, im, w, h, p, t);
        },
      };
    },
    note,
    phase,
  );
}

rasterPrim(
  "pixelate",
  "Mosaic and quantisation. Withheld detail is a documentary statement, not a censor bar.",
  { size: { v: 10, lo: 2, hi: 40, int: 1 }, quantize: { v: 4, lo: 2, hi: 16, int: 1 } },
  (ctx, im, w, h, p) => {
    bg(ctx, w, h);
    const c = Math.round(p.size),
      q = Math.round(p.quantize);
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        const i = ((y | 0) * w + (x | 0)) * 4;
        let g = im.data[i];
        g = (Math.round((g / 255) * q) / q) * 255;
        ctx.fillStyle = "rgb(" + (g | 0) + "," + ((g * 1.02) | 0) + "," + ((g * 1.04) | 0) + ")";
        ctx.fillRect(x, y, c, c);
      }
  },
);

rasterPrim(
  "dither",
  "Ordered and error-diffusion dithering. Tone reconstructed from a two-value system.",
  { threshold: { v: 0.5, lo: 0.1, hi: 0.9 }, size: { v: 3, lo: 1, hi: 8, int: 1 } },
  (ctx, im, w, h, p) => {
    bg(ctx, w, h);
    const B = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
      ],
      c = Math.round(p.size);
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        const i = ((y | 0) * w + (x | 0)) * 4;
        const v = im.data[i] / 255;
        const th = (B[((y / c) | 0) % 4][((x / c) | 0) % 4] / 16) * (1.4 - p.threshold);
        if (v > th) {
          ctx.fillStyle = v > 0.85 ? EMB : INK;
          ctx.fillRect(x, y, c, c);
        }
      }
  },
);

rasterPrim(
  "halftone",
  "Amplitude-modulated dots. Print reproduction as a temporal register — this is the 1970s.",
  { size: { v: 8, lo: 3, hi: 20, int: 1 }, angle: { v: 0.4, lo: 0, hi: 1 } },
  (ctx, im, w, h, p) => {
    bg(ctx, w, h);
    const c = Math.round(p.size),
      a = p.angle * 0.8;
    for (let y = 0; y < h + c; y += c)
      for (let x = 0; x < w + c; x += c) {
        const sx = Math.round(x + Math.sin(a) * c * 0.5),
          sy = Math.round(y + Math.cos(a) * c * 0.5);
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        const v = im.data[(sy * w + sx) * 4] / 255;
        ctx.fillStyle = v > 0.8 ? EMB : INK;
        ctx.beginPath();
        ctx.arc(sx, sy, v * c * 0.62, 0, 6.3);
        ctx.fill();
      }
  },
);

rasterPrim(
  "threshold",
  "Posterise or isolate. Output can be used directly as a mask.",
  { level: { v: 0.5, lo: 0.05, hi: 0.95 }, steps: { v: 2, lo: 2, hi: 8, int: 1 } },
  (ctx, im, w, h, p) => {
    bg(ctx, w, h);
    const c = 3,
      S = Math.round(p.steps);
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        const v = im.data[((y | 0) * w + (x | 0)) * 4] / 255;
        const q = Math.floor(cl01(v - p.level + 0.5) * S) / S;
        if (q <= 0) continue;
        ctx.fillStyle = q > 0.85 ? EMB : "rgba(238,241,243," + q + ")";
        ctx.fillRect(x, y, c, c);
      }
  },
);

rasterPrim(
  "pixel_sort",
  "Rows sorted by luminance above a threshold. Glitch used as evidence of tampering.",
  { threshold: { v: 0.45, lo: 0.05, hi: 0.95 }, direction: { v: 0, lo: 0, hi: 1, int: 1 } },
  (ctx, im, w, h, p) => {
    bg(ctx, w, h);
    const c = 3;
    for (let y = 0; y < h; y += c) {
      const row = [];
      for (let x = 0; x < w; x += c) row.push(im.data[((y | 0) * w + (x | 0)) * 4] / 255);
      let i = 0;
      while (i < row.length) {
        if (row[i] > p.threshold) {
          let j = i;
          while (j < row.length && row[j] > p.threshold) j++;
          const seg = row.slice(i, j).sort((a, b) => (p.direction < 0.5 ? a - b : b - a));
          for (let k = 0; k < seg.length; k++) row[i + k] = seg[k];
          i = j;
        } else i++;
      }
      row.forEach((v, x) => {
        ctx.fillStyle = v > 0.88 ? EMB : "rgba(238,241,243," + v * 0.9 + ")";
        ctx.fillRect(x * c, y, c, c);
      });
    }
  },
);

rasterPrim(
  "scanline",
  "CRT scanlines and roll. A period register — the archive as it was actually watched.",
  {
    gap: { v: 3, lo: 2, hi: 9, int: 1 },
    roll: { v: 0.4, lo: 0, hi: 1 },
    bleed: { v: 0.4, lo: 0, hi: 1 },
  },
  (ctx, im, w, h, p, t) => {
    bg(ctx, w, h);
    const g = Math.round(p.gap),
      c = 3;
    for (let y = 0; y < h; y += c) {
      if (((y / c) | 0) % g === 0) continue;
      const sh = Math.sin(y * 0.05 + t * p.roll * 6) * p.bleed * 7;
      for (let x = 0; x < w; x += c) {
        const sx = Math.round(clampv(x + sh, 0, w - 1));
        const v = im.data[((y | 0) * w + sx) * 4] / 255;
        ctx.fillStyle = "rgba(238,241,243," + v * 0.85 + ")";
        ctx.fillRect(x, y, c, c);
      }
    }
    ctx.fillStyle = "rgba(216,98,74,.05)";
    ctx.fillRect(0, (t * 90) % h, w, 26);
  },
);

/* ── K. SHADER / GPU ────────────────────────────────── */
reg(
  "shader_surface",
  "K · SHADER",
  "— → IMAGE",
  {
    frequency: { v: 0.4, lo: 0.05, hi: 1 },
    warp: { v: 0.4, lo: 0, hi: 1 },
    bands: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t) {
        const c = 4;
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            const u = x / w,
              v = y / h;
            const wp = fbm(n, u * 4, v * 4 + t * 0.05, 3, 0.6) * p.warp * 2;
            let s =
              Math.sin((u * 8 + wp) * (1 + p.frequency * 9) + t) *
              Math.cos((v * 8 - wp) * (1 + p.frequency * 6) - t * 0.7);
            if (p.bands > 0.02) s = Math.round(s * (2 + p.bands * 10)) / (2 + p.bands * 10);
            const g = cl01(s * 0.5 + 0.5);
            ctx.fillStyle =
              g > 0.72
                ? "rgba(216,98,74," + g * 0.85 + ")"
                : "rgb(" + ((g * 160) | 0) + "," + ((g * 172) | 0) + "," + ((g * 182) | 0) + ")";
            ctx.fillRect(x, y, c, c);
          }
        lab(ctx, "L2-GPU · PIXEL-IDENTICAL ON SAME GPU ONLY", 10, h - 16, "#d9a441");
      },
    };
  },
  "Arbitrary fragment work. Honestly flagged L2-GPU: floating point differs between hardware and we say so.",
);

reg(
  "displacement",
  "K · SHADER",
  "IMAGE + FIELD → IMAGE",
  {
    amount: { v: 0.4, lo: 0, hi: 1 },
    scale: { v: 0.4, lo: 0.05, hi: 1 },
    chroma: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t, upstream) {
        bg(ctx, w, h);
        const src = upstream?.canvas || srcImage(w, h, t * 0.4, n),
          im = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h),
          c = 4;
        for (let y = 0; y < h; y += c)
          for (let x = 0; x < w; x += c) {
            const dx =
              fbm(n, (x / w) * 5 * p.scale, (y / h) * 5 * p.scale + t * 0.1, 3, 0.6) *
              p.amount *
              90;
            const dy =
              fbm(n, (x / w) * 5 * p.scale + 7, (y / h) * 5 * p.scale - t * 0.1, 3, 0.6) *
              p.amount *
              90;
            const sx = Math.round(clampv(x + dx, 0, w - 1)),
              sy = Math.round(clampv(y + dy, 0, h - 1));
            const g = im.data[(sy * w + sx) * 4];
            if (p.chroma > 0.02) {
              const sx2 = Math.round(clampv(x + dx * (1 + p.chroma), 0, w - 1));
              const g2 = im.data[(sy * w + sx2) * 4];
              ctx.fillStyle = "rgb(" + g2 + "," + g + "," + Math.min(255, (g * 1.05) | 0) + ")";
            } else ctx.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
            ctx.fillRect(x, y, c, c);
          }
        lab(ctx, "L2-GPU · DISTORT BY FIELD", 10, h - 16, "#d9a441");
      },
    };
  },
  "Distortion driven by a field, with optional chromatic separation. Instability as a controlled parameter.",
);

reg(
  "chromatic_split",
  "K · SHADER",
  "IMAGE → IMAGE",
  {
    amount: { v: 0.4, lo: 0, hi: 1 },
    angle: { v: 0.3, lo: 0, hi: 1 },
    pulse: { v: 0.4, lo: 0, hi: 1 },
  },
  (p) => {
    const n = vnoise(1337);
    return {
      frame(ctx, w, h, t, upstream) {
        bg(ctx, w, h);
        const src = upstream?.canvas || srcImage(w, h, t * 0.3, n),
          a = p.angle * 6.283,
          amt = p.amount * 22 * (1 + Math.sin(t * 3) * p.pulse);
        ctx.globalCompositeOperation = "lighter";
        const chans = [
          ["rgba(216,98,74,.9)", 1],
          ["rgba(110,220,180,.7)", 0],
          ["rgba(111,158,196,.9)", -1],
        ];
        chans.forEach(([col, dir]) => {
          ctx.save();
          ctx.translate(Math.cos(a) * amt * dir, Math.sin(a) * amt * dir);
          ctx.drawImage(src, 0, 0);
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = col;
          ctx.fillRect(-40, -40, w + 80, h + 80);
          ctx.restore();
          ctx.globalCompositeOperation = "lighter";
        });
        ctx.globalCompositeOperation = "source-over";
        lab(ctx, "L2-GPU · RGB SEPARATION " + amt.toFixed(1) + "px", 10, h - 16, "#d9a441");
      },
    };
  },
  "Channel separation. Reserved for moments where the image itself should read as unreliable.",
);

reg(
  "feedback",
  "K · SHADER",
  "IMAGE → IMAGE",
  {
    zoom: { v: 0.5, lo: 0, hi: 1 },
    rotate: { v: 0.3, lo: 0, hi: 1 },
    decay: { v: 0.5, lo: 0.1, hi: 1 },
  },
  (p) => {
    let buf = null;
    return {
      frame(ctx, w, h, t) {
        if (!buf || buf.width !== w) {
          buf = document.createElement("canvas");
          buf.width = w;
          buf.height = h;
        }
        const b = buf.getContext("2d");
        b.fillStyle = "rgba(13,15,17," + (0.02 + p.decay * 0.1) + ")";
        b.fillRect(0, 0, w, h);
        b.save();
        b.translate(w / 2, h / 2);
        b.scale(1 + p.zoom * 0.03, 1 + p.zoom * 0.03);
        b.rotate((p.rotate - 0.5) * 0.02);
        b.globalAlpha = 0.96;
        b.drawImage(buf, -w / 2, -h / 2);
        b.restore();
        b.globalAlpha = 1;
        b.fillStyle = EMB;
        b.save();
        b.translate(w / 2 + Math.cos(t * 0.7) * w * 0.2, h / 2 + Math.sin(t * 1.1) * h * 0.22);
        b.rotate(t * 0.5);
        b.fillRect(-13, -13, 26, 26);
        b.restore();
        ctx.drawImage(buf, 0, 0);
        lab(ctx, "STATEFUL · FRAME N DEPENDS ON N−1 · RENDER SERIALLY", 10, h - 16, "#d9a441");
      },
    };
  },
  "Previous frame as input. Excluded from Phase 0 chunked rendering: it breaks per-frame independence.",
  1,
);
