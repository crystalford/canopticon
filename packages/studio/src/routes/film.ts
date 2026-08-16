// THE FILM ROUTES. Create it, read it, cut it.
//
// The Worker's authority ends at the FilmCut: it decides what a moment IS
// and WHEN it happens, and never what it looks like. Placement, size, face
// and colour all need text metrics that do not exist here, and deciding
// them anyway is how a system ends up with two engines that disagree.

import { Hono } from "hono";
import { buildCut } from "../cut/index.ts";
import { analyseEssay, describeProvenance } from "../editor/index.ts";
import { callEditor } from "../editor/model.ts";
import { verifyEditorial } from "../editor/verify.ts";
import type { Env } from "../env.ts";
import { type Film, SettingsSchema, parseFilm } from "../film/schema.ts";
import { segmentEssay } from "../film/segment.ts";
import { all, newId, nowIso, one, run } from "../lib/d1.ts";
import { freshFilmSeed } from "../lib/rng.ts";
import { planSpans } from "../narrate/spans.ts";
import { loadSpans } from "../narrate/store.ts";
import { estimateSpine } from "../timeline/estimate.ts";
import { buildSpine } from "../timeline/spine.ts";

const app = new Hono<{ Bindings: Env }>();

interface ProjectRow {
  id: string;
  title: string;
  created_at: string;
  current_ir_version: number;
}
interface VersionRow {
  ir_json: string;
  version: number;
}

/** WHAT A STORED RECORD TURNS OUT TO BE.
 *
 *  Three outcomes, not two. Collapsing "there is no such film" and "this
 *  film predates the engine" into one `null` is what would make every
 *  pre-reset film list on the front page and then 404 on open — visible
 *  and broken, which is worse than either alone. */
export type Loaded =
  | { kind: "ok"; film: Film }
  | { kind: "legacy"; essay: string; title: string }
  | { kind: "missing" };

/** Old films were `EditorialIR`: no `schema` field, a `scenes` array, and —
 *  the part that matters — the essay at the top level. Everything else in
 *  that record was DERIVED from the essay, so there is nothing to convert.
 *  The essay is recovered and re-read; the derivation is redone. */
function readLegacy(raw: unknown): Loaded {
  if (!raw || typeof raw !== "object") return { kind: "missing" };
  const o = raw as Record<string, unknown>;
  const looksOld = Array.isArray(o.scenes) || Array.isArray(o.acts);
  const essay = typeof o.essay === "string" ? o.essay.trim() : "";
  // An old record whose essay is gone cannot be re-read into anything.
  // Say it is missing rather than offering to rebuild an empty film.
  if (!looksOld || essay.length < 40) return { kind: "missing" };
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Untitled";
  return { kind: "legacy", essay, title };
}

async function loadFilm(env: Env, id: string): Promise<Loaded> {
  const row = await one<VersionRow>(
    env.DB,
    `SELECT ir_json, version FROM ir_versions WHERE project_id = ?
     ORDER BY version DESC LIMIT 1`,
    [id],
  );
  if (!row) return { kind: "missing" };
  let raw: unknown;
  try {
    raw = JSON.parse(row.ir_json);
  } catch {
    return { kind: "missing" };
  }
  const parsed = parseFilm(raw);
  return parsed.ok ? { kind: "ok", film: parsed.film } : readLegacy(raw);
}

/** The 409 an old film gets instead of a dead 404, so the browser can
 *  offer the fix rather than showing a wall. */
const legacyBody = (id: string, l: Extract<Loaded, { kind: "legacy" }>) => ({
  error: "this film was made by the previous engine",
  legacy: true,
  filmId: id,
  title: l.title,
  words: l.essay.split(/\s+/).filter(Boolean).length,
});

async function saveFilm(env: Env, film: Film, summary: string): Promise<number> {
  const last = await one<{ v: number }>(
    env.DB,
    "SELECT COALESCE(MAX(version), 0) AS v FROM ir_versions WHERE project_id = ?",
    [film.filmId],
  );
  const version = (last?.v ?? 0) + 1;
  await run(
    env.DB,
    `INSERT INTO ir_versions (id, project_id, version, ir_json, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId("irv"), film.filmId, version, JSON.stringify(film), summary, nowIso()],
  );
  await run(env.DB, "UPDATE projects SET current_ir_version = ? WHERE id = ?", [
    version,
    film.filmId,
  ]);
  return version;
}

/* ── the front door ────────────────────────────────────────────────── */

app.get("/films", async (c) => {
  // EVERY FILM EVER MADE IS A ROW IN THIS TABLE, including the ones the
  // previous engine made. Listing them without saying which is which is
  // how a front page fills with links that 404 — so the latest stored
  // record is checked for the new schema marker in the same query rather
  // than in a hundred round trips.
  const rows = await all<ProjectRow & { engine: string | null }>(
    c.env.DB,
    `SELECT p.id, p.title, p.created_at, p.current_ir_version,
            (SELECT CASE WHEN v.ir_json LIKE '%canopticon.film/1%' THEN 'film' ELSE 'legacy' END
               FROM ir_versions v
              WHERE v.project_id = p.id
              ORDER BY v.version DESC LIMIT 1) AS engine
       FROM projects p
      ORDER BY p.created_at DESC LIMIT 100`,
  );
  return c.json({
    films: rows.map((r) => ({ ...r, legacy: r.engine !== "film" })),
  });
});

/** RE-READ AN OLD FILM.
 *
 *  Not a conversion — there is nothing in an old record worth converting.
 *  Its scenes, constructions and chains describe an engine that no longer
 *  exists; its ESSAY is the only thing that was ever the source of truth,
 *  and everything else was derived from it. So the essay is recovered and
 *  the derivation is simply redone by the current engine.
 *
 *  A POST, not a side effect of opening the film: a GET must not write,
 *  and the operator decides when to spend a model call.
 *
 *  `ir_versions` is append-only, so the old record survives this untouched
 *  and the film keeps its id, its title and its place in the list. */
app.post("/film/:id/reread", async (c) => {
  const id = c.req.param("id");
  const loaded = await loadFilm(c.env, id);
  if (loaded.kind === "ok") {
    return c.json({ error: "this film is already on the current engine", filmId: id }, 409);
  }
  if (loaded.kind === "missing") return c.json({ error: "no such film" }, 404);

  const { essay, title } = loaded;
  const body = await c.req.json().catch(() => ({}));
  const seg = segmentEssay(essay);
  const read = await analyseEssay(c.env.AI, essay);
  const film: Film = {
    schema: "canopticon.film/1",
    filmId: id,
    title: title || seg.title,
    essay,
    seed: Number.isInteger(body.seed) ? Number(body.seed) : freshFilmSeed(),
    settings: SettingsSchema.parse(body.settings ?? {}),
    editorial: read.editorial,
    editorialHash: read.editorialHash,
    editorialProvenance: read.provenance,
    // The old recordings cannot come across: they were cut per SCENE, at
    // sentence boundaries, under keys naming scene ids that no longer
    // exist. The new engine speaks paragraph-scale spans. Saying the film
    // is silent is honest; quietly serving mismatched audio would not be.
    narration: { voice: null, spans: planSpans(essay, read.editorial) },
    assets: [],
    createdAt: nowIso(),
  };

  const checked = parseFilm(film);
  if (!checked.ok) {
    return c.json({ error: "the re-read film did not validate", details: checked.errors }, 500);
  }
  const version = await saveFilm(c.env, film, "re-read by the film engine");
  await run(c.env.DB, "UPDATE projects SET title = ? WHERE id = ?", [film.title, id]);

  return c.json({
    filmId: id,
    version,
    title: film.title,
    seed: film.seed,
    beats: film.editorial.beats.length,
    sections: film.editorial.sections.length,
    motifs: film.editorial.motifs.length,
    spans: film.narration.spans.length,
    spokenWords: seg.spokenWords,
    editorial: describeProvenance(film.editorialProvenance),
    narration:
      "none — the previous engine's recordings could not carry over, so record it again to hear it",
    notes: read.notes,
  });
});

/** ESSAY IN. The one entry point. Runs the editor (model, verified,
 *  frozen; rules if it declines), plans the narration spans, and stores a
 *  complete film record — no separate "compile" step to forget. */
app.post("/film", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const essay = typeof body.essay === "string" ? body.essay.trim() : "";
  if (essay.length < 40) {
    return c.json({ error: "an essay is required (at least a paragraph)" }, 400);
  }
  const settings = SettingsSchema.parse(body.settings ?? {});
  const voice = typeof body.voice === "string" && body.voice ? body.voice : null;
  const seed = Number.isInteger(body.seed) ? Number(body.seed) : freshFilmSeed();

  const seg = segmentEssay(essay);
  const read = await analyseEssay(c.env.AI, essay);
  const filmId = newId("film");
  const film: Film = {
    schema: "canopticon.film/1",
    filmId,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : seg.title,
    essay,
    seed,
    settings,
    editorial: read.editorial,
    editorialHash: read.editorialHash,
    editorialProvenance: read.provenance,
    narration: { voice, spans: planSpans(essay, read.editorial) },
    assets: [],
    createdAt: nowIso(),
  };

  const checked = parseFilm(film);
  if (!checked.ok)
    return c.json({ error: "the film did not validate", details: checked.errors }, 500);

  await run(
    c.env.DB,
    "INSERT INTO projects (id, title, created_at, current_ir_version) VALUES (?, ?, ?, 0)",
    [filmId, film.title, film.createdAt],
  );
  await saveFilm(c.env, film, "essay ingested");

  return c.json(
    {
      filmId,
      title: film.title,
      seed,
      beats: film.editorial.beats.length,
      sections: film.editorial.sections.length,
      motifs: film.editorial.motifs.length,
      spans: film.narration.spans.length,
      spokenWords: seg.spokenWords,
      editorial: describeProvenance(film.editorialProvenance),
      notes: read.notes,
    },
    201,
  );
});

app.get("/film/:id", async (c) => {
  const id = c.req.param("id");
  const loaded = await loadFilm(c.env, id);
  if (loaded.kind === "legacy") return c.json(legacyBody(id, loaded), 409);
  if (loaded.kind === "missing") return c.json({ error: "no such film" }, 404);
  const { film } = loaded;
  return c.json({ film, editorial: describeProvenance(film.editorialProvenance) });
});

app.delete("/film/:id", async (c) => {
  const id = c.req.param("id");
  const list = await c.env.FILES.list({ prefix: `films/${id}/` });
  for (const obj of list.objects) await c.env.FILES.delete(obj.key);
  await run(c.env.DB, "DELETE FROM ir_versions WHERE project_id = ?", [id]);
  await run(c.env.DB, "DELETE FROM projects WHERE id = ?", [id]);
  return c.json({ deleted: id });
});

/** Change the dials, or re-roll the seed. Cheap: the editorial reading is
 *  frozen and is NOT recomputed, so a different look costs no model call
 *  and no narration. */
app.post("/film/:id/settings", async (c) => {
  const id = c.req.param("id");
  const loaded = await loadFilm(c.env, id);
  if (loaded.kind === "legacy") return c.json(legacyBody(id, loaded), 409);
  if (loaded.kind === "missing") return c.json({ error: "no such film" }, 404);
  const { film } = loaded;
  const body = await c.req.json().catch(() => ({}));
  const next: Film = {
    ...film,
    settings: SettingsSchema.parse({ ...film.settings, ...(body.settings ?? {}) }),
    seed:
      body.seed === "new" ? freshFilmSeed() : Number.isInteger(body.seed) ? body.seed : film.seed,
  };
  const version = await saveFilm(c.env, next, "settings changed");
  return c.json({ ok: true, version, seed: next.seed, settings: next.settings });
});

/* ── the cut ───────────────────────────────────────────────────────── */

/** THE SEAM. A pure function of the frozen record: one D1 read, no model
 *  call, no narration. The browser turns this into pixels. */
app.get("/film/:id/cut", async (c) => {
  const id = c.req.param("id");
  const loaded = await loadFilm(c.env, id);
  if (loaded.kind === "legacy") return c.json(legacyBody(id, loaded), 409);
  if (loaded.kind === "missing") return c.json({ error: "no such film" }, 404);
  const { film } = loaded;

  const { spoken, stale } = await loadSpans(c.env, film);
  const measured = spoken
    .filter((s) => s.durationMs > 0)
    .map((s) => ({
      span: film.narration.spans.find((x) => x.spanId === s.spanId) as NonNullable<
        (typeof film.narration.spans)[number]
      >,
      heard: s.words,
      durationMs: s.durationMs,
    }))
    .filter((m) => m.span);

  const spine =
    measured.length > 0
      ? buildSpine(film.essay, measured)
      : estimateSpine(film.essay, film.editorial.sections);

  const voice =
    measured.length > 0
      ? {
          spans: spoken.map((s, i) => ({
            spanId: s.spanId,
            startMs: spoken.slice(0, i).reduce((n, p) => n + p.durationMs + 320, 0),
            durationMs: s.durationMs,
            url: `/v1/film/${film.filmId}/vo/${s.spanId}`,
            sha256: s.audio.sha256,
          })),
        }
      : null;

  const cut = await buildCut({ film, spine, voice });
  for (const s of stale) cut.warnings.push(s);
  cut.warnings.push(spine.describes);

  const started = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO compile_runs (id, project_id, ir_version, nodes_total, nodes_recomputed,
       scenes_touched, wall_ms, tts_calls, report_json, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
    [
      newId("run"),
      film.filmId,
      0,
      cut.beats.length,
      cut.beats.length,
      Date.now() - started,
      JSON.stringify({ cutHash: cut.cutHash, spine: cut.spine, warnings: cut.warnings }),
      nowIso(),
    ],
  ).catch(() => undefined);

  return c.json(cut);
});

/* ── the probe, and it ships FIRST ─────────────────────────────────── */

/** RUN THIS BEFORE TRUSTING A SINGLE FILM.
 *
 *  The deleted extract-reading.ts records a route that had never once
 *  succeeded: it assumed a response shape, threw, and the throw was
 *  swallowed into a designed "declined" outcome. It looked polite and
 *  correct for weeks. This returns the raw response, what shape it was,
 *  what parsed, and what the verifier threw away. */
app.post("/editorial/probe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const essay =
    typeof body.essay === "string" && body.essay.trim().length > 40
      ? body.essay
      : `The medium doesn't reward having been right before. It rewards winning now.

A platform pays for attention, not accuracy, so the fastest route to revenue is manufactured conflict, repeated on schedule. The performer does not need to be right. He needs to be reliably furious.`;

  const call = await callEditor(c.env.AI, essay);
  const checked = call.ok ? verifyEditorial(call.json, essay) : null;

  // EACH PASS, SEPARATELY. The two-pass split exists because a single call
  // asked to hold structure and content and full coverage at once was
  // quietly dropping the coverage requirement — and that failure was only
  // findable by looking at each pass's own raw output and coverage, not
  // the merged result. This is that same diagnostic, kept live rather than
  // done by hand against production the way it was found.
  const passSummary = (p: typeof call.sectionsPass) => ({
    ok: p.ok,
    model: p.model ?? null,
    reason: p.reason ?? null,
    attempts: p.attempts,
    rawFirst400: p.raw ? p.raw.slice(0, 400) : null,
    rawLength: p.raw?.length ?? null,
  });

  return c.json({
    ok: call.ok,
    model: call.model ?? null,
    reason: call.reason ?? null,
    attempts: call.attempts,
    sectionsPass: passSummary(call.sectionsPass),
    beatsPass: call.beatsPass ? passSummary(call.beatsPass) : null,
    parsed: call.json
      ? {
          sections: Array.isArray((call.json as Record<string, unknown>).sections)
            ? ((call.json as Record<string, unknown>).sections as unknown[]).length
            : 0,
          beats: Array.isArray((call.json as Record<string, unknown>).beats)
            ? ((call.json as Record<string, unknown>).beats as unknown[]).length
            : 0,
        }
      : null,
    verified: checked
      ? {
          declined: checked.declined,
          beats: checked.editorial.beats.length,
          promoted: checked.editorial.beats.filter((b) => b.phrases.length > 0).length,
          motifs: checked.editorial.motifs.length,
          rejectedPhrases: checked.rejectedPhrases,
          notes: checked.notes,
        }
      : null,
  });
});

export default app;
export { loadFilm, saveFilm };
