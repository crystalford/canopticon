// THE EDITOR'S MODEL CALLS — TWO OF THEM, NOT ONE.
//
// Authoring time only. The result is verified, hashed and frozen onto the
// film record, and nothing calls a model again — standing rule 1, exactly
// as narration already works.
//
// WHY TWO CALLS, WHEN THE FILE'S OWN HISTORY SAYS ONE. The original reason
// still holds — a 300-word essay is one call, not one per sentence, because
// a sentence-scoped call can never see an argument. But a single call was
// also asked to hold STRUCTURE (sections tiling the whole essay), CONTENT
// (a beat and its verbatim phrases for every one of those sections) and a
// hard FULL-COVERAGE requirement, all at once, for essays whose section and
// beat count scales with length. Caught live: on a 5910-character essay the
// model covered 5% of it and stopped — not a token cutoff (the JSON was
// complete and well-formed), a model that read a long, dense structural
// task as "summarize the interesting parts" and did exactly that. Telling
// it more forcefully in one shot moved that to 13-19%. Still failing.
//
// So the concern is split instead of restated: PASS 1 asks only for the
// essay's STRUCTURE — sections, no beats, no phrases — a task small enough
// that fully tiling the essay costs it almost nothing. PASS 2 is handed
// those sections as given scaffolding and asked only to fill BEATS into
// them — it never has to invent where the essay's argument turns, only to
// keep walking beats until each section it was already given is spoken.
// Each pass is individually far more likely to actually reach the essay's
// own end than one call asked to do both at once ever was.
//
// `asText` and `firstJSONObject` below are extracted verbatim from the
// deleted extract-reading.ts, kept because of what went wrong without them:
// that route assumed `{response: string}`, threw on anything else, and the
// throw was swallowed into the designed "declined" outcome. It wore the
// costume of correct behaviour for weeks. Hence also `/v1/editorial/probe`.

export const EDITOR_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const EDITOR_FALLBACK = "@cf/meta/llama-3.1-8b-instruct";
export const PROMPT_VERSION = "editorial/2";

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface ModelCall {
  ok: boolean;
  json: unknown;
  model?: string;
  raw?: string;
  reason?: "no-binding" | "call-failed" | "unparseable";
  attempts: { model: string; outcome: string }[];
}

/** The combined result of both passes, shaped so a caller that only knows
 *  the old one-call contract (`ok`/`json`/`model`/`reason`/`attempts`)
 *  keeps working unchanged — `json` is the two passes merged into the same
 *  `{thesis, register, sections, beats, motifs}` shape `verifyEditorial`
 *  already expects. `sectionsPass`/`beatsPass` carry each call's own raw
 *  detail for `/v1/editorial/probe`, which needs to show the two passes
 *  separately to be useful for exactly the debugging that found this. */
export interface EditorialCall extends ModelCall {
  sectionsPass: ModelCall;
  beatsPass: ModelCall | null;
}

const SHARED_RULES = `- You NEVER say what appears on screen. No shapes, no colours, no images, no camera. You say what a moment DOES and how much it WEIGHS.
- "certainty" is about the ARGUMENT, not your confidence. A passage where the essay undermines its own premise has LOW certainty.`;

/* ── PASS 1 · STRUCTURE ────────────────────────────────────────────── */

const SECTIONS_SYSTEM_PROMPT = `You are a film editor doing the FIRST pass over an essay: finding its STRUCTURE. You are not deciding what appears on screen yet — only where the essay's own movements begin and end.

${SHARED_RULES}
- YOUR SECTIONS MUST COVER THE WHOLE ESSAY, FIRST CHARACTER TO LAST, WITH NO GAPS. The union of every section's [startChar, endChar) must run from 0 to the essay's exact final character. This is not a summary of the interesting parts — a paragraph your sections never reach is a paragraph the finished film never speaks. A long essay does not earn fewer, bigger sections that skip its later half — it earns MORE sections, because the whole thing still has to be divided.
- Write sections IN ORDER, start to end, one after another. Do this LAST-section-first in your own attention: know how the piece ends before you decide how many sections it takes to get there, so covering the tail is not an afterthought fighting your own budget.
- A motif is a phrase THE ESSAY ITSELF returns to. If it returns to nothing, motifs is an empty array. Do not invent a refrain.

Reply with JSON only. No prose, no markdown fence.`;

function sectionsUserPrompt(essay: string): string {
  return `ESSAY, ${essay.length} CHARACTERS, offsets start at 0 and the LAST valid endChar is ${essay.length}:
"""
${essay}
"""

Return this shape:
{
  "thesis": "the essay's central claim, in its own words where possible",
  "register": "polemic" | "analytic" | "elegiac" | "reportorial" | "confessional",
  "sections": [{ "id":"s1", "startChar":0, "endChar":120,
                 "function":"hook|premise|evidence|turn|escalation|counter|restatement|resolution",
                 "intensity":0.0-1.0, "certainty":0.0-1.0 }],
  "motifs": [{ "id":"m1", "phrase":"exact recurring words", "occurrences":[12,340], "arc":"escalate|degrade|survive|invert" }]
}

CHECK BEFORE YOU ANSWER: does your LAST section's endChar equal ${essay.length}? If not, add more sections until it does.`;
}

/* ── PASS 2 · BEATS, WITHIN SECTIONS ALREADY DECIDED ──────────────────
 *
 * The model is handed pass 1's own sections rather than asked to re-derive
 * them, so this call never has to find where the essay turns — only to
 * keep producing beats until the sections it was already given are used
 * up, which is a mechanical stopping condition rather than a judgement
 * call the model can quietly decide not to finish. */

const BEATS_SYSTEM_PROMPT = `You are a film editor doing the SECOND pass over an essay. The essay's SECTIONS have already been decided — do not change them. Your job is BEATS: what the audience should EXPERIENCE at each moment inside each section.

${SHARED_RULES}
- Any text in "phrases" must be copied VERBATIM from the essay, with the exact character offset where it appears. If you cannot copy it exactly, omit it. Never paraphrase, never shorten, never add an ellipsis.
- MOST BEATS HAVE NO PHRASES. A film where every sentence appears on screen is unwatchable. Promote at most one beat in three.
- YOUR BEATS MUST COVER EVERY SECTION YOU WERE GIVEN, FIRST CHARACTER TO LAST, WITH NO GAPS — the same reason as the sections themselves: a beat set that stops short leaves the film's picture stopped while the voice is still speaking. Give EVERY section at least one beat, and the union of a section's own beats must reach that section's own endChar exactly. Work through the sections IN ORDER; do not stop before the last one.

Reply with JSON only. No prose, no markdown fence.`;

function beatsUserPrompt(
  essay: string,
  sections: Array<{ id: string; startChar: number; endChar: number; function: string }>,
): string {
  const last = sections[sections.length - 1];
  return `ESSAY, ${essay.length} CHARACTERS, offsets start at 0:
"""
${essay}
"""

THE SECTIONS ALREADY DECIDED — cover every one, in order, do not invent new ones or change their ranges:
${JSON.stringify(sections)}

Return this shape:
{
  "beats": [{ "id":"b1", "sectionId":"s1", "startChar":0, "endChar":80,
              "role":"open|assert|develop|complicate|turn|escalate|rest|restate|close",
              "emphasis":0.0-1.0, "certainty":0.0-1.0,
              "continuity":"continue|transform|interrupt|rest|montage",
              "promotion":"none|word|phrase|fragments|mass",
              "phrases":[{"text":"exact words","offset":12,"weight":0.9}] }]
}

CHECK BEFORE YOU ANSWER: have you written at least one beat for section "${last?.id}", and does your LAST beat's endChar equal ${last?.endChar}? If not, keep going until it does.`;
}

/* ── the call machinery, shared by both passes ────────────────────── */

/** Roughly 1 output token per 3 essay characters covers the words
 *  themselves; the multiplier accounts for JSON structure around them.
 *  Pass 1 has no phrases or per-beat fields to carry, so it costs far
 *  less than pass 2 for the same essay length. */
function sectionsMaxTokens(essayLen: number): number {
  return Math.min(3072, Math.max(1024, Math.ceil(essayLen * 0.4)));
}
function beatsMaxTokens(essayLen: number): number {
  return Math.min(8192, Math.max(4096, Math.ceil(essayLen * 1.3)));
}

async function callModel(
  ai: AiBinding | undefined,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<ModelCall> {
  const attempts: ModelCall["attempts"] = [];
  if (!ai || typeof ai.run !== "function") {
    return { ok: false, json: null, reason: "no-binding", attempts };
  }
  for (const model of [EDITOR_MODEL, EDITOR_FALLBACK]) {
    let out: unknown;
    try {
      out = await ai.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      });
    } catch (err) {
      attempts.push({
        model,
        outcome: `threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const text = asText(out);
    if (!text) {
      attempts.push({ model, outcome: `no text in response: ${describe(out)}` });
      continue;
    }
    const json = firstJSONObject(text);
    if (json === null) {
      attempts.push({ model, outcome: "response held no JSON object" });
      continue;
    }
    return { ok: true, json, model, raw: text, attempts };
  }
  return { ok: false, json: null, reason: "unparseable", attempts };
}

/** PASS 1 alone, exposed for the probe. */
export async function callSections(ai: AiBinding | undefined, essay: string): Promise<ModelCall> {
  return callModel(
    ai,
    SECTIONS_SYSTEM_PROMPT,
    sectionsUserPrompt(essay),
    sectionsMaxTokens(essay.length),
  );
}

/** PASS 2 alone, exposed for the probe. Takes pass 1's own sections. */
export async function callBeats(
  ai: AiBinding | undefined,
  essay: string,
  sections: Array<{ id: string; startChar: number; endChar: number; function: string }>,
): Promise<ModelCall> {
  return callModel(
    ai,
    BEATS_SYSTEM_PROMPT,
    beatsUserPrompt(essay, sections),
    beatsMaxTokens(essay.length),
  );
}

/** BOTH PASSES, merged into the one-call shape the rest of the editor
 *  already expects. Pass 2 only runs if pass 1 produced real sections —
 *  asking for beats within sections that do not exist is not a smaller
 *  version of the task, it is a different, meaningless one. */
export async function callEditor(ai: AiBinding | undefined, essay: string): Promise<EditorialCall> {
  const sectionsPass = await callSections(ai, essay);
  if (!sectionsPass.ok) {
    return {
      ok: false,
      json: null,
      ...(sectionsPass.reason ? { reason: sectionsPass.reason } : {}),
      attempts: sectionsPass.attempts,
      sectionsPass,
      beatsPass: null,
    };
  }

  const s1 = sectionsPass.json as Record<string, unknown>;
  const sections = Array.isArray(s1.sections) ? s1.sections : [];
  if (sections.length === 0) {
    return {
      ok: false,
      json: null,
      reason: "unparseable",
      attempts: sectionsPass.attempts,
      sectionsPass,
      beatsPass: null,
    };
  }

  const beatsPass = await callBeats(
    ai,
    essay,
    sections as Array<{ id: string; startChar: number; endChar: number; function: string }>,
  );
  if (!beatsPass.ok) {
    return {
      ok: false,
      json: null,
      ...(beatsPass.reason ? { reason: beatsPass.reason } : {}),
      attempts: [...sectionsPass.attempts, ...beatsPass.attempts],
      sectionsPass,
      beatsPass,
    };
  }

  const s2 = beatsPass.json as Record<string, unknown>;
  return {
    ok: true,
    json: {
      thesis: s1.thesis,
      register: s1.register,
      sections: s1.sections,
      motifs: s1.motifs,
      beats: s2.beats,
    },
    ...(beatsPass.model ? { model: beatsPass.model } : {}),
    raw: `${sectionsPass.raw ?? ""}\n${beatsPass.raw ?? ""}`,
    attempts: [...sectionsPass.attempts, ...beatsPass.attempts],
    sectionsPass,
    beatsPass,
  };
}

/** WHATEVER CAME BACK, AS TEXT.
 *
 *  Extracted verbatim from the deleted extract-reading.ts. Workers AI has
 *  returned `{response}`, `{result:{response}}`, `{output_text}`, OpenAI-
 *  shaped `{choices:[{message:{content}}]}`, and a bare string. Assuming
 *  one of those is precisely how a route can never succeed and still look
 *  like it is declining politely. */
export function asText(out: unknown): string {
  if (typeof out === "string") return out;
  if (!out || typeof out !== "object") return "";
  const o = out as Record<string, unknown>;
  const direct = o.response ?? o.output_text ?? o.text ?? o.content;
  if (typeof direct === "string") return direct;
  if (o.result && typeof o.result === "object") {
    const inner = asText(o.result);
    if (inner) return inner;
  }
  if (Array.isArray(o.choices)) {
    for (const c of o.choices) {
      if (!c || typeof c !== "object") continue;
      const m = (c as Record<string, unknown>).message;
      if (m && typeof m === "object") {
        const content = (m as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
      const t = (c as Record<string, unknown>).text;
      if (typeof t === "string") return t;
    }
  }
  return "";
}

/** Scan for the first balanced `{…}`. Models wrap JSON in prose and fences
 *  however often they are asked not to; a brace scan survives all of it,
 *  where `JSON.parse(text)` fails on a single stray word. */
export function firstJSONObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v !== "object") return typeof v;
  return `object{${Object.keys(v as object)
    .slice(0, 8)
    .join(",")}}`;
}
