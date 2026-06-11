// Typed data model — TypeScript types for the canonical-spec v2.4 Part 4
// typed graph. These mirror the schema in supabase/migrations/0026_typed_graph.sql.
//
// No runtime code uses these yet — they exist so the schema and the
// type-level shape land together. The extraction rewrite (next PR) will be
// the first consumer; the LLM-driven proposer (after that) consumes them too.

/** The 7 node-kinds. Theme is the v2.4-Phase-1 addition: a received account
 *  the corpus is engaging with — what the documents are arguing against. */
export type NodeKind =
  | "entity" // a person, company, org, place, asset that persists
  | "attribute" // a stable property — what something IS
  | "event" // a dated occurrence — what HAPPENED
  | "neutral_fact" // a sourced, established, uncontested proposition
  | "assertion" // what an ACTOR claims (pro/critical/disputed)
  | "source" // the external artifact a fact rests on
  | "theme"; // a received account the corpus engages with (the orientation primitive)

/** The 6 edge-families per spec Part 4. */
export type EdgeFamily =
  | "aboutness" // fact → subject (the demoted single-link family)
  | "relationship" // entity→entity, typed, time-bounded (owns, funded, etc.)
  | "temporal" // before/after/during/coincides_with
  | "causal" // caused/contributed_to/enabled — flagged weaker
  | "evidential" // supports/contradicts/corroborates/rebuts/undercuts
  | "attribution"; // asserted_by, derived_from, attributed_to

/** Assertion stance per spec Part 4. */
export type AssertionStance = "pro" | "critical" | "neutral";

/** Assertion rank per spec Part 4 (Wikidata-inspired). */
export type AssertionRank = "preferred" | "normal" | "deprecated" | "contested";

/** Inquiry-thread lifecycle per spec Part 6. */
export type InquiryThreadStatus = "open" | "being_pursued" | "resolved" | "dropped";

export interface NodeRow {
  id: string;
  user_id: string;
  kind: NodeKind;
  label: string;
  metadata: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface NodePropRow {
  id: string;
  node_id: string;
  key: string;
  value: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
}

export interface EdgeRow {
  id: string;
  user_id: string;
  src_node_id: string;
  dst_node_id: string;
  edge_type: string;
  family: EdgeFamily;
  valid_from: string | null;
  valid_to: string | null;
  weight: number;
  metadata: string; // JSON
  created_at: string;
}

export interface QuoteRow {
  id: string;
  user_id: string;
  source_id: string; // Source-kind node
  node_id: string; // any node the quote supports
  verbatim_text: string;
  byte_offset: number | null;
  byte_length: number | null;
  created_at: string;
}

export interface AssertionRow {
  id: string;
  node_id: string; // Assertion-kind node
  asserted_by_node_id: string | null; // Entity-kind node (the actor)
  stance: AssertionStance;
  rank: AssertionRank;
  evidence_balance: number;
  created_at: string;
  updated_at: string;
}

export interface InquiryThreadRow {
  id: string;
  user_id: string;
  question: string;
  status: InquiryThreadStatus;
  related_node_ids: string; // JSON array of node ids
  created_at: string;
  last_resurfaced_at: string | null;
}
