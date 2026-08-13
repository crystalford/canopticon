/* CANOPTICON — family S (generative entities) and the image→material bridge.
 *
 * Everything in families A–R paints a TEXTURE or a GRAPHIC. This file is the
 * first of a different kind: a procedural SUBJECT. `creature_chain` is not a
 * centipede asset — it is a body plan. Change the parameters and the same
 * machinery yields a worm, a millipede, a serpent, or an arthropod that does
 * not exist. Determinism is unaffected: same seed + same params + same t
 * gives the same creature and the same gait, frame for frame.
 *
 * The thing that makes a many-legged creature read as alive is not the
 * number of legs — it is the METACHRONAL WAVE: each leg pair is phase-offset
 * from the one ahead of it, so a travelling wave runs down the body. Set
 * `wave` to 0 and the legs move in lockstep and it dies instantly. That
 * single parameter is the difference between an animation and an organism.
 */

/* ── S. GENERATIVE ENTITY ───────────────────────────── */

const TAU = Math.PI * 2;

reg(
  "creature_chain",
  "S · ENTITY",
  "— → IMAGE",
  {
    segments: { v: 22, lo: 5, hi: 60, int: 1 },
    legPairs: { v: 1, lo: 0, hi: 2, int: 1 },
    wave: { v: 0.5, lo: 0, hi: 1 },
    stride: { v: 0.5, lo: 0, hi: 1 },
    gait: { v: 0.55, lo: 0.05, hi: 1 },
    scale: { v: 0.45, lo: 0.12, hi: 1 },
    count: { v: 1, lo: 1, hi: 12, int: 1 },
    wander: { v: 0.45, lo: 0, hi: 1 },
    speed: { v: 0.5, lo: 0.05, hi: 1 },
  },
  (p) => {
    let colony = [];
    let key = "";
    const noise = vnoise(1337);

    const build = (w, h) => {
      const n = Math.round(p.count);
      const segs = Math.round(p.segments);
      const rnd = mulberry(4242);
      colony = Array.from({ length: n }, (_, i) => {
        const x = w * (0.15 + rnd() * 0.7);
        const y = h * (0.15 + rnd() * 0.7);
        return {
          id: i,
          heading: rnd() * TAU,
          // Each creature samples the steering field at its own offset, so a
          // colony spreads instead of moving as one rigid block.
          drift: rnd() * 100,
          pts: Array.from({ length: segs }, () => ({ x, y })),
        };
      });
    };

    return {
      frame(ctx, w, h, t) {
        const k = [p.count, p.segments, w, h].join();
        if (k !== key) {
          key = k;
          build(w, h);
        }

        bg(ctx, w, h);

        const S = 3 + p.scale * 9; // body radius of the widest segment
        const spacing = S * 0.92;
        const step = (0.4 + p.speed * 2.6) * (S / 6);

        for (const c of colony) {
          // ── locomotion: the head steers, the body follows ──────────
          const head = c.pts[0];
          const turn = fbm(
            noise,
            (head.x / w) * 2.4 + c.drift,
            (head.y / h) * 2.4 + t * 0.09,
            3,
            0.5,
          );
          c.heading += turn * p.wander * 0.28;
          head.x += Math.cos(c.heading) * step;
          head.y += Math.sin(c.heading) * step;

          // Steer away from the edges rather than wrapping. Wrapping teleports
          // the head across the frame while the body is still on the far side,
          // and the follow constraint below then drags the chain the wrong way
          // through the seam until it collapses into a single point. It also
          // just looks wrong in a shot. Turning back reads as an organism
          // meeting a wall, and keeps the chain continuous.
          const margin = S * 7;
          const edge = Math.min(head.x, w - head.x, head.y, h - head.y);
          if (edge < margin) {
            const toCentre = Math.atan2(h / 2 - head.y, w / 2 - head.x);
            let delta = toCentre - c.heading;
            while (delta > Math.PI) delta -= TAU;
            while (delta < -Math.PI) delta += TAU;
            c.heading += delta * 0.07 * (1 - Math.max(0, edge) / margin);
          }
          head.x = Math.max(S, Math.min(w - S, head.x));
          head.y = Math.max(S, Math.min(h - S, head.y));

          // Follow-the-leader constraint. The undulation is emergent: each
          // segment is simply pulled to a fixed distance behind the one in
          // front, and the lag does the rest.
          for (let i = 1; i < c.pts.length; i++) {
            const a = c.pts[i - 1];
            const b = c.pts[i];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy) || 1;
            b.x += dx * (1 - spacing / d);
            b.y += dy * (1 - spacing / d);
          }

          drawCreature(ctx, c, p, S, t);
        }

        lab(
          ctx,
          `${Math.round(p.count)}× · ${Math.round(p.segments)} SEG · ${Math.round(p.legPairs) * Math.round(p.segments) * 2} LEGS · WAVE ${p.wave.toFixed(2)}`,
          10,
          h - 16,
        );
      },
    };
  },
  "A body plan, not an asset. Segment count, leg pairs and gait phase are axes — the same machinery gives a worm, a millipede, or an arthropod that never existed. `wave` is the metachronal phase offset: set it to 0 and the legs move in lockstep and the thing dies.",
);

function drawCreature(ctx, c, p, S, t) {
  const pts = c.pts;
  const pairs = Math.round(p.legPairs);
  const legLen = S * (2.1 + p.stride * 1.1);
  const cycle = t * (0.6 + p.gait * 3.4);

  // ── legs, drawn under the body ────────────────────────────────────
  if (pairs > 0) {
    for (let i = 1; i < pts.length - 1; i++) {
      const seg = pts[i];
      const prev = pts[i - 1];
      const ang = Math.atan2(seg.y - prev.y, seg.x - prev.x);
      const px = Math.cos(ang + Math.PI / 2);
      const py = Math.sin(ang + Math.PI / 2);
      const taper = segTaper(i, pts.length);
      if (taper < 0.25) continue;

      for (let g = 0; g < pairs; g++) {
        for (const side of [-1, 1]) {
          // The metachronal wave: phase runs backwards along the body, so
          // the legs move as a travelling wave rather than in unison.
          // Opposite sides are a half-cycle apart (alternating tripod-ish).
          const phase = cycle - i * p.wave * 0.55 - g * 0.4 + (side > 0 ? Math.PI : 0);
          const swing = Math.sin(phase);
          // Stance is the half of the cycle where the foot drives backward.
          const planted = swing < 0;

          const hipX = seg.x + px * side * S * 0.55;
          const hipY = seg.y + py * side * S * 0.55;
          // Foot sweeps fore/aft along the body axis by `stride`.
          const reach = legLen * (0.72 + (planted ? 0.28 : 0.16));
          const fore = swing * S * (0.6 + p.stride * 1.9);
          const footX = hipX + px * side * reach + Math.cos(ang) * fore;
          const footY = hipY + py * side * reach + Math.sin(ang) * fore;
          // Knee kicks outward on the swing half so the leg reads as
          // lifting rather than sliding.
          const lift = planted ? 0.12 : 0.42;
          const kneeX = (hipX + footX) / 2 + px * side * S * lift * 2.2;
          const kneeY = (hipY + footY) / 2 + py * side * S * lift * 2.2;

          ctx.strokeStyle = planted
            ? `rgba(238,241,243,${0.5 * taper})`
            : `rgba(155,163,170,${0.3 * taper})`;
          ctx.lineWidth = planted ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
          ctx.stroke();

          if (planted) {
            ctx.fillStyle = `rgba(216,98,74,${0.5 * taper})`;
            ctx.fillRect(footX - 1, footY - 1, 2, 2);
          }
        }
      }
    }
  }

  // ── body ──────────────────────────────────────────────────────────
  for (let i = pts.length - 1; i >= 0; i--) {
    const s = pts[i];
    const r = S * segTaper(i, pts.length);
    const shade = 0.34 + 0.5 * (1 - i / pts.length);
    ctx.fillStyle = `rgba(${Math.round(150 * shade + 40)},${Math.round(158 * shade + 42)},${Math.round(166 * shade + 46)},0.96)`;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r, r * 0.86, 0, 0, TAU);
    ctx.fill();
    // A hairline along the leading edge separates the segments.
    if (i > 0) {
      ctx.strokeStyle = "rgba(13,15,17,.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ── head: antennae and a pair of eyes ─────────────────────────────
  const head = pts[0];
  const next = pts[1] || pts[0];
  const ha = Math.atan2(head.y - next.y, head.x - next.x);
  const hp = ha + Math.PI / 2;
  ctx.strokeStyle = "rgba(216,98,74,.75)";
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    const wag = Math.sin(cycle * 0.8 + (side > 0 ? 1.6 : 0)) * 0.36;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.quadraticCurveTo(
      head.x + Math.cos(ha + side * 0.5) * S * 2,
      head.y + Math.sin(ha + side * 0.5) * S * 2,
      head.x + Math.cos(ha + side * (0.75 + wag)) * S * 3.6,
      head.y + Math.sin(ha + side * (0.75 + wag)) * S * 3.6,
    );
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(13,15,17,.85)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(ha) * S * 0.3 + Math.cos(hp) * side * S * 0.42,
      head.y + Math.sin(ha) * S * 0.3 + Math.sin(hp) * side * S * 0.42,
      Math.max(0.9, S * 0.17),
      0,
      TAU,
    );
    ctx.fill();
  }
}

/** Segments taper at both ends — fat through the thorax, thin at the tail.
 *  A uniform chain reads as a tube; the taper is what makes it a body. */
function segTaper(i, n) {
  const u = i / Math.max(1, n - 1);
  return Math.max(0.18, Math.sin(Math.PI * (0.14 + u * 0.78)) ** 0.65);
}

/* ── image → material ───────────────────────────────────────────────
 * The bridge that turns a picture into something the procedural engine can
 * manipulate. `glyph_to_points` already does this for text; this does it for
 * an arbitrary raster, which is the same code path a generated image takes.
 *
 * The Lab has no network, so `source` renders a procedural stand-in — a
 * skyline, a crowd, a document. The sampling and dissolution below are
 * identical regardless of where the pixels came from, which is the point:
 * a generated image is not output, it is raw material.
 */
reg(
  "image_to_points",
  "S · ENTITY",
  "IMAGE → GEOMETRY",
  {
    source: { v: 0, lo: 0, hi: 2, int: 1 },
    sampling: { v: 5, lo: 3, hi: 14, int: 1 },
    threshold: { v: 0.4, lo: 0.05, hi: 0.95 },
    dissolve: { v: 0, lo: 0, hi: 1 },
    drift: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => {
    let pts = [];
    let key = "";
    const noise = vnoise(909);

    return {
      frame(ctx, w, h, t, upstream) {
        // Accept either a bare canvas (older call sites) or the executor's
        // typed payload, so adding the payload did not have to be a
        // migration of every consumer at once.
        const input = upstream && upstream.canvas !== undefined ? upstream.canvas : upstream;
        if (input) {
          // Real upstream pixels — a rasterised entity, or a generated
          // plate. Re-sampled every frame because the source may be moving;
          // at these step sizes that is a few thousand reads, not a cost
          // worth caching incorrectly.
          pts = samplePixels(input, w, h, Math.round(p.sampling), p.threshold);
          key = "";
        } else {
          const k = [p.source, p.sampling, p.threshold, w, h].join();
          if (k !== key) {
            key = k;
            pts = sampleMaterial(w, h, Math.round(p.source), Math.round(p.sampling), p.threshold);
          }
        }

        bg(ctx, w, h);
        const d = p.dissolve;

        for (const q of pts) {
          let x = q.x;
          let y = q.y;
          if (d > 0) {
            // Points advect through a flow field as dissolution rises — the
            // image comes apart along its own structure, not by fading.
            const a = fbm(noise, (q.x / w) * 3, (q.y / h) * 3 + t * 0.1, 3, 0.5) * TAU * 1.6;
            const push = d * d * 90 * (0.4 + p.drift);
            x += Math.cos(a) * push + Math.cos(a) * Math.sin(t * 0.7 + q.seed) * push * 0.3;
            y += Math.sin(a) * push + Math.sin(a) * Math.cos(t * 0.6 + q.seed) * push * 0.3;
          }
          const alpha = (0.25 + q.v * 0.7) * (1 - d * 0.35);
          ctx.fillStyle = q.v > 0.82 ? `rgba(216,98,74,${alpha})` : `rgba(238,241,243,${alpha})`;
          ctx.fillRect(x, y, 1.6, 1.6);
        }

        // Report where the pixels actually came from. Naming the stand-in
        // while consuming a real upstream buffer would be a label that
        // lies about its own provenance.
        const origin = input ? "UPSTREAM" : ["SKYLINE", "CROWD", "DOCUMENT"][Math.round(p.source)];
        lab(ctx, `${pts.length} PTS · ${origin} · DISSOLVE ${d.toFixed(2)}`, 10, h - 16);
        // Hand the points downstream. This is what lets a concrete subject
        // — a fixture, a document, a generated plate — reach the kinetic
        // family and be morphed rather than merely re-photographed.
        return { geometry: pts };
      },
    };
  },
  "Turns a raster into geometry the engine can move. The Lab renders a procedural stand-in because it has no network, but the sampling path is identical for a generated image — which is the point: generated imagery is raw material, not output.",
);

/** Sample any canvas into a point cloud. This is the one function that
 *  makes a picture into geometry the engine can move — and it does not care
 *  whether the pixels came from a generated plate, a rasterised entity, or
 *  the procedural stand-in below. That indifference is the point. */
function samplePixels(source, w, h, step, threshold) {
  // Points carry x0/y0 — their origin — because a morph interpolates from
  // where a point started. Without it a concrete subject could be sampled
  // but never transformed.
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.drawImage(source, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h).data;
  const out = [];
  const rr = mulberry(77);
  for (let y = 0; y < h; y += step) {
    for (let px = 0; px < w; px += step) {
      const i = (y * w + px) * 4;
      const v = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      if (v < threshold) continue;
      out.push({ x: px, y, v, seed: rr() * TAU, x0: px, y0: y });
    }
  }
  return out;
}

/** Render a stand-in material offscreen, then sample it to a point cloud.
 *  Deterministic: every source is drawn from a fixed seed. */
function sampleMaterial(w, h, source, step, threshold) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, w, h);
  const r = mulberry(20260812);

  if (source === 0) {
    // Skyline: towers with lit windows.
    x.fillStyle = "#fff";
    let bx = -20;
    while (bx < w + 20) {
      const bw = 18 + r() * 54;
      const bh = h * (0.18 + r() * 0.55);
      x.globalAlpha = 0.55 + r() * 0.35;
      x.fillRect(bx, h - bh, bw, bh);
      x.globalAlpha = 1;
      for (let wy = h - bh + 8; wy < h - 10; wy += 11) {
        for (let wx = bx + 5; wx < bx + bw - 5; wx += 9) {
          if (r() > 0.45) x.fillRect(wx, wy, 3, 4);
        }
      }
      bx += bw + 4 + r() * 12;
    }
  } else if (source === 1) {
    // Crowd: a field of figures, denser toward the horizon.
    for (let i = 0; i < 420; i++) {
      const u = r();
      const px = r() * w;
      const py = h * (0.34 + u * u * 0.62);
      const s = 3 + (py / h) * 15;
      x.globalAlpha = 0.35 + (py / h) * 0.6;
      x.fillStyle = "#fff";
      x.beginPath();
      x.arc(px, py - s * 1.5, s * 0.42, 0, TAU);
      x.fill();
      x.fillRect(px - s * 0.34, py - s, s * 0.68, s);
    }
    x.globalAlpha = 1;
  } else {
    // Document: columns of ruled text with redactions.
    x.fillStyle = "#fff";
    x.globalAlpha = 0.9;
    x.fillRect(30, 22, w * 0.42, 10);
    x.globalAlpha = 1;
    const cols = 2;
    const cw = (w - 60 - (cols - 1) * 22) / cols;
    for (let col = 0; col < cols; col++) {
      const x0 = 30 + col * (cw + 22);
      for (let y = 52; y < h - 20; y += 9) {
        const lw = cw * (0.55 + r() * 0.45);
        x.globalAlpha = r() < 0.12 ? 1 : 0.28 + r() * 0.4;
        x.fillRect(x0, y, lw, r() < 0.12 ? 6 : 2.6);
      }
    }
    x.globalAlpha = 1;
  }

  const data = x.getImageData(0, 0, w, h).data;
  const out = [];
  const rr = mulberry(77);
  for (let y = 0; y < h; y += step) {
    for (let px = 0; px < w; px += step) {
      const i = (y * w + px) * 4;
      // Perceptual luminance — a blue window and a grey wall of the same
      // RGB sum are not equally bright to the eye.
      const v = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      if (v < threshold) continue;
      out.push({ x: px, y, v, seed: rr() * TAU });
    }
  }
  return out;
}
