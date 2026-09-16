-- 0052_piece_slug_aliases.sql — old URLs keep working after a rename.
--
-- Every one of the 50 published documents has a slug like
-- `compass-artifact-wf-facec16e-8872-4a9f-a905-feabce4b8aa9-text-markdown`:
-- a Claude export filename with a UUID in it. For a publication whose whole
-- purpose is being cited, that is the worst available state — the URL is the
-- part a person copies and a machine keys on, and that one signals nothing
-- and looks broken.
--
-- Renaming them is only safe if the old URL survives. A citation that 404s is
-- worse than an ugly citation, and the record must not break links it has
-- already put into the world.
--
-- Every rename writes the previous slug here, so /p/<old> can 301 to the new
-- one. Renames compound: rename twice and BOTH old slugs still resolve,
-- because each rename adds a row rather than replacing one.
CREATE TABLE piece_slug_aliases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piece_id TEXT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The lookup /p/<slug> does on a miss, so it must be unique and fast. Scoped
-- per operator like every other slug in the schema.
CREATE UNIQUE INDEX piece_slug_aliases_lookup ON piece_slug_aliases (user_id, old_slug);
CREATE INDEX piece_slug_aliases_piece ON piece_slug_aliases (user_id, piece_id);
