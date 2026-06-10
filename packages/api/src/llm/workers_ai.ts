// Workers AI adapter — calls env.AI.run() with provider-neutral input
// and normalizes the response shape.
//
// Models in scope:
//   - @cf/meta/llama-3.3-70b-instruct-fp8-fast  (chat orchestrator + extraction)
//   - @cf/meta/llama-3.1-8b-instruct-fp8-fast   (cheap routing, citation, predictor parse)
//   - @cf/meta/llama-4-scout-17b-16e-instruct   (multimodal, 131k ctx; PDF/image extract)
//   - @cf/baai/bge-base-en-v1.5                 (768-dim embeddings)
//
// Kept partner-shape detection (Kimi/DeepSeek/OpenAI-compat) so we can
// route to them via AI Gateway in future without rewriting the adapter.

import { TIMEOUTS, withTimeout } from "../lib/timeout";
import type {
  LlmCallInput,
  LlmCallOutput,
  LlmContent,
  LlmMessage,
  LlmStopReason,
  LlmStreamChunk,
} from "./types";

interface WorkersAiChatResponse {
  // Llama-style normalized shape that Workers AI returns for most catalog
  // models. `response` is usually a string, but when the model emits JSON some
  // models (e.g. Llama 4 Scout) return it already PARSED as an object.
  response?: string | Record<string, unknown>;
  tool_calls?: Array<{
    id?: string;
    name: string;
    arguments?: Record<string, unknown> | string;
  }>;
  // OpenAI-compatible shape that partner models (Kimi, DeepSeek, etc.) return.
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

function isOpenAiShapeModel(model: string): boolean {
  // Partner models (Moonshot Kimi, DeepSeek, OpenAI-compat) speak strict
  // OpenAI Chat Completions and reject unknown fields like repetition_penalty.
  return /^@cf\/(moonshotai|deepseek-ai|openai)/i.test(model);
}

function buildBody(input: LlmCallInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages: toChatMessages(input),
    max_tokens: input.max_tokens,
    temperature: input.temperature ?? 0,
  };
  if (input.top_p !== undefined) body.top_p = input.top_p;
  // repetition_penalty is a Llama-family parameter; partner models on the
  // OpenAI-compatible path will 8004 on unknown fields.
  if (input.repetition_penalty !== undefined && !isOpenAiShapeModel(input.model)) {
    body.repetition_penalty = input.repetition_penalty;
  }
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }
  if (input.response_schema) {
    body.response_format = { type: "json_schema", json_schema: input.response_schema };
  }
  // reasoning_effort is the gpt-oss / Responses-API dial (canonical-spec
  // v2.4 Part 16 rule #1). Other models ignore unknown fields, so this is
  // safe to pass through unconditionally — but only do so if the model is
  // gpt-oss to keep the request body clean and avoid partner-model 8004s.
  if (input.reasoning_effort && /^@cf\/openai\/gpt-oss/i.test(input.model)) {
    body.reasoning_effort = input.reasoning_effort;
  }
  return body;
}

export async function callWorkersAi(ai: Ai, input: LlmCallInput): Promise<LlmCallOutput> {
  // Bounded round-trip: a slow/sunset model that never returns would otherwise
  // hang past the Worker wall-clock and corrupt the surrounding D1 transaction
  // (see PR fix-cost-ledger-idempotency for the failure mode).
  const res = (await withTimeout(
    ai.run(input.model as never, buildBody(input) as never) as Promise<unknown>,
    TIMEOUTS.LLM_CALL_MS,
    `workers_ai.run[${input.model}]`,
  )) as WorkersAiChatResponse;

  // Llama-style returns {response, tool_calls}. Partner models (Kimi, DeepSeek)
  // return OpenAI shape {choices: [{message: {content, tool_calls}}]}.
  // `response` may be a STRING or — when the model emits JSON — an already
  // PARSED OBJECT (Llama 4 Scout does this). Capture the object so callers
  // that want structured output get it directly instead of an empty string.
  const openAiMsg = res.choices?.[0]?.message;
  let objectResponse: Record<string, unknown> | null = null;
  let rawText: string;
  if (typeof res.response === "string" && res.response.length > 0) {
    rawText = res.response;
  } else if (res.response && typeof res.response === "object") {
    objectResponse = res.response as Record<string, unknown>;
    rawText = JSON.stringify(res.response);
  } else {
    rawText = openAiMsg?.content ?? "";
  }
  const text = stripFiller(rawText);

  const rawToolCalls = res.tool_calls ?? [];
  const openAiToolCalls = openAiMsg?.tool_calls ?? [];
  const tool_uses =
    rawToolCalls.length > 0
      ? rawToolCalls.map((tc, i) => ({
          id: tc.id ?? `call_${i}_${crypto.randomUUID().slice(0, 8)}`,
          name: tc.name,
          input: typeof tc.arguments === "string" ? safeParse(tc.arguments) : (tc.arguments ?? {}),
        }))
      : openAiToolCalls
          .filter((tc) => tc.function?.name)
          .map((tc, i) => ({
            id: tc.id ?? `call_${i}_${crypto.randomUUID().slice(0, 8)}`,
            name: tc.function?.name ?? "",
            input: tc.function?.arguments ? safeParse(tc.function.arguments) : {},
          }));

  // RESCUE Llama text-format tool calls (see rescueLlamaToolCalls below).
  // Runs even when the model already gave us structured tool_calls,
  // because Llama sometimes appends raw-JSON tool calls AFTER a real one
  // and the leaked JSON shows up in the chat UI. response_schema mode
  // skips rescue because the text IS the structured output.
  let finalText = text;
  let finalToolUses = tool_uses;
  if (!input.response_schema && finalText) {
    const rescued = rescueLlamaToolCalls(finalText);
    if (rescued.calls.length > 0) {
      finalToolUses = [
        ...finalToolUses,
        ...rescued.calls.map((c, i) => ({
          id: `call_${finalToolUses.length + i}_${crypto.randomUUID().slice(0, 8)}`,
          name: c.name,
          input: c.input,
        })),
      ];
      finalText = rescued.remainder;
    }
  }
  // Dedup: drop identical-input duplicates Llama sometimes emits in a
  // single response. Keeps the first; subsequent ones are model noise.
  finalToolUses = dedupeToolUses(finalToolUses);

  const usage = {
    input_tokens: res.usage?.prompt_tokens ?? res.usage?.input_tokens ?? 0,
    output_tokens: res.usage?.completion_tokens ?? res.usage?.output_tokens ?? 0,
  };

  // Structured output: an object-valued `response` IS the structured result.
  // Otherwise, parse the text when the caller asked for a schema.
  let structured: unknown = objectResponse;
  if (structured == null && input.response_schema && finalText) {
    try {
      structured = JSON.parse(finalText);
    } catch {
      structured = null;
    }
  }

  const stop_reason: LlmStopReason = finalToolUses.length > 0 ? "tool_use" : "end_turn";

  return {
    text: finalText,
    structured,
    tool_uses: finalToolUses,
    stop_reason,
    usage,
    cost_cents: 0,
    cost_ledger_id: null,
    model: input.model,
    provider: "workers_ai",
  };
}

interface PartialToolCall {
  id: string;
  name: string;
  argumentsText: string;
}

/** Streaming variant. Calls `onChunk` for each delta (text or completed tool_use)
 *  and returns the final assembled output for persistence. Workers AI returns
 *  SSE bytes in OpenAI's `chat.completion.chunk` shape when stream:true. */
export async function streamWorkersAi(
  ai: Ai,
  input: LlmCallInput,
  onChunk: (chunk: LlmStreamChunk) => void,
): Promise<LlmCallOutput> {
  const body = { ...buildBody(input), stream: true };
  const streamRes = (await withTimeout(
    ai.run(input.model as never, body as never) as Promise<unknown>,
    TIMEOUTS.LLM_CALL_MS,
    `workers_ai.stream.open[${input.model}]`,
  )) as ReadableStream<Uint8Array>;

  const reader = streamRes.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let fullText = "";
  let leadingFillerStripped = false;
  // Once the accumulated stream text looks like a Llama tool-call
  // JSON (e.g. starts with `{"type":` or `<|python_tag|>`), suppress
  // deltas to the client so the raw JSON doesn't leak into the chat
  // UI. The rescue at end-of-stream parses it as a real tool_use.
  let suppressDeltas = false;
  const toolByIndex = new Map<number, PartialToolCall>();
  let finishReason: string | null = null;
  let usagePrompt = 0;
  let usageCompletion = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIdx = buffer.indexOf("\n");
    while (nlIdx !== -1) {
      const line = buffer.slice(0, nlIdx).trim();
      buffer = buffer.slice(nlIdx + 1);
      nlIdx = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      let parsed: WorkersAiChatResponse & {
        choices?: Array<{
          delta?: {
            content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string;
        }>;
      };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      // Llama models may stream a single object with .response (non-chunked).
      if (typeof parsed.response === "string" && parsed.response.length > 0) {
        let chunkText = parsed.response;
        if (!leadingFillerStripped) {
          chunkText = stripFiller(chunkText);
          leadingFillerStripped = chunkText.length > 0;
        }
        fullText += chunkText;
        if (!suppressDeltas && looksLikeToolCallPrefix(fullText)) suppressDeltas = true;
        if (chunkText && !suppressDeltas) onChunk({ delta: chunkText });
      }
      const choice = parsed.choices?.[0];
      const delta = choice?.delta;
      if (typeof delta?.content === "string" && delta.content.length > 0) {
        let chunkText = delta.content;
        if (!leadingFillerStripped) {
          chunkText = stripFiller(fullText + chunkText).slice(fullText.length);
          leadingFillerStripped = (fullText + chunkText).length > 0;
        }
        fullText += chunkText;
        if (!suppressDeltas && looksLikeToolCallPrefix(fullText)) suppressDeltas = true;
        if (chunkText && !suppressDeltas) onChunk({ delta: chunkText });
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolByIndex.get(idx) ?? { id: "", name: "", argumentsText: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.argumentsText += tc.function.arguments;
          toolByIndex.set(idx, existing);
        }
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (parsed.usage) {
        usagePrompt = parsed.usage.prompt_tokens ?? parsed.usage.input_tokens ?? usagePrompt;
        usageCompletion =
          parsed.usage.completion_tokens ?? parsed.usage.output_tokens ?? usageCompletion;
      }
    }
  }

  // RESCUE: Llama 3.3 70B often emits tool calls as raw JSON in the
  // assistant text instead of using the OpenAI tool_calls field, and
  // sometimes does so EVEN WHEN it also emits a proper tool_call (the
  // text leaks as visible JSON in the chat UI). Strip every tool-call-
  // shaped JSON object out of the text and append the parsed calls.
  // Common Llama formats:
  //   {"type": "function", "name": "X", "parameters": {...}}
  //   {"name": "X", "arguments": {...}}
  //   <function=X>{"arg": "val"}</function>
  //   <|python_tag|>X.call({"arg": "val"})
  if (fullText) {
    const rescued = rescueLlamaToolCalls(fullText);
    if (rescued.calls.length > 0) {
      const baseIdx = toolByIndex.size;
      rescued.calls.forEach((c, i) => {
        toolByIndex.set(baseIdx + i, {
          id: "",
          name: c.name,
          argumentsText: JSON.stringify(c.input),
        });
      });
      fullText = rescued.remainder;
    }
  }

  // Build the raw list, then dedup by (name, input) — Llama sometimes
  // emits the same call multiple times in one stream. Emit a single
  // tool_use chunk per unique call so the UI doesn't render duplicate
  // chips.
  const rawToolUses = [...toolByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, t]) => t.name.length > 0)
    .map(([idx, t]) => ({
      id: t.id || `call_${idx}_${crypto.randomUUID().slice(0, 8)}`,
      name: t.name,
      input: t.argumentsText ? safeParse(t.argumentsText) : {},
    }));
  const tool_uses = dedupeToolUses(rawToolUses);
  for (const tu of tool_uses) {
    onChunk({ tool_use: tu });
  }

  const stop_reason: LlmStopReason =
    finishReason === "tool_calls" || tool_uses.length > 0
      ? "tool_use"
      : finishReason === "length"
        ? "max_tokens"
        : "end_turn";

  const out: LlmCallOutput = {
    text: fullText,
    structured: null,
    tool_uses,
    stop_reason,
    usage: { input_tokens: usagePrompt, output_tokens: usageCompletion },
    cost_cents: 0,
    cost_ledger_id: null,
    model: input.model,
    provider: "workers_ai",
  };
  onChunk({
    done: {
      stop_reason,
      usage: out.usage,
      cost_cents: 0,
      cost_ledger_id: null,
      model: input.model,
      provider: "workers_ai",
    },
  });
  return out;
}

/** Workers AI chat-completions format: an array of {role, content} where
 *  content is a string. Tool results and multimodal documents map to
 *  inline JSON / data-URLs since the chat schema only supports text. */
function toChatMessages(input: LlmCallInput): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = [];
  if (input.system) out.push({ role: "system", content: input.system });
  for (const m of input.messages) {
    out.push({ role: m.role, content: serializeContent(m.content) });
  }
  return out;
}

function serializeContent(content: LlmContent[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === "text") parts.push(c.text);
    else if (c.type === "tool_use")
      parts.push(`<tool_use name="${c.name}">${JSON.stringify(c.input)}</tool_use>`);
    else if (c.type === "tool_result")
      parts.push(
        `<tool_result tool_use_id="${c.tool_use_id}"${c.is_error ? ' is_error="true"' : ""}>${c.output}</tool_result>`,
      );
    else if (c.type === "document" && c.mime === "text/plain") parts.push(atob(c.base64));
    else if (c.type === "document" && c.mime === "application/pdf")
      parts.push(`[PDF document attached, ${c.base64.length} bytes base64]`);
    else if (c.type === "image") parts.push(`[Image attached, mime=${c.mime}]`);
  }
  return parts.join("\n");
}

/** Llama 3.3 70B occasionally emits its tool call as raw JSON in the
 *  assistant text instead of using the OpenAI tool_calls field. This
 *  scans for the common variants and returns the first one found.
 *  Kept for back-compat; new callers should prefer `rescueLlamaToolCalls`
 *  which handles multiple concatenated calls and returns the remainder. */
export function rescueLlamaToolCall(
  text: string,
): { name: string; input: Record<string, unknown> } | null {
  const result = rescueLlamaToolCalls(text);
  return result.calls[0] ?? null;
}

/** Multi-call rescue. Scans the whole text for tool-call-shaped JSON
 *  objects (and the python_tag / function-tag variants), returns every
 *  one found along with the text that remains after they're stripped.
 *
 *  Why this exists: Llama sometimes emits one structured tool_call via
 *  the OpenAI tool_calls field AND then duplicates it (or appends a
 *  second tool call) as raw text in the assistant message. The raw
 *  text leaks into the chat UI as visible JSON. Stripping it on the
 *  server keeps the chat clean. */
export function rescueLlamaToolCalls(text: string): {
  calls: Array<{ name: string; input: Record<string, unknown> }>;
  remainder: string;
} {
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  let remainder = text;

  // Strip <|python_tag|>name.call({...}) blocks.
  remainder = remainder.replace(
    /<\|python_tag\|>\s*([a-z_][a-z0-9_]*)\.call\((.+?)\)/gis,
    (_m, name: string, args: string) => {
      calls.push({ name, input: safeParse(args) });
      return "";
    },
  );

  // Strip <function=name>{json}</function> blocks.
  remainder = remainder.replace(
    /<function=([a-z_][a-z0-9_]*)>([\s\S]*?)(?:<\/function>|$)/gi,
    (_m, name: string, body: string) => {
      calls.push({ name, input: safeParse(body) });
      return "";
    },
  );

  // Scan for balanced-brace JSON objects and extract any that look like
  // a tool call ({type:function,name,parameters} or {name,arguments|parameters}).
  remainder = stripToolCallJsonObjects(remainder, calls);

  return { calls, remainder: remainder.trim() };
}

/** Walk the text, find balanced-brace JSON objects, and pull out any
 *  that match a tool-call schema. Returns the text with those objects
 *  removed. Non-tool-call objects are left in place. */
function stripToolCallJsonObjects(
  text: string,
  out: Array<{ name: string; input: Record<string, unknown> }>,
): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "{") {
      result += ch;
      i += 1;
      continue;
    }
    const end = findBalancedBraceEnd(text, i);
    if (end === -1) {
      // Unbalanced — copy the rest verbatim and stop.
      result += text.slice(i);
      break;
    }
    const candidate = text.slice(i, end + 1);
    const parsed = tryParseToolCall(candidate);
    if (parsed) {
      out.push(parsed);
      // Skip the consumed object (and any trailing whitespace/comma).
      i = end + 1;
      while (i < text.length && /[\s,]/.test(text[i] ?? "")) i += 1;
    } else {
      result += text.slice(i, end + 1);
      i = end + 1;
    }
  }
  return result;
}

/** Find the index of the matching `}` for the `{` at `start`. Respects
 *  string literals. Returns -1 if unbalanced. */
function findBalancedBraceEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseToolCall(
  candidate: string,
): { name: string; input: Record<string, unknown> } | null {
  let obj = safeParse(candidate) as Record<string, unknown>;
  if (!obj || Object.keys(obj).length === 0) {
    // Repair common malformations.
    const repaired = candidate
      .replace(/"\s*:\s*}/g, '": ""}')
      .replace(/"\s*:\s*,/g, '": "",')
      .replace(/,(\s*[}\]])/g, "$1");
    obj = safeParse(repaired) as Record<string, unknown>;
  }
  if (!obj || typeof obj !== "object") return null;

  if (typeof obj.name === "string" && obj.parameters && typeof obj.parameters === "object") {
    return { name: obj.name, input: obj.parameters as Record<string, unknown> };
  }
  if (typeof obj.name === "string" && obj.arguments && typeof obj.arguments === "object") {
    return { name: obj.name, input: obj.arguments as Record<string, unknown> };
  }
  if (
    obj.type === "function" &&
    typeof obj.name === "string" &&
    typeof obj.parameters === "object"
  ) {
    return { name: obj.name, input: obj.parameters as Record<string, unknown> };
  }
  return null;
}

/** Cheap prefix detector for "the model is starting to emit a tool call
 *  as text". Used to suppress delta streaming so leaked JSON doesn't
 *  appear in the chat UI. End-of-stream rescue still parses it as a
 *  real tool_use. */
function looksLikeToolCallPrefix(accumulated: string): boolean {
  const t = accumulated.trimStart();
  if (!t) return false;
  if (t.startsWith("<|python_tag|>")) return true;
  if (/^<function=[a-z_]/i.test(t)) return true;
  // Tool-call-shaped JSON: {"type":"function",... or {"name":"...","parameters":...
  if (/^\{\s*"type"\s*:\s*"function"/.test(t)) return true;
  if (/^\{\s*"name"\s*:\s*"[a-z_]/i.test(t)) return true;
  return false;
}

/** Canonical hash of a tool call for dedup: name + stable-stringified
 *  input. Order-independent — two calls with the same logical input
 *  hash identically regardless of key insertion order. */
export function toolUseHash(name: string, input: Record<string, unknown>): string {
  return `${name}:${stableStringify(input)}`;
}

/** Fold a tool_uses array by hash: keep the first occurrence, drop the
 *  rest. Llama 3.3 70B sometimes emits the same tool call N times in
 *  one response (especially after a recent successful call). The agent
 *  loop only needs to execute each unique call once.
 *
 *  Note: any legitimate "call the same tool twice in one turn" flow
 *  would need to vary the input — identical-input duplicates are always
 *  a model artifact. */
export function dedupeToolUses<T extends { name: string; input: Record<string, unknown> }>(
  tool_uses: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const tu of tool_uses) {
    const h = toolUseHash(tu.name, tu.input);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(tu);
  }
  return out;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function stripFiller(text: string): string {
  return text.replace(
    /^(Certainly!?|Of course!?|Sure!?|Absolutely!?|Great question!?|I'd be happy to[^!]*!?|I'm happy to help[^!]*!?)\s*/i,
    "",
  );
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Helper exposed for non-chat tasks (embeddings, image input) that don't
 *  match the chat-completions schema. */
export async function runWorkersAi<T = unknown>(
  ai: Ai,
  model: string,
  body: Record<string, unknown>,
): Promise<T> {
  return (await withTimeout(
    ai.run(model as never, body as never) as Promise<unknown>,
    TIMEOUTS.LLM_CALL_MS,
    `workers_ai.run[${model}]`,
  )) as T;
}

// Avoid unused-binding warning when LlmMessage isn't referenced elsewhere.
export type { LlmMessage };
