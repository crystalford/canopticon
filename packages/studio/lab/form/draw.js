/* DRAWING A FORM — as coverage, into the same plate as the type.
 *
 * Forms are laid into the ink plate rather than composited afterwards, so
 * knockout, boil, registration, the press and every process apply to them
 * exactly as they apply to text, with no second code path. Standing rule 11:
 * every system that operates on a visual program treats the new structure, or
 * none of them do. A form drawn after the press would be a sticker.
 *
 * Nothing here knows what it is drawing. It is handed limbs, dots, boundaries
 * and cells; it does not know whether they add up to something that reads as a
 * bloom, a body or a sheet, and it must not — the moment this file branches on
 * a name, the generator has become a library again.
 */

/** Draw the grown portion of a form. `x`/`y` are frame fractions; `scale`
 *  sizes the whole structure; `ink` is the coverage colour, which is always
 *  white because the plate is coverage rather than picture. */
export function drawForm(p, grown, x, y, scale, w, h, ink = "#fff") {
  p.save();
  p.translate(x * w, y * h);
  const s = scale * Math.min(w, h);
  p.lineCap = "round";
  p.lineJoin = "round";

  // BOUNDARIES FIRST. A membrane is behind the structure that generated it,
  // the way a body is behind the limbs that define its edge.
  for (const hu of grown.hulls) {
    if (hu.pts.length < 3) continue;
    p.beginPath();
    // Grown boundaries close progressively, so a body forms rather than
    // appearing — the arc of the boundary is the arc of it becoming a thing.
    const n = Math.max(3, Math.round(hu.pts.length * hu.grown));
    p.moveTo(hu.pts[0].x * s, hu.pts[0].y * s);
    for (let i = 1; i < n; i++) p.lineTo(hu.pts[i].x * s, hu.pts[i].y * s);
    if (n >= hu.pts.length) p.closePath();
    p.globalAlpha = Math.min(1, hu.fill);
    p.fillStyle = ink;
    if (n >= hu.pts.length) p.fill();
    p.globalAlpha = 1;
    p.strokeStyle = ink;
    p.lineWidth = Math.max(1, s * 0.004);
    p.stroke();
  }

  for (const r of grown.rects) {
    p.globalAlpha = 1;
    const rw = r.w * s * r.grown;
    const rh = r.h * s;
    if (r.fill) {
      p.fillStyle = ink;
      p.fillRect(r.x * s, r.y * s, rw, rh);
    } else {
      p.strokeStyle = ink;
      p.lineWidth = Math.max(1, s * 0.003);
      p.strokeRect(r.x * s, r.y * s, rw, rh);
    }
  }

  // LIMBS. Each is drawn only as far as it has grown, along its own polyline,
  // so the structure extends rather than fading up.
  p.strokeStyle = ink;
  for (const l of grown.limbs) {
    const pts = l.pts;
    if (pts.length < 2) continue;
    const upto = 1 + (pts.length - 1) * Math.max(0, Math.min(1, l.grown));
    const whole = Math.floor(upto);
    p.lineWidth = Math.max(0.6, l.w * s);
    p.beginPath();
    p.moveTo(pts[0].x * s, pts[0].y * s);
    for (let i = 1; i < whole; i++) p.lineTo(pts[i].x * s, pts[i].y * s);
    // The partial segment at the growing end, so the tip advances smoothly
    // between frames instead of stepping vertex to vertex.
    if (whole < pts.length) {
      const f = upto - whole;
      const a = pts[whole - 1];
      const b = pts[whole];
      p.lineTo((a.x + (b.x - a.x) * f) * s, (a.y + (b.y - a.y) * f) * s);
    }
    p.stroke();
  }

  p.fillStyle = ink;
  for (const d of grown.dots) {
    const r = d.r * s * d.grown;
    if (r < 0.4) continue;
    p.beginPath();
    p.arc(d.x * s, d.y * s, r, 0, Math.PI * 2);
    p.fill();
  }

  p.restore();
}

/** Where the form's mass is, in frame fractions, so the type placer can
 *  compose around it rather than on top of it. Reuses nothing but arithmetic;
 *  the occupancy map itself is `comp/layout.js`'s and stays the only one. */
export function formMass(built, x, y, scale) {
  const pts = [];
  for (const l of built.limbs) for (const q of l.pts) pts.push(q);
  for (const d of built.dots) pts.push(d);
  if (pts.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return {
    x: x + x0 * scale,
    y: y + y0 * scale,
    w: (x1 - x0) * scale,
    h: (y1 - y0) * scale,
  };
}
