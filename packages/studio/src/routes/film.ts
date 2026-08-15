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

async function loadFilm(env: Env, id: string): Promise<Film | null> {
  const row = await one<VersionRow>(
    env.DB,
    `SELECT ir_json, version FROM ir_versions WHERE project_id = ?
     ORDER BY version DESC LIMIT 1`,
    [id],
  );
  if (!row) return null;
  const parsed = parseFilm(JSON.parse(row.ir_json));
  return parsed.ok ? parsed.film : null;
}

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
  const rows = await all<ProjectRow>(
    c.env.DB,
    "SELECT id, title, created_at, current_ir_version FROM projects ORDER BY created_at DESC LIMIT 100",
  );
  return c.json({ films: rows });
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
  const film = await loadFilm(c.env, c.req.param("id"));
  if (!film) return c.json({ error: "no such film" }, 404);
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
  const film = await loadFilm(c.env, c.req.param("id"));
  if (!film) return c.json({ error: "no such film" }, 404);
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
  const film = await loadFilm(c.env, c.req.param("id"));
  if (!film) return c.json({ error: "no such film" }, 404);

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
  return c.json({
    ok: call.ok,
    model: call.model ?? null,
    reason: call.reason ?? null,
    attempts: call.attempts,
    rawFirst400: call.raw ? call.raw.slice(0, 400) : null,
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
