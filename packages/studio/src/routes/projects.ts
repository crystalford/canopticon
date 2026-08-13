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
import { captureGrammar, describeGrammar } from "../compile/grammar.ts";
import { compile } from "../compile/index.ts";
import { EMPTY_READING, describeIntent, readIntent } from "../compile/intent.ts";
import { segmentEssay } from "../compile/segment.ts";
import { applyVerb, verbById } from "../compile/verbs.ts";
import type { Env } from "../env.ts";
import { type DirectorIntentIR, type EditorialIR, parseIR } from "../ir/schema.ts";
import { all, newId, nowIso, one, run } from "../lib/d1.ts";
import { ASR_CANDIDATES, readTimings, sequenceAlignments } from "../narrate/align.ts";
import { loadAlignments, narrateScenes, voiceStates } from "../narrate/index.ts";
import { TTS_CANDIDATES, describeShape, sniff, toBase64, toBytes } from "../narrate/tts.ts";
import { PRIMITIVES } from "../primitives/registry.ts";

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
    let narrated = 0;
    let stale = 0;
    if (version) {
      try {
        const ir = JSON.parse(version.ir_json) as {
          scenes?: { reading?: unknown; narration?: { voAssetId?: string } }[];
          acts?: unknown[];
        };
        scenes = ir.scenes?.length ?? 0;
        acts = ir.acts?.length ?? 0;
        readings = (ir.scenes ?? []).filter((s) => s.reading).length;
        narrated = (ir.scenes ?? []).filter((s) => s.narration?.voAssetId).length;
        // STALE IS NOT NARRATED. A scene whose prose was edited after
        // recording has audio and says the wrong thing, and a row that
        // reports it as done is the row lying.
        const parsedIR = parseIR(JSON.parse(version.ir_json));
        if (parsedIR.ok) stale = voiceStates(parsedIR.ir).stale;
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
      narrated,
      stale,
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
  // A decline is a legitimate result; a broken binding is a bug. Reporting
  // only the count made them indistinguishable, and the first live run of
  // this route declined 8 of 8 with no way to tell which had happened.
  const why: Record<string, number> = {};
  const samples: { sentence: string; reason: string; said: string }[] = [];
  for (const scene of pending) {
    const result = await proposeReading(c.env.AI, scene.narration.text);
    if (!result.reading) {
      declined++;
      const r = result.provenance.declineReason ?? "unknown";
      why[r] = (why[r] ?? 0) + 1;
      if (samples.length < 3) {
        samples.push({
          sentence: scene.narration.text.slice(0, 90),
          reason: r,
          said: result.provenance.rawSample ?? "",
        });
      }
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
      why,
      samples,
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
    why,
    samples,
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

/** DIRECT — the human choosing between visual interpretations.
 *
 *  The engine proposes several programs per scene and uses the best-scoring
 *  one. This is how a director says "no, that one" — and it is the SAME
 *  rail a reading goes through, applied to depiction: the system proposes,
 *  the human ratifies, and the ratification is stored in the IR as a
 *  version rather than applied to a running state.
 *
 *  It writes a `pin` override, which precedence 1 already honours and which
 *  every downstream surface already reports as pinned. Nothing new had to
 *  be invented to make a director's choice outrank the engine — the
 *  precedence order was built for exactly this and had no way to be
 *  reached.
 *
 *  A pin is reversible: post with no chain to release the scene back to the
 *  engine. */
/* ── THE DIRECTOR STATES WHAT THE SCENE IS FOR ──────────────────────
 *
 * The third kind of input this compiler takes, and the one it had no
 * channel for at all. A FIGURE is checkable against the prose, so it needs
 * no ratification. A READING is an interpretation of the prose, so a model
 * proposes and a human ratifies. An INTENT is neither — it is not about
 * the prose, it is the director's own instruction, so it is authored
 * outright and there is nothing to ratify.
 *
 * Writes a new IR version like every other edit, and RETURNS WHAT IT
 * HEARD. That readback is the point: the reading is deterministic
 * precisely so a director can see it was misread and reword, which is
 * impossible when the reading is a model's private opinion. */
app.post("/project/:id/intend", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    sceneId?: string;
    understand?: string;
    feel?: string;
    notice?: string;
    hide?: string;
    /** Clear the direction on this scene. */
    release?: boolean;
  };
  if (!body.sceneId) return c.json({ error: "sceneId is required" }, 400);

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);
  if (!parsed.ir.scenes.some((s) => s.sceneId === body.sceneId)) {
    return c.json({ error: `no scene ${body.sceneId}` }, 404);
  }

  const fields = ["understand", "feel", "notice", "hide"] as const;
  const intent: DirectorIntentIR = {};
  for (const key of fields) {
    const value = body[key]?.trim();
    if (value) intent[key] = value;
  }
  const clearing = body.release || Object.keys(intent).length === 0;

  const scenes = parsed.ir.scenes.map((s) => {
    if (s.sceneId !== body.sceneId) return s;
    if (clearing) {
      const { directorIntent: _dropped, ...rest } = s;
      return rest;
    }
    return { ...s, directorIntent: intent };
  });

  const reading = clearing ? EMPTY_READING : readIntent(intent);
  const nextV = project.current_ir_version + 1;
  await writeVersion(
    c.env,
    projectId,
    { ...parsed.ir, scenes },
    nextV,
    project.current_ir_version,
    clearing
      ? `${body.sceneId} — direction cleared`
      : `${body.sceneId} — directed: ${describeIntent(reading)}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextV,
    projectId,
  ]);

  const snap = await loadSnapshot(c.env, projectId);
  const t = await frozenAlignments(c.env, { ...parsed.ir, scenes });
  const rep = await compile({ ...parsed.ir, scenes }, { snapshot: snap, alignments: t.alignments });
  await saveSnapshot(c.env, projectId, rep.snapshot);
  const scene = rep.composed.find((s) => s.sceneId === body.sceneId);

  return c.json({
    projectId,
    irVersion: nextV,
    sceneId: body.sceneId,
    cleared: clearing,
    intent: clearing ? null : intent,
    // WHAT THE COMPILER HEARD, not what was typed. A director whose
    // direction read as nothing needs to be told so, in the same breath.
    heard: {
      registers: reading.registers,
      matched: reading.matched,
      dislocation: reading.dislocation,
      describe: describeIntent(reading),
    },
    // AND WHAT IT DID ABOUT IT. The visual idea and its alternatives after
    // the direction landed, so the effect is visible in the response
    // rather than only on the next fetch.
    built: scene
      ? {
          construction: scene.program?.construction ?? null,
          against: Boolean(scene.program?.dislocated),
          why: scene.program?.why ?? null,
          chain: scene.nodes.map((n) => n.primitiveId),
          alternatives: scene.alternatives.map((a) => ({
            construction: a.construction,
            why: a.why,
          })),
        }
      : null,
    cache: rep.cache,
  });
});

app.post("/project/:id/direct", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    sceneId?: string;
    chain?: string[];
    note?: string;
    release?: boolean;
    /** A director's verb — "stranger", "ground", "quieter". Bends the
     *  scene's state rather than pinning its chain. */
    verb?: string;
  };
  if (!body.sceneId) return c.json({ error: "sceneId is required" }, 400);

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  const scene = parsed.ir.scenes.find((s) => s.sceneId === body.sceneId);
  if (!scene) return c.json({ error: `no scene ${body.sceneId}` }, 404);

  const existing = parsed.ir.overrides.find(
    (o) => o.sceneId === body.sceneId && o.type === "constrain",
  );
  const overrides = parsed.ir.overrides.filter((o) => o.sceneId !== body.sceneId);

  // A VERB. Bends the state this scene composes against and lets the
  // engine keep composing, so the instruction survives a restyle rather
  // than freezing the shot the way a pin does.
  if (body.verb) {
    const verb = verbById(body.verb);
    if (!verb) return c.json({ error: `no verb "${body.verb}"` }, 400);
    const styleNudge = applyVerb(existing?.styleNudge, verb);
    if (Object.keys(styleNudge).length > 0) {
      overrides.push({
        sceneId: body.sceneId,
        type: "constrain",
        styleNudge,
        note: verb.label.toLowerCase(),
        createdAt: nowIso(),
      });
    }
    const nextV = project.current_ir_version + 1;
    await writeVersion(
      c.env,
      projectId,
      { ...parsed.ir, overrides },
      nextV,
      project.current_ir_version,
      `${body.sceneId} — ${verb.label.toLowerCase()}`,
    );
    await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
      nextV,
      projectId,
    ]);
    const snap = await loadSnapshot(c.env, projectId);
    const t = await frozenAlignments(c.env, { ...parsed.ir, overrides });
    const rep = await compile(
      { ...parsed.ir, overrides },
      { snapshot: snap, alignments: t.alignments },
    );
    await saveSnapshot(c.env, projectId, rep.snapshot);
    return c.json({
      projectId,
      irVersion: nextV,
      sceneId: body.sceneId,
      verb: verb.id,
      styleNudge,
      cache: rep.cache,
    });
  }

  if (!body.release) {
    if (!body.chain?.length) return c.json({ error: "chain is required unless releasing" }, 400);
    // Every primitive named has to exist. A pin is the one thing that
    // bypasses composition entirely, so an unknown id here would reach the
    // executor as a chain nobody planned.
    const unknown = body.chain.filter((id) => !PRIMITIVES[id]);
    if (unknown.length) return c.json({ error: `not in the palette: ${unknown.join(", ")}` }, 400);
    overrides.push({
      sceneId: body.sceneId,
      type: "pin",
      chain: body.chain,
      note: body.note ?? "chosen by the director",
      createdAt: nowIso(),
    });
  }

  const nextVersion = project.current_ir_version + 1;
  await writeVersion(
    c.env,
    projectId,
    { ...parsed.ir, overrides },
    nextVersion,
    project.current_ir_version,
    body.release
      ? `Released ${body.sceneId} back to the engine`
      : `Directed ${body.sceneId} — ${body.note ?? "chose an interpretation"}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  const snapshot = await loadSnapshot(c.env, projectId);
  const timed = await frozenAlignments(c.env, { ...parsed.ir, overrides });
  const report = await compile(
    { ...parsed.ir, overrides },
    { snapshot, alignments: timed.alignments },
  );
  await saveSnapshot(c.env, projectId, report.snapshot);
  return c.json({
    projectId,
    irVersion: nextVersion,
    sceneId: body.sceneId,
    pinned: !body.release,
    cache: report.cache,
  });
});

/** NAME THE LOOK THIS FILM ALREADY HAS.
 *
 *  "That's sorta the style I was envisioning... but it sorta happened
 *  randomly." It did not happen randomly — it was the appetites the film's
 *  own curves implied, and the same curve produces it again. But nothing
 *  captured it, so it could not be asked for, and it could not be carried
 *  to a different essay. A style you cannot ask for twice is a result, not
 *  a style.
 *
 *  This compiles the film, reads what it ACTUALLY did — which operators it
 *  reached for, how often, at what representation rung — and stores that
 *  as a named grammar on the IR. From then on the constructor is biased
 *  toward it, so a new essay under the same grammar builds different
 *  things in a recognisable way.
 *
 *  Captured rather than authored. That is the whole point: you keep the
 *  accident by naming it, and then you can do it on purpose. */
app.post("/project/:id/grammar", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; clear?: boolean };

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  let next: EditorialIR;
  let summary: string;
  if (body.clear) {
    const { grammar: _dropped, ...rest } = parsed.ir;
    next = rest as EditorialIR;
    summary = "Released the film's grammar — composed from the curves alone";
  } else {
    const name = body.name?.trim();
    if (!name) return c.json({ error: "name is required" }, 400);
    // Captured from the film as it stands WITHOUT its current grammar, so
    // capturing twice does not compound a bias into a caricature of
    // itself.
    const { grammar: _existing, ...bare } = parsed.ir;
    const report = await compile(bare as EditorialIR);
    const grammar = captureGrammar(name, report.composed, projectId);
    next = { ...parsed.ir, grammar };
    summary = `Captured "${name}" — ${describeGrammar(grammar)}`;
  }

  const nextVersion = project.current_ir_version + 1;
  await writeVersion(c.env, projectId, next, nextVersion, project.current_ir_version, summary);
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  return c.json({
    projectId,
    irVersion: nextVersion,
    grammar: next.grammar ?? null,
    describes: next.grammar ? describeGrammar(next.grammar) : "none",
  });
});

/** NARRATE — the one place TTS is ever spent.
 *
 *  An explicit operator action at authoring time, never a compile step.
 *  Each scene's speech is synthesised once, hashed, written to R2,
 *  recorded as an Asset with its provenance, measured for word timings,
 *  and the measurement frozen as a second Asset. Thereafter the compiler
 *  READS it. That is standing rule 1, and it is why dragging a creative
 *  curve costs nothing.
 *
 *  Bounded per call for the same reason `/read` is: an 88-scene film is
 *  176 model calls and a Worker request has a wall clock. It always takes
 *  the next un-narrated scenes, so calling it repeatedly finishes the film
 *  and `remaining` says how far there is to go.
 *
 *  A failure here degrades one scene. The audio it did produce is kept
 *  even when the alignment fails, because good audio with a nominal window
 *  is worth more than no audio. */
app.post("/project/:id/narrate", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    limit?: number;
    sceneIds?: string[];
    force?: boolean;
    voice?: string;
  };

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);

  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid", details: parsed.errors }, 500);

  const nextVersion = project.current_ir_version + 1;
  const { ir: narratedIR, report } = await narrateScenes(
    c.env,
    projectId,
    parsed.ir,
    nextVersion,
    body,
  );

  if (report.narrated === 0) {
    // Nothing was frozen, so nothing is versioned. A failed batch must not
    // leave a version behind that looks like progress.
    return c.json({ projectId, irVersion: project.current_ir_version, ...report }, 200);
  }

  await writeVersion(
    c.env,
    projectId,
    narratedIR,
    nextVersion,
    project.current_ir_version,
    `Narrated ${report.narrated} scene${report.narrated === 1 ? "" : "s"}${report.failed ? ` (${report.failed} failed)` : ""}`,
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  return c.json({ projectId, irVersion: nextVersion, ...report });
});

/** The narration audio itself, so the Lab can play it and the render can
 *  mux it. Streams straight from R2 — the Worker holds no copy. */
app.get("/project/:id/vo/:sceneId", async (c) => {
  const projectId = c.req.param("id");
  const sceneId = c.req.param("sceneId");

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const parsed = parseIR(JSON.parse(version.ir_json));
  if (!parsed.ok) return c.json({ error: "stored IR is invalid" }, 500);

  const scene = parsed.ir.scenes.find((s) => s.sceneId === sceneId);
  const assetId = scene?.narration.voAssetId;
  const asset = assetId ? parsed.ir.assets.find((a) => a.assetId === assetId) : undefined;
  if (!asset) return c.json({ error: "this scene has no narration yet" }, 404);

  const obj = await c.env.FILES.get(asset.r2Key);
  if (!obj) return c.json({ error: "narration object is missing from storage" }, 404);

  const bytes = await obj.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "content-type": sniff(new Uint8Array(bytes.slice(0, 8))).contentType,
      "cache-control": "public, max-age=31536000, immutable",
      // The hash is the identity. A client that has this etag has the
      // approved bytes, not merely bytes from the same key.
      etag: `"${asset.sha256}"`,
    },
  });
});

/** WHAT THE BINDING ACTUALLY RETURNS.
 *
 *  A permanent diagnostic, and a deliberate one. The last serious bug in
 *  this system was an unverified assumption about the shape of a Workers
 *  AI response, and it survived because nothing could ask production what
 *  the shape was without also writing something. This asks, stores
 *  nothing, and reports what it saw — including on failure, which is the
 *  case that matters.
 *
 *  IT TRIES EVERY CANDIDATE, not just until one works.
 *
 *  A ladder that stops at its first success answers "can we speak?" A
 *  probe should answer "what is actually available here", because the next
 *  question after the first success is always which of the others also
 *  work and what they return — and a second round trip to find out is a
 *  second deploy-and-wait. One run reports the whole shelf: every TTS
 *  candidate, every ASR candidate, what each returned, how many bytes, and
 *  the structural shape of anything unusable.
 *
 *  ASR is probed with the audio the TTS step just produced, because that
 *  is exactly what alignment will be handed in production. Probing it with
 *  a synthetic buffer would answer a question nobody is asking. */
app.post("/tts/probe", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    text?: string;
    voice?: string;
    /** Skip the ASR half. Off by default — measuring the audio is half of
     *  what narration does. */
    speechOnly?: boolean;
  };
  const text = (body.text ?? "Canopticon Studio. Narration probe.").slice(0, 300);
  const started = Date.now();

  const speech: Array<Record<string, unknown>> = [];
  let firstAudio: Uint8Array | null = null;

  for (const candidate of TTS_CANDIDATES) {
    const at = Date.now();
    let out: unknown;
    try {
      out = await c.env.AI.run(
        candidate.model as never,
        candidate.input(text, body.voice) as never,
      );
    } catch (err) {
      speech.push({
        model: candidate.model,
        ok: false,
        outcome: `threw: ${err instanceof Error ? err.message : String(err)}`,
        wallMs: Date.now() - at,
      });
      continue;
    }
    const bytes = await toBytes(out);
    if (!bytes) {
      speech.push({
        model: candidate.model,
        ok: false,
        outcome: "no recoverable audio",
        shape: describeShape(out),
        wallMs: Date.now() - at,
      });
      continue;
    }
    const sniffed = sniff(bytes.bytes);
    if (!firstAudio) firstAudio = bytes.bytes;
    speech.push({
      model: candidate.model,
      ok: true,
      via: bytes.via,
      bytes: bytes.bytes.length,
      contentType: sniffed.contentType,
      extension: sniffed.extension,
      firstBytes: [...bytes.bytes.subarray(0, 8)].map((b) => b.toString(16).padStart(2, "0")),
      wallMs: Date.now() - at,
    });
  }

  const transcription: Array<Record<string, unknown>> = [];
  if (!body.speechOnly && firstAudio) {
    for (const candidate of ASR_CANDIDATES) {
      const at = Date.now();
      let out: unknown;
      try {
        out = await c.env.AI.run(candidate.model as never, candidate.input(firstAudio) as never);
      } catch (err) {
        transcription.push({
          model: candidate.model,
          ok: false,
          outcome: `threw: ${err instanceof Error ? err.message : String(err)}`,
          wallMs: Date.now() - at,
        });
        continue;
      }
      const read = readTimings(out);
      transcription.push({
        model: candidate.model,
        ok: read.durationMs > 0,
        words: read.words.length,
        durationMs: read.durationMs,
        // The shape either way: on failure it is the diagnostic, and on
        // success it is how the next person knows what was relied on.
        shape: describeShape(out),
        firstWords: read.words.slice(0, 4),
        wallMs: Date.now() - at,
      });
    }
  }

  return c.json({
    ok: speech.some((s) => s.ok),
    wallMs: Date.now() - started,
    text,
    speech,
    transcription,
    note: firstAudio
      ? "ASR was run against the audio the first working TTS candidate produced."
      : "No TTS candidate produced audio, so ASR was not probed.",
  });
});

/** AUDITION — hear the candidates before committing a film to one.
 *
 *  The provider question is a product decision and it should be settled by
 *  ear rather than by argument. This speaks one line through every
 *  available candidate and hands back the audio, so two voices can be
 *  compared on the operator's own sentence rather than on a demo reel.
 *
 *  Stores nothing. Costs one call per candidate on a line the operator
 *  chose, which is the cheapest possible way to make this decision and
 *  considerably cheaper than narrating a film to find out.
 *
 *  Base64 rather than a URL for the same reason it stores nothing: an
 *  audition is not an artifact. Nothing here is hashed, versioned, or
 *  reachable again — if it were, it would be narration, and narration is
 *  a deliberate act with a different button. */
app.post("/voice/audition", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string; voice?: string };
  const line = (body.text ?? "The building is the same. The residents are the same.").slice(0, 400);

  const takes: Array<Record<string, unknown>> = [];
  for (const candidate of TTS_CANDIDATES) {
    const at = Date.now();
    let out: unknown;
    try {
      out = await c.env.AI.run(
        candidate.model as never,
        candidate.input(line, body.voice) as never,
      );
    } catch (err) {
      takes.push({
        model: candidate.model,
        ok: false,
        outcome: `unavailable: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const bytes = await toBytes(out);
    if (!bytes) {
      takes.push({ model: candidate.model, ok: false, outcome: "no recoverable audio" });
      continue;
    }
    const sniffed = sniff(bytes.bytes);
    takes.push({
      model: candidate.model,
      ok: true,
      contentType: sniffed.contentType,
      bytes: bytes.bytes.length,
      wallMs: Date.now() - at,
      // The audio itself, so the browser can play it without a round trip
      // to storage that would imply this was kept.
      audio: toBase64(bytes.bytes),
    });
  }

  return c.json({ text: line, takes });
});

/** DOES THE NUMBER SURVIVE BEING SPOKEN?
 *
 *  The one question about a voice this system can answer objectively, and
 *  it happens to be the one that matters most here. Whether narration
 *  sounds authoritative over fifteen minutes is a judgement a person makes
 *  with their ears. Whether "$282,345.84" comes back as "$282,345.84" is a
 *  measurement — and on an institutional investigation an approximation of
 *  that figure is a different finding, which is the standing rule the
 *  whole figures pipeline exists to protect.
 *
 *  So: speak the line, transcribe it back, and report what survived. A
 *  round trip through a DIFFERENT model family than the one that spoke it,
 *  which is the same generate-then-verify discipline the Record uses on
 *  quotes.
 *
 *  This is NOT a quality score. A model can round-trip perfectly and still
 *  be unpleasant to listen to for a quarter of an hour. It is a floor: a
 *  voice that mangles the figures is disqualified regardless of how it
 *  sounds, and a voice that keeps them has earned the right to be judged
 *  by ear. */
app.post("/voice/fidelity", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  const line =
    body.text ??
    "The City of Niagara Falls received a federal IHAP grant of $282,345.84 for 2024-2025. " +
      "Peak occupancy reached 7,000 people in July 2023. The building is the same.";

  // What must survive verbatim: money, counts, years, and capitalised
  // names. Anything a viewer would read off the screen and check.
  const mustSurvive = [
    ...(line.match(/\$[\d,]+(?:\.\d+)?/g) ?? []),
    ...(line.match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? []),
    ...(line.match(/\b[A-Z][a-z]{2,}\b/g) ?? []),
  ];

  const takes: Array<Record<string, unknown>> = [];
  for (const candidate of TTS_CANDIDATES) {
    let out: unknown;
    try {
      out = await c.env.AI.run(candidate.model as never, candidate.input(line) as never);
    } catch (err) {
      takes.push({
        model: candidate.model,
        ok: false,
        outcome: `unavailable: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const bytes = await toBytes(out);
    if (!bytes) {
      takes.push({ model: candidate.model, ok: false, outcome: "no recoverable audio" });
      continue;
    }

    // Transcribed by a different family than the one that spoke it.
    let heard = "";
    let durationMs = 0;
    let words = 0;
    for (const asr of ASR_CANDIDATES) {
      try {
        const back = await c.env.AI.run(asr.model as never, asr.input(bytes.bytes) as never);
        const timings = readTimings(back);
        const asObject = back as unknown as { text?: unknown } | null;
        const said =
          asObject && typeof asObject.text === "string"
            ? asObject.text
            : timings.words.map((w) => w.word).join(" ");
        if (said) {
          heard = said;
          durationMs = timings.durationMs;
          words = timings.words.length;
          break;
        }
      } catch {
        // Next ASR candidate. A transcription that fails says nothing
        // about the voice.
      }
    }

    const lower = heard.toLowerCase().replace(/\s+/g, " ");
    const kept = mustSurvive.filter((t) => lower.includes(t.toLowerCase()));
    const lost = mustSurvive.filter((t) => !lower.includes(t.toLowerCase()));
    // Words per minute, measured. Documentary narration sits around
    // 130–160; far outside that is a pacing problem no amount of liking
    // the timbre will fix.
    const wpm = durationMs > 0 ? Math.round((line.split(/\s+/).length / durationMs) * 60000) : 0;

    takes.push({
      model: candidate.model,
      ok: true,
      bytes: bytes.bytes.length,
      durationMs,
      wordsHeard: words,
      wpm,
      survived: `${kept.length}/${mustSurvive.length}`,
      lost,
      heard,
      audio: toBase64(bytes.bytes),
    });
  }

  return c.json({
    text: line,
    mustSurvive,
    takes,
    note:
      "Round-trip fidelity is a FLOOR, not a quality score. A voice that mangles the figures is " +
      "disqualified however it sounds; one that keeps them has earned the right to be judged by ear.",
  });
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
  const timed = await frozenAlignments(c.env, parsed.ir);
  const report = await compile(parsed.ir, { snapshot, alignments: timed.alignments });
  report.warnings.push(...timed.stale);
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

/** THE DIRECTOR'S EDIT.
 *
 *  Writes a new creative state and nothing else. This is the loop the whole
 *  architecture exists to make cheap: narration is a frozen input artifact,
 *  so re-styling a film spends no TTS and no model call, and the
 *  per-primitive cache means only the nodes whose inputs actually moved get
 *  recomputed. Until this route existed the sliders moved and nothing was
 *  saved — the thesis was a demo of itself.
 *
 *  Append-only, like every other write here: an edit is a VERSION, so a
 *  director can drag a curve, dislike it, and revert to the exact film they
 *  had before.
 *
 *  Control points keep their ORIGINAL binding. An act-bound point is the
 *  preferred authoring form precisely because it survives re-timing, so the
 *  client sends back the descriptor it was given rather than the position
 *  that descriptor happened to resolve to. */
app.post("/project/:id/creative-state", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    identity?: Record<string, number>;
    controlPoints?: { at: unknown; values: Record<string, number> }[];
    invariants?: { param: string; min?: number; max?: number }[];
    /** THE FILM'S VISUAL LANGUAGE, editable for the first time.
     *
     *  It has been a real, load-bearing field since `construct.ts` was
     *  written — it moves every operator's appetite and sets the
     *  representation rung a construction prefers — and there was no way
     *  to change it from anywhere. So a director could reach the two
     *  continuous dimensions of the film's depiction and not the one
     *  discrete one, which is the choice with the largest effect.
     *
     *  It travels the identical rail as a curve edit: validated, written
     *  as a new IR version with a stated summary, recompiled against the
     *  stored snapshot, and the cache diff handed back. Structurally zero
     *  TTS — restyling a film has never been allowed to cost speech. */
    visualLanguage?: string;
    /** The film's colour, as the four directorial numbers. Same rail as a
     *  curve drag: validated, versioned, recompiled, cost reported. */
    colour?: Record<string, number>;
  };

  const project = await one<ProjectRow>(c.env.DB, "SELECT * FROM projects WHERE id = ?", [
    projectId,
  ]);
  if (!project) return c.json({ error: "not found" }, 404);
  const version = await loadVersion(c.env, projectId, project.current_ir_version);
  if (!version) return c.json({ error: "no IR stored for this project" }, 400);
  const current = parseIR(JSON.parse(version.ir_json));
  if (!current.ok) return c.json({ error: "stored IR is invalid", details: current.errors }, 500);

  const next: EditorialIR = {
    ...current.ir,
    visualLanguage: (body.visualLanguage ??
      current.ir.visualLanguage) as EditorialIR["visualLanguage"],
    cinematography: {
      ...current.ir.cinematography,
      colour: {
        ...current.ir.cinematography.colour,
        ...(body.colour ?? {}),
      },
    },
    creativeState: {
      ...current.ir.creativeState,
      identity: body.identity ?? current.ir.creativeState.identity,
      controlPoints: (body.controlPoints ??
        current.ir.creativeState.controlPoints) as EditorialIR["creativeState"]["controlPoints"],
      invariants: (body.invariants ??
        current.ir.creativeState.invariants) as EditorialIR["creativeState"]["invariants"],
    },
  };

  // Validated before it is stored, never after. A curve edit that produced
  // an IR the compiler would reject should fail here, with the reason,
  // rather than becoming a version that cannot be opened.
  const parsed = parseIR(JSON.parse(JSON.stringify(next)));
  if (!parsed.ok) return c.json({ error: "invalid creative state", details: parsed.errors }, 400);

  const nextVersion = project.current_ir_version + 1;
  const changedLanguage =
    body.visualLanguage !== undefined && body.visualLanguage !== current.ir.visualLanguage;
  const changedColour = body.colour !== undefined;
  await writeVersion(
    c.env,
    projectId,
    parsed.ir,
    nextVersion,
    project.current_ir_version,
    changedLanguage
      ? `Visual language → ${parsed.ir.visualLanguage}`
      : changedColour
        ? "Colour changed"
        : "Creative state edited",
  );
  await run(c.env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    nextVersion,
    projectId,
  ]);

  // Recompile against the stored snapshot and hand back the diff, because
  // the interesting part of an edit is what it did NOT invalidate.
  const snapshot = await loadSnapshot(c.env, projectId);
  const timed = await frozenAlignments(c.env, parsed.ir);
  const report = await compile(parsed.ir, { snapshot, alignments: timed.alignments });
  await saveSnapshot(c.env, projectId, report.snapshot);
  return c.json({
    projectId,
    irVersion: nextVersion,
    visualLanguage: parsed.ir.visualLanguage,
    colour: parsed.ir.cinematography.colour,
    cache: report.cache,
    ttsCalls: report.ttsCalls,
    warnings: report.warnings,
  });
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
  const timed = await frozenAlignments(c.env, parsed.ir);
  const report = await compile(parsed.ir, { snapshot, alignments: timed.alignments });
  report.warnings.push(...timed.stale);
  // A REAL COMPILE UPDATES THE SNAPSHOT. Two routes compile and only one
  // used to store what it produced, so the cache diff an operator saw
  // depended on which route they had happened to hit last — opening a film
  // and then dragging a curve reported 296/296 recomputed for an edit that
  // genuinely touched 43 of 88 scenes. The cache should always mean "since
  // the last time this film was compiled", whoever asked for it.
  await saveSnapshot(c.env, projectId, report.snapshot);
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

/** Every frozen alignment this film has, placed on the film's timeline.
 *
 *  Two steps, and the second is the one that is easy to get wrong: an
 *  alignment artifact measures ONE audio file, so its times start at zero.
 *  The solver reads absolute times, because a scene's window is its
 *  position in the film. `sequenceAlignments` walks the scenes in the IR's
 *  order — not the map's — and shifts each by the running cursor.
 *
 *  Anything that fails verification comes back as a warning rather than
 *  silently as a missing alignment, because "this film is not narrated
 *  yet" and "this film's narration no longer matches what was approved"
 *  are different facts and only one of them is a bug. */
async function frozenAlignments(env: Env, ir: EditorialIR) {
  const loaded = await loadAlignments(env, ir);
  return {
    alignments: sequenceAlignments(ir.scenes, loaded.alignments),
    stale: loaded.stale,
  };
}

async function saveSnapshot(env: Env, projectId: string, snapshot: CacheSnapshot): Promise<void> {
  await env.FILES.put(`projects/${projectId}/cache/snapshot.json`, JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json" },
  });
}

export default app;
