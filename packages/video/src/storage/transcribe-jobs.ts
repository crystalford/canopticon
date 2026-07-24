// D1 access — transcribe_jobs CRUD (migration 0007). Same queue/status
// shape as d1.ts's render_jobs helpers, kept in its own file since this
// is a genuinely separate pipeline (video-in, not video-out) sharing
// only the "queue -> running -> succeeded/failed" pattern, not any data.

export interface TranscribeJobRow {
  id: string;
  source_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  title: string | null;
  channel: string | null;
  published_at: string | null;
  duration_s: number | null;
  transcript: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export async function createTranscribeJob(db: D1Database, url: string): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO transcribe_jobs (id, source_url, status) VALUES (?, ?, 'queued')")
    .bind(id, url)
    .run();
  return id;
}

export async function markTranscribeRunning(db: D1Database, jobId: string): Promise<void> {
  await db
    .prepare("UPDATE transcribe_jobs SET status = 'running', started_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), jobId)
    .run();
}

export async function markTranscribeSucceeded(
  db: D1Database,
  jobId: string,
  args: {
    transcript: string;
    title: string | null;
    channel: string | null;
    published_at: string | null;
    duration_s: number | null;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE transcribe_jobs
          SET status = 'succeeded',
              finished_at = ?,
              transcript = ?,
              title = ?,
              channel = ?,
              published_at = ?,
              duration_s = ?
        WHERE id = ?`,
    )
    .bind(
      new Date().toISOString(),
      args.transcript,
      args.title,
      args.channel,
      args.published_at,
      args.duration_s,
      jobId,
    )
    .run();
}

export async function markTranscribeFailed(
  db: D1Database,
  jobId: string,
  error: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE transcribe_jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?`,
    )
    .bind(new Date().toISOString(), error.slice(0, 2000), jobId)
    .run();
}

export async function loadTranscribeJob(
  db: D1Database,
  jobId: string,
): Promise<TranscribeJobRow | null> {
  return db
    .prepare("SELECT * FROM transcribe_jobs WHERE id = ? LIMIT 1")
    .bind(jobId)
    .first<TranscribeJobRow>();
}
