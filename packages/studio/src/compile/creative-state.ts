// Creative State resolution — Constitution Part 2.
//
// Every moment of the film has a creative state: a vector of continuous
// parameters describing what the film currently *is*. Not `frame = 18420`
// but `abstraction 0.48, archivalWeight 0.22, humanPresence 0.34`.
//
// State is authored at control points and interpolated between them, so
// the director expresses a trajectory ("start grounded, destabilise
// through the middle, abstract at the turn") rather than a per-scene
// setting. Individual shots are generated FROM the field; they are not
// assembled into it.
//
// Invariants are the part that makes this safe to drag around: floors and
// ceilings that hold across the whole film no matter what the curves do.
// When one bites, it is REPORTED, never silently absorbed — a director who
// can't see that their curve was overruled will keep dragging it.

import type { CreativeState, CreativeValues, EditorialIR } from "../ir/schema.ts";

export interface ResolvedState {
  values: CreativeValues;
  /** Invariants that actually bit at this position, in plain language. */
  held: string[];
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalized runtime position (0..1) of each control point, resolved
 *  from whatever it was bound to. Structural bindings (act/scene) are
 *  preferred in the IR because they survive re-timing; this is where they
 *  get turned into numbers. */
export function controlPointPositions(ir: EditorialIR): number[] {
  const sceneCount = ir.scenes.length;
  const scenePos = new Map<string, number>();
  ir.scenes.forEach((s, i) => {
    // Midpoint of the scene's slot — a scene-bound control point should
    // sit at the middle of that scene, not at its leading edge.
    scenePos.set(s.sceneId, sceneCount === 1 ? 0.5 : (i + 0.5) / sceneCount);
  });

  const actBounds = new Map<string, { start: number; end: number }>();
  for (const act of ir.acts) {
    const idxs = ir.scenes.map((s, i) => (s.actId === act.actId ? i : -1)).filter((i) => i >= 0);
    if (idxs.length === 0) {
      actBounds.set(act.actId, { start: 0, end: 0 });
      continue;
    }
    const first = idxs[0] as number;
    const last = idxs[idxs.length - 1] as number;
    actBounds.set(act.actId, {
      start: first / sceneCount,
      end: (last + 1) / sceneCount,
    });
  }

  return ir.creativeState.controlPoints.map((cp) => {
    // Order matters: the act-bound form carries BOTH `actId` and
    // `position`, so it has to be matched before the bare-position form or
    // it gets read as a raw number and every control point collapses to 0.
    if ("actId" in cp.at) {
      const b = actBounds.get(cp.at.actId);
      if (!b) return 0;
      return cp.at.position === "start" ? b.start : b.end;
    }
    if ("sceneId" in cp.at) return scenePos.get(cp.at.sceneId) ?? 0;
    return clamp01(cp.at.position);
  });
}

/** Resolve the creative state at a normalized runtime position.
 *  Deterministic: same IR and same position always yield the same vector. */
export function resolveStateAt(
  ir: EditorialIR,
  position: number,
  positions?: number[],
): ResolvedState {
  const cs: CreativeState = ir.creativeState;
  const pts = cs.controlPoints;
  const pos = positions ?? controlPointPositions(ir);

  // Order control points by resolved position. Authoring order is not
  // guaranteed to be temporal order once they're bound to acts and scenes.
  const order = pts.map((_, i) => i).sort((a, b) => (pos[a] as number) - (pos[b] as number));

  const p = clamp01(position);
  let lo = order[0] as number;
  let hi = order[order.length - 1] as number;
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i] as number;
    const b = order[i + 1] as number;
    if (p >= (pos[a] as number) && p <= (pos[b] as number)) {
      lo = a;
      hi = b;
      break;
    }
    if (p > (pos[b] as number)) {
      lo = b;
      hi = order[i + 2] !== undefined ? (order[i + 2] as number) : b;
    }
  }

  const aPt = pts[lo];
  const bPt = pts[hi];
  const values: CreativeValues = {};
  if (aPt && bPt) {
    const span = (pos[hi] as number) - (pos[lo] as number);
    const raw = span > 0 ? (p - (pos[lo] as number)) / span : 0;
    const t = cs.interpolation === "linear" ? clamp01(raw) : smoothstep(clamp01(raw));
    // Union of keys — a control point need not restate every parameter.
    const keys = new Set([...Object.keys(aPt.values), ...Object.keys(bPt.values)]);
    for (const k of keys) {
      const av = aPt.values[k] ?? bPt.values[k] ?? 0;
      const bv = bPt.values[k] ?? aPt.values[k] ?? 0;
      values[k] = av + (bv - av) * t;
    }
  }

  // Identity applies where a curve doesn't speak to a parameter. A curve
  // that DOES name the parameter wins — the trajectory is more specific
  // than the baseline.
  for (const [k, v] of Object.entries(cs.identity)) {
    if (values[k] === undefined) values[k] = v;
  }

  const held: string[] = [];
  for (const inv of cs.invariants) {
    const v = values[inv.param];
    if (v === undefined) continue;
    if (inv.min !== undefined && v < inv.min) {
      values[inv.param] = inv.min;
      held.push(`${inv.param} floored at ${inv.min.toFixed(2)} (curve asked for ${v.toFixed(2)})`);
    }
    if (inv.max !== undefined && v > inv.max) {
      values[inv.param] = inv.max;
      held.push(`${inv.param} capped at ${inv.max.toFixed(2)} (curve asked for ${v.toFixed(2)})`);
    }
  }

  return { values, held };
}

/** Where a scene sits on the runtime, by index. Used to sample the state
 *  field per scene without needing resolved timing first — composition
 *  and timing are independent passes. */
export function scenePosition(ir: EditorialIR, sceneIndex: number): number {
  const n = ir.scenes.length;
  return n <= 1 ? 0.5 : (sceneIndex + 0.5) / n;
}
