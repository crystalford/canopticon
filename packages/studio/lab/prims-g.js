/* CANOPTICON — input-aware primitives: the first chain that actually runs.
 *
 * These three read the upstream buffer the executor hands them as the fifth
 * argument to frame(). They form the worked chain:
 *
 *   plate_scene → pixel_quantise → drift_parallax
 *   —  → IMAGE  →      IMAGE     →   ANIMATION
 *
 * `plate_scene` stands in for a generated plate. Its structure is the point:
 * a scene is big flat regions — sky, lot, store band, cars — which is why a
 * scene survives quantisation where a small mechanical object does not.
 * Swapping it for a real FLUX frame changes nothing downstream; that is what
 * makes generated imagery MATERIAL rather than output.
 *
 * Motion is drift and parallax rather than a zoom. Zooming a quantised
 * image inflates the art pixels with the camera, which reads as the grid
 * growing rather than the world moving. Lateral drift moves the world
 * through a grid that stays put — the same reason a side-scroller reads
 * correctly and a zoomed sprite does not.
 */

/* ── source plate ───────────────────────────────────────────────────── */
reg(
  "plate_scene",
  "T · MATERIAL",
  "— → IMAGE",
  {
    scene: { v: 0, lo: 0, hi: 1, int: 1 },
    cars: { v: 11, lo: 0, hi: 40, int: 1 },
    dusk: { v: 0.55, lo: 0, hi: 1 },
    life: { v: 0.5, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      const r = mulberry(31337);
      const dusk = p.dusk;
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.46);
      sky.addColorStop(0, `rgb(${20 + dusk * 26},${26 + dusk * 24},${36 + dusk * 26})`);
      sky.addColorStop(1, `rgb(${58 + dusk * 40},${64 + dusk * 30},${74 + dusk * 20})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.46);

      ctx.fillStyle = "#2a2f35";
      ctx.fillRect(0, h * 0.46, w, h * 0.54);
      ctx.fillStyle = "#6d7580";
      ctx.fillRect(0, h * 0.34, w, h * 0.12);
      ctx.fillStyle = "#aab3bd";
      for (let i = 0; i < 7; i++)
        ctx.fillRect(w * 0.06 + i * w * 0.13, h * 0.375, w * 0.06, h * 0.03);

      ctx.strokeStyle = "rgba(210,215,220,.45)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
        const x = w * 0.02 + i * w * 0.07;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.63);
        ctx.lineTo(x - w * 0.012, h * 0.99);
        ctx.stroke();
      }

      const n = Math.round(p.cars);
      for (let i = 0; i < n; i++) {
        const x = w * 0.04 + r() * w * 0.9;
        const y = h * (0.64 + r() * 0.29);
        const cw = w * 0.055;
        const ch = h * 0.05;
        ctx.fillStyle = ["#8e97a1", "#5b636d", "#39404a", "#a9b2bb"][Math.floor(r() * 4)];
        ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = "rgba(180,200,220,.45)";
        ctx.fillRect(x + cw * 0.15, y + ch * 0.12, cw * 0.7, ch * 0.4);
      }

      // Light poles. The flicker is the only thing moving in the plate
      // itself — enough that a held frame isn't dead, seeded so it is the
      // same flicker every run.
      for (let i = 0; i < 4; i++) {
        const x = w * 0.14 + i * w * 0.24;
        ctx.fillStyle = "#1b1f24";
        ctx.fillRect(x, h * 0.3, 2.5, h * 0.35);
        const flick = 0.72 + 0.28 * Math.sin(t * (1.6 + i * 0.7) + i * 2.1);
        ctx.fillStyle = `rgba(232,217,168,${(0.45 + p.life * 0.5) * flick})`;
        ctx.fillRect(x - 5, h * 0.29, 13, 4);
        const glow = ctx.createRadialGradient(x + 1, h * 0.3, 0, x + 1, h * 0.3, h * 0.16);
        glow.addColorStop(0, `rgba(232,217,168,${0.16 * flick * p.life})`);
        glow.addColorStop(1, "rgba(232,217,168,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - h * 0.16, h * 0.14, h * 0.32, h * 0.32);
      }
    },
  }),
  "A stand-in for a generated plate. Scenes are big flat regions, which is why they survive quantisation where a small mechanical object does not. Swap it for a real generated frame and nothing downstream changes — that is what makes generated imagery material rather than output.",
);

/* ── input-aware quantiser ──────────────────────────────────────────── */
const SCENE_RAMP = [
  [13, 15, 17],
  [34, 39, 44],
  [62, 69, 76],
  [118, 126, 134],
  [186, 192, 197],
  [238, 241, 243],
];

reg(
  "pixel_quantise",
  "T · MATERIAL",
  "IMAGE → IMAGE",
  {
    grid: { v: 5, lo: 2, hi: 16, int: 1 },
    levels: { v: 6, lo: 2, hi: 12, int: 1 },
    warmth: { v: 0.35, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, input) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      if (!input) {
        lab(ctx, "pixel_quantise: no upstream IMAGE", 10, h / 2);
        return;
      }

      const px = Math.max(2, Math.round(p.grid));
      const gw = Math.max(1, Math.round(w / px));
      const gh = Math.max(1, Math.round(h / px));
      const small = document.createElement("canvas");
      small.width = gw;
      small.height = gh;
      const s = small.getContext("2d");
      s.imageSmoothingEnabled = true;
      s.drawImage(input, 0, 0, gw, gh);

      // One shared ramp across all three channels. Quantising R, G and B
      // independently rounds a neutral grey into three different buckets
      // and manufactures colour speckle out of nothing — measured earlier
      // at 107 luma levels where the goal was fewer than 10.
      const img = s.getImageData(0, 0, gw, gh);
      const d = img.data;
      const stops = Math.max(2, Math.round(p.levels));
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
        const idx = Math.min(
          SCENE_RAMP.length - 1,
          Math.round(l * (stops - 1)) * ((SCENE_RAMP.length - 1) / (stops - 1)),
        );
        const stop = SCENE_RAMP[Math.round(idx)] || SCENE_RAMP[0];
        d[i] = Math.min(255, stop[0] + p.warmth * 26 * l);
        d[i + 1] = Math.min(255, stop[1] + p.warmth * 14 * l);
        d[i + 2] = stop[2];
      }
      s.putImageData(img, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
    },
  }),
  "Consumes the upstream IMAGE and snaps it to a fixed ramp at a fixed grid. One ramp shared across all channels: quantising channels independently invents colour on neutral greys.",
);

/* ── motion ─────────────────────────────────────────────────────────── */
reg(
  "drift_parallax",
  "T · MATERIAL",
  "IMAGE → ANIMATION",
  {
    drift: { v: 0.45, lo: 0, hi: 1 },
    depth: { v: 0.5, lo: 0, hi: 1 },
    sway: { v: 0.3, lo: 0, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t, input) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      if (!input) {
        lab(ctx, "drift_parallax: no upstream IMAGE", 10, h / 2);
        return;
      }
      ctx.imageSmoothingEnabled = false;

      // Three horizontal bands moving at different rates. Not a zoom: the
      // grid stays the size it was, and the world slides through it.
      // Whole-pixel offsets only — a sub-pixel slide would resample the
      // quantised plate and put the soft edges straight back.
      const bands = [
        { y0: 0, y1: 0.46, rate: 0.28 },
        { y0: 0.46, y1: 0.66, rate: 0.62 },
        { y0: 0.66, y1: 1, rate: 1 },
      ];
      for (const band of bands) {
        const y = Math.round(band.y0 * h);
        const bh = Math.round((band.y1 - band.y0) * h) + 1;
        const speed = p.drift * 26 * (0.4 + band.rate * p.depth);
        const dx = Math.round(-t * speed) % w;
        const sway = Math.round(Math.sin(t * 0.5 + band.rate) * p.sway * 4);
        for (const pass of [0, w]) {
          ctx.drawImage(input, 0, y, w, bh, dx + pass, y + sway, w, bh);
        }
      }
      ctx.imageSmoothingEnabled = true;
    },
  }),
  "Lateral drift with per-band parallax, at whole-pixel offsets. Motion without a zoom: zooming a quantised frame inflates the art pixels with the camera, which reads as the grid growing rather than the world moving.",
);
