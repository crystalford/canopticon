-- 0047_evidential_scope_check.sql — the claim-scoping fix (fabric redesign
-- Phase 3, see /root/.claude/plans/humming-questing-backus.md).
--
-- assertions.rank is set by surfacing.ts's runSurfacingL1 purely from
-- `evidential` edges (supports/corroborates vs contradicts/rebuts/
-- undercuts). Those edges come from a single unverified extraction pass
-- (digestion-typed.ts's HARD_EXTRACTION_PROMPT) that only ever sees nodes
-- from the same ~3000-char chunk and gets zero instruction to check
-- whether two claims are genuinely about the same question. One spurious
-- `contradicts` edge is enough to flip a claim to 'contested' forever,
-- with no review — the exact "two claims about different scopes getting
-- extracted as if they rebut each other" failure mode.
--
-- scope_check is an independent verification pass (evidential-scope-
-- check.ts, modeled on self-contradictions.ts's judge pattern) that runs
-- between edge creation and edge consumption: NULL = not yet checked,
-- 'verified' = an independent judge confirmed both claims are genuinely
-- about the same specific question, 'rejected' = the judge found the
-- edge merely topically similar / different scope / broader-narrower
-- mismatch. Rejected edges are kept, not deleted, so a checked edge is
-- never re-evaluated. surfacing.ts's balance/contradiction queries are
-- updated (same migration's companion code change, not SQL) to only
-- count scope_check = 'verified' edges — unverified edges neither
-- contest nor corroborate until a judge confirms them.

ALTER TABLE edges ADD COLUMN scope_check TEXT DEFAULT NULL
  CHECK (scope_check IN ('verified', 'rejected') OR scope_check IS NULL);
ALTER TABLE edges ADD COLUMN scope_check_notes TEXT;

CREATE INDEX edges_evidential_scope_idx ON edges (family, edge_type, scope_check);
