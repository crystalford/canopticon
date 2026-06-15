// voice_profile D1 CRUD + R2 sample storage.
//
// The voice_profile table is one row keyed by user_id (single-operator
// system, so always the seeded operator id). Stores the trained MiniMax
// voice_id + a JSON manifest of the sample URLs the clone was trained
// on.

export interface VoiceProfile {
  user_id: string;
  minimax_voice_id: string | null;
  samples_json: string | null; // JSON: { keys: string[], total_seconds: number }
  characterisation: string | null;
  updated_at: string;
}

export async function loadVoiceProfile(db: D1Database): Promise<VoiceProfile | null> {
  return db
    .prepare("SELECT * FROM voice_profile ORDER BY updated_at DESC LIMIT 1")
    .first<VoiceProfile>();
}

export async function upsertVoiceProfile(
  db: D1Database,
  args: {
    user_id: string;
    minimax_voice_id: string | null;
    samples_json: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO voice_profile (user_id, minimax_voice_id, samples_json, updated_at)
         VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         minimax_voice_id = excluded.minimax_voice_id,
         samples_json = excluded.samples_json,
         updated_at = excluded.updated_at`,
    )
    .bind(args.user_id, args.minimax_voice_id, args.samples_json, new Date().toISOString())
    .run();
}

export async function putVoiceSample(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType = "audio/webm",
): Promise<void> {
  await bucket.put(key, body, { httpMetadata: { contentType } });
}

export async function listVoiceSampleKeys(bucket: R2Bucket, prefix: string): Promise<string[]> {
  const r = await bucket.list({ prefix });
  return (r.objects ?? []).map((o) => o.key);
}
