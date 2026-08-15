// THE EDITOR'S ONE MODEL CALL.
//
// Authoring time only. The result is verified, hashed and frozen onto the
// film record, and nothing calls a model again — standing rule 1, exactly
// as narration already works.
//
// ONE CALL FOR THE WHOLE ESSAY, not one per sentence. The deleted
// extract-reading.ts called per sentence, bounded to twelve, which is the
// wrong unit for an EDITOR: it could see a sentence but never an argument.
// A 300-word essay is ~400 tokens; there is no reason to fragment it.
//
// `asText` below is extracted verbatim from that file, and it exists
// because the old route had NEVER ONCE SUCCEEDED — it assumed
// `{response: string}`, threw on anything else, and the throw was
// swallowed into the designed "declined" outcome. It wore the costume of
// correct behaviour for weeks. Hence also `/v1/editorial/probe`.

export const EDITOR_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const EDITOR_FALLBACK = "@cf/meta/llama-3.1-8b-instruct";
export const PROMPT_VERSION = "editorial/1";

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

export const SYSTEM_PROMPT = `You are a film editor reading an essay. You decide what the audience should EXPERIENCE at each moment.

ABSOLUTE RULES:
- You NEVER say what appears on screen. No shapes, no colours, no images, no camera. You say what a moment DOES and how much it WEIGHS.
- Any text in "phrases" must be copied VERBATIM from the essay, with the exact character offset where it appears. If you cannot copy it exactly, omit it. Never paraphrase, never shorten, never add an ellipsis.
- MOST BEATS HAVE NO PHRASES. A film where every sentence appears on screen is unwatchable. Promote at most one beat in three.
- "certainty" is about the ARGUMENT, not your confidence. A passage where the essay undermines its own premise has LOW certainty.
- A motif is a phrase THE ESSAY ITSELF returns to. If it returns to nothing, motifs is an empty array. Do not invent a refrain.

Reply with JSON only. No prose, no markdown fence.`;

export function userPrompt(essay: string): string {
  return `ESSAY (character offsets start at 0):
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
  "beats": [{ "id":"b1", "sectionId":"s1", "startChar":0, "endChar":80,
              "role":"open|assert|develop|complicate|turn|escalate|rest|restate|close",
              "emphasis":0.0-1.0, "certainty":0.0-1.0,
              "continuity":"continue|transform|interrupt|rest|montage",
              "promotion":"none|word|phrase|fragments|mass",
              "phrases":[{"text":"exact words","offset":12,"weight":0.9}] }],
  "motifs": [{ "id":"m1", "phrase":"exact recurring words", "occurrences":[12,340], "arc":"escalate|degrade|survive|invert" }]
}`;
}

export async function callEditor(ai: AiBinding | undefined, essay: string): Promise<ModelCall> {
  const attempts: ModelCall["attempts"] = [];
  if (!ai || typeof ai.run !== "function") {
    return { ok: false, json: null, reason: "no-binding", attempts };
  }
  for (const model of [EDITOR_MODEL, EDITOR_FALLBACK]) {
    let out: unknown;
    try {
      out = await ai.run(model, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(essay) },
        ],
        max_tokens: 4096,
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
