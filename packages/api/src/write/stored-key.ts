// The Anthropic API key the author pastes on /admin/claude — an alternative
// to the ANTHROPIC_API_KEY secret, which needs GitHub and a redeploy.
//
// Stored encrypted in D1 (operator_secrets, migration 0071): AES-GCM with a
// key derived from SESSION_SECRET, a Worker secret that never leaves
// Cloudflare, so a copy of the database alone does not reveal it. No page
// ever shows more than its last four characters. Loaded into a short
// per-isolate cache on each operator request (loadStoredKey), so the
// synchronous claudeRoute() can see it.

import type { Env } from "../env";
import { one, run } from "../lib/d1";

const NAME = "anthropic_api_key";
const TTL_MS = 60_000;

let cache: { key: string | null; hint: string | null; at: number } | null = null;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function cryptoKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}\u0000canopticon:anthropic-key`),
  );
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** The pasted key, if one is stored and readable; null otherwise. */
export function storedKey(): string | null {
  return cache?.key ?? null;
}

/** Its last four characters, for the page. */
export function storedKeyHint(): string | null {
  return cache?.hint ?? null;
}

/** Read the stored key into the cache, at most once a minute (or now). */
export async function loadStoredKey(env: Env, force = false): Promise<void> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return;
  const row = await one<{ ciphertext: string; iv: string; hint: string }>(
    env.DB,
    "SELECT ciphertext, iv, hint FROM operator_secrets WHERE name = ?",
    [NAME],
  ).catch(() => null);
  if (!row || !env.SESSION_SECRET) {
    cache = { key: null, hint: null, at: Date.now() };
    return;
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(row.iv) },
      await cryptoKey(env.SESSION_SECRET),
      unb64(row.ciphertext),
    );
    cache = { key: new TextDecoder().decode(plain), hint: row.hint, at: Date.now() };
  } catch {
    // SESSION_SECRET changed since it was saved: the key cannot be read, so
    // it is as good as not set. The page says so (hint, no key).
    cache = { key: null, hint: row.hint, at: Date.now() };
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

/** Store a pasted key, encrypted. Refuses what is plainly not a key. */
export async function saveStoredKey(env: Env, input: string): Promise<SaveResult> {
  const key = input.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key))
    return {
      ok: false,
      reason:
        "That does not look like an Anthropic API key (they start sk-ant-). Nothing was saved.",
    };
  if (!env.SESSION_SECRET)
    return {
      ok: false,
      reason: "The site has no SESSION_SECRET to encrypt it with. Nothing was saved.",
    };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(env.SESSION_SECRET),
    new TextEncoder().encode(key),
  );
  await run(
    env.DB,
    `INSERT INTO operator_secrets (name, ciphertext, iv, hint, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv,
         hint = excluded.hint, updated_at = excluded.updated_at`,
    [NAME, b64(new Uint8Array(sealed)), b64(iv), key.slice(-4), new Date().toISOString()],
  );
  await loadStoredKey(env, true);
  return { ok: true };
}

export async function forgetStoredKey(env: Env): Promise<void> {
  await run(env.DB, "DELETE FROM operator_secrets WHERE name = ?", [NAME]);
  cache = { key: null, hint: null, at: Date.now() };
}
