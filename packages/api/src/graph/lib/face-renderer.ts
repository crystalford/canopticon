// Face renderer — pre-render the LLM-seasoned faces of a signed reading
// (spec v2.6 Part 8).
//
// When the operator clicks Sign & Publish on a reading, the system
// queues the LLM-seasoned faces as background jobs (script, chapter).
// They appear as tabs on the signed reading view; by the time the
// operator wants to share something, it's already rendered.
//
// The other two faces (thread, card) are TEMPLATE + QUERY — pure
// renderings that live in packages/api/src/public/render/faces/. No LLM,
// no persistence, no queue.
//
// SELECTION, not regeneration. The signed reading carries all truth
// claims. The faces select / reformat — they never introduce a new
// assertion. Constraint enforced by prompt + by reusing only quote_ids
// that are already verified on the reading.

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";

export type FaceKind = "thread" | "card" | "carousel" | "script" | "chapter";

// v2.6 Part 8: faces are RENDERINGS, not regenerations. Thread + card +
// carousel are template + query and render at view time (no LLM, <100ms)
// — see packages/api/src/public/render/faces/. Only script + chapter
// genuinely need argumentative sequencing; those still get the writer
// LLM on sign and persist to page_faces.
const LLM_FACES = ["script", "chapter"] as const;
type LlmFaceKind = (typeof LLM_FACES)[number];

function isLlmFace(kind: FaceKind): kind is LlmFaceKind {
  return (LLM_FACES as readonly FaceKind[]).includes(kind);
}

interface PageRow {
  id: string;
  slug: string;
  thesis: string | null;
  body_md: string | null;
  confidence: string | null;
}

interface FaceJobReport {
  pageId: string;
  queued: FaceKind[];
  rendered: FaceKind[];
  failed: Array<{ kind: FaceKind; error: string }>;
}

/** Queue all four faces for a freshly signed reading and resolve them in
 *  parallel. Best-effort: a single face failure doesn't sink the others.
 *  Called from the sign handler inside c.executionCtx.waitUntil so the
 *  sign POST returns immediately and the renders complete in the
 *  background. */
export async function generateAllFaces(
  env: Env,
  userId: string,
  pageId: string,
): Promise<FaceJobReport> {
  const report: FaceJobReport = { pageId, queued: [], rendered: [], failed: [] };
  const page = await loadPage(env, userId, pageId);
  if (!page || !page.body_md || !page.thesis) {
    // Nothing to render — page has no signed body yet.
    return report;
  }

  // Mark every face as queued up-front. Upserts so re-signs replace old.
  for (const kind of LLM_FACES) {
    await upsertFaceStatus(env, userId, pageId, kind, "queued").catch(() => {});
    report.queued.push(kind);
  }

  // Render in parallel; each face is independent. Errors are captured
  // per-face — one timeout doesn't kill the others.
  const results = await Promise.allSettled(
    LLM_FACES.map((kind) => renderFace(env, userId, pageId, kind, page)),
  );
  results.forEach((r, i) => {
    const kind = LLM_FACES[i] as FaceKind;
    if (r.status === "fulfilled") report.rendered.push(kind);
    else report.failed.push({ kind, error: (r.reason as Error)?.message ?? "unknown" });
  });
  return report;
}

/** Re-render a single face on demand. Used by the operator's "rerender"
 *  affordance and by retries. No-op for template+query faces (thread,
 *  card, carousel) — those render live at view time, there's nothing to
 *  pre-render. */
export async function generateSingleFace(
  env: Env,
  userId: string,
  pageId: string,
  kind: FaceKind,
): Promise<void> {
  if (!isLlmFace(kind)) return;
  const page = await loadPage(env, userId, pageId);
  if (!page || !page.body_md || !page.thesis) return;
  await renderFace(env, userId, pageId, kind, page);
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

async function loadPage(env: Env, userId: string, pageId: string): Promise<PageRow | null> {
  return one<PageRow>(
    env.DB,
    `SELECT id, slug, thesis, body_md, confidence
       FROM pages WHERE id = ? AND user_id = ?`,
    [pageId, userId],
  );
}

async function renderFace(
  env: Env,
  userId: string,
  pageId: string,
  kind: LlmFaceKind,
  page: PageRow,
): Promise<void> {
  await upsertFaceStatus(env, userId, pageId, kind, "rendering");
  const prompt = PROMPTS[kind];
  try {
    const out = await callRole(env, "writer", {
      userId,
      system: prompt.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `THESIS: ${page.thesis}\n\nSIGNED READING:\n${page.body_md}\n\n${prompt.userTail}`,
            },
          ],
        },
      ],
      max_tokens: prompt.maxTokens,
      idempotency_key: `face:${pageId}:${kind}`,
    });
    const bodyMd = (out.text ?? "").trim();
    if (!bodyMd) throw new Error("empty response");
    const { renderMarkdown } = await import("../../cms/lib/render-post");
    const bodyHtml = renderMarkdown(bodyMd);
    await run(
      env.DB,
      `UPDATE page_faces
          SET body_md = ?, body_html = ?, status = 'ready', generate_model = ?,
              error = NULL, updated_at = ?
        WHERE page_id = ? AND kind = ?`,
      [bodyMd, bodyHtml, modelForRole("writer").model, new Date().toISOString(), pageId, kind],
    );
  } catch (err) {
    await run(
      env.DB,
      `UPDATE page_faces SET status = 'failed', error = ?, updated_at = ?
        WHERE page_id = ? AND kind = ?`,
      [(err as Error).message ?? "unknown", new Date().toISOString(), pageId, kind],
    ).catch(() => {});
    throw err;
  }
}

async function upsertFaceStatus(
  env: Env,
  userId: string,
  pageId: string,
  kind: FaceKind,
  status: "queued" | "rendering" | "ready" | "failed",
): Promise<void> {
  // Try update first; insert on miss. SQLite has UPSERT but the lib/d1
  // helpers are simpler to compose here.
  const updated = await env.DB.prepare(
    `UPDATE page_faces SET status = ?, updated_at = ?
       WHERE page_id = ? AND kind = ?`,
  )
    .bind(status, new Date().toISOString(), pageId, kind)
    .run();
  if ((updated.meta.changes ?? 0) > 0) return;
  await insertOne(env.DB, "page_faces", {
    page_id: pageId,
    user_id: userId,
    kind,
    status,
  }).catch(() => {});
}

interface FacePrompt {
  system: string;
  userTail: string;
  maxTokens: number;
}

// Per-face writer-LLM prompts. Only LLM_FACES (script + chapter) are
// keyed here — thread + card + carousel are pure template+query renderers
// living in packages/api/src/public/render/faces/, no LLM. Selection, not
// regeneration: the reading carries the truth; the face re-arranges.
const PROMPTS: Record<LlmFaceKind, FacePrompt> = {
  script: {
    system: `You convert a signed reading into a LOCKED REASONING SKELETON for a 3–4 minute video script. STRUCTURE, NOT VOICE — the operator reads the structure aloud in their own register.

OUTPUT FORMAT:
**BEAT 1 — the thing nobody says**
- 2–3 bullets framing the thesis as the unstated claim

**BEAT 2 — the instances, dated**
- 2–3 bullets naming specific dated facts the reading rests on
- each bullet ends with [source]

**BEAT 3 — the structure**
- 2–3 bullets showing the pattern / mechanism / connection

**BEAT 4 — the implication**
- 1–2 bullets landing what it means

HARD RULES:
- Bullet points only — never write narration. The structure is the product.
- Facts must already appear in the reading body.
- Reference receipts as [source].
- Total length: under 250 words.`,
    userTail: "Produce the reasoning skeleton now.",
    maxTokens: 900,
  },
  chapter: {
    system: `You expand a signed reading into a CHAPTER OUTLINE for long-form treatment. Sections + bullets + research direction notes.

OUTPUT FORMAT:
A numbered list of 5–8 sections. Each section is:
**N. Section heading**
- 2–4 bullets summarising what the section covers
- "[needs deeper sourcing]" tag where the reading currently leans on a single source and a long-form treatment would want more

HARD RULES:
- Don't introduce new facts — outline the reading's existing structure.
- Tag every section that depends on weak evidence honestly.
- Sections in argument order (thesis → instances → mechanism → implication).`,
    userTail: "Produce the chapter outline now.",
    maxTokens: 1200,
  },
};
