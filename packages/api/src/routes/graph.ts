// Graph routes — see canopticon-api-v1.0.md §18.
//
// Returns the entity-claim graph as { nodes, edges }. Nodes are
// resolved entities; edges connect entities that co-occur in the same
// claim_version. Edge weight is the number of shared claims.
//
//   GET /v1/graph                      full operator graph
//   GET /v1/graph?thesis_id=...        sub-graph scoped to a thesis's
//                                       integrated claims

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { userClient } from "../lib/supabase.ts";

const graph = new Hono<AuthContext>();
graph.use("*", requireAuth());

interface Node {
  id: string;
  canonical_name: string;
  entity_type: string;
  degree: number;
  claim_count: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  claim_ids: string[];
}

graph.get("/", async (c) => {
  const thesisId = c.req.query("thesis_id");
  const client = userClient(c.env, c.get("jwt"));

  // Optional scoping: if thesis_id is given, restrict to that thesis's
  // integrated claims.
  let scopedClaimIds: string[] | null = null;
  if (thesisId) {
    const { data: tcs } = await client
      .from("thesis_claims")
      .select("claim_id")
      .eq("thesis_id", thesisId)
      .is("removed_at", null);
    scopedClaimIds = (tcs ?? []).map((row) => (row as { claim_id: string }).claim_id);
    if (scopedClaimIds.length === 0) {
      return c.json({ data: { nodes: [], edges: [] } });
    }
  }

  // Pull claim_entities, scoped if necessary.
  let ceQuery = client.from("claim_entities").select("claim_id, entity_id");
  if (scopedClaimIds) ceQuery = ceQuery.in("claim_id", scopedClaimIds);
  const { data: claimEntities, error: ceErr } = await ceQuery;
  if (ceErr) throw new Error(`graph.claim_entities: ${ceErr.message}`);

  const links = (claimEntities ?? []) as Array<{ claim_id: string; entity_id: string }>;
  if (links.length === 0) {
    return c.json({ data: { nodes: [], edges: [] } });
  }

  // Group by claim → list of entities in it.
  const byClaim: Record<string, string[]> = {};
  const claimsByEntity: Record<string, Set<string>> = {};
  for (const row of links) {
    const list = byClaim[row.claim_id] ?? [];
    list.push(row.entity_id);
    byClaim[row.claim_id] = list;
    const claims = claimsByEntity[row.entity_id] ?? new Set<string>();
    claims.add(row.claim_id);
    claimsByEntity[row.entity_id] = claims;
  }

  // Pull entity metadata for every entity that appears.
  const entityIds = Object.keys(claimsByEntity);
  const { data: entities } = await client
    .from("entities")
    .select("id, canonical_name, entity_type, is_excluded")
    .in("id", entityIds);

  const entityMap: Record<string, { canonical_name: string; entity_type: string }> = {};
  for (const e of entities ?? []) {
    const r = e as {
      id: string;
      canonical_name: string;
      entity_type: string;
      is_excluded: boolean;
    };
    if (r.is_excluded) continue;
    entityMap[r.id] = { canonical_name: r.canonical_name, entity_type: r.entity_type };
  }

  // Build edges: for each claim, every pair of entities co-cited in it
  // becomes an edge. Aggregate weights and dedupe (undirected, sorted
  // pair as the key).
  const edgeMap = new Map<string, { source: string; target: string; claim_ids: Set<string> }>();
  for (const [claim_id, ids] of Object.entries(byClaim)) {
    const sorted = ids.filter((id) => entityMap[id]).sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (!a || !b) continue;
        const key = `${a}::${b}`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.claim_ids.add(claim_id);
        } else {
          edgeMap.set(key, { source: a, target: b, claim_ids: new Set([claim_id]) });
        }
      }
    }
  }

  const edges: Edge[] = Array.from(edgeMap.values()).map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.claim_ids.size,
    claim_ids: Array.from(e.claim_ids),
  }));

  // Build nodes with degree (count of edges) + claim_count (count of
  // claims they appear in).
  const degree: Record<string, number> = {};
  for (const e of edges) {
    degree[e.source] = (degree[e.source] ?? 0) + 1;
    degree[e.target] = (degree[e.target] ?? 0) + 1;
  }

  const nodes: Node[] = Object.keys(entityMap).map((id) => {
    const meta = entityMap[id];
    return {
      id,
      canonical_name: meta?.canonical_name ?? "",
      entity_type: meta?.entity_type ?? "",
      degree: degree[id] ?? 0,
      claim_count: claimsByEntity[id]?.size ?? 0,
    };
  });

  return c.json({ data: { nodes, edges } });
});

export default graph;
