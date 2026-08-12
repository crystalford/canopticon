/* CANOPTICON — the representation ladder.
 *
 * The centipede proved code can generate a SUBJECT. This proves the other
 * half: one subject, rendered through fundamentally different visual
 * ontologies, from a single geometry.
 *
 * `mounted_fixture` is a body plan, not a smoke detector — disc radius,
 * rim depth, dome, vent count and LED are axes, so the same machinery is a
 * smoke detector, a ceiling speaker, a sprinkler head, or a camera dome.
 * It builds real 3-D-ish geometry and projects it under a moving camera.
 *
 * `representation` is the axis that matters. The geometry is computed ONCE
 * and then drawn as solid, illustrated, technical, pixel, or points. That
 * is the difference between a style preset and a visual ontology: the
 * subject's identity is invariant, its mode of depiction is not. A director
 * can hold the object fixed and travel the ladder mid-shot — realistic to
 * diagrammatic to 16-bit to particles — without the thing ever stopping
 * being a smoke detector.
 *
 * Seeded and deterministic like everything else: same params + same t give
 * the same frame.
 */

const LADDER_MODES = ["SOLID", "ILLUSTRATED", "TECHNICAL", "PIXEL", "POINTS"];

reg(
  "mounted_fixture",
  "S · ENTITY",
  "— → ENTITY",
  {
    representation: { v: 0, lo: 0, hi: 4, int: 1 },
    radius: { v: 0.5, lo: 0.15, hi: 1 },
    depth: { v: 0.45, lo: 0.05, hi: 1 },
    vents: { v: 12, lo: 0, hi: 32, int: 1 },
    dome: { v: 0.4, lo: 0, hi: 1 },
    spin: { v: 0.35, lo: 0, hi: 1 },
    pitch: { v: 0.5, lo: 0, hi: 1 },
    push: { v: 0.35, lo: 0, hi: 1 },
    led: { v: 1, lo: 0, hi: 1, int: 1 },
  },
  (p) => {
    let geo = null;
    let key = "";

    return {
      frame(ctx, w, h, t) {
        const k = [p.radius, p.depth, p.vents, p.dome].join();
        if (k !== key) {
          key = k;
          geo = buildFixture(p);
        }

        const mode = Math.round(p.representation);
        // Camera: a slow push combined with a yaw sweep. The push is what
        // makes a flat object read as occupying space.
        const yaw = t * p.spin * 0.9;
        const pitchAng = (0.12 + p.pitch * 0.55) * Math.PI * 0.5;
        const dist = 4.6 - p.push * 1.9 - Math.sin(t * 0.35) * p.push * 0.5;
        const scale = Math.min(w, h) * 0.42;

        const project = (v) => {
          // yaw about Y, then pitch about X, then perspective divide.
          const cy = Math.cos(yaw);
          const sy = Math.sin(yaw);
          const x1 = v.x * cy - v.z * sy;
          const z1 = v.x * sy + v.z * cy;
          const cp = Math.cos(pitchAng);
          const sp = Math.sin(pitchAng);
          const y2 = v.y * cp - z1 * sp;
          const z2 = v.y * sp + z1 * cp;
          const k2 = 1 / (dist + z2);
          return { x: w / 2 + x1 * scale * k2 * 2.4, y: h / 2 + y2 * scale * k2 * 2.4, z: z2 };
        };

        if (mode === 3) {
          drawPixel(ctx, w, h, geo, project, p, t);
        } else {
          bg(ctx, w, h);
          drawFixture(ctx, geo, project, mode, p, t, w, h);
        }

        lab(ctx, `MOUNTED FIXTURE · ${LADDER_MODES[mode]} · SAME GEOMETRY`, 10, h - 16);
      },
    };
  },
  "A body plan for a ceiling fixture — a smoke detector is one parameterisation, so is a speaker or a sprinkler. The `representation` axis draws ONE geometry as solid, illustrated, technical, pixel or points: the subject's identity is invariant, its mode of depiction is not.",
);

/** Build the fixture once as 3-D rings. Reused by every representation —
 *  that reuse is the whole argument: the ladder changes depiction, not
 *  identity. */
function buildFixture(p) {
  const R = 0.4 + p.radius * 0.55;
  const D = 0.06 + p.depth * 0.28;
  const SEG = 48;
  const ring = (r, y, bulge) =>
    Array.from({ length: SEG }, (_, i) => {
      const a = (i / SEG) * Math.PI * 2;
      return { x: Math.cos(a) * r, y: y - (bulge || 0), z: Math.sin(a) * r };
    });

  // Face rings from the outer rim inward, the innermost lifted into a dome.
  const rings = [];
  const steps = 5;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const r = R * (1 - u * 0.82);
    const bulge = Math.sin(u * Math.PI * 0.5) * p.dome * D * 1.4;
    rings.push(ring(r, 0, bulge));
  }
  // The rim: the same outer circle pushed back, which is what gives the
  // silhouette thickness when the camera comes round.
  const back = ring(R, D, 0);

  const ventCount = Math.round(p.vents);
  const vents = [];
  for (let i = 0; i < ventCount; i++) {
    const a = (i / Math.max(1, ventCount)) * Math.PI * 2;
    const r0 = R * 0.42;
    const r1 = R * 0.86;
    vents.push([
      { x: Math.cos(a) * r0, y: -p.dome * D * 0.5, z: Math.sin(a) * r0 },
      { x: Math.cos(a) * r1, y: -p.dome * D * 0.15, z: Math.sin(a) * r1 },
    ]);
  }

  const led = { x: R * 0.52, y: -p.dome * D * 0.7, z: 0 };
  return { rings, back, vents, led, R, D };
}

function drawFixture(ctx, geo, project, mode, p, t, w, h) {
  const outer = geo.rings[0].map(project);
  const back = geo.back.map(project);

  // ── rim: the band between the face edge and the back edge ─────────
  if (mode !== 4) {
    ctx.beginPath();
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const c = back[(i + 1) % back.length];
      const d = back[i];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
    }
    if (mode === 2) {
      ctx.strokeStyle = "rgba(111,158,196,.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = mode === 1 ? "#3d444b" : "#2b3137";
      ctx.fill();
    }
  }

  // ── face: concentric rings, shaded from the outside in ────────────
  for (let s = geo.rings.length - 1; s >= 0; s--) {
    const pts = geo.rings[s].map(project);
    const u = s / (geo.rings.length - 1);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();

    if (mode === 4) {
      ctx.fillStyle = `rgba(238,241,243,${0.25 + u * 0.5})`;
      for (const q of pts) ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
      continue;
    }
    if (mode === 2) {
      ctx.strokeStyle = `rgba(111,158,196,${0.3 + u * 0.45})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      continue;
    }
    // SOLID shades continuously; ILLUSTRATED posterises to flat bands.
    const lit = 0.42 + u * 0.5;
    const v = mode === 1 ? Math.round(lit * 4) / 4 : lit;
    const g = Math.round(150 + v * 95);
    ctx.fillStyle = `rgb(${g},${g + 3},${g + 7})`;
    ctx.fill();
    if (mode === 1) {
      ctx.strokeStyle = "rgba(13,15,17,.75)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  // ── vents ─────────────────────────────────────────────────────────
  for (const [a, b] of geo.vents) {
    const pa = project(a);
    const pb = project(b);
    if (mode === 4) {
      ctx.fillStyle = "rgba(216,98,74,.6)";
      ctx.fillRect(pb.x - 1, pb.y - 1, 2, 2);
      continue;
    }
    ctx.strokeStyle = mode === 2 ? "rgba(111,158,196,.6)" : "rgba(13,15,17,.5)";
    ctx.lineWidth = mode === 2 ? 1 : 2.2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // ── LED: the one thing that makes it read as a working device ─────
  if (p.led > 0.5) {
    const l = project(geo.led);
    const blink = 0.35 + 0.65 * (Math.sin(t * 2.2) > 0.92 ? 1 : 0.12);
    ctx.fillStyle = `rgba(216,98,74,${blink})`;
    ctx.beginPath();
    ctx.arc(l.x, l.y, Math.max(1.6, 4 - 0), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── technical mode earns its name: real callouts ──────────────────
  if (mode === 2) {
    const l = project(geo.led);
    ctx.strokeStyle = "rgba(155,163,170,.5)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(w * 0.78, h * 0.3);
    ctx.stroke();
    ctx.setLineDash([]);
    lab(ctx, "INDICATOR", w * 0.78 + 4, h * 0.3 - 4, "#9ba3aa");
    const e = outer[0];
    ctx.strokeStyle = "rgba(155,163,170,.5)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(w * 0.2, h * 0.74);
    ctx.stroke();
    ctx.setLineDash([]);
    lab(ctx, `Ø ${(geo.R * 2 * 170).toFixed(0)} MM`, w * 0.2 - 46, h * 0.74 + 4, "#9ba3aa");
  }
}

/** PIXEL is not a filter over the finished frame — it re-renders the same
 *  geometry into a low-resolution buffer and scales it up with smoothing
 *  off, so the quantisation is in the depiction rather than smeared on
 *  top. That is why the silhouette stays crisp at 16-bit sizes. */
function drawPixel(ctx, w, h, geo, project, p, t) {
  const res = Math.max(28, Math.round(120 - p.push * 60));
  const small = document.createElement("canvas");
  const aspect = h / w;
  small.width = res;
  small.height = Math.round(res * aspect);
  const s = small.getContext("2d");

  const sx = small.width / w;
  const sy = small.height / h;
  const scaled = (v) => {
    const q = project(v);
    return { x: q.x * sx, y: q.y * sy, z: q.z };
  };

  s.fillStyle = BG;
  s.fillRect(0, 0, small.width, small.height);
  drawFixture(s, geo, scaled, 0, p, t, small.width, small.height);

  // Quantise to a limited palette — the other half of what makes pixel
  // art read as pixel art. A low resolution alone still looks photographic.
  const img = s.getImageData(0, 0, small.width, small.height);
  const d = img.data;
  const levels = 5;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round((d[i] / 255) * levels) * (255 / levels);
    d[i + 1] = Math.round((d[i + 1] / 255) * levels) * (255 / levels);
    d[i + 2] = Math.round((d[i + 2] / 255) * levels) * (255 / levels);
  }
  s.putImageData(img, 0, 0);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

/* ── the missing link: ENTITY → IMAGE ───────────────────────────────
 * Building the first real treatment chain exposed a hole in the type
 * graph: `mounted_fixture` and `creature_chain` emit ENTITY, and nothing
 * consumed it. So `fixture → pixelate` did not typecheck, correctly —
 * pixelate takes IMAGE.
 *
 * That is not a bug in the type system, it is the type system being right.
 * An entity is a scene object with geometry and behaviour; it has to be
 * RASTERISED before a compositing or raster primitive can touch it. This
 * is that step, and it is what lets a subject travel into the pixel,
 * particle and raster families without the engine pretending an entity and
 * a picture are the same thing.
 */
reg(
  "entity_render",
  "S · ENTITY",
  "ENTITY → IMAGE",
  {
    exposure: { v: 0.5, lo: 0, hi: 1 },
    contrast: { v: 0.5, lo: 0, hi: 1 },
    vignette: { v: 0.35, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      // Standing in for the upstream entity's own draw call: the chain
      // executor hands this the entity's framebuffer. On its own it shades
      // the plate so the exposure/vignette controls are legible.
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      const lift = Math.round(20 + p.exposure * 60);
      g.addColorStop(0, `rgb(${lift},${lift + 3},${lift + 6})`);
      g.addColorStop(1, BG);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (p.vignette > 0) {
        const v = ctx.createRadialGradient(
          w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62,
        );
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, `rgba(0,0,0,${p.vignette * 0.85})`);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);
      }
      lab(ctx, "ENTITY → IMAGE · rasterise before compositing", 10, h - 16);
    },
  }),
  "The rasterisation step. An ENTITY carries geometry and behaviour; a raster or compositing primitive needs pixels. Without this a subject cannot legally reach the pixel, particle or raster families — the type system doing its job, not obstructing it.",
);
