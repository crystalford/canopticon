// Workers AI adapter — calls env.AI.run() with provider-neutral input
// and normalizes the response shape.
//
// Models in scope:
//   - @cf/moonshotai/kimi-k2.6                  (chat orchestrator, OpenAI shape)
//   - @cf/meta/llama-4-scout-17b-16e-instruct   (multimodal, 131k ctx)
//   - @cf/meta/llama-3.3-70b-instruct-fp8-fast  (tool-calling orchestrator)
//   - @cf/qwen/qwq-32b                          (reasoning roles)
//   - @cf/baai/bge-large-en-v1.5                (embeddings)

import type {
  LlmCallInput,
  LlmCallOutput,
  LlmContent,
  LlmMessage,
  LlmStopReason,
  LlmStreamChunk,
} from "./types";

interface WorkersAiChatResponse {
  // Llama-style normalized shape that Workers AI returns for most catalog models.
  response?: string;
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

function buildBody(input: LlmCallInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages: toChatMessages(input),
    max_tokens: input.max_tokens,
    temperature: input.temperature ?? 0,
  };
  if (input.top_p !== undefined) body.top_p = input.top_p;
  if (input.repetition_penalty !== undefined) body.repetition_penalty = input.repetition_penalty;
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
  return body;
}

export async function callWorkersAi(ai: Ai, input: LlmCallInput): Promise<LlmCallOutput> {
  const res = (await ai.run(
    input.model as never,
    buildBody(input) as never,
  )) as WorkersAiChatResponse;

  // Llama-style returns {response, tool_calls}. Partner models (Kimi, DeepSeek)
  // return OpenAI shape {choices: [{message: {content, tool_calls}}]}.
  const openAiMsg = res.choices?.[0]?.message;
  const rawText =
    typeof res.response === "string" && res.response.length > 0
      ? res.response
      : (openAiMsg?.content ?? "");
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

  const usage = {
    input_tokens: res.usage?.prompt_tokens ?? res.usage?.input_tokens ?? 0,
    output_tokens: res.usage?.completion_tokens ?? res.usage?.output_tokens ?? 0,
  };

  let structured: unknown = null;
  if (input.response_schema && text) {
    try {
      structured = JSON.parse(text);
    } catch {
      structured = null;
    }
  }

  const stop_reason: LlmStopReason = tool_uses.length > 0 ? "tool_use" : "end_turn";

  return {
    text,
    structured,
    tool_uses,
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
  const streamRes = (await ai.run(
    input.model as never,
    body as never,
  )) as ReadableStream<Uint8Array>;

  const reader = streamRes.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let fullText = "";
  let leadingFillerStripped = false;
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
        if (chunkText) onChunk({ delta: chunkText });
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
        if (chunkText) onChunk({ delta: chunkText });
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

  const tool_uses = [...toolByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, t]) => t.name.length > 0)
    .map(([idx, t]) => {
      const tu = {
        id: t.id || `call_${idx}_${crypto.randomUUID().slice(0, 8)}`,
        name: t.name,
        input: t.argumentsText ? safeParse(t.argumentsText) : {},
      };
      onChunk({ tool_use: tu });
      return tu;
    });

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
  return (await ai.run(model as never, body as never)) as T;
}

// Avoid unused-binding warning when LlmMessage isn't referenced elsewhere.
export type { LlmMessage };
