// Typed-graph extraction — canonical-spec v2.4 Part 2 + Part 4.
//
// Replaces the flat atomic-claims extraction with the spec's typed graph:
//   - 6 node-kinds (entity, attribute, event, neutral_fact, assertion, source)
//   - 6 edge-families (aboutness, relationship, temporal, causal,
//     evidential, attribution)
//   - quotes (verbatim text + byte offsets) tied to source nodes
//   - assertions with stance + rank + evidence_balance (the firewall hinge)
//
// Model routing — spec Part 16: bulk extraction uses the cheap-strong baseline
// (Gemma 4 26B A4B) via the router. Hard extraction (stance, typed relations,
// evidential links) is a follow-up PR that may dial up to gpt-oss-120b
// medium effort.
//
// Idempotency — spec Part 19: re-extraction supersedes prior typed-graph
// rows for the same piece. Before persisting a new run, all nodes carrying
// the piece's id (indexed `piece_id` column, migration 0027) are deleted
// (cascades to edges, quotes, assertions, node_props). The raw `pieces` row
// + the R2 doc are untouched — they're the durable asset.
//
// Write strategy: a rich document produces hundreds of rows. Persisting them
// one awaited INSERT at a time blows D1's storage-operation time budget (the
// object-reset timeout). So we pre-generate all ids in JS, build the lid→id
// map up front, queue every row as a prepared statement, and submit them via
// env.DB.batch() in groups of BATCH_SIZE — a handful of roundtrips, not
// hundreds. Node inserts are queued before any edge/quote/assertion that
// references them, so ordering within the batch satisfies foreign keys.

import type { Env } from "../../env";
import { insertOne, run, serialize } from "../../lib/d1";
import { TIMEOUTS, withTimeout } from "../../lib/timeout";
import { callRole } from "../../llm/router";
import type { AssertionStance, EdgeFamily, NodeKind } from "./typed-graph";

const MAX_CHUNKS = 3;

// Bulk extraction needs room to finish a full typed-graph JSON. The earlier
// regression that wrongly blamed Gemma ran it at 512 tokens — a budget far
// too small to complete one extraction. 4000 lets the factual layer finish.
const EXTRACTION_MAX_TOKENS = 4000;
const HARD_MAX_TOKENS = 2600;

// ---------------------------------------------------------------------------
// PASS 1 — bulk extraction (Gemma, spec Part 16). The high-volume FACTUAL
// layer: entities, events, neutral facts, attributed assertions, and — the
// piece that was missing — ABOUTNESS: which entities each fact/event/assertion
// is about. Without aboutness, facts never attach to a subject page, so the
// graph is a disconnected bag. This pass is what makes pages come alive.
// ---------------------------------------------------------------------------
const BULK_EXTRACTION_PROMPT = `You extract the FACTUAL layer of a typed graph from a research document. Output ONLY a JSON object — no prose, no markdown fences. Start with { and end with }.

Schema:
{
  "entities":      [{ "lid": "e1", "label": "...", "type": "person|organization|institution|location|concept|asset|work|other" }],
  "events":        [{ "lid": "ev1", "label": "...", "date": "YYYY[-MM[-DD]] or null", "about": ["e1"], "source_quote": "..." }],
  "neutral_facts": [{ "lid": "f1", "text": "...", "about": ["e1","e2"], "source_quote": "..." }],
  "assertions":    [{ "lid": "a1", "text": "...", "stance": "pro|critical|neutral", "asserted_by_lid": "e1 or null", "about": ["e2"], "source_quote": "..." }],
  "open_threads":  [{ "question": "...", "related_lids": ["e1", "f1"] }]
}

Rules:
- "lid" is a LOCAL id (e.g. "e1", "f1") used only WITHIN this response to link items. The system generates real ids when persisting.
- "about" lists the entity lids the fact/event/assertion CONCERNS. ALWAYS fill it — a fact about nobody is invisible to the reader. Reference entities you put in "entities".
- "source_quote" MUST be a LITERAL substring of the document below — copy it character for character, do NOT paraphrase or fix punctuation. Quotes that aren't found verbatim are dropped.
- A NEUTRAL FACT is what is established and uncontested. An ASSERTION is what someone CLAIMS (and may be contested) — give its stance and who asserts it. Do NOT label a contested claim as a neutral fact; that violates the firewall.
- A book, article, film, album, or other named creative/intellectual work is an ENTITY of type "work" — not an event. Its publication date is an attribute of that entity, not a separate event node; only make an event for the act of publishing if the document treats that moment itself as newsworthy (a launch, a ban, a controversy).
- OPEN THREADS are unfinished directions the document opens but doesn't pursue. They surface as inquiry threads.
- Omit any array that has no entries. Be thorough on entities + facts; that is the backbone.

Document:`;

// ---------------------------------------------------------------------------
// PASS 2 — hard extraction (gpt-oss-120b medium effort, spec Part 16). The
// relational REASONING the cheap model can't do well: typed relationships
// between entities, evidential support/contradiction (the firewall's
// contested signal), and temporal ordering. Given the node menu pass 1 found,
// so its lids line up. This pass is ADDITIVE and non-fatal: if it fails, the
// factual layer from pass 1 still persists.
// ---------------------------------------------------------------------------
const HARD_EXTRACTION_PROMPT = `You read a research document plus a MENU of nodes already extracted from it, and output the RELATIONAL layer that connects them. Output ONLY a JSON object — no prose, no fences. Start with { and end with }.

Schema:
{
  "relationships": [{ "src_lid": "e1", "dst_lid": "e2", "type": "owns|funded|appointed|employed_by|controls|member_of|other", "source_quote": "..." }],
  "evidential":    [{ "src_lid": "f1", "dst_lid": "a1", "type": "supports|contradicts|corroborates|rebuts|undercuts" }],
  "temporal":      [{ "src_lid": "ev1", "dst_lid": "ev2", "type": "before|after|during|coincides_with" }]
}

Rules:
- Use ONLY the lids from the MENU. Do not invent new nodes.
- relationships connect two ENTITIES. evidential connects a fact/assertion to an assertion it supports or contradicts (contradiction is the contested-claim signal — find these). temporal connects two events.
- "source_quote" on relationships MUST be a literal substring of the document. Omit it rather than paraphrase.
- Omit any array with no entries. Quality over quantity — only assert a link the document actually supports.`;

// ---------------------------------------------------------------------------
// Model-output shape (matches the prompt above; all fields optional + tolerant).
// ---------------------------------------------------------------------------
interface ExtractedEntity {
  lid: string;
  label: string;
  type?: string | undefined;
}
interface ExtractedEvent {
  lid: string;
  label: string;
  date?: string | null | undefined;
  about?: string[] | undefined;
  source_quote?: string | undefined;
}
interface ExtractedFact {
  lid: string;
  text: string;
  about?: string[] | undefined;
  source_quote?: string | undefined;
}
interface ExtractedAssertion {
  lid: string;
  text: string;
  stance?: string | undefined;
  asserted_by_lid?: string | null | undefined;
  about?: string[] | undefined;
  source_quote?: string | undefined;
}
interface ExtractedRelationship {
  src_lid: string;
  dst_lid: string;
  type: string;
  source_quote?: string | undefined;
}
interface ExtractedEvidential {
  src_lid: string;
  dst_lid: string;
  type: string;
}
interface ExtractedTemporal {
  src_lid: string;
  dst_lid: string;
  type: string;
}
interface ExtractedThread {
  question: string;
  related_lids?: string[] | undefined;
}
export interface TypedExtraction {
  entities: ExtractedEntity[];
  events: ExtractedEvent[];
  neutral_facts: ExtractedFact[];
  assertions: ExtractedAssertion[];
  relationships: ExtractedRelationship[];
  evidential: ExtractedEvidential[];
  temporal: ExtractedTemporal[];
  open_threads: ExtractedThread[];
}

const VALID_STANCES = new Set<AssertionStance>(["pro", "critical", "neutral"]);
const VALID_RELATIONSHIP_TYPES = new Set([
  "owns",
  "funded",
  "appointed",
  "employed_by",
  "controls",
  "member_of",
  "other",
]);
const VALID_EVIDENTIAL_TYPES = new Set([
  "supports",
  "contradicts",
  "corroborates",
  "rebuts",
  "undercuts",
]);
const VALID_TEMPORAL_TYPES = new Set(["before", "after", "during", "coincides_with"]);

// ---------------------------------------------------------------------------
// Defensive JSON parse (shared shape with the legacy extractor — Workers AI
// occasionally fences output or trails prose despite the instructions).
// ---------------------------------------------------------------------------
function looseJsonParse(s: string): unknown {
  const trimmed = s.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const objStart = candidate.indexOf("{");
    const arrStart = candidate.indexOf("[");
    const starts = [objStart, arrStart].filter((i) => i >= 0);
    if (starts.length === 0) return null;
    const start = Math.min(...starts);
    const open = candidate[start];
    const close = open === "{" ? "}" : "]";
    const end = candidate.lastIndexOf(close);
    if (end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
/** Filter to plain object entries — drops nulls / strings / numbers / arrays
 *  the model can occasionally slip into a list when the output drifts. */
function asObjArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is Record<string, unknown> => typeof e === "object" && e !== null && !Array.isArray(e),
  );
}
function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
/** Parse an "about"/"related_lids" field to a clean string[] of local ids. */
function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length > 0 ? out : undefined;
}

export function parseTypedExtraction(raw: unknown): TypedExtraction {
  let root: unknown = raw;
  if (typeof root === "string") {
    root = looseJsonParse(root);
    if (root == null) return emptyExtraction();
  }
  if (typeof root !== "object" || root === null) return emptyExtraction();
  const o = root as Record<string, unknown>;
  return {
    entities: asObjArray(o.entities)
      .map((e) => ({
        lid: asString(e.lid),
        label: asString(e.label),
        type: asString(e.type) || undefined,
      }))
      .filter((e) => e.lid && e.label),
    events: asObjArray(o.events)
      .map((e) => ({
        lid: asString(e.lid),
        label: asString(e.label),
        date: typeof e.date === "string" ? e.date : null,
        about: asStringArray(e.about),
        source_quote: asString(e.source_quote) || undefined,
      }))
      .filter((e) => e.lid && e.label),
    neutral_facts: asObjArray(o.neutral_facts)
      .map((f) => ({
        lid: asString(f.lid),
        text: asString(f.text),
        about: asStringArray(f.about),
        source_quote: asString(f.source_quote) || undefined,
      }))
      .filter((f) => f.lid && f.text),
    assertions: asObjArray(o.assertions)
      .map((a) => ({
        lid: asString(a.lid),
        text: asString(a.text),
        stance: asString(a.stance) || undefined,
        asserted_by_lid: typeof a.asserted_by_lid === "string" ? a.asserted_by_lid : null,
        about: asStringArray(a.about),
        source_quote: asString(a.source_quote) || undefined,
      }))
      .filter((a) => a.lid && a.text),
    relationships: asObjArray(o.relationships)
      .map((r) => ({
        src_lid: asString(r.src_lid),
        dst_lid: asString(r.dst_lid),
        type: asString(r.type),
        source_quote: asString(r.source_quote) || undefined,
      }))
      .filter((r) => r.src_lid && r.dst_lid && r.type),
    evidential: asObjArray(o.evidential)
      .map((e) => ({
        src_lid: asString(e.src_lid),
        dst_lid: asString(e.dst_lid),
        type: asString(e.type),
      }))
      .filter((e) => e.src_lid && e.dst_lid && e.type),
    temporal: asObjArray(o.temporal)
      .map((t) => ({
        src_lid: asString(t.src_lid),
        dst_lid: asString(t.dst_lid),
        type: asString(t.type),
      }))
      .filter((t) => t.src_lid && t.dst_lid && t.type),
    open_threads: asObjArray(o.open_threads)
      .map((t) => ({
        question: asString(t.question),
        related_lids: asArray(t.related_lids).filter((x): x is string => typeof x === "string"),
      }))
      .filter((t) => t.question),
  };
}

function emptyExtraction(): TypedExtraction {
  return {
    entities: [],
    events: [],
    neutral_facts: [],
    assertions: [],
    relationships: [],
    evidential: [],
    temporal: [],
    open_threads: [],
  };
}

// ---------------------------------------------------------------------------
// LLM call — single chunk through the router. The cap on chunks lives in the
// caller (digestion.ts), not here, so this module is pure extract-and-parse.
// ---------------------------------------------------------------------------

export async function extractTypedChunk(
  env: Env,
  userId: string,
  pieceId: string,
  chunkIndex: number,
  chunkText: string,
): Promise<TypedExtraction> {
  // PASS 1 — bulk (Gemma): the factual layer + aboutness. This is the
  // backbone; if it fails the chunk is empty.
  const bulkOut = await withTimeout(
    callRole(env, "bulk_extraction", {
      userId,
      system: BULK_EXTRACTION_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: chunkText }] }],
      max_tokens: EXTRACTION_MAX_TOKENS,
      idempotency_key: `${pieceId}:bulk:${chunkIndex}`,
    }),
    TIMEOUTS.LLM_CALL_MS,
    `extractTypedChunk.bulk[${chunkIndex}]`,
  );
  const extraction = parseTypedExtraction(bulkOut.structured ?? bulkOut.text);

  // PASS 2 — hard (gpt-oss-120b): the relational layer over the nodes pass 1
  // found. ADDITIVE and non-fatal — a timeout/parse failure here must not lose
  // the factual layer, so it's wrapped and its result merged on success only.
  const menu = buildNodeMenu(extraction);
  if (menu.length > 0) {
    try {
      const hardOut = await withTimeout(
        callRole(env, "hard_extraction", {
          userId,
          system: HARD_EXTRACTION_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `MENU (lid → node):\n${menu}\n\nDocument:\n${chunkText}` },
              ],
            },
          ],
          max_tokens: HARD_MAX_TOKENS,
          idempotency_key: `${pieceId}:hard:${chunkIndex}`,
        }),
        TIMEOUTS.LLM_CALL_MS,
        `extractTypedChunk.hard[${chunkIndex}]`,
      );
      const hard = parseTypedExtraction(hardOut.structured ?? hardOut.text);
      // Merge ONLY the relational arrays; pass 1 owns the nodes.
      extraction.relationships = hard.relationships;
      extraction.evidential = hard.evidential;
      extraction.temporal = hard.temporal;
    } catch {
      // Hard pass failed — keep the factual layer. Relations fill in on a
      // later re-extract; the pages still come alive from pass 1 + aboutness.
    }
  }
  return extraction;
}

/** A compact lid→label menu of the nodes pass 1 found, so the hard pass can
 *  reference them without re-deriving. Capped to keep the prompt tight. */
function buildNodeMenu(ext: TypedExtraction): string {
  const lines: string[] = [];
  for (const e of ext.entities) lines.push(`${e.lid} = entity: ${e.label}`);
  for (const ev of ext.events) lines.push(`${ev.lid} = event: ${ev.label}`);
  for (const f of ext.neutral_facts) lines.push(`${f.lid} = fact: ${f.text.slice(0, 80)}`);
  for (const a of ext.assertions) lines.push(`${a.lid} = assertion: ${a.text.slice(0, 80)}`);
  return lines.slice(0, 80).join("\n");
}

// ---------------------------------------------------------------------------
// Persistence — write typed extraction into the spec Part 4 tables.
//
// Order matters: nodes first (we need ids for edges/quotes/assertions to
// reference), then quotes (need source + node ids), then edges, then
// assertions, then inquiry_threads.
//
// Verbatim verification: every source_quote is checked against the chunk
// text before it's persisted. Non-matching quotes are kept in the node but
// the quote row is dropped (the firewall mandate Part 8 — quotes must be
// literal substrings of fetched/extracted text).
// ---------------------------------------------------------------------------

interface PersistArgs {
  userId: string;
  pieceId: string;
  chunkText: string;
  /** Pre-existing source node id for this piece. Created lazily on first call
   *  inside a digest run; reused across chunks. */
  sourceNodeId: string;
}

interface PersistStats {
  nodes: number;
  edges: number;
  quotes: number;
  assertions: number;
  threads: number;
  killed_quotes: number;
}

// Map a model's "type" field to one of the canonical entity types we recognize
// at the metadata level. Unknown values fall to "concept" — the entity still
// persists, just typed as a concept until P2 surfaces re-type it.
function normalizeEntityType(t: string | undefined): string {
  const valid = [
    "person",
    "organization",
    "institution",
    "location",
    "concept",
    "asset",
    "work",
    "other",
  ];
  const lower = (t ?? "").toLowerCase();
  return valid.includes(lower) ? lower : "concept";
}

// D1 batch size — keep each batch well under any per-batch statement ceiling
// and short enough that a single batch never approaches the storage timeout.
const BATCH_SIZE = 50;

export async function persistTypedExtraction(
  env: Env,
  args: PersistArgs,
  extraction: TypedExtraction,
): Promise<PersistStats> {
  const stats: PersistStats = {
    nodes: 0,
    edges: 0,
    quotes: 0,
    assertions: 0,
    threads: 0,
    killed_quotes: 0,
  };

  // lid → DB id map so cross-references in the extraction (relationships /
  // evidential / temporal / assertion.asserted_by_lid) resolve to real ids.
  // Ids are generated in JS up front so edges/quotes can reference nodes
  // without a roundtrip. Nodes are queued before the rows that reference them.
  const lidToId = new Map<string, string>();
  const stmts: D1PreparedStatement[] = [];

  // Aboutness edges: link a fact/event/assertion to each entity it concerns
  // (src = the fact node, dst = the entity), family='aboutness'. This is what
  // attaches material to a subject page — the renderer joins facts to a
  // subject through these edges. Entities are queued first, so their lids are
  // already resolved by the time we reach the items that reference them.
  const pushAboutness = (itemNodeId: string, about: string[] | undefined): void => {
    if (!about) return;
    const seen = new Set<string>();
    for (const lid of about) {
      const dst = lidToId.get(lid);
      if (dst && dst !== itemNodeId && !seen.has(dst)) {
        seen.add(dst);
        stmts.push(edgeInsert(env.DB, args, itemNodeId, dst, "about", "aboutness"));
        stats.edges++;
      }
    }
  };

  // Entities — node kind 'entity'. Type goes in metadata.
  for (const e of extraction.entities) {
    const { id, stmt } = nodeInsert(env.DB, args, "entity", e.label, {
      entity_type: normalizeEntityType(e.type),
    });
    lidToId.set(e.lid, id);
    stmts.push(stmt);
    stats.nodes++;
  }

  // Events — node kind 'event'. Date is a property + metadata mirror so
  // SQL can sort by it cheaply.
  for (const e of extraction.events) {
    const { id, stmt } = nodeInsert(env.DB, args, "event", e.label, {
      event_date: e.date ?? null,
    });
    lidToId.set(e.lid, id);
    stmts.push(stmt);
    stats.nodes++;
    if (e.date) {
      stmts.push(propInsert(env.DB, id, "event_date", e.date));
    }
    pushAboutness(id, e.about);
    if (e.source_quote) {
      const q = quoteInsert(env.DB, args, id, e.source_quote);
      if (q) {
        stmts.push(q);
        stats.quotes++;
      } else {
        stats.killed_quotes++;
      }
    }
  }

  // Neutral facts.
  for (const f of extraction.neutral_facts) {
    const { id, stmt } = nodeInsert(env.DB, args, "neutral_fact", f.text, {});
    lidToId.set(f.lid, id);
    stmts.push(stmt);
    stats.nodes++;
    pushAboutness(id, f.about);
    if (f.source_quote) {
      const q = quoteInsert(env.DB, args, id, f.source_quote);
      if (q) {
        stmts.push(q);
        stats.quotes++;
      } else {
        stats.killed_quotes++;
      }
    }
  }

  // Assertions — node + assertions row (stance, asserted_by). The actor is
  // resolved via the lidToId map; entities were queued first, so by here all
  // entity lids are known.
  for (const a of extraction.assertions) {
    const { id: nodeId, stmt } = nodeInsert(env.DB, args, "assertion", a.text, {});
    lidToId.set(a.lid, nodeId);
    stmts.push(stmt);
    stats.nodes++;
    const stance: AssertionStance = VALID_STANCES.has(a.stance as AssertionStance)
      ? (a.stance as AssertionStance)
      : "neutral";
    const actorNodeId = a.asserted_by_lid ? (lidToId.get(a.asserted_by_lid) ?? null) : null;
    stmts.push(assertionInsert(env.DB, nodeId, actorNodeId, stance));
    stats.assertions++;
    pushAboutness(nodeId, a.about);
    if (a.source_quote) {
      const q = quoteInsert(env.DB, args, nodeId, a.source_quote);
      if (q) {
        stmts.push(q);
        stats.quotes++;
      } else {
        stats.killed_quotes++;
      }
    }
    // Attribution edge: assertion --asserted_by--> actor (Attribution family).
    if (actorNodeId) {
      stmts.push(edgeInsert(env.DB, args, nodeId, actorNodeId, "asserted_by", "attribution"));
      stats.edges++;
    }
  }

  // Relationships — entity → entity, family='relationship'.
  for (const r of extraction.relationships) {
    const src = lidToId.get(r.src_lid);
    const dst = lidToId.get(r.dst_lid);
    if (!src || !dst) continue;
    const type = VALID_RELATIONSHIP_TYPES.has(r.type) ? r.type : "other";
    stmts.push(edgeInsert(env.DB, args, src, dst, type, "relationship"));
    stats.edges++;
  }

  // Evidential — supports/contradicts/etc. between nodes. Strong signal for
  // the firewall: an assertion with mixed evidential edges is contested.
  for (const e of extraction.evidential) {
    const src = lidToId.get(e.src_lid);
    const dst = lidToId.get(e.dst_lid);
    if (!src || !dst) continue;
    if (!VALID_EVIDENTIAL_TYPES.has(e.type)) continue;
    stmts.push(edgeInsert(env.DB, args, src, dst, e.type, "evidential"));
    stats.edges++;
  }

  // Temporal — between events.
  for (const t of extraction.temporal) {
    const src = lidToId.get(t.src_lid);
    const dst = lidToId.get(t.dst_lid);
    if (!src || !dst) continue;
    if (!VALID_TEMPORAL_TYPES.has(t.type)) continue;
    stmts.push(edgeInsert(env.DB, args, src, dst, t.type, "temporal"));
    stats.edges++;
  }

  // Open threads — first-class objects per spec Part 6.
  for (const t of extraction.open_threads) {
    const relatedNodeIds = (t.related_lids ?? [])
      .map((lid) => lidToId.get(lid))
      .filter((x): x is string => !!x);
    stmts.push(threadInsert(env.DB, args.userId, t.question, JSON.stringify(relatedNodeIds)));
    stats.threads++;
  }

  // Submit in batches. Statements run in array order within each batch and
  // batches run sequentially, so a node always commits before any row that
  // references it.
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    await env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/** Make sure a Source-kind node exists for this piece and return its id.
 *  Lazily upserts on first call inside a digest run. Keyed by the indexed
 *  `piece_id` column (migration 0027), so the lookup is an index hit, not a
 *  json_extract full scan. */
export async function ensureSourceNode(
  env: Env,
  userId: string,
  pieceId: string,
  title: string,
): Promise<string> {
  const existing = await env.DB.prepare(
    `SELECT id FROM nodes
       WHERE user_id = ? AND piece_id = ? AND kind = 'source'
       LIMIT 1`,
  )
    .bind(userId, pieceId)
    .first<{ id: string }>();
  if (existing) return existing.id;
  return insertOne(env.DB, "nodes", {
    user_id: userId,
    piece_id: pieceId,
    kind: "source",
    label: title,
    metadata: JSON.stringify({ piece_id: pieceId }),
  });
}

/** Delete all typed-graph rows associated with a piece. Idempotent
 *  re-extraction calls this before persisting a new run, so the typed graph
 *  for a piece is always a single coherent extraction (no double-counting,
 *  spec Part 19 "supersede, not migrate"). Deletes by the indexed `piece_id`
 *  column; cascades handle edges/quotes/assertions/node_props referencing the
 *  deleted nodes.
 *
 *  Inquiry threads are intentionally NOT purged here. The current schema
 *  ties threads to user_id + related_node_ids (JSON), not to piece_id, so a
 *  piece-scoped purge would need a json-array scan. Re-extracts accumulate
 *  threads for now; PR F (inquiry-thread surfaces) is where scoped purging
 *  + cross-extract dedup lives. The thread question text stays valuable even
 *  if its related_node_ids reference deleted nodes (soft-stale, not broken). */
export async function purgeTypedGraphForPiece(
  env: Env,
  userId: string,
  pieceId: string,
): Promise<void> {
  await run(env.DB, "DELETE FROM nodes WHERE user_id = ? AND piece_id = ?", [userId, pieceId]);
}

// ---------------------------------------------------------------------------
// Statement builders — generate a row id in JS and return a prepared INSERT
// so the caller can batch many of them in one roundtrip. `serialize` matches
// insertOne's column coercion (booleans → 0/1, objects → JSON, undefined →
// null) so the rows are identical to the single-insert path.
// ---------------------------------------------------------------------------
function buildInsert(
  db: D1Database,
  table: string,
  values: Record<string, unknown>,
): { id: string; stmt: D1PreparedStatement } {
  const id = (values.id as string | undefined) ?? crypto.randomUUID();
  const row: Record<string, unknown> = { ...values, id };
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql).bind(...cols.map((c) => serialize(row[c])));
  return { id, stmt };
}

function nodeInsert(
  db: D1Database,
  args: PersistArgs,
  kind: NodeKind,
  label: string,
  extraMetadata: Record<string, unknown>,
): { id: string; stmt: D1PreparedStatement } {
  return buildInsert(db, "nodes", {
    user_id: args.userId,
    piece_id: args.pieceId,
    kind,
    label,
    metadata: JSON.stringify({ piece_id: args.pieceId, ...extraMetadata }),
  });
}

function propInsert(
  db: D1Database,
  nodeId: string,
  key: string,
  value: string,
): D1PreparedStatement {
  return buildInsert(db, "node_props", { node_id: nodeId, key, value }).stmt;
}

function edgeInsert(
  db: D1Database,
  args: PersistArgs,
  srcNodeId: string,
  dstNodeId: string,
  edgeType: string,
  family: EdgeFamily,
): D1PreparedStatement {
  return buildInsert(db, "edges", {
    user_id: args.userId,
    src_node_id: srcNodeId,
    dst_node_id: dstNodeId,
    edge_type: edgeType,
    family,
    metadata: JSON.stringify({ piece_id: args.pieceId }),
  }).stmt;
}

function assertionInsert(
  db: D1Database,
  nodeId: string,
  actorNodeId: string | null,
  stance: AssertionStance,
): D1PreparedStatement {
  return buildInsert(db, "assertions", {
    node_id: nodeId,
    asserted_by_node_id: actorNodeId,
    stance,
    // rank is computed by the Surfacing Engine Level 1 (Part 17); seed 'normal'.
    rank: "normal",
    evidence_balance: 0.0,
  }).stmt;
}

function threadInsert(
  db: D1Database,
  userId: string,
  question: string,
  relatedNodeIdsJson: string,
): D1PreparedStatement {
  return buildInsert(db, "inquiry_threads", {
    user_id: userId,
    question,
    status: "open",
    related_node_ids: relatedNodeIdsJson,
  }).stmt;
}

/** Verbatim check + statement build. Returns a prepared INSERT if the quote
 *  can be located in the chunk, or null if it can't (killed).
 *
 *  The firewall mandate is that a stored quote is genuinely text from the
 *  source — but a strict character-for-character indexOf is too brittle: models
 *  routinely differ only in whitespace (a normalized space for a newline, a
 *  collapsed run of spaces) and an exact match then drops a quote that IS in
 *  the document. So we locate the quote by WHITESPACE-NORMALIZED match and
 *  store the ORIGINAL chunk span we matched — the stored text is always real
 *  document bytes, never the model's paraphrase. A true paraphrase (different
 *  words) still finds nothing and is correctly killed. */
function quoteInsert(
  db: D1Database,
  args: PersistArgs,
  nodeId: string,
  quote: string,
): D1PreparedStatement | null {
  const located = locateVerbatim(args.chunkText, quote);
  if (!located) return null;
  return buildInsert(db, "quotes", {
    user_id: args.userId,
    source_id: args.sourceNodeId,
    node_id: nodeId,
    verbatim_text: located.text,
    byte_offset: located.offset,
    byte_length: located.text.length,
  }).stmt;
}

/** Find a quote in the chunk, tolerant to whitespace differences. Returns the
 *  ORIGINAL chunk substring (so the stored quote is real document text) plus
 *  its offset, or null if the words aren't present in order. */
export function locateVerbatim(
  chunk: string,
  quote: string,
): { text: string; offset: number } | null {
  const trimmed = quote.trim();
  if (trimmed.length < 8) return null;
  // Fast path: exact substring.
  const exact = chunk.indexOf(trimmed);
  if (exact >= 0) return { text: trimmed, offset: exact };
  // Whitespace-normalized path: collapse runs of whitespace in both, map the
  // normalized match back to original-chunk offsets.
  const norm = (s: string) => s.replace(/\s+/g, " ");
  const normQuote = norm(trimmed);
  // Build normalized chunk + an index map (normalized pos -> original pos).
  const map: number[] = [];
  let normChunk = "";
  let prevSpace = false;
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i] ?? "";
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      normChunk += " ";
      map.push(i);
      prevSpace = true;
    } else {
      normChunk += ch;
      map.push(i);
      prevSpace = false;
    }
  }
  const npos = normChunk.indexOf(normQuote);
  if (npos < 0) return null;
  const startOrig = map[npos] ?? 0;
  const endNorm = npos + normQuote.length - 1;
  const endOrig = (map[endNorm] ?? startOrig) + 1;
  return { text: chunk.slice(startOrig, endOrig), offset: startOrig };
}

export const TYPED_EXTRACTION_LIMITS = {
  MAX_CHUNKS,
} as const;
