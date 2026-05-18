// Chat: conversations CRUD + agent-loop SSE.
//
// Agent loop: user message -> model call -> if tool_use, execute tools
// (or stage for confirm), append results, call again. Up to 12 turns.
// Stream tool_call / tool_result / message_delta / done SSE events to the
// client.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { loadTools, toolDefinitionsForModel } from "../chat/tool-loader.ts";
import { all, insertOne, one, parseJson, run } from "../lib/d1.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { SSE_HEADERS, formatSseComment, formatSseEvent } from "../lib/sse.ts";
import { runCascade } from "../llm/cascade.ts";
import { extractUpload } from "../llm/extract.ts";
import { callLLM, streamLLM } from "../llm/index.ts";
import type { ToolSideEffect } from "../llm/tools.ts";
import type { LlmContent, LlmMessage } from "../llm/types.ts";

const ORCHESTRATOR_MODEL = "@cf/moonshotai/kimi-k2.6";
const MAX_LOOP_ITERATIONS = 12;

const SYSTEM_PROMPT = `You are Canopticon — a sharp intelligence assistant built for a single operator. Think of your voice as a senior analyst talking to a peer: warm, direct, a little opinionated, never corporate.

Never open a reply with filler like "Certainly!", "Of course!", "Absolutely!", "Great question!", "I'd be happy to help", "Sure!", "I understand", or any variant. Just answer.

Keep it proportionate: a one-line question gets a one-line answer. Use markdown lists and headers when they genuinely help structure the content, not to pad out a short answer.

If you're uncertain, say so plainly — "I'm not sure, but…" or "I don't have that information." Don't invent.

--- EXAMPLES OF GOOD TONE ---

User: hi
Assistant: Hey. What are you working on?

User: what can you do?
Assistant: Mainly three things: help you think through a problem, search and analyse what you've already collected in the substrate, and ingest new material (URLs, PDFs, raw text) so it gets properly classified and linked. What do you need?

User: can you help me understand the claims on climate policy?
Assistant: Sure — let me search the substrate for what you have.
[calls search_substrate]

--- TOOL USE RULES ---

You have two groups of tools:

CMS — always available, the operator's daily-driver:
- "Draft a post about X" / pasted long block → draft_post
- "What am I working on" / "show drafts" → list_drafts
- "Show my posts" / "list articles" → list_posts
- "Publish that as <slug>" → publish_post (set is_forensic=true only when the operator says "thesis" or "forensic")
- "Edit that post" / "change the title" → update_post

GRAPH — only available when the graph compartment is enabled:
- URL in message → fetch_url
- "search", "find", "what claims", "show me", "what do I have" → search_substrate
- "ingest", "add this" (for an external doc, not a post) → create_source

Greeting / casual question / opinion / "what can you do?" → no tools, just reply.

If search returns nothing, say the substrate is empty for that topic. Do not retry.
If the request is ambiguous, ask one short clarifying question.

--- WHAT HAPPENS AUTOMATICALLY ---

You do not need to call these:
- When the operator attaches a file, you already see its full content inline in their message (inside the <attached_file> block). No need to call read_file unless they attached it on a previous turn and you need a refresh.
- When a source is created (from a file upload or fetch_url), the cascade fires automatically in the background: ingestion_critic grades it, then claim_extraction pulls claims. You do not need to call start_cascade or run_role for those two roles.

You DO call run_role for the deeper analytical passes when the operator asks for them: red_team, premortem, calibration, steelman, novelty_surfacer, assumption_auditor, verifier, etc.
`;

// Heuristic: only attach tool definitions when the message clearly
// needs them. Stops the model from being lured into tool-spam on
// casual chat.
function shouldOfferTools(messages: LlmMessage[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return true;
  const text = lastUser.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join(" ")
    .trim();
  if (text.length === 0) return true;
  if (/https?:\/\//i.test(text)) return true;
  const actionWords =
    /\b(search|find|show|list|look\s?up|fetch|ingest|upload|extract|create|seed|run|claim|claims|entity|entities|source|sources|thesis|theses|graph|substrate)\b/i;
  if (actionWords.test(text)) return true;
  return false;
}

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

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
  // Attached files: expand the extracted text into the user message right
  // away so the model sees the content on this turn without having to call
  // read_file first. Extraction is triggered synchronously here if still
  // pending — it's slower for the first message touching a file but means
  // "drop PDF + ask question" works in a single turn.
  const userContent: LlmContent[] = [{ type: "text", text: body.text }];
  const newSourceIds: string[] = [];
  for (const fid of body.attached_file_ids ?? []) {
    const result = await buildFilePreamble(c.env, fid);
    if (result?.preamble) userContent.push({ type: "text", text: result.preamble });
    // Only auto-cascade for sources that just got extracted on this turn —
    // re-attaching the same file later shouldn't re-run the pipeline.
    if (result?.sourceId && result.wasNewlyExtracted) newSourceIds.push(result.sourceId);
  }
  // Fire the analysis cascade in the background for any source that just
  // landed. Operator's chat response returns immediately; the cascade runs
  // ingestion_critic → claim_extraction and surfaces on /live as events.
  for (const sourceId of newSourceIds) {
    c.executionCtx.waitUntil(
      runCascade(c.env, { userId, sourceId, trigger: "auto_on_chat_attach" }),
    );
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
  const { toolsByName } = loadTools(c.env);
  const tool = toolsByName[toolRow.tool_name];
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

  const { tools: availableTools, toolsByName, graphEnabled } = loadTools(env);
  const systemPrompt = graphEnabled
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\n\n[Graph compartment disabled. Only CMS tools are available; if asked about claims/entities/sources/theses say "the graph is currently disabled" and offer to draft a post instead.]`;

  for (let iter = 0; iter < MAX_LOOP_ITERATIONS; iter++) {
    const messages = await loadConversationMessages(env.DB, conversationId);
    ping();

    const offerTools = shouldOfferTools(messages);
    const out = await streamLLM(
      env,
      {
        provider: "workers_ai",
        model: ORCHESTRATOR_MODEL,
        system: systemPrompt,
        messages,
        tools: offerTools ? toolDefinitionsForModel(availableTools) : [],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.05,
        ledger: { user_id: userId, operation_type: "workers_ai.chat" },
      },
      (chunk) => {
        if (chunk.delta) emit("message_delta", { text: chunk.delta });
      },
    );

    // Persist assistant message (text + tool_use blocks) after streaming completes.
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

    if (out.tool_uses.length === 0 || out.stop_reason !== "tool_use") {
      return; // end of turn
    }

    let blockedByConfirm = false;
    for (const tu of out.tool_uses) {
      const tool = toolsByName[tu.name];
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
      provider: "workers_ai",
      model: ORCHESTRATOR_MODEL,
      system: `${systemPrompt}\n\nYour previous tool calls did not find what the operator wanted. Respond now in plain text only — no more tool calls. Briefly say what you tried and suggest one concrete next step.`,
      messages,
      max_tokens: 600,
      temperature: 0.7,
      top_p: 0.9,
      repetition_penalty: 1.05,
      ledger: { user_id: userId, operation_type: "workers_ai.chat" },
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

interface FileRow {
  extraction_status: string;
  extracted_text: string | null;
  extracted_summary: string | null;
  original_filename: string;
  classification: string | null;
  created_source_id: string | null;
}

interface FilePreambleResult {
  preamble: string;
  sourceId: string | null;
  wasNewlyExtracted: boolean;
}

async function buildFilePreamble(
  env: AuthContext["Bindings"],
  fileId: string,
): Promise<FilePreambleResult | null> {
  let row = await one<FileRow>(
    env.DB,
    `SELECT extraction_status, extracted_text, extracted_summary, original_filename,
            classification, created_source_id
       FROM uploaded_files WHERE id = ?`,
    [fileId],
  );
  if (!row) return null;

  const originalFilename = row.original_filename;
  let wasNewlyExtracted = false;
  if (row.extraction_status === "pending" || row.extraction_status === "extracting") {
    try {
      await extractUpload(env, fileId);
      wasNewlyExtracted = true;
      row = await one<FileRow>(
        env.DB,
        `SELECT extraction_status, extracted_text, extracted_summary, original_filename,
                classification, created_source_id
           FROM uploaded_files WHERE id = ?`,
        [fileId],
      );
    } catch (err) {
      return {
        preamble: `<attached_file id="${fileId}" filename="${escapeAttr(originalFilename)}" extraction_failed="true">\n${(err as Error).message}\n</attached_file>`,
        sourceId: null,
        wasNewlyExtracted: false,
      };
    }
  }
  if (!row) return null;
  if (row.extraction_status !== "extracted") {
    return {
      preamble: `<attached_file id="${fileId}" filename="${escapeAttr(row.original_filename)}" extraction_status="${row.extraction_status}" />`,
      sourceId: row.created_source_id,
      wasNewlyExtracted: false,
    };
  }

  const summary = row.extracted_summary?.trim() ?? "";
  const text = row.extracted_text?.trim() ?? "";
  const attrs = [
    `id="${fileId}"`,
    `filename="${escapeAttr(row.original_filename)}"`,
    `classification="${row.classification ?? "other"}"`,
  ];
  if (row.created_source_id) attrs.push(`source_id="${row.created_source_id}"`);
  const lines = [`<attached_file ${attrs.join(" ")}>`];
  if (summary && summary !== text) lines.push(`Summary: ${summary}`, "");
  if (text) lines.push(text);
  lines.push("</attached_file>");
  return {
    preamble: lines.join("\n"),
    sourceId: row.created_source_id,
    wasNewlyExtracted,
  };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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
