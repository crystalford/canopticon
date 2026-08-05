// /react routes — the reaction-video production tool (standalone,
// separate route family from /queue's GDELT/AI-voiceover pipeline; see
// react/db.ts + react/segment-points.ts for the data model and LLM
// pipeline this wires together).
//
// GET  /react                          — project list
// POST /react/projects                 — create a project (title + source
//                                         URL), kicks off transcription +
//                                         point segmentation in waitUntil
// GET  /react/projects/:id             — review/scripting surface: project
//                                         status + its points, editable
// POST /react/projects/:id/points/:pid — approve/skip/edit one point
//                                         (summary, cue_mode, cue_text)
// GET  /react/projects/:id/points/:pid/record  — full-screen cue + record UI
// POST /react/projects/:id/points/:pid/upload  — store the operator's own
//                                         camera+mic take for this point
// GET  /react/clip/:key                — streams a stored reaction clip.
//                                         No operator gate (same call as
//                                         voice/routes.ts's /sample/:key):
//                                         the render Container fetches this
//                                         over plain HTTPS at stitch time,
//                                         with no session cookie to send.

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth";
import type { Env } from "../env";
import { renderReactDetailPage, renderReactListPage, renderRecordPage } from "../pages/react";
import {
  createReactProject,
  listReactPoints,
  listReactProjects,
  loadReactPoint,
  loadReactProject,
  updateReactPoint,
  updateReactProject,
} from "../react/db";
import { segmentTranscriptIntoPoints } from "../react/segment-points";
import { transcribeVideo } from "../render/client";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

const CLIP_PREFIX = "react-clips/";

app.get("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const projects = await listReactProjects(c.env.DB).catch(() => []);
  return renderReactListPage({ projects });
});

app.post("/projects", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const form = await c.req.parseBody();
  const title = typeof form.title === "string" ? form.title.trim() : "";
  const sourceUrl = typeof form.source_url === "string" ? form.source_url.trim() : "";
  if (!title || !sourceUrl) {
    return new Response("title and source_url are both required", { status: 400 });
  }

  const project = await createReactProject(c.env.DB, { title, sourceUrl });
  c.executionCtx.waitUntil(runTranscribeAndSegment(c.env, project.id, sourceUrl));
  return c.redirect(`/react/projects/${encodeURIComponent(project.id)}`, 302);
});

app.get("/projects/:id", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const id = c.req.param("id");
  const project = await loadReactProject(c.env.DB, id);
  if (!project) return new Response("project not found", { status: 404 });
  const points = await listReactPoints(c.env.DB, id).catch(() => []);
  return renderReactDetailPage({ project, points });
});

app.post("/projects/:id/points/:pointId", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const pointId = c.req.param("pointId");
  const point = await loadReactPoint(c.env.DB, pointId);
  if (!point || point.project_id !== c.req.param("id")) {
    return new Response("point not found", { status: 404 });
  }
  const form = await c.req.parseBody();
  const action = typeof form.action === "string" ? form.action : "";

  if (action === "approve" || action === "skip") {
    await updateReactPoint(c.env.DB, pointId, {
      status: action === "approve" ? "approved" : "skipped",
    });
  } else if (action === "save") {
    const cueMode = form.cue_mode === "verbatim" ? "verbatim" : "bullets";
    const cueText = typeof form.cue_text === "string" ? form.cue_text : point.cue_text;
    const summary =
      typeof form.summary === "string" && form.summary.trim() ? form.summary.trim() : point.summary;
    await updateReactPoint(c.env.DB, pointId, { cue_mode: cueMode, cue_text: cueText, summary });
  }
  return c.redirect(`/react/projects/${encodeURIComponent(c.req.param("id"))}`, 302);
});

app.get("/projects/:id/points/:pointId/record", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const id = c.req.param("id");
  const point = await loadReactPoint(c.env.DB, c.req.param("pointId"));
  if (!point || point.project_id !== id) return new Response("point not found", { status: 404 });
  const project = await loadReactProject(c.env.DB, id);
  if (!project) return new Response("project not found", { status: 404 });
  return renderRecordPage({ project, point });
});

app.post("/projects/:id/points/:pointId/upload", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const pointId = c.req.param("pointId");
  const point = await loadReactPoint(c.env.DB, pointId);
  if (!point || point.project_id !== c.req.param("id")) {
    return new Response("point not found", { status: 404 });
  }
  const body = await c.req.arrayBuffer();
  if (!body || body.byteLength < 1000) {
    return new Response("recording too short", { status: 400 });
  }
  const durationMs = Number(c.req.query("duration_ms") ?? "0");
  const key = `${CLIP_PREFIX}${pointId}-${Date.now()}.webm`;
  await c.env.ASSETS.put(key, body, {
    httpMetadata: { contentType: c.req.header("content-type") ?? "video/webm" },
  });
  await updateReactPoint(c.env.DB, pointId, {
    reaction_r2_key: key,
    reaction_duration_ms:
      Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : null,
  });
  return c.json({ ok: true, key });
});

app.get("/clip/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  if (!key.startsWith(CLIP_PREFIX)) return new Response("not found", { status: 404 });
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "video/webm",
      "cache-control": "public, max-age=3600",
    },
  });
});

export default app;

// ---------------------------------------------------------------------------
// Background pipeline: transcribe (timestamped) -> segment into points.
// Runs in waitUntil since both steps are far too slow for one synchronous
// request (a real WhisperX pass on a 10-minute video, then N chunked
// writer+judge LLM calls) — same discipline as this Worker's render jobs
// and the publication's own settle-pipeline background work.
// ---------------------------------------------------------------------------
async function runTranscribeAndSegment(
  env: Env,
  projectId: string,
  sourceUrl: string,
): Promise<void> {
  try {
    const result = await transcribeVideo(env.RENDER_CONTAINER, projectId, sourceUrl, {
      timestamped: true,
    });
    if (!result.ok || !result.segments?.length) {
      await updateReactProject(env.DB, projectId, {
        status: "failed",
        error: result.error ?? "transcription produced no timestamped segments",
      });
      return;
    }
    await updateReactProject(env.DB, projectId, {
      status: "scripting",
      transcript_json: JSON.stringify(result.segments),
      source_duration_s: result.duration_s ?? null,
    });

    const report = await segmentTranscriptIntoPoints(env, projectId, result.segments);
    if (report.points_created === 0) {
      await updateReactProject(env.DB, projectId, {
        status: "failed",
        error:
          report.errors.length > 0
            ? `segmentation produced no points: ${report.errors.join("; ")}`
            : "segmentation produced no points",
      });
      return;
    }
    await updateReactProject(env.DB, projectId, { status: "ready_for_scripting" });
  } catch (err) {
    await updateReactProject(env.DB, projectId, {
      status: "failed",
      error: (err as Error).message,
    }).catch(() => {});
  }
}
