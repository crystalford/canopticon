// Juxtaposition meme prototype (2026-08-11) — operator-requested test of a
// formula validated live, conversationally, against real corpus material:
// a two-line A/B juxtaposition (a short attributed quote against a bare,
// flatly-stated fact) with NO connecting/explanatory clause between them —
// the reader's own inference does the work. Not a new fact-finding
// capability: this reuses self_contradictions.ts's already judge-verified
// contradiction pairs as its only input. Two new LLM steps on top of an
// already-verified row: compress into that copy format, then translate the
// copy into a visual prompt (never baked-in text — diffusion models can't
// render text reliably, so the image carries the symbolic scene and the
// copy stays as real HTML text, same as memetic.ts's existing cards).
//
// Admin-triggered only. Nothing here publishes anywhere — it produces one
// row in meme_drafts for the operator to look at.

import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";
import { callRole } from "../../llm/router";

// Cloudflare-catalog, first-party text-to-image model (not a third-party
// API) — see the router.ts convention of naming *why* a model was picked.
// FLUX.1 [schnell] verified live against Cloudflare's own pricing table +
// @cloudflare/workers-types 2026-08-11: cheapest of the current catalogue
// by ~10-20x, fastest (1-8 step distilled model), strong prompt adherence
// for illustration/poster styles even at low step counts. Returns
// {image: base64 JPEG} — not a raw stream, not PNG (checked against the
// other live candidates: lucid-origin/phoenix-1.0 are ~10x costlier and
// slower for a same-shape image; the legacy SDXL family is absent from the
// current pricing table entirely). No model in the catalogue renders
// legible meme text reliably — the real copy stays real HTML text, same as
// every other memetic.ts card; this only generates the background scene.
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

interface ContradictionRow {
  id: string;
  person_label: string;
  tension_summary: string;
  quote_a_text: string;
  quote_b_text: string;
}

export interface MemeDraftResult {
  ok: boolean;
  meme_draft_id?: string;
  quote_line?: string;
  attribution?: string | null;
  statement_line?: string;
  image_prompt?: string;
  image_r2_key?: string;
  error?: string;
}

export async function draftMeme(
  env: Env,
  userId: string,
  contradictionId?: string,
): Promise<MemeDraftResult> {
  const row = contradictionId
    ? await one<ContradictionRow>(
        env.DB,
        `SELECT id, person_label, tension_summary, quote_a_text, quote_b_text
           FROM self_contradictions WHERE id = ? AND user_id = ? AND judge_pass = 1`,
        [contradictionId, userId],
      )
    : await pickUndraftedContradiction(env, userId);
  if (!row) return { ok: false, error: "no verified, undrafted self-contradiction on file" };

  const copy = await draftMemeCopy(env, userId, row);
  if (!copy) return { ok: false, error: "copy drafting failed" };

  const imagePrompt = await draftImagePrompt(env, userId, copy, row.tension_summary);
  if (!imagePrompt) return { ok: false, error: "image-prompt drafting failed" };

  const r2Key = await generateMemeImage(env, imagePrompt).catch((err: Error) => {
    console.error("meme image generation failed", err.message);
    return null;
  });

  const id = await insertOne(env.DB, "meme_drafts", {
    user_id: userId,
    contradiction_id: row.id,
    quote_line: copy.quoteLine,
    attribution: copy.attribution,
    statement_line: copy.statementLine,
    copy_model: "writer",
    image_prompt: imagePrompt,
    image_model: r2Key ? IMAGE_MODEL : null,
    image_r2_key: r2Key,
  });

  return {
    ok: true,
    meme_draft_id: id,
    quote_line: copy.quoteLine,
    attribution: copy.attribution,
    statement_line: copy.statementLine,
    image_prompt: imagePrompt,
    ...(r2Key ? { image_r2_key: r2Key } : {}),
  };
}

async function pickUndraftedContradiction(
  env: Env,
  userId: string,
): Promise<ContradictionRow | null> {
  const rows = await all<ContradictionRow>(
    env.DB,
    `SELECT sc.id, sc.person_label, sc.tension_summary, sc.quote_a_text, sc.quote_b_text
       FROM self_contradictions sc
       LEFT JOIN meme_drafts md ON md.contradiction_id = sc.id
      WHERE sc.user_id = ? AND sc.judge_pass = 1 AND md.id IS NULL
      ORDER BY sc.created_at DESC
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Step 1: compress the verified pair into the validated A/B copy format.
// ---------------------------------------------------------------------------
interface MemeCopy {
  quoteLine: string;
  attribution: string | null;
  statementLine: string;
}

async function draftMemeCopy(
  env: Env,
  userId: string,
  row: ContradictionRow,
): Promise<MemeCopy | null> {
  const out = await callRole(env, "writer", {
    userId,
    system: `You compress an already-verified self-contradiction into a two-line juxtaposition meme. Follow this format exactly — it was validated by testing several versions against a real reader and converging on what actually lands:

LINE 1 — a short, sharp quote or claim, trimmed to its sharpest phrase (real words from the material, don't invent), with attribution.
LINE 2 — a bare, flatly-stated fact or number that contradicts it — NOT a sentence explaining the connection. Never use connecting or explanatory words: no "but," "yet," "despite," "now counted as," "reclassified as," "which," "because," "in reality." State it as its own plain declarative fact, the same flat confident register as line 1 — a headline, not a caption.

No editorializing. No verdict on who's right. No explaining WHY it's ironic — the gap between the two lines has to do that work by itself, the way a stark meme's punchline works before the reader consciously parses it. Keep both lines short, ideally under 12 words each.

Return ONLY JSON: {"quote_line": "...", "attribution": "...", "statement_line": "..."}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Person: ${row.person_label}\n\nQuote A: "${row.quote_a_text}"\n\nQuote B: "${row.quote_b_text}"\n\nThe tension: ${row.tension_summary}`,
          },
        ],
      },
    ],
    max_tokens: 400,
    response_schema: {
      type: "object",
      properties: {
        quote_line: { type: "string" },
        attribution: { type: "string" },
        statement_line: { type: "string" },
      },
      required: ["quote_line", "statement_line"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    quote_line?: string;
    attribution?: string;
    statement_line?: string;
  } | null;
  if (!parsed?.quote_line || !parsed.statement_line) return null;
  return {
    quoteLine: parsed.quote_line.trim(),
    attribution: parsed.attribution?.trim() || row.person_label,
    statementLine: parsed.statement_line.trim(),
  };
}

// ---------------------------------------------------------------------------
// Step 2: translate the copy into a visual prompt — a symbolic scene, never
// literal text (diffusion models render text unreliably; the real words
// stay as real HTML text laid over/beside the image, same as every other
// memetic.ts card).
// ---------------------------------------------------------------------------
async function draftImagePrompt(
  env: Env,
  userId: string,
  copy: MemeCopy,
  tensionSummary: string,
): Promise<string | null> {
  const out = await callRole(env, "writer", {
    userId,
    system: `You write ONE visual prompt for a text-to-image model, illustrating the SYMBOLIC SCENE behind a juxtaposition meme. The model cannot render legible text reliably — describe concrete objects and imagery that embody both halves of the contrast in a single scene, never words, letters, signage, or captions.

Style: muted editorial illustration, high contrast, single clear composition, no text of any kind in the frame. One or two sentences, plain description only.

Return ONLY JSON: {"image_prompt": "..."}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Line 1: "${copy.quoteLine}"\nLine 2: "${copy.statementLine}"\nWhat's actually in tension: ${tensionSummary}`,
          },
        ],
      },
    ],
    max_tokens: 250,
    response_schema: {
      type: "object",
      properties: { image_prompt: { type: "string" } },
      required: ["image_prompt"],
    },
  });
  const parsed = (out.structured ?? safeParse(out.text)) as { image_prompt?: string } | null;
  return parsed?.image_prompt?.trim() || null;
}

// ---------------------------------------------------------------------------
// Step 3: generate the image via Workers AI, store to R2.
// ---------------------------------------------------------------------------
async function generateMemeImage(env: Env, prompt: string): Promise<string | null> {
  // flux-1-schnell's response shape: { image: string } base64 JPEG.
  const out = (await env.AI.run(
    IMAGE_MODEL as never,
    {
      prompt,
      steps: 4,
      seed: Math.floor(Math.random() * 1e9),
    } as never,
  )) as { image?: string };
  if (!out?.image) return null;

  const binary = atob(out.image);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const key = `memes/${crypto.randomUUID()}.jpg`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return key;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
