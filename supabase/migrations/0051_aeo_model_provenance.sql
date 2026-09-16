-- 0051_aeo_model_provenance.sql — which model produced each atom.
--
-- The operator wants to run the pass under different models and compare. A
-- toggle alone does not give you that: you can eyeball one run, form an
-- impression, and a week later have no way to tell which model wrote what.
-- Recording it on the row is what makes the comparison survive the session.
--
-- On findings and question_evidence, NOT on questions. A question is the merge
-- point across documents — several models and several documents can converge
-- on one, so there is no single model that "produced" it. The evidence rows
-- underneath it each have exactly one.
--
-- Nullable on purpose: rows written before this migration were all produced by
-- the bulk_extraction default, but backfilling that would be asserting
-- something no record actually says. An honest NULL beats a confident guess.
ALTER TABLE findings ADD COLUMN model TEXT;
ALTER TABLE question_evidence ADD COLUMN model TEXT;
