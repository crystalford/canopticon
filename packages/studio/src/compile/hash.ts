// Node hashing — Master Spec Part 4, as amended by Atlas Part 7.1.2.
//
// The amendment is the whole point: the hash is computed PER PRIMITIVE,
// not per block. A chain that ends in a recoloured `color_transform`
// reuses the entire upstream particle simulation, because only the final
// node's hash changed. Hashing per block would recompute the sim.
//
// The hash covers everything that can change what a node paints:
//   primitiveId + rendererVersion + resolved params + timing window
//   + seed + the hashes of any assets it references
//
// It deliberately does NOT cover the scene id or the node's position in
// the chain. Two nodes that would paint identical pixels SHOULD collide —
// that is a cache hit across scenes, not a bug.
//
// Canonical JSON with sorted keys, because `{a:1,b:2}` and `{b:2,a:1}` are
// the same node and must not produce two cache entries.

import type { ComposedNode } from "./compose.ts";

/** Bumped when a primitive's implementation changes in a way that alters
 *  its output. This is what invalidates the cache after a code change —
 *  without it, a fixed bug would keep serving stale renders forever. */
export const RENDERER_VERSION = "1.0.0";

export interface HashableNode {
  primitiveId: string;
  params: Record<string, number | string>;
  seed: number;
  startMs: number;
  endMs: number;
  assetHashes: string[];
  /** THE SECOND INPUT, flattened.
   *
   *  A compositor's ground is a chain of its own, and a node whose ground
   *  changed paints something different. Without this in the payload,
   *  swapping a gravity field for a noise field behind the same sentence
   *  would leave every hash identical and the film would keep rendering
   *  the old layer — the same class of bug as narration text not reaching
   *  the hash, and just as silent. */
  ground?: string[];
}

/** Deterministic JSON: object keys sorted at every depth. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(",")}}`;
}

/** The exact string that gets hashed. Exposed separately so a failing
 *  cache test can show WHAT differed, not just that the digests differed. */
export function hashPayload(node: HashableNode): string {
  return canonicalJSON({
    primitiveId: node.primitiveId,
    rendererVersion: RENDERER_VERSION,
    params: node.params,
    seed: node.seed,
    window: [node.startMs, node.endMs],
    assets: [...node.assetHashes].sort(),
    // Order matters here and must NOT be sorted: a ground is a chain, and
    // noise_field → flow_field is not flow_field → noise_field.
    ground: node.ground ?? [],
  });
}

export async function nodeHash(node: HashableNode): Promise<string> {
  const data = new TextEncoder().encode(hashPayload(node));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A ground, flattened to strings, ALL THE WAY DOWN.
 *
 *  A ground used to be one level deep, so one `.map()` covered it. An
 *  N-plane stack nests — the deepest layer hangs off a compositor that
 *  hangs off another compositor — and a non-recursive signature would
 *  leave the film's furthest layer outside the hash entirely. Change the
 *  city behind the ordinary world behind the anomaly, and every node hash
 *  would be identical and the cache would serve the old frames.
 *
 *  That is the exact bug this field was added to prevent, one level
 *  further down. Nesting is marked with parentheses so a stack and a flat
 *  list of the same primitives cannot collide. */
function groundSignature(nodes: HashableGround[]): string[] {
  return nodes.map((g) => {
    const self = `${g.primitiveId}#${g.seed}#${canonicalJSON(g.params)}`;
    return g.ground && g.ground.length > 0
      ? `${self}(${groundSignature(g.ground).join(",")})`
      : self;
  });
}

interface HashableGround {
  primitiveId: string;
  params: Record<string, number | string>;
  seed: number;
  ground?: HashableGround[];
}

/** Hash every node of a composed scene against its resolved window. */
export async function hashSceneNodes(
  nodes: ComposedNode[],
  window: { startMs: number; endMs: number },
  assetHashes: string[],
): Promise<Array<{ node: ComposedNode; hash: string }>> {
  return Promise.all(
    nodes.map(async (node) => ({
      node,
      hash: await nodeHash({
        primitiveId: node.primitiveId,
        params: node.params,
        seed: node.seed,
        startMs: window.startMs,
        endMs: window.endMs,
        assetHashes,
        ...(node.ground ? { ground: groundSignature(node.ground) } : {}),
      }),
    })),
  );
}
