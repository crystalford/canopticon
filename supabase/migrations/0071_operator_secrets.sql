-- THE ANTHROPIC KEY THE AUTHOR PASTES ON /admin/claude.
--
-- The workspace (writing, research, Read it) needs Claude. The author can
-- paste an Anthropic API key on /admin/claude instead of setting a GitHub
-- secret and redeploying. It is stored encrypted (AES-GCM, with a key derived
-- from the Worker's SESSION_SECRET, which never leaves Cloudflare), so the
-- database alone does not reveal it; `hint` is its last four characters, the
-- only part any page shows. One row per named secret; forgetting deletes it.
CREATE TABLE IF NOT EXISTS operator_secrets (
  name TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  hint TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
