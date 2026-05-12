// Chat: conversations CRUD + agent-loop SSE.
//
// Agent loop: user message -> model call -> if tool_use, execute tools
// (or stage for confirm), append results, call again. Up to 12 turns.
// Stream tool_call / tool_result / message_delta / done SSE events to the
// client.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, parseJson, run } from "../lib/d1.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";
import { callLLM } from "../llm/index.ts";
import { TOOLS_BY_NAME, type ToolSideEffect, toolDefinitionsForModel } from "../llm/tools.ts";
import type { LlmContent, LlmMessage } from "../llm/types.ts";

// Default chat orchestrator: free Workers-AI Llama. If the operator has
// enabled Anthropic (System screen), the orchestrator switches to Claude
// Sonnet for the chat thread — the experience the user wants.
const ORCHESTRATOR_FREE = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ORCHESTRATOR_CLAUDE = "claude-sonnet-4-6";
const MAX_LOOP_ITERATIONS = 12;

async function pickOrchestrator(
  env: AuthContext["Bindings"],
  userId: string,
): Promise<{ provider: "workers_ai" | "anthropic"; model: string }> {
  if (!env.ANTHROPIC_API_KEY) {
    return { provider: "workers_ai", model: ORCHESTRATOR_FREE };
  }
  const prefs = await one<{ anthropic_enabled: number }>(
    env.DB,
    "SELECT anthropic_enabled FROM user_ai_prefs WHERE user_id = ?",
    [userId],
  );
  if (prefs?.anthropic_enabled === 1) {
    return { provider: "anthropic", model: ORCHESTRATOR_CLAUDE };
  }
  return { provider: "workers_ai", model: ORCHESTRATOR_FREE };
}

const SYSTEM_PROMPT = `You are Canopticon's chat assistant. Your tone is warm, direct, and intelligent — the way a senior analyst would talk to a peer. Think helpful and curious, not robotic, not sycophantic.

How to write:
- Talk like a real person. Short, clear sentences. No corporate filler ("Certainly!", "I'd be happy to help!", "Sure! I can do that.").
- Get to the point. If the answer is one sentence, give one sentence.
- Markdown is fine for lists and emphasis, but don't over-format casual replies.
- Acknowledge uncertainty when it exists; don't make things up.

How to behave:
- Greetings ("hi", "hello") → say hi back, briefly mention what you can help with, ask what they want to do. Don't dump a feature tour unless asked.
- Casual chat, jokes, opinions, general questions → just answer like a normal person.
- "What can you do?" / "Walk me through this" → 3–4 concrete options in plain language. No tool calls.

Tools (use sparingly, only when clearly warranted):
- fetch_url — operator pasted a URL
- search_substrate — operator asked about THEIR collected data ("what claims do I have on housing?")
- create_source / extract_entities / run_role — operator explicitly asked to ingest, extract, or run a role
- Empty search results → tell them the substrate is empty for that topic. Do not retry with different queries.
- If a request is ambiguous, ask one clarifying question instead of guessing with a tool.
`;

// Heuristic: only attach tool definitions when the message clearly
// needs them. Stops the model from being lured into tool-spam on
// casual chat, and makes responses feel more like Claude.
function shouldOfferTools(messages: LlmMessage[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return true;
  const text = lastUser.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join(" ")
    .trim();
  if (text.length === 0) return true;
  // URL → almost certainly wants fetch_url.
  if (/https?:\/\//i.test(text)) return true;
  // Action keywords that map clearly to a tool.
  const actionWords =
    /\b(search|find|show|list|look\s?up|fetch|ingest|upload|extract|create|seed|run|claim|claims|entity|entities|source|sources|thesis|theses|graph|substrate)\b/i;
  if (actionWords.test(text)) return true;
  // Otherwise treat it as plain chat — no tools.
  return false;
}

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

// Returns the orchestrator the chat will use for this operator, so the
// UI can show "claude-sonnet-4-6" instead of a hardcoded model label.
app.get("/model", async (c) => {
  const userId = c.get("user_id");
  const o = await pickOrchestrator(c.env, userId);
  return c.json({
    provider: o.provider,
    model: o.model,
    label:
      o.provider === "anthropic"
        ? "Anthropic · Claude Sonnet 4.6"
        : "Workers AI · Free Tier · Llama 3.3 70B",
  });
});

// ---------------------------------------------------------------------------
// Conversations CRUD
// ---------------------------------------------------------------------------

app.post("/conversations", async (c) => {
  const userId = c.get("user_id");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const id = await insertOne(c.env.DB, "chat_conversations", {
    user_id: userId,
    title: body.title ?? null,
  });
  return c.json({ id }, 201);
});

app.get("/conversations", async (c) => {
  const userId = c.get("user_id");
  const rows = await all(
    c.env.DB,
    `SELECT id, title, pinned, last_message_at, message_count, total_cost_cents, archived, created_at
     FROM chat_conversations WHERE user_id = ? AND archived = 0
     ORDER BY pinned DESC, last_message_at DESC NULLS LAST, created_at DESC LIMIT 100`,
    [userId],
  );
  return c.json({ conversations: rows });
});

app.get("/conversations/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const conv = await one(
    c.env.DB,
    "SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!conv) throw notFound("conversation");
  const messages = await all(
    c.env.DB,
    `SELECT id, seq, role, content_json, provider, model, tokens_in, tokens_out, cost_cents,
            stop_reason, tool_name, tool_use_id, tool_status, side_effects, created_at
     FROM chat_messages WHERE conversation_id = ? ORDER BY seq ASC`,
    [id],
  );
  return c.json({ conversation: conv, messages });
});

app.patch("/conversations/:id", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");
  const body = (await c.req.json()) as {
    title?: string;
    pinned?: boolean;
    archived?: boolean;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.title !== undefined) {
    sets.push("title = ?");
    params.push(body.title);
  }
  if (body.pinned !== undefined) {
    sets.push("pinned = ?");
    params.push(body.pinned ? 1 : 0);
  }
  if (body.archived !== undefined) {
    sets.push("archived = ?");
    params.push(body.archived ? 1 : 0);
  }
  if (sets.length === 0) throw badRequest("nothing to update");
  sets.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id, userId);
  await run(
    c.env.DB,
    `UPDATE chat_conversations SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params,
  );
  return c.json({ ok: true });
});

app.delete("/conversations/:id", async (c) => {
  const userId = c.get("user_id");
  await run(c.env.DB, "DELETE FROM chat_conversations WHERE id = ? AND user_id = ?", [
    c.req.param("id"),
    userId,
  ]);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Agent loop (SSE)
// ---------------------------------------------------------------------------

interface PostMessageBody {
  text: string;
  attached_file_ids?: string[];
  confirm_tool_use_id?: string;
  confirm_input?: Record<string, unknown>;
}

app.post("/conversations/:id/messages", async (c) => {
  const userId = c.get("user_id");
  const conversationId = c.req.param("id");
  const body = (await c.req.json()) as PostMessageBody;
  const conv = await one<{ id: string; title: string | null }>(
    c.env.DB,
    "SELECT id, title FROM chat_conversations WHERE id = ? AND user_id = ?",
    [conversationId, userId],
  );
  if (!conv) throw notFound("conversation");

  // Persist the user message immediately.
  const userContent: LlmContent[] = [{ type: "text", text: body.text }];
  for (const fid of body.attached_file_ids ?? []) {
    userContent.push({ type: "text", text: `<attached_file id="${fid}" />` });
  }
  const userSeq = await nextSeq(c.env.DB, conversationId);
  await insertOne(c.env.DB, "chat_messages", {
    conversation_id: conversationId,
    user_id: userId,
    seq: userSeq,
    role: "user",
    content_json: JSON.stringify(userContent),
  });

  // Auto-title from first user message if not yet titled.
  if (!conv.title && body.text) {
    await run(
      c.env.DB,
      "UPDATE chat_conversations SET title = ?, last_message_at = ? WHERE id = ?",
      [body.text.slice(0, 80), new Date().toISOString(), conversationId],
    );
  }

  // SSE stream of agent progress.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(formatSseEvent({ id: crypto.randomUUID(), event, data })));
      };
      try {
        await runAgentLoop({
          env: c.env,
          userId,
          conversationId,
          startSeq: userSeq + 1,
          emit,
          ping: () => controller.enqueue(enc.encode(formatSseComment("ping"))),
        });
        emit("done", { ok: true });
      } catch (err) {
        emit("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

// Resolve a pending confirm-tool: client calls with the staged input.
app.post("/conversations/:id/tool/:tool_use_id/confirm", async (c) => {
  const userId = c.get("user_id");
  const conversationId = c.req.param("id");
  const toolUseId = c.req.param("tool_use_id");
  const body = (await c.req.json().catch(() => ({}))) as { input?: Record<string, unknown> };
  const toolRow = await one<{
    id: string;
    tool_name: string;
    content_json: string;
    tool_status: string;
  }>(
    c.env.DB,
    `SELECT id, tool_name, content_json, tool_status FROM chat_messages
     WHERE conversation_id = ? AND tool_use_id = ? AND user_id = ?`,
    [conversationId, toolUseId, userId],
  );
  if (!toolRow) throw notFound("tool_use");
  if (toolRow.tool_status !== "pending") return c.json({ ok: true, already: true });
  const tool = TOOLS_BY_NAME[toolRow.tool_name];
  if (!tool) throw badRequest(`unknown tool: ${toolRow.tool_name}`);

  const staged = parseJson<LlmContent[]>(toolRow.content_json, []);
  const stagedInput =
    (staged.find((c) => c.type === "tool_use") as { input?: Record<string, unknown> } | undefined)
      ?.input ?? {};
  const finalInput = { ...stagedInput, ...(body.input ?? {}) };

  const result = await tool.exec({ env: c.env, userId, conversationId }, finalInput);
  await run(
    c.env.DB,
    `UPDATE chat_messages
        SET content_json = ?, tool_status = 'success', side_effects = ?
      WHERE id = ?`,
    [
      JSON.stringify([
        { type: "tool_result", tool_use_id: toolUseId, output: result.output },
      ] satisfies LlmContent[]),
      JSON.stringify(result.side_effects),
      toolRow.id,
    ],
  );
  return c.json({ ok: true, output: result.output, side_effects: result.side_effects });
});

// ---------------------------------------------------------------------------
// Agent loop body
// ---------------------------------------------------------------------------

async function runAgentLoop(args: {
  env: AuthContext["Bindings"];
  userId: string;
  conversationId: string;
  startSeq: number;
  emit: (event: string, data: unknown) => void;
  ping: () => void;
}): Promise<void> {
  const { env, userId, conversationId, emit, ping } = args;
  let seq = args.startSeq;
  const orchestrator = await pickOrchestrator(env, userId);
  const opType = orchestrator.provider === "anthropic" ? "anthropic.chat" : "workers_ai.chat";

  for (let iter = 0; iter < MAX_LOOP_ITERATIONS; iter++) {
    const messages = await loadConversationMessages(env.DB, conversationId);
    ping();

    const offerTools = shouldOfferTools(messages);
    const out = await callLLM(env, {
      provider: orchestrator.provider,
      model: orchestrator.model,
      system: SYSTEM_PROMPT,
      messages,
      tools: offerTools ? toolDefinitionsForModel() : [],
      max_tokens: 1500,
      // Slight warmth in sampling so Llama doesn't read like a manual.
      temperature: 0.5,
      ledger: { user_id: userId, operation_type: opType },
    });

    // Persist assistant message (text + tool_use blocks).
    const assistantContent: LlmContent[] = [];
    if (out.text) assistantContent.push({ type: "text", text: out.text });
    for (const tu of out.tool_uses) {
      assistantContent.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
    }
    await insertOne(env.DB, "chat_messages", {
      conversation_id: conversationId,
      user_id: userId,
      seq: seq++,
      role: "assistant",
      content_json: JSON.stringify(assistantContent),
      provider: out.provider,
      model: out.model,
      tokens_in: out.usage.input_tokens,
      tokens_out: out.usage.output_tokens,
      cost_cents: out.cost_cents,
      cost_ledger_id: out.cost_ledger_id,
      stop_reason: out.stop_reason,
    });
    if (out.text) emit("message_delta", { text: out.text });

    if (out.tool_uses.length === 0 || out.stop_reason !== "tool_use") {
      return; // end of turn
    }

    let blockedByConfirm = false;
    for (const tu of out.tool_uses) {
      const tool = TOOLS_BY_NAME[tu.name];
      if (!tool) {
        await persistToolResult(env, {
          conversationId,
          userId,
          seq: seq++,
          tool_use_id: tu.id,
          tool_name: tu.name,
          output: `Unknown tool: ${tu.name}`,
          is_error: true,
        });
        emit("tool_result", { tool_use_id: tu.id, error: `unknown tool ${tu.name}` });
        continue;
      }

      emit("tool_call", {
        tool_use_id: tu.id,
        name: tu.name,
        input: tu.input,
        confirm: tool.confirm,
      });

      if (tool.confirm) {
        // Stage the call as a pending tool message; loop pauses here for this turn.
        await insertOne(env.DB, "chat_messages", {
          conversation_id: conversationId,
          user_id: userId,
          seq: seq++,
          role: "tool",
          content_json: JSON.stringify([
            { type: "tool_use", id: tu.id, name: tu.name, input: tu.input },
          ] satisfies LlmContent[]),
          tool_name: tu.name,
          tool_use_id: tu.id,
          tool_status: "pending",
        });
        emit("awaiting_confirm", { tool_use_id: tu.id, name: tu.name, input: tu.input });
        blockedByConfirm = true;
        continue;
      }

      try {
        const result = await tool.exec({ env, userId, conversationId }, tu.input);
        await persistToolResult(env, {
          conversationId,
          userId,
          seq: seq++,
          tool_use_id: tu.id,
          tool_name: tu.name,
          output: result.output,
          side_effects: result.side_effects,
        });
        emit("tool_result", {
          tool_use_id: tu.id,
          output: result.output,
          side_effects: result.side_effects,
        });
      } catch (err) {
        const msg = (err as Error).message ?? "tool failure";
        await persistToolResult(env, {
          conversationId,
          userId,
          seq: seq++,
          tool_use_id: tu.id,
          tool_name: tu.name,
          output: msg,
          is_error: true,
        });
        emit("tool_result", { tool_use_id: tu.id, error: msg });
      }
    }

    if (blockedByConfirm) return; // wait for the client to confirm
  }

  // Loop hit the iteration cap without producing a final text response.
  // Force one more LLM call with tools disabled so the operator gets an
  // answer instead of staring at a wall of tool calls.
  try {
    const messages = await loadConversationMessages(env.DB, conversationId);
    const finalOut = await callLLM(env, {
      provider: orchestrator.provider,
      model: orchestrator.model,
      system: `${SYSTEM_PROMPT}\n\nYour previous tool calls did not find what the operator wanted. Respond now in plain text only — no more tool calls. Briefly say what you tried and suggest one concrete next step.`,
      messages,
      max_tokens: 600,
      temperature: 0.5,
      ledger: { user_id: userId, operation_type: opType },
    });
    if (finalOut.text) {
      await insertOne(env.DB, "chat_messages", {
        conversation_id: conversationId,
        user_id: userId,
        seq: seq++,
        role: "assistant",
        content_json: JSON.stringify([
          { type: "text", text: finalOut.text },
        ] satisfies LlmContent[]),
        provider: finalOut.provider,
        model: finalOut.model,
        tokens_in: finalOut.usage.input_tokens,
        tokens_out: finalOut.usage.output_tokens,
        cost_cents: finalOut.cost_cents,
        cost_ledger_id: finalOut.cost_ledger_id,
        stop_reason: "end_turn",
      });
      emit("message_delta", { text: finalOut.text });
      return;
    }
  } catch {
    // Fall through to the error event below.
  }

  emit("error", { message: `Agent loop hit max iterations (${MAX_LOOP_ITERATIONS}).` });
}

async function persistToolResult(
  env: AuthContext["Bindings"],
  args: {
    conversationId: string;
    userId: string;
    seq: number;
    tool_use_id: string;
    tool_name: string;
    output: string;
    side_effects?: ToolSideEffect[];
    is_error?: boolean;
  },
): Promise<void> {
  await insertOne(env.DB, "chat_messages", {
    conversation_id: args.conversationId,
    user_id: args.userId,
    seq: args.seq,
    role: "tool",
    content_json: JSON.stringify([
      {
        type: "tool_result",
        tool_use_id: args.tool_use_id,
        output: args.output,
        is_error: args.is_error,
      },
    ] satisfies LlmContent[]),
    tool_name: args.tool_name,
    tool_use_id: args.tool_use_id,
    tool_status: args.is_error ? "error" : "success",
    side_effects: args.side_effects ?? [],
  });
}

async function nextSeq(db: D1Database, conversationId: string): Promise<number> {
  const row = await one<{ max: number | null }>(
    db,
    "SELECT MAX(seq) AS max FROM chat_messages WHERE conversation_id = ?",
    [conversationId],
  );
  return (row?.max ?? 0) + 1;
}

async function loadConversationMessages(
  db: D1Database,
  conversationId: string,
): Promise<LlmMessage[]> {
  const rows = await all<{ role: string; content_json: string; tool_status: string | null }>(
    db,
    `SELECT role, content_json, tool_status FROM chat_messages
     WHERE conversation_id = ? AND (tool_status IS NULL OR tool_status != 'pending')
     ORDER BY seq ASC`,
    [conversationId],
  );
  return rows.map((r) => ({
    role: r.role as LlmMessage["role"],
    content: parseJson<LlmContent[]>(r.content_json, []),
  }));
}

export default app;
