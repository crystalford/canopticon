-- 0032_pages_intent.sql — intent classification on signed readings.
--
-- Spec v2.5 Part 5 (the seven intents) calls for every signed reading to
-- wear its epistemic stance as a badge: investigation (open probe),
-- argument (closed case), pattern (recurring structure), hypothesis
-- (candidate explanation), assessment (judgment with confidence band),
-- critique (attacks an assertion), explanation (connects the dots).
--
-- The drafter classifies on draft. The renderer surfaces the badge on the
-- signed page, on /investigations cards, and on the operator's Awaiting-
-- your-signature card in OUT.

ALTER TABLE pages ADD COLUMN intent TEXT CHECK (
  intent IS NULL OR intent IN (
    'investigation', 'argument', 'pattern', 'hypothesis',
    'assessment', 'critique', 'explanation'
  )
);

-- The intent filter on /investigations needs a fast lookup.
CREATE INDEX pages_user_intent_idx ON pages (user_id, intent, signed_status, updated_at DESC);
