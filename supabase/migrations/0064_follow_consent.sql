-- FOLLOW: WHICH TOPICS, AND THE CONSENT THAT WAS GIVEN.
--
-- The Black Box Follow page (docs/blackbox/BACKEND.md) lets a subscriber
-- narrow the weekly email to topics, and Canada's anti-spam law requires a
-- record of each consent: when, from where, on which page and form, for
-- which topics, and the exact wording shown. That record is kept for three
-- years after an unsubscribe, so it lives on the row rather than in a log.
--
-- `topics` is a JSON array of topic names; NULL or [] means everything.
-- `consent` is a JSON object {at, ip, source, topics, wording}.
ALTER TABLE pub_subscriptions ADD COLUMN topics TEXT;
ALTER TABLE pub_subscriptions ADD COLUMN consent TEXT;
