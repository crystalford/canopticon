// D1 access — react_projects + react_points CRUD (migration 0008).
//
// Same raw D1Database .prepare()/.bind() style as storage/d1.ts — this
// Worker doesn't share a query-helper library with the publication's
// api Worker (separate package, separate deploy).

export type ReactProjectStatus =
  | "transcribing"
  | "ready_for_scripting"
  | "scripting"
  | "ready_to_record"
  | "recording"
  | "stitching"
  | "rendered"
  | "published"
  | "failed";

export interface ReactProjectRow {
  id: string;
  title: string;
  source_url: string;
  status: ReactProjectStatus;
  transcript_json: string | null;
  source_r2_key: string | null;
  source_duration_s: number | null;
  stitched_r2_key: string | null;
  approved_at: string | null;
  published_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export type ReactPointStatus = "pending" | "approved" | "skipped";
export type ReactCueMode = "verbatim" | "bullets";
export type ReactAngleKind = "fact_check" | "fallacy_check" | "none";

export interface ReactPointRow {
  id: string;
  project_id: string;
  sort_order: number;
  start_s: number;
  end_s: number;
  transcript_text: string;
  summary: string;
  suggested_angle_kind: ReactAngleKind | null;
  suggested_angle_text: string | null;
  angle_judge_pass: number | null;
  angle_judge_notes: string | null;
  cue_mode: ReactCueMode;
  cue_text: string | null;
  status: ReactPointStatus;
  clip_r2_key: string | null;
  reaction_r2_key: string | null;
  reaction_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export async function createReactProject(
  db: D1Database,
  args: { title: string; sourceUrl: string },
): Promise<ReactProjectRow> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO react_projects (id, title, source_url, status, created_at, updated_at)
       VALUES (?, ?, ?, 'transcribing', ?, ?)`,
    )
    .bind(id, args.title, args.sourceUrl, now, now)
    .run();
  const row = await loadReactProject(db, id);
  if (!row) throw new Error("failed to load react_project immediately after insert");
  return row;
}

export async function loadReactProject(
  db: D1Database,
  id: string,
): Promise<ReactProjectRow | null> {
  return db
    .prepare("SELECT * FROM react_projects WHERE id = ? LIMIT 1")
    .bind(id)
    .first<ReactProjectRow>();
}

export async function listReactProjects(db: D1Database, limit = 30): Promise<ReactProjectRow[]> {
  const res = await db
    .prepare("SELECT * FROM react_projects ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<ReactProjectRow>();
  return res.results ?? [];
}

export async function updateReactProject(
  db: D1Database,
  id: string,
  fields: Partial<
    Pick<
      ReactProjectRow,
      | "status"
      | "transcript_json"
      | "source_r2_key"
      | "source_duration_s"
      | "stitched_r2_key"
      | "approved_at"
      | "published_at"
      | "error"
    >
  >,
): Promise<void> {
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const set = cols.map((c) => `${c} = ?`).join(", ");
  const values = cols.map((c) => (fields as Record<string, unknown>)[c]);
  await db
    .prepare(`UPDATE react_projects SET ${set}, updated_at = ? WHERE id = ?`)
    .bind(...values, new Date().toISOString(), id)
    .run();
}

export async function insertReactPoint(
  db: D1Database,
  args: {
    projectId: string;
    sortOrder: number;
    startS: number;
    endS: number;
    transcriptText: string;
    summary: string;
    suggestedAngleKind: ReactAngleKind | null;
    suggestedAngleText: string | null;
    angleJudgePass: boolean | null;
    angleJudgeNotes: string | null;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO react_points (
         id, project_id, sort_order, start_s, end_s, transcript_text, summary,
         suggested_angle_kind, suggested_angle_text, angle_judge_pass, angle_judge_notes,
         cue_mode, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bullets', 'pending', ?, ?)`,
    )
    .bind(
      id,
      args.projectId,
      args.sortOrder,
      args.startS,
      args.endS,
      args.transcriptText,
      args.summary,
      args.suggestedAngleKind,
      args.suggestedAngleText,
      args.angleJudgePass === null ? null : args.angleJudgePass ? 1 : 0,
      args.angleJudgeNotes,
      now,
      now,
    )
    .run();
  return id;
}

export async function listReactPoints(db: D1Database, projectId: string): Promise<ReactPointRow[]> {
  const res = await db
    .prepare("SELECT * FROM react_points WHERE project_id = ? ORDER BY sort_order ASC")
    .bind(projectId)
    .all<ReactPointRow>();
  return res.results ?? [];
}

export async function loadReactPoint(db: D1Database, id: string): Promise<ReactPointRow | null> {
  return db
    .prepare("SELECT * FROM react_points WHERE id = ? LIMIT 1")
    .bind(id)
    .first<ReactPointRow>();
}

export async function updateReactPoint(
  db: D1Database,
  id: string,
  fields: Partial<
    Pick<
      ReactPointRow,
      | "summary"
      | "cue_mode"
      | "cue_text"
      | "status"
      | "clip_r2_key"
      | "reaction_r2_key"
      | "reaction_duration_ms"
    >
  >,
): Promise<void> {
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const set = cols.map((c) => `${c} = ?`).join(", ");
  const values = cols.map((c) => (fields as Record<string, unknown>)[c]);
  await db
    .prepare(`UPDATE react_points SET ${set}, updated_at = ? WHERE id = ?`)
    .bind(...values, new Date().toISOString(), id)
    .run();
}
