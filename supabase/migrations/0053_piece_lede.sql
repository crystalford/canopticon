-- 0053_piece_lede.sql — the passage a retriever is meant to lift.
--
-- Retrieval is passage-level, not page-level, and engines cite only a
-- fraction of what they retrieve (ChatGPT ~15% of retrieved pages). So the
-- lever is not "more pages" — it is making one passage per document the
-- obvious thing to quote.
--
-- SELECTED, NOT WRITTEN. The model's job here is to pick the best existing
-- passage, never to compose one. That is the whole design:
--
--   - a written summary cannot be mechanically checked, and standing rule 1
--     is that verification is mechanical and never vouched for;
--   - a selected passage is a literal substring of the stored document, so it
--     goes through the same locateVerbatim firewall as every other quote and
--     earns a /q/<id> receipt;
--   - and it is the document's own words, which is what a reader following a
--     citation expects to find when they arrive.
--
-- Hence a quotes row rather than a text column: a lede IS a quote, with byte
-- offsets and a receipt, and giving it its own free-text column would have
-- created a second kind of published prose with no provenance behind it.
ALTER TABLE pieces ADD COLUMN lede_quote_id TEXT REFERENCES quotes(id);

-- Nothing renders until a person says so. The selection is a proposal: the
-- model can pick a technically-true passage that misrepresents the document's
-- weight, and no substring check catches that.
ALTER TABLE pieces ADD COLUMN lede_approved_at TEXT;
