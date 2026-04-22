// CANOPTICON v2 — Neo4j AuraDB Setup
// Run these statements in the Neo4j Browser or via driver

// ── Constraints (enforce uniqueness + create indexes) ──────────────────────

CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE;

CREATE CONSTRAINT claim_id_unique IF NOT EXISTS
FOR (c:Claim) REQUIRE c.claim_id IS UNIQUE;

CREATE CONSTRAINT source_id_unique IF NOT EXISTS
FOR (s:Source) REQUIRE s.source_id IS UNIQUE;

CREATE CONSTRAINT gap_id_unique IF NOT EXISTS
FOR (g:KnowledgeGap) REQUIRE g.gap_id IS UNIQUE;

CREATE CONSTRAINT hypothesis_id_unique IF NOT EXISTS
FOR (h:Hypothesis) REQUIRE h.hypothesis_id IS UNIQUE;

// ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX entity_name_idx IF NOT EXISTS
FOR (e:Entity) ON (e.name);

CREATE INDEX entity_type_idx IF NOT EXISTS
FOR (e:Entity) ON (e.type);

CREATE INDEX claim_status_idx IF NOT EXISTS
FOR (c:Claim) ON (c.status);

CREATE INDEX gap_resolved_idx IF NOT EXISTS
FOR (g:KnowledgeGap) ON (g.is_resolved);

// ── Relationship type documentation (no-op Cypher — for reference) ─────────
// RELATES_TO     — generic relationship between entities
// FUNDS          — financial support or funding
// CONTROLS       — operational or legal control
// EMPLOYS        — employment relationship
// MEMBER_OF      — membership in org or party
// SUPPORTS       — political or ideological support
// OPPOSES        — political or ideological opposition
// CONTRADICTS    — one claim contradicts another
// SUPPORTS_CLAIM — entity is implicated in or supports a claim
// EVIDENCED_BY   — claim is evidenced by a source

// ── Seed: keepalive node (prevents AuraDB free tier from sleeping) ─────────
MERGE (k:_Keepalive {id: 'canopticon-v2'})
SET k.last_ping = datetime();
