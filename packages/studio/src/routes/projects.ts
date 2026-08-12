// Project + IR version routes — Master Spec Part 7.2.
//
// IR versions are append-only and parented. Nothing mutates a stored IR in
// place, so "revert" is a pointer move rather than a destructive write, and
// because render artifacts are content-addressed the reverted version's
// cache entries are still valid the moment you land on it.

import { Hono } from "hono";
import type { CacheSnapshot } from "../compile/cache.ts";
import { compile } from "../compile/index.ts";
import type { Env } from "../env.ts";
import { type EditorialIR, parseIR } from "../ir/schema.ts";
import { all, newId, nowIso, one, run } from "../lib/d1.ts";

const app = new Hono<{ Bindings: Env }>();

interface ProjectRow {
  id: string;
  title: string;
  created_at: string;
  current_ir_version: number;
}

interface IRVersionRow {
  id: string;
  project_id: string;
  version: number;
  ir_json: string;
  change_summary: string | null;
  parent_version: number | null;
  created_at: string;
}

app.post("/project", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string; ir?: unknown };
  const title = body.title?.trim();
  if (!title) return c.json({ error: "title is required" }, 400);

  const id = newId("proj");
  await run(
    c.env.DB,
    "INSERT INTO projects (id, title, created_at, current_ir_version) VALUES (?, ?, ?, 0)",
    [id, title, nowIso()],
  );

  if (body.ir) {
    const parsed = parseIR(body.ir);
    if (!parsed.ok) return c.json({ error: "invalid IR", details: parsed.errors }, 400);
    await writeVersion(c.env, id, parsed.ir, 1, null, "Initial IR");
    await run(c.env.DB, "UPDATE projects SET current_ir_version = 1 WHERE id = ?", [id]);
    return c.json({ projectId: id, irVersion: 1 }, 201);
  }
  return c.json({ projectId: id, irVersion: 0 }, 201);
});

app.get("/project/:id", async (c) => {
  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    c.req.param("id"),
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, project.id, project.current_ir_version);
  return c.json({
    project,
    irVersion: project.current_ir_version,
    ir: version ? (JSON.parse(version.ir_json) as EditorialIR) : null,
  });
});

app.get("/project/:id/versions", async (c) => {
  const rows = await all<Omit<IRVersionRow, "ir_json">>(
    c.env.DB,
    `SELECT id, project_id, version, change_summary, parent_version, created_at
       FROM ir_versions WHERE project_id = ? ORDER BY version DESC`,
    [c.req.param("id")],
  );
  return c.json({ versions: rows });
});

/** Store a new IR version. The operator ratifies; nothing auto-mutates the
 *  source representation (standing rule 3), so every write comes through
 *  here with an explicit change summary. */
app.put("/project/:id/ir", async (c) => {
  const projectId = c.req.param("id");
  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as { ir?: unknown; changeSummary?: string };
  const parsed = parseIR(body.ir);
  if (!parsed.ok) return c.json({ error: "invalid IR", details: parsed.errors }, 400);

  const next = project.current_ir_version + 1;
  await writeVersion(
    c.env,
    projectId,
    parsed.ir,
    next,
    project.current_ir_version,
    body.changeSummary ?? null,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [next, projectId]);
  return c.json({ projectId, irVersion: next });
});

app.post("/project/:id/revert", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { version?: number };
  if (typeof body.version !== "number") return c.json({ error: "version is required" }, 400);

  const target = await loadVersion(c.env, projectId, body.version);
  if (!target) return c.json({ error: "version not found" }, 404);

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  // Revert forward: copy the old IR to a NEW version rather than deleting
  // history. The cache is content-addressed, so every node in the reverted
  // IR hits immediately — reverting costs nothing to rebuild.
  const next = project.current_ir_version + 1;
  const ir = JSON.parse(target.ir_json) as EditorialIR;
  await writeVersion(
    c.env,
    projectId,
    ir,
    next,
    project.current_ir_version,
    `Reverted to v${body.version}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [next, projectId]);
  return c.json({ projectId, irVersion: next, revertedTo: body.version });
});

/** Compile. Returns the full build report: resolved windows, composed
 *  chains, and the cache diff with a stated reason per recomputation. */
app.post("/project/:id/compile", async (c) => {
  const projectId = c.req.param("id");
  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);

  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  const started = Date.now();
  const snapshot = await loadSnapshot(c.env, projectId);
  const report = await compile(parsed.ir, { snapshot });
  const wallMs = Date.now() - started;

  await saveSnapshot(c.env, projectId, report.snapshot);
  await run(
    c.env.DB,
    `INSERT INTO compile_runs (id, project_id, ir_version, nodes_total, nodes_recomputed,
                               scenes_touched, wall_ms, tts_calls, report_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      newId("run"),
      projectId,
      project.current_ir_version,
      report.cache.total,
      report.cache.misses,
      report.cache.scenesTouched,
      wallMs,
      JSON.stringify({
        cache: report.cache,
        warnings: report.warnings,
        determinism: report.determinism,
        peakCostMsPerFrame: report.peakCostMsPerFrame,
      }),
      nowIso(),
    ],
  );

  return c.json({ ...report, wallMs });
});

app.get("/project/:id/compile-runs", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, ir_version, nodes_total, nodes_recomputed, scenes_touched, wall_ms, tts_calls, created_at
       FROM compile_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 20`,
    [c.req.param("id")],
  );
  return c.json({ runs: rows });
});

async function writeVersion(
  env: Env,
  projectId: string,
  ir: EditorialIR,
  version: number,
  parent: number | null,
  changeSummary: string | null,
): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO ir_versions (id, project_id, version, ir_json, change_summary, parent_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId("ir"), projectId, version, JSON.stringify(ir), changeSummary, parent, nowIso()],
  );
}

async function loadVersion(
  env: Env,
  projectId: string,
  version: number,
): Promise<IRVersionRow | null> {
  return one<IRVersionRow>(
    env.DB,
    "SELECT * FROM ir_versions WHERE project_id = ? AND version = ?",
    [projectId, version],
  );
}

/** The cache snapshot lives in R2 rather than D1: it is a blob read and
 *  written whole on every compile, which is exactly what object storage is
 *  for and exactly what a relational row is not. */
async function loadSnapshot(env: Env, projectId: string): Promise<CacheSnapshot | null> {
  const obj = await env.ASSETS.get(`projects/${projectId}/cache/snapshot.json`);
  if (!obj) return null;
  return (await obj.json()) as CacheSnapshot;
}

async function saveSnapshot(env: Env, projectId: string, snapshot: CacheSnapshot): Promise<void> {
  await env.ASSETS.put(`projects/${projectId}/cache/snapshot.json`, JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json" },
  });
}

export default app;
