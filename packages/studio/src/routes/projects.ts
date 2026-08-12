// Project + IR version routes — Master Spec Part 7.2.
//
// IR versions are append-only and parented. Nothing mutates a stored IR in
// place, so "revert" is a pointer move rather than a destructive write, and
// because render artifacts are content-addressed the reverted version's
// cache entries are still valid the moment you land on it.

import { Hono } from "hono";
import type { CacheSnapshot } from "../compile/cache.ts";
import { EXTRACTION_MODEL, proposeReading } from "../compile/extract-reading.ts";
import { buildFilmPlan } from "../compile/film.ts";
import { compile } from "../compile/index.ts";
import { segmentEssay } from "../compile/segment.ts";
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

/** ESSAY IN.
 *
 *  The intake the compiler did not have. Post prose, get a project whose
 *  IR is a real, compilable film: acts from the essay's own headings,
 *  scenes bound to it by character offset, quantities lifted verbatim.
 *
 *  Nothing here calls a model, so this costs nothing and always answers.
 *  What it does NOT produce is readings — what each sentence is ABOUT is an
 *  interpretation, it goes through `POST /project/:id/read` where an
 *  operator ratifies it, and a scene without one falls back to the film's
 *  abstraction curve rather than to a guess.
 *
 *  Re-posting an essay to an existing project appends a new IR version
 *  rather than overwriting: an edit to the prose is a version of the film,
 *  and the cache diff will report exactly which scenes it touched. */
/** Every project, newest first. The front door's data.
 *
 *  Cheap on purpose — a list view that compiled each project to show a
 *  duration would make opening the app cost the whole corpus. Scene count
 *  and last-compiled come from stored rows; the film itself is computed
 *  when someone actually asks for one. */
app.get("/projects", async (c) => {
  const rows = await all<ProjectRow>(
    c.env.DB,
    "SELECT * FROM projects ORDER BY created_at DESC LIMIT 200",
  );
  const out = [];
  for (const r of rows) {
    const version = r.current_ir_version
      ? await loadVersion(c.env, r.id, r.current_ir_version)
      : null;
    let scenes = 0;
    let acts = 0;
    let readings = 0;
    if (version) {
      try {
        const ir = JSON.parse(version.ir_json) as {
          scenes?: { reading?: unknown }[];
          acts?: unknown[];
        };
        scenes = ir.scenes?.length ?? 0;
        acts = ir.acts?.length ?? 0;
        readings = (ir.scenes ?? []).filter((s) => s.reading).length;
      } catch {
        // A project whose stored IR will not parse is still a project. It
        // lists with zero counts rather than taking the whole page down.
      }
    }
    const lastRun = await one<{ created_at: string; nodes_total: number }>(
      c.env.DB,
      "SELECT created_at, nodes_total FROM compile_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
      [r.id],
    );
    out.push({
      projectId: r.id,
      title: r.title,
      createdAt: r.created_at,
      irVersion: r.current_ir_version,
      scenes,
      acts,
      readings,
      lastCompiledAt: lastRun?.created_at ?? null,
      lastNodes: lastRun?.nodes_total ?? null,
    });
  }
  return c.json({ count: out.length, projects: out });
});

/** Remove a project and everything hanging off it. The IR versions are
 *  append-only WITHIN a project's life, not immortal — an operator who
 *  pasted the wrong essay should be able to say so. */
app.delete("/project/:id", async (c) => {
  const id = c.req.param("id");
  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [id]);
  if (!project) return c.json({ error: "not found" }, 404);
  await run(c.env.DB, "DELETE FROM compile_runs WHERE project_id = ?", [id]);
  await run(c.env.DB, "DELETE FROM ir_versions WHERE project_id = ?", [id]);
  await run(c.env.DB, "DELETE FROM projects WHERE id = ?", [id]);
  return c.json({ deleted: id, title: project.title });
});

app.post("/project/ingest", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    essay?: string;
    title?: string;
    projectId?: string;
  };
  const essay = body.essay?.trim();
  if (!essay) return c.json({ error: "essay is required" }, 400);

  let projectId = body.projectId;
  let parentVersion: number | null = null;
  let nextVersion = 1;

  if (projectId) {
    const existing = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
      projectId,
    ]);
    if (!existing) return c.json({ error: "not found" }, 404);
    parentVersion = existing.current_ir_version || null;
    nextVersion = existing.current_ir_version + 1;
  }

  const seed = segmentEssay(essay, {
    projectId: projectId ?? "pending",
    ...(body.title ? { title: body.title } : {}),
  });

  if (!projectId) {
    projectId = newId("proj");
    await run(
      c.env.DB,
      "INSERT INTO projects (id, title, created_at, current_ir_version) VALUES (?, ?, ?, 0)",
      [projectId, seed.ir.title, nowIso()],
    );
  }
  // The IR names its own project, so it is stamped after the id exists.
  const ir: EditorialIR = { ...seed.ir, projectId };

  const parsed = parseIR(JSON.parse(JSON.stringify(ir)));
  if (!parsed.ok) {
    // A segmenter that produced an invalid IR is a bug in the segmenter,
    // not bad input — say so rather than blaming the essay.
    return c.json({ error: "segmenter produced an invalid IR", details: parsed.errors }, 500);
  }

  await writeVersion(
    c.env,
    projectId,
    parsed.ir,
    nextVersion,
    parentVersion,
    `Segmented from essay (${seed.stats.scenes} scenes, ${seed.stats.acts} acts)`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  return c.json(
    { projectId, irVersion: nextVersion, title: parsed.ir.title, ...seed.stats, notes: seed.notes },
    201,
  );
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
/** PROPOSE READINGS — the only place in Studio that calls a model.
 *
 *  It runs at AUTHORING time, never at compile time, and what it produces
 *  is a PROPOSAL: readings land on scenes whose status becomes
 *  `ready_for_review`, and it is the operator's `POST /project/:id/ratify`
 *  that promotes them. The system proposes; the human ratifies. Standing
 *  rule 3, made structural rather than aspirational.
 *
 *  Bounded per call (`limit`, default 12) for a plain reason: a Worker
 *  request has a wall clock and an essay has a hundred sentences. Call it
 *  repeatedly; it always takes the next unread scenes, so it resumes.
 *
 *  A declined scene is a RESULT, not a failure. `proposeReading` returns
 *  null rather than guessing, the scene keeps no reading, and the film's
 *  own abstraction curve carries it — which on an abstract essay is a
 *  better film than nineteen scenes of one wrongly-guessed body plan. */
app.post("/project/:id/read", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.max(1, Math.min(40, body.limit ?? 12));

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  const scenes = [...parsed.ir.scenes];
  const pending = scenes.filter((s) => !s.reading).slice(0, limit);
  if (pending.length === 0) {
    return c.json({
      projectId,
      proposed: 0,
      declined: 0,
      remaining: 0,
      message: "all scenes read",
    });
  }

  let proposed = 0;
  let declined = 0;
  for (const scene of pending) {
    const result = await proposeReading(c.env.AI, scene.narration.text);
    if (!result.reading) {
      declined++;
      continue;
    }
    const at = scenes.findIndex((s) => s.sceneId === scene.sceneId);
    scenes[at] = { ...scene, reading: result.reading, status: "ready_for_review" };
    proposed++;
  }

  if (proposed === 0) {
    return c.json({
      projectId,
      proposed,
      declined,
      remaining: scenes.filter((s) => !s.reading).length,
    });
  }

  const nextVersion = project.current_ir_version + 1;
  await writeVersion(
    c.env,
    projectId,
    { ...parsed.ir, scenes },
    nextVersion,
    project.current_ir_version,
    `Proposed ${proposed} readings (${declined} declined) via ${EXTRACTION_MODEL}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  return c.json({
    projectId,
    irVersion: nextVersion,
    proposed,
    declined,
    remaining: scenes.filter((s) => !s.reading).length,
    // Named so the Compile view can state provenance rather than presenting
    // a machine's guess as a fact about the essay.
    model: EXTRACTION_MODEL,
  });
});

/** RATIFY — the human act. Moves reviewed scenes to `approved`, or rejects
 *  a reading outright, which strips it and hands the scene back to the
 *  abstraction curve. Nothing else in the system can set `approved`. */
app.post("/project/:id/ratify", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    approve?: string[];
    reject?: string[];
  };
  const approve = new Set(body.approve ?? []);
  const reject = new Set(body.reject ?? []);
  if (approve.size === 0 && reject.size === 0) {
    return c.json({ error: "nothing to ratify — pass approve[] or reject[]" }, 400);
  }

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  let approved = 0;
  let rejected = 0;
  const scenes = parsed.ir.scenes.map((s) => {
    if (approve.has(s.sceneId) && s.reading) {
      approved++;
      return { ...s, status: "approved" as const };
    }
    if (reject.has(s.sceneId)) {
      rejected++;
      const { reading: _dropped, ...rest } = s;
      return { ...rest, status: "draft" as const };
    }
    return s;
  });

  const nextVersion = project.current_ir_version + 1;
  await writeVersion(
    c.env,
    projectId,
    { ...parsed.ir, scenes },
    nextVersion,
    project.current_ir_version,
    `Operator ratified ${approved}, rejected ${rejected}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);
  return c.json({ projectId, irVersion: nextVersion, approved, rejected });
});

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

/** THE FILM, as something that can be played.
 *
 *  Compiles and returns a plan the Lab's executor can run directly: per
 *  scene, the chain with its resolved parameters and seeds; per shot, its
 *  window and what varies across it. No pixels are produced here — the
 *  Worker plans, the browser paints — but everything needed to paint is in
 *  the response, and nothing in it was invented by this route.
 *
 *  Costs nothing to call. `ttsCalls` comes back 0 for the same structural
 *  reason it always does: narration is an input artifact, so watching the
 *  film is free and so is watching it again after dragging a curve. */
app.get("/project/:id/film", async (c) => {
  const projectId = c.req.param("id");
  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  const snapshot = await loadSnapshot(c.env, projectId);
  const report = await compile(parsed.ir, { snapshot });
  return c.json(buildFilmPlan(parsed.ir, report));
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
  const obj = await env.FILES.get(`projects/${projectId}/cache/snapshot.json`);
  if (!obj) return null;
  return (await obj.json()) as CacheSnapshot;
}

async function saveSnapshot(env: Env, projectId: string, snapshot: CacheSnapshot): Promise<void> {
  await env.FILES.put(`projects/${projectId}/cache/snapshot.json`, JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json" },
  });
}

export default app;
