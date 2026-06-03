-- Drop the legacy test post.
-- Per operator: "The Class That Governs" was a test of the old CMS
-- flow; the new model starts with the seed corpus (28 entities + 65
-- reports) instead. This removes the one row; the posts table itself
-- stays in place during transition so legacy chat-history rendering
-- doesn't break.

DELETE FROM post_versions
 WHERE post_id IN (SELECT id FROM posts WHERE slug = 'the-class-that-governs');
DELETE FROM posts WHERE slug = 'the-class-that-governs';
