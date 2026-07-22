// Provenance: every source pull is snapshotted to R2 under a
// content-hash key before anything is ingested. Nothing is published
// that isn't traceable to a stored snapshot. Content-hash dedup means an
// unchanged source doesn't create a new snapshot — change_detection
// records the last signature so a refresh can report snapshot_same.

import type { Env } from "../env.ts";

/** Hex SHA-256 of a string. Web Crypto — available in Workers + Node 20+. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The R2 key for a snapshot of `sourceId` with content hash `sha`. */
export function snapshotKey(sourceId: string, sha: string): string {
  return `snapshots/${sourceId}/${sha.slice(0, 16)}.json`;
}

export interface SnapshotResult {
  key: string;
  sha: string;
  /** True when this content hash was not seen before (new snapshot);
   *  false when the source is byte-identical to the last pull. */
  isNew: boolean;
}

/** Store `raw` in R2 iff its content hash differs from the last seen for
 *  this source. Returns the key + whether it was new. Idempotent: the
 *  same bytes always map to the same key. */
export async function putSnapshot(
  env: Env,
  sourceId: string,
  raw: string,
  contentType: string,
): Promise<SnapshotResult> {
  const sha = await sha256Hex(raw);
  const key = snapshotKey(sourceId, sha);

  const prior = await env.DB.prepare(
    "SELECT last_signature FROM change_detection WHERE cube_pid = ?",
  )
    .bind(sourceId)
    .first<{ last_signature: string | null }>();

  const isNew = !prior || prior.last_signature !== sha;

  if (isNew) {
    await env.ASSETS.put(key, raw, { httpMetadata: { contentType } });
    await env.DB.prepare(
      `INSERT INTO change_detection (cube_pid, last_signature, last_checked)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(cube_pid) DO UPDATE SET
         last_signature = excluded.last_signature,
         last_checked   = excluded.last_checked`,
    )
      .bind(sourceId, sha)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE change_detection SET last_checked = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE cube_pid = ?",
    )
      .bind(sourceId)
      .run();
  }

  return { key, sha, isNew };
}
