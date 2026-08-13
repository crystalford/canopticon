// Cache diff — what recomputed, and why.
//
// The Compile view is deliberately boring: it exists so the operator can
// audit a rebuild rather than trust it. That means every recomputation
// carries a stated reason in plain language ("params changed: abstraction
// 0.48 → 0.72"), not just a changed digest.
//
// Because hashes are content-addressed, reverting to an earlier IR version
// is free — the old hashes are still in the cache and hit immediately.

export interface CachedNodeRef {
  primitiveId: string;
  hash: string;
  params?: Record<string, number | string>;
}

export type NodeStatus = "hit" | "new" | "changed";

export interface NodeDiff {
  primitiveId: string;
  hash: string;
  status: NodeStatus;
  reason: string;
}

export interface SceneDiff {
  sceneId: string;
  nodes: NodeDiff[];
  hits: number;
  misses: number;
  /** Primitives that were in the previous chain and are gone now. Worth
   *  reporting: a primitive silently vanishing from a chain is exactly the
   *  kind of change a director wants to notice. */
  removed: string[];
  status: "unchanged" | "recompute" | "new";
}

export interface CacheReport {
  scenes: SceneDiff[];
  total: number;
  hits: number;
  misses: number;
  scenesTouched: number;
  /** True on the very first compile, when nothing could have hit. */
  coldStart: boolean;
}

export type CacheSnapshot = Record<string, CachedNodeRef[]>;

/** Diff a freshly composed+hashed build against the previous snapshot. */
export function diffAgainstSnapshot(
  current: Array<{
    sceneId: string;
    nodes: Array<{ primitiveId: string; hash: string; params: Record<string, number | string> }>;
  }>,
  snapshot: CacheSnapshot | null,
): CacheReport {
  const scenes: SceneDiff[] = [];
  let hits = 0;
  let misses = 0;

  for (const scene of current) {
    const before = snapshot?.[scene.sceneId];
    const nodes: NodeDiff[] = [];
    let h = 0;
    let m = 0;

    scene.nodes.forEach((node, at) => {
      // MATCHED BY POSITION, NOT BY NAME.
      //
      // A chain can legitimately contain the same primitive twice — the
      // `fragment` operator turns an image into points and draws them, so
      // a constructed chart followed by a fragment ends
      // `particle_trail → image_to_points → particle_trail`, and those two
      // trails are different nodes doing different work at different
      // seeds.
      //
      // Matching by primitiveId alone made the second one match the
      // FIRST one's stored hash, never agree with it, and count as a miss
      // on every compile forever. A permanent cache miss reported as a
      // recomputation is worse than a slow build: it makes the diff — the
      // one surface whose whole job is to be trusted — quietly wrong.
      const prior =
        (before?.[at]?.primitiveId === node.primitiveId ? before[at] : undefined) ??
        before?.find((b) => b.primitiveId === node.primitiveId);
      if (prior && prior.hash === node.hash) {
        nodes.push({
          primitiveId: node.primitiveId,
          hash: node.hash,
          status: "hit",
          reason: "unchanged",
        });
        h++;
      } else if (prior) {
        nodes.push({
          primitiveId: node.primitiveId,
          hash: node.hash,
          status: "changed",
          reason: describeParamChange(prior.params, node.params),
        });
        m++;
      } else {
        nodes.push({
          primitiveId: node.primitiveId,
          hash: node.hash,
          status: "new",
          reason: snapshot ? "new in chain" : "first compile",
        });
        m++;
      }
    });

    const removed = (before ?? [])
      .filter((b) => !scene.nodes.some((n) => n.primitiveId === b.primitiveId))
      .map((b) => b.primitiveId);

    hits += h;
    misses += m;
    scenes.push({
      sceneId: scene.sceneId,
      nodes,
      hits: h,
      misses: m,
      removed,
      status: !snapshot ? "new" : m > 0 || removed.length > 0 ? "recompute" : "unchanged",
    });
  }

  return {
    scenes,
    total: hits + misses,
    hits,
    misses,
    scenesTouched: scenes.filter((s) => s.misses > 0 || s.removed.length > 0).length,
    coldStart: !snapshot,
  };
}

/** Name the parameters that actually moved, so the Compile view can say
 *  "abstraction 0.48 → 0.72" instead of "hash changed". */
function describeParamChange(
  before: Record<string, number | string> | undefined,
  after: Record<string, number | string>,
): string {
  if (!before) return "parameters changed";
  const changes: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of [...keys].sort()) {
    const a = before[k];
    const b = after[k];
    if (a === b) continue;
    if (a === undefined) changes.push(`${k} set to ${fmt(b)}`);
    else if (b === undefined) changes.push(`${k} cleared`);
    else changes.push(`${k} ${fmt(a)} → ${fmt(b)}`);
  }
  if (changes.length === 0) return "timing window or referenced asset changed";
  return changes.join(", ");
}

const fmt = (v: number | string | undefined): string =>
  typeof v === "number" ? v.toFixed(3).replace(/\.?0+$/, "") : String(v);

/** The snapshot to persist after a successful compile. */
export function snapshotFrom(
  current: Array<{
    sceneId: string;
    nodes: Array<{ primitiveId: string; hash: string; params: Record<string, number | string> }>;
  }>,
): CacheSnapshot {
  const snap: CacheSnapshot = {};
  for (const scene of current) {
    snap[scene.sceneId] = scene.nodes.map((n) => ({
      primitiveId: n.primitiveId,
      hash: n.hash,
      params: n.params,
    }));
  }
  return snap;
}
