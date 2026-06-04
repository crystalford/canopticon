// Feed digestion pipeline — the auto-ingest engine.
//
// Per the operator-claude-code-handoff: "Upload is authorization; the
// system does the work; the operator oversees rather than manages." Each
// uploaded piece runs through five steps automatically — no confirmation
// gates. Claims land at draft confidence; promotion to citable is governed
// by the weighting model (P2), not by bulk publish.
//
// Steps:
//   1. extract_text         — done by extract.ts before this runs; the
//                              body_md is passed in. Logged for completeness.
//   2. recognize_entities   — runRole(entity_resolver) on the body. The role
//                              returns proposed entity slugs/labels; we record
//                              the output for later resolution in P2.
//   3. extract_claims       — runRole(claim_extraction) populating
//                              asserted_in_piece_id (the new model from
//                              migration 0016). evidenced_by_source_ids stays
//                              empty — the spec invariant: never an internal
//                              piece id. Confidence defaults to draft.
//   4. embed                — embedText(body) + upsertVector with kind="piece".
//   5. detect_chains        — searchVectors near-duplicate band. Per spec §6.5:
//                              >0.95 duplicate, 0.80–0.95 new pass of chain,
//                              0.65–0.80 related. New pass assigns chain_id;
//                              the operator sees it surface in Synthesis (P2).
//
// Every step writes an orchestrator_events row so the Feed activity log
// (read-only surface) has a single source of truth. Failures emit
// feed.<step>.failed and the pipeline returns; the dropzone shows a
// conflict flag (P1 ships the event; P2 wires the flag to Synthesis).

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { embedText, searchVectors, upsertVector, vectorId } from "./embeddings";
import { runRole } from "./role-runner";

export interface DigestArgs {
  userId: string;
  pieceId: string;
  pieceSlug: string;
  title: string;
  body_md: string;
  /** Optional source row id (when extract.ts created one). Used so the
   *  existing role pipeline can hook to either piece_id or source_id. */
  sourceId?: string | undefined;
}

export interface DigestResult {
  steps_completed: string[];
  failed_step?: string;
  failed_reason?: string;
  entities_proposed?: number;
  claims_drafted?: number;
  chain_id?: string;
  chain_action?: "extends" | "new" | "duplicate" | "related" | null;
}

const STEP_ORDER = [
  "extract_text",
  "recognize_entities",
  "extract_claims",
  "embed",
  "detect_chains",
] as const;

export async function digest(env: Env, args: DigestArgs): Promise<DigestResult> {
  const result: DigestResult = { steps_completed: [], chain_action: null };

  // Ensure the live operator's claim_extraction role points at the chosen
  // model (idempotent; the seed only applies to fresh installs).
  await ensureExtractionRoleModel(env, args.userId);

  // Step 1: extract_text — already done before this lib is called.
  // Log the event so the activity log shows the full 5-step trail.
  await emit(env, args, "extract_text", "completed", {
    chars: args.body_md.length,
    title: args.title,
  });
  result.steps_completed.push("extract_text");

  // Steps 2 + 3: extract_claims (chunked) → persist claims + entities.
  // Entities are derived from each claim's entities_mentioned[] (the reliable
  // signal); the per-mention entity_resolver role is a P2 upgrade. The two
  // steps are reported separately for the activity log but computed together.
  await emit(env, args, "recognize_entities", "started", {});
  await emit(env, args, "extract_claims", "started", {});

  // Bound the work per upload: a Cloudflare Worker has a wall-clock /
  // subrequest budget, and an unbounded chunk×LLM loop will get the request
  // hard-killed mid-extraction (observed: digestion stuck at
  // extract_claims.started, nothing persisted). Cap the chunks and put a hard
  // timeout on every model call so a hung call can never freeze the request.
  const chunks = chunkText(args.body_md).slice(0, MAX_CHUNKS);
  const accepted: ExtractedClaim[] = [];
  const claimSeen = new Set<string>();
  let chunksOk = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      const roleResult = await withTimeout(
        runRole(env, {
          userId: args.userId,
          roleName: "claim_extraction",
          payload: {
            title: args.title,
            content_text: chunks[i] ?? "",
            source_id: args.sourceId,
            piece_id: args.pieceId,
            chunk_index: i,
            chunk_count: chunks.length,
          },
          idempotencyKey: `${args.pieceId}:claims:${i}`,
        }),
        ROLE_TIMEOUT_MS,
      );
      if (roleResult.status === "failed") continue; // skip the chunk, keep going
      chunksOk++;
      const parsed = parseClaims(roleResult.output);
      // Diagnostic: if the model "succeeded" but parseClaims returned [], the
      // output shape didn't match the schema we expect. Log a tiny sample so
      // the operator can see WHY ingest is producing 0 claims.
      if (parsed.length === 0) {
        const sample =
          typeof roleResult.output === "string"
            ? roleResult.output.slice(0, 240)
            : JSON.stringify(roleResult.output ?? null).slice(0, 240);
        await emit(env, args, "extract_claims", "started", {
          diag: "empty_parse",
          chunk_index: i,
          output_kind: typeof roleResult.output,
          sample,
        });
      }
      for (const c of parsed) {
        const key = normalizeName(c.claim_text);
        if (!key || claimSeen.has(key)) continue; // cross-chunk dedup
        claimSeen.add(key);
        accepted.push(c);
      }
    } catch {
      // a single bad chunk shouldn't sink the document
    }
  }

  // Every chunk failed → the extraction step genuinely failed.
  if (chunks.length > 0 && chunksOk === 0) {
    result.failed_step = "extract_claims";
    result.failed_reason = "claim_extraction failed on every chunk";
    await emit(env, args, "extract_claims", "failed", { error: result.failed_reason });
    return result;
  }

  // Persist claims + derive/link entities. Embedding failures are tolerated
  // (vectors are recoverable via the /backfill route); a row-write failure
  // skips that one claim rather than aborting the document.
  const entitySeen = new Map<string, string>();
  let claimsPersisted = 0;
  let persistErrors = 0;
  let lastPersistError: string | null = null;
  for (const claim of accepted) {
    try {
      const claimId = await persistClaim(
        env,
        { userId: args.userId, pieceId: args.pieceId, sourceId: args.sourceId },
        claim,
      );
      claimsPersisted++;
      for (const name of claim.entities_mentioned) {
        const entityId = await upsertEntityByName(env, args.userId, name, entitySeen);
        if (entityId) {
          await run(
            env.DB,
            "INSERT OR IGNORE INTO claim_entities (claim_id, entity_id, user_id) VALUES (?, ?, ?)",
            [claimId, entityId, args.userId],
          );
        }
      }
    } catch (err) {
      // skip this claim; continue with the rest — but capture the reason so
      // we don't get another silent 0-claims-persisted mystery.
      persistErrors++;
      lastPersistError = (err as Error).message;
    }
  }

  if (persistErrors > 0) {
    await emit(env, args, "extract_claims", "started", {
      diag: "persist_error",
      persist_errors: persistErrors,
      last_error: lastPersistError,
      accepted: accepted.length,
      persisted: claimsPersisted,
    });
  }
  result.claims_drafted = claimsPersisted;
  result.entities_proposed = entitySeen.size;
  await emit(env, args, "extract_claims", "completed", {
    claims_drafted: claimsPersisted,
    chunks: chunks.length,
  });
  await emit(env, args, "recognize_entities", "completed", {
    entities_proposed: entitySeen.size,
  });
  result.steps_completed.push("recognize_entities");
  result.steps_completed.push("extract_claims");

  // Step 4: embed
  await emit(env, args, "embed", "started", {});
  let pieceVector: number[];
  try {
    pieceVector = await embedText(env, `${args.title}\n${args.body_md.slice(0, 4000)}`);
    await upsertVector(env, {
      id: vectorId("piece", args.pieceId),
      values: pieceVector,
      metadata: {
        user_id: args.userId,
        kind: "piece",
        id: args.pieceId,
        title: args.title,
      },
    });
    await emit(env, args, "embed", "completed", { dims: pieceVector.length });
    result.steps_completed.push("embed");
  } catch (err) {
    result.failed_step = "embed";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "embed", "failed", { error: result.failed_reason });
    return result;
  }

  // Step 5: detect_chains — spec §6.5 bands.
  //   >0.95 duplicate · 0.80–0.95 new pass of existing chain · 0.65–0.80 related
  await emit(env, args, "detect_chains", "started", {});
  try {
    const hits = await searchVectors(env, {
      query: `${args.title}\n${args.body_md.slice(0, 4000)}`,
      userId: args.userId,
      topK: 5,
      kinds: ["piece"],
    });
    // Filter out self-match.
    const self = vectorId("piece", args.pieceId);
    const neighbours = hits.filter((h) => h.id !== self);
    const best = neighbours[0];
    if (best && best.score > 0.95) {
      result.chain_action = "duplicate";
      await emit(env, args, "detect_chains", "completed", {
        action: "duplicate",
        against: best.metadata.id,
        score: best.score,
      });
    } else if (best && best.score >= 0.8) {
      // "New pass of an existing chain" — link to the neighbour's chain_id
      // (or create a fresh chain anchored on the neighbour) and assign it.
      const neighbourRow = await one<{ chain_id: string | null; id: string }>(
        env.DB,
        "SELECT id, chain_id FROM pieces WHERE id = ? AND user_id = ?",
        [best.metadata.id, args.userId],
      );
      const chainId = neighbourRow?.chain_id ?? `chain-${best.metadata.id.slice(0, 8)}`;
      // Link the neighbour itself into the chain if it wasn't already.
      if (neighbourRow && neighbourRow.chain_id == null) {
        await run(env.DB, "UPDATE pieces SET chain_id = ? WHERE id = ? AND user_id = ?", [
          chainId,
          neighbourRow.id,
          args.userId,
        ]);
      }
      // Assign chain to the new piece.
      await run(env.DB, "UPDATE pieces SET chain_id = ? WHERE id = ? AND user_id = ?", [
        chainId,
        args.pieceId,
        args.userId,
      ]);
      result.chain_id = chainId;
      result.chain_action = "extends";
      await emit(env, args, "detect_chains", "completed", {
        action: "extends",
        chain_id: chainId,
        against: best.metadata.id,
        score: best.score,
      });
    } else if (best && best.score >= 0.65) {
      result.chain_action = "related";
      await emit(env, args, "detect_chains", "completed", {
        action: "related",
        against: best.metadata.id,
        score: best.score,
      });
    } else {
      result.chain_action = "new";
      await emit(env, args, "detect_chains", "completed", {
        action: "new",
        best_score: best?.score ?? null,
      });
    }
    result.steps_completed.push("detect_chains");
  } catch (err) {
    result.failed_step = "detect_chains";
    result.failed_reason = (err as Error).message;
    await emit(env, args, "detect_chains", "failed", { error: result.failed_reason });
    return result;
  }

  return result;
}

// Step constraint — TypeScript guards against typos in event_type names.
type Step = (typeof STEP_ORDER)[number];

async function emit(
  env: Env,
  args: DigestArgs,
  step: Step,
  state: "started" | "completed" | "failed",
  payload: Record<string, unknown>,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: args.userId,
    event_type: `feed.${step}.${state}`,
    subject_kind: "piece",
    subject_id: args.pieceId,
    payload: {
      piece_slug: args.pieceSlug,
      ...payload,
    },
  });
}

// ---------------------------------------------------------------------------
// Claim extraction model — single config point. The seed sets this for fresh
// installs; ensureExtractionRoleModel() reconciles the live operator's role.
// Flip to an Anthropic model + provider="anthropic" (and seed the
// anthropic.role.claim_extraction cost whitelist) to route to Claude.
//
// NOTE: Llama-4-Scout (fast 17B, 131k ctx) is the proven model here — it
// completes structured-output extraction reliably and quickly. Llama-3.3-70B
// was observed to hang the Worker on the structured-output call (request
// hard-killed mid-extraction, nothing persisted). Quality upgrades go through
// the Anthropic toggle, not a slower Workers-AI model.
const CLAIM_EXTRACTION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Bound per-upload work so the request can't be killed mid-flight.
const MAX_CHUNKS = 4;
const ROLE_TIMEOUT_MS = 45_000;

// Race a promise against a timeout so a hung model call fails the chunk
// cleanly instead of freezing the whole request until the Worker is killed.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`role call exceeded ${ms}ms`)), ms),
    ),
  ]);
}

async function ensureExtractionRoleModel(env: Env, userId: string): Promise<void> {
  try {
    await run(
      env.DB,
      `UPDATE role_definitions SET model = ?
        WHERE user_id = ? AND name = 'claim_extraction' AND model <> ?`,
      [CLAIM_EXTRACTION_MODEL, userId, CLAIM_EXTRACTION_MODEL],
    );
  } catch {
    // non-fatal: extraction still runs on whatever model is configured
  }
}

// ---------------------------------------------------------------------------
// Claim parsing — tolerant of every shape the model/runner can hand back:
// a parsed object, a bare array, a raw JSON string, or null. Malformed claim
// entries are skipped, not fatal.
// ---------------------------------------------------------------------------
const LAYERS = ["factual", "framing", "architectural", "distributive"] as const;
type Layer = (typeof LAYERS)[number];

export interface ExtractedClaim {
  data: string;
  claim_text: string;
  warrant: string | null;
  backing: string | null;
  qualifier: string | null;
  rebuttal: string | null;
  layer: Layer;
  entities_mentioned: string[];
  source_excerpt: string | undefined;
}

export function parseClaims(output: unknown): ExtractedClaim[] {
  let root: unknown = output;
  if (root == null) return [];
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }
  let arr: unknown[];
  if (Array.isArray(root)) {
    arr = root;
  } else if (typeof root === "object" && root !== null) {
    const obj = root as Record<string, unknown>;
    const found = obj.claims ?? obj.drafted_claims ?? obj.extracted_claims ?? obj.items;
    arr = Array.isArray(found) ? found : [];
  } else {
    return [];
  }
  const out: ExtractedClaim[] = [];
  for (const raw of arr) {
    const c = coerceClaim(raw);
    if (c) out.push(c);
  }
  return out;
}

function coerceClaim(raw: unknown): ExtractedClaim | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const claim_text = typeof o.claim_text === "string" ? o.claim_text.trim() : "";
  if (!claim_text) return null;
  const layer = (LAYERS as readonly string[]).includes(o.layer as string)
    ? (o.layer as Layer)
    : "factual";
  const data = typeof o.data === "string" && o.data.trim() ? o.data : claim_text;
  const entities_mentioned = Array.isArray(o.entities_mentioned)
    ? o.entities_mentioned.filter((e): e is string => typeof e === "string")
    : [];
  return {
    data,
    claim_text,
    warrant: typeof o.warrant === "string" ? o.warrant : null,
    backing: typeof o.backing === "string" ? o.backing : null,
    qualifier: typeof o.qualifier === "string" ? o.qualifier : null,
    rebuttal: typeof o.rebuttal === "string" ? o.rebuttal : null,
    layer,
    entities_mentioned,
    source_excerpt: typeof o.source_excerpt === "string" ? o.source_excerpt : undefined,
  };
}

// ---------------------------------------------------------------------------
// Persistence — claims + claim_versions + Vectorize.
// ---------------------------------------------------------------------------
async function persistClaim(
  env: Env,
  args: { userId: string; pieceId: string; sourceId: string | undefined },
  claim: ExtractedClaim,
): Promise<string> {
  // 1. claim shell. evidenced_by_source_ids may ONLY hold external Source IDs —
  //    never a piece id (spec §2.5 citogenesis invariant).
  const claimId = await insertOne(env.DB, "claims", {
    user_id: args.userId,
    layer: claim.layer,
    verification_status: "unverified",
    asserted_in_piece_id: args.pieceId,
    evidenced_by_source_ids: args.sourceId ? [args.sourceId] : [],
    metadata: { ingested_via: "feed-digest", source_excerpt: claim.source_excerpt ?? null },
  });
  // 2. version 1.
  const versionId = await insertOne(env.DB, "claim_versions", {
    claim_id: claimId,
    version_number: 1,
    data: claim.data,
    claim_text: claim.claim_text,
    warrant: claim.warrant,
    backing: claim.backing,
    qualifier: claim.qualifier,
    rebuttal: claim.rebuttal,
    change_summary: "initial extraction",
    created_by_user_id: args.userId,
  });
  // 3. back-link the current version.
  await run(env.DB, "UPDATE claims SET current_version_id = ? WHERE id = ? AND user_id = ?", [
    versionId,
    claimId,
    args.userId,
  ]);
  // Vectors are intentionally NOT embedded inline — embedding every claim
  // during ingest multiplies subrequests and slows the request. Claim/entity
  // vectors are backfilled separately; the rows are the source of truth.
  return claimId;
}

// ---------------------------------------------------------------------------
// Entities — derived from claim.entities_mentioned[]. Dedup in-pipeline (the
// `seen` map) and against existing rows (case-insensitive canonical_name).
// ---------------------------------------------------------------------------
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function entitySlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "entity"
  );
}

async function ensureUniqueEntitySlug(db: D1Database, base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  while (suffix < 32) {
    // public_slug is globally UNIQUE (not per-user), so check without user filter.
    const existing = await one<{ id: string }>(
      db,
      "SELECT id FROM entities WHERE public_slug = ?",
      [candidate],
    );
    if (!existing) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function upsertEntityByName(
  env: Env,
  userId: string,
  surfaceName: string,
  seen: Map<string, string>,
): Promise<string | null> {
  const norm = normalizeName(surfaceName);
  if (!norm || norm.length < 2) return null;
  const cached = seen.get(norm);
  if (cached) return cached;

  const existing = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM entities WHERE user_id = ? AND lower(canonical_name) = ? LIMIT 1",
    [userId, norm],
  );
  if (existing) {
    seen.set(norm, existing.id);
    return existing.id;
  }

  // entity_type is CHECK-constrained and can't be reliably inferred from a
  // surface string at ingest time — default to 'concept'; P2 re-types.
  const slug = await ensureUniqueEntitySlug(env.DB, entitySlug(surfaceName));
  const entityId = await insertOne(env.DB, "entities", {
    user_id: userId,
    entity_type: "concept",
    canonical_name: surfaceName.trim(),
    public_slug: slug,
    metadata: { provisional: true, created_via: "feed-digest" },
  });
  // Vectors backfilled separately (see persistClaim note) to keep ingest fast.
  seen.set(norm, entityId);
  return entityId;
}

// ---------------------------------------------------------------------------
// Chunking — paragraph-greedy windows so long documents aren't truncated.
// Small docs (the common case) return [text] unchanged.
// ---------------------------------------------------------------------------
export function chunkText(
  text: string,
  opts: { maxChars?: number; overlapChars?: number } = {},
): string[] {
  const maxChars = opts.maxChars ?? 24000;
  const overlapChars = opts.overlapChars ?? 800;
  if (text.length <= maxChars) return text.length ? [text] : [];

  const paras = text.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = "";
  const pushCur = () => {
    if (cur.trim()) chunks.push(cur);
    // carry a tail of the previous chunk for continuity
    cur = overlapChars > 0 ? cur.slice(-overlapChars) : "";
  };
  for (const para of paras) {
    if (para.length > maxChars) {
      // hard-slice an oversized paragraph
      if (cur.trim()) pushCur();
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      cur = "";
      continue;
    }
    if (cur.length + para.length + 2 > maxChars) pushCur();
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}
