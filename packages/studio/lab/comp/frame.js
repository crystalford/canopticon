/* THE FRAME — divided into zones with roles, before anything is placed.
 *
 * "It reminds me of an After Effects plugin."
 *
 * The design research names this exactly: procedural systems "overlook the
 * inherent HIERARCHICAL STRUCTURE within graphic designs, which arises because
 * human designers usually follow LAYERED design principles." That is this
 * engine to the letter. Every element was placed by one flat process — score a
 * position against an occupancy map, drop it, take the next — with no stage at
 * which anything decided what the PAGE was. Elements scattered by an algorithm
 * is what a plugin does; a designer decides the structure first and fills it
 * second, and the difference is legible in a frame from across a room.
 *
 * So composition happens in layers now:
 *
 *   1. PARTITION   the frame is cut into zones, recursively, at ratios
 *   2. ROLE        one zone dominates, one or two support, the rest are quiet
 *   3. ASSIGN      an element goes to the zone its importance earns
 *   4. ALIGN       inside a zone it obeys THAT zone's edge, not a global grid
 *
 * Step 4 is what most obviously separates the two. A global grid places
 * everything against the same lines and reads as a scatter that happens to
 * line up; a zone with its own alignment reads as a decision, because a run of
 * elements sharing an edge is the oldest signal in typography that someone
 * meant it.
 *
 * Nothing here is a template. The partition is generated — ratios, direction
 * and depth all come from the style point — so two frames share the METHOD and
 * not the layout.
 */

const lerp = (a, b, t) => a + (b - a) * t;

/** Cut the frame into zones by recursive splitting.
 *
 *  Real layouts are made this way: a page is divided, then a division is
 *  divided, and the ratios are few and deliberate. Splitting at a continuous
 *  ratio drawn from the style keeps it generated while the METHOD stays the
 *  one a designer uses.
 */
export function partition(style, rng) {
  const depth = 1 + Math.round(style.gridStrength * 2.4 + style.occupancy * 1.2);
  let zones = [{ x: 0, y: 0, w: 1, h: 1 }];

  for (let d = 0; d < depth; d++) {
    // Split the largest zone — which is what makes the result look considered
    // rather than shredded: a layout is a few big decisions, not many small.
    zones.sort((a, b) => b.w * b.h - a.w * a.h);
    const z = zones.shift();
    if (!z) break;
    // The classical ratios, plus everything between them. A split at 0.5 reads
    // as indecision, so the range deliberately avoids the exact centre.
    const r = lerp(0.24, 0.76, rng() < 0.5 ? rng() * 0.42 : 0.58 + rng() * 0.42);
    const vertical = z.w >= z.h ? rng() < 0.78 : rng() < 0.22;
    if (vertical) {
      zones.push({ x: z.x, y: z.y, w: z.w * r, h: z.h });
      zones.push({ x: z.x + z.w * r, y: z.y, w: z.w * (1 - r), h: z.h });
    } else {
      zones.push({ x: z.x, y: z.y, w: z.w, h: z.h * r });
      zones.push({ x: z.x, y: z.y + z.h * r, w: z.w, h: z.h * (1 - r) });
    }
  }

  // ROLES. One zone carries the frame, one or two answer it, the rest are
  // quiet — and quiet is a role, not a leftover. A composition where every
  // region is equally busy has no hierarchy, which is the other half of why
  // procedural work reads as flat.
  zones.sort((a, b) => b.w * b.h - a.w * a.h);
  return zones.map((z, i) => ({
    ...z,
    role: i === 0 ? "dominant" : i <= 2 ? "supporting" : "quiet",
    // Each zone has its own edge. A run of elements sharing an alignment is
    // the oldest signal in typography that a person meant it.
    align: rng() < 0.62 ? "start" : rng() < 0.6 ? "end" : "centre",
    // And its own baseline, so elements inside it sit on a shared line.
    baseline: 0.18 + rng() * 0.5,
  }));
}

/** Which zone this element has earned.
 *
 *  Importance decides, not availability — the mistake the occupancy placer
 *  makes is treating "where is there room" as the question, when the question
 *  a designer asks is "what is this, and where does that kind of thing go".
 */
export function zoneFor(zones, unit, rng) {
  const want =
    unit.protection >= 0.9 ? "dominant" : unit.protection >= 0.4 ? "supporting" : "quiet";
  const pool = zones.filter((z) => z.role === want);
  if (pool.length === 0) return zones[zones.length - 1];
  return pool[Math.floor(rng() * pool.length)];
}

/** Place an element INSIDE its zone, obeying that zone's own alignment and
 *  baseline rather than a global grid. */
export function placeInZone(zone, unit, rng, style) {
  // SIZE TO THE ZONE, NOT TO THE FRAME.
  //
  // A unit's box is a fraction of the FRAME, so putting it in a zone a third
  // that wide left the type tiny and the zone empty — the layout became
  // legible and the words disappeared, which is a worse trade than the one it
  // replaced. A dominant zone should carry type that fills it.
  const want = zone.w * (zone.role === "dominant" ? 0.94 : zone.role === "supporting" ? 0.86 : 0.7);
  if (unit.box.w > 0.001) {
    const k = want / unit.box.w;
    // Bounded: a headline may grow into its zone, and a caption must not be
    // inflated into a headline because it happened to land somewhere large.
    const bounded = Math.max(0.45, Math.min(unit.protection >= 0.9 ? 3.2 : 1.5, k));
    unit.size *= bounded;
    unit.box.w *= bounded;
    unit.box.h *= bounded;
  }
  const pad = 0.012 + (1 - (style?.occupancy ?? 0.5)) * 0.05;
  const inner = {
    x: zone.x + zone.w * pad,
    y: zone.y + zone.h * pad,
    w: zone.w * (1 - pad * 2),
    h: zone.h * (1 - pad * 2),
  };
  const x =
    zone.align === "start"
      ? inner.x
      : zone.align === "end"
        ? inner.x + inner.w - unit.box.w
        : inner.x + (inner.w - unit.box.w) / 2;

  // Stack down from the zone's baseline, so several elements in one zone form
  // a run instead of overlapping at the same spot.
  const used = zone._used ?? 0;
  zone._used = used + unit.box.h * 1.18;
  const y = inner.y + inner.h * zone.baseline + used;

  return {
    x,
    y: Math.min(y, inner.y + inner.h - unit.box.h * 0.2),
    // A zone's elements share an angle. Individually random angles read as
    // noise; a shared one reads as a decision about that region.
    rot: zone._rot ?? (zone._rot = (rng() - 0.5) * (style?.angleSpread ?? 8) * 0.35),
  };
}
