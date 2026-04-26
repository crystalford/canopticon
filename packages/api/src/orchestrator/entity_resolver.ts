// runEntityResolver — turn unresolved entity_mentions into resolved
// entity links (or queue for operator review).
//
// This is a deterministic resolver — no Claude call. It walks every
// unresolved entity_mention, normalizes the surface text, and attempts
// to match against existing `entities` rows by canonical_name + aliases
// using a simple normalized-equality + Levenshtein-like overlap pass.
//
// Resolution outcomes:
//
//   - exact_normalized   : surface text matches a canonical_name or alias
//                          after normalization. Confidence 0.95. Auto-link.
//   - high_confidence    : surface text overlaps strongly with one
//                          existing entity. Confidence 0.75. Auto-link.
//   - ambiguous          : multiple candidates within tolerance of each
//                          other. Leaves entity_id NULL with a flag for
//                          operator review.
//   - no_match           : no candidate. Leaves entity_id NULL.
//
// After resolution, walk the linked claims (via claim_sources) and
// write claim_entities rows (skipping duplicates via the unique
// constraint).
//
// Used by:
//   - POST /v1/entities/resolve     (manual fire from /entities screen)
//   - cascade step G                 (auto-fire after claim_extraction)

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RunEntityResolverInput {
  user_id: string;
  triggered_by: string;
  /** Optional: cap how many unresolved mentions to process this run. */
  limit?: number;
}

export interface RunEntityResolverResult {
  status: "completed";
  mentions_considered: number;
  mentions_resolved_exact: number;
  mentions_resolved_high: number;
  mentions_ambiguous: number;
  mentions_no_match: number;
  claim_entities_written: number;
}

export interface EntityResolverContext {
  service: SupabaseClient;
}

interface UnresolvedMention {
  id: string;
  source_id: string;
  mention_text: string;
  context_excerpt: string | null;
}

interface CandidateEntity {
  id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
}

const DEFAULT_LIMIT = 200;
const HIGH_CONFIDENCE_OVERLAP = 0.85;
const AMBIGUOUS_GAP = 0.05;

export async function runEntityResolver(
  ctx: EntityResolverContext,
  input: RunEntityResolverInput,
): Promise<RunEntityResolverResult> {
  const limit = input.limit ?? DEFAULT_LIMIT;

  const result: RunEntityResolverResult = {
    status: "completed",
    mentions_considered: 0,
    mentions_resolved_exact: 0,
    mentions_resolved_high: 0,
    mentions_ambiguous: 0,
    mentions_no_match: 0,
    claim_entities_written: 0,
  };

  const mentions = await fetchUnresolvedMentions(ctx.service, input.user_id, limit);
  result.mentions_considered = mentions.length;
  if (mentions.length === 0) return result;

  const candidates = await fetchCandidates(ctx.service, input.user_id);

  // Index by normalized canonical / aliases for fast exact matching.
  const exactIndex: Map<string, CandidateEntity[]> = new Map();
  for (const c of candidates) {
    for (const key of [c.canonical_name, c.display_name, ...c.aliases]) {
      const norm = normalize(key);
      if (!norm) continue;
      const list = exactIndex.get(norm) ?? [];
      list.push(c);
      exactIndex.set(norm, list);
    }
  }

  for (const mention of mentions) {
    const norm = normalize(mention.mention_text);
    if (!norm) {
      result.mentions_no_match++;
      continue;
    }

    // 1. Exact normalized match.
    const exactList = exactIndex.get(norm);
    if (exactList && exactList.length === 1) {
      const only = exactList[0];
      if (!only) {
        result.mentions_no_match++;
        continue;
      }
      await linkMention(ctx.service, mention, only, 0.95);
      result.mentions_resolved_exact++;
      result.claim_entities_written += await writeClaimEntities(
        ctx.service,
        input.user_id,
        mention.source_id,
        only.id,
      );
      continue;
    }
    if (exactList && exactList.length > 1) {
      // Multiple candidates with the same normalized name: needs
      // operator disambiguation.
      result.mentions_ambiguous++;
      continue;
    }

    // 2. Fuzzy overlap pass.
    const scored = candidates
      .map((c) => ({ c, score: bestSimilarity(norm, c) }))
      .filter((s) => s.score >= HIGH_CONFIDENCE_OVERLAP)
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    if (!top) {
      result.mentions_no_match++;
      continue;
    }
    const second = scored[1];
    if (second && top.score - second.score < AMBIGUOUS_GAP) {
      result.mentions_ambiguous++;
      continue;
    }

    await linkMention(ctx.service, mention, top.c, top.score);
    result.mentions_resolved_high++;
    result.claim_entities_written += await writeClaimEntities(
      ctx.service,
      input.user_id,
      mention.source_id,
      top.c.id,
    );
  }

  return result;
}

async function fetchUnresolvedMentions(
  client: SupabaseClient,
  user_id: string,
  limit: number,
): Promise<UnresolvedMention[]> {
  const { data } = await client
    .from("entity_mentions")
    .select("id, source_id, mention_text, context_excerpt")
    .eq("user_id", user_id)
    .is("entity_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as UnresolvedMention[];
}

async function fetchCandidates(
  client: SupabaseClient,
  user_id: string,
): Promise<CandidateEntity[]> {
  const { data } = await client
    .from("entities")
    .select("id, entity_type, canonical_name, display_name, aliases")
    .eq("user_id", user_id)
    .eq("is_excluded", false);
  return (data ?? []) as CandidateEntity[];
}

async function linkMention(
  client: SupabaseClient,
  mention: UnresolvedMention,
  entity: CandidateEntity,
  confidence: number,
): Promise<void> {
  await client
    .from("entity_mentions")
    .update({
      entity_id: entity.id,
      resolution_confidence: confidence,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", mention.id);

  await client
    .from("entities")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", entity.id);
}

async function writeClaimEntities(
  client: SupabaseClient,
  user_id: string,
  source_id: string,
  entity_id: string,
): Promise<number> {
  // Walk the claim_sources for this source — every claim that cites
  // this source now also cites this entity. role_in_claim is left null
  // (the resolver doesn't know whether the entity is actor / object /
  // beneficiary; downstream roles can refine).
  const { data: cs } = await client
    .from("claim_sources")
    .select("claim_id")
    .eq("source_id", source_id);
  const claimIds = Array.from(
    new Set((cs ?? []).map((row) => (row as { claim_id: string }).claim_id)),
  );
  let written = 0;
  for (const claim_id of claimIds) {
    const { error } = await client.from("claim_entities").insert({
      user_id,
      claim_id,
      entity_id,
      role_in_claim: null,
    });
    if (!error) written++;
    // 23505 (unique violation) is fine — already linked.
  }
  return written;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining marks (diacritics)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestSimilarity(normMention: string, candidate: CandidateEntity): number {
  let best = 0;
  for (const key of [candidate.canonical_name, candidate.display_name, ...candidate.aliases]) {
    const score = jaccardTokenSimilarity(normMention, normalize(key));
    if (score > best) best = score;
  }
  return best;
}

function jaccardTokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const at = new Set(a.split(" ").filter(Boolean));
  const bt = new Set(b.split(" ").filter(Boolean));
  if (at.size === 0 || bt.size === 0) return 0;
  let intersect = 0;
  for (const t of at) if (bt.has(t)) intersect++;
  const union = at.size + bt.size - intersect;
  return union === 0 ? 0 : intersect / union;
}
