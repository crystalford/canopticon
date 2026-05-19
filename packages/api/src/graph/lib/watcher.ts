// Watcher: a stripped-down agent loop that runs autonomously on a
// schedule against a single monitor. No SSE, no client, no confirm flow.
// The agent fetches the source URL, judges novelty against the existing
// substrate, only ingests genuinely new content via create_source (which
// auto-fires the cascade), and emits a finding event for the Live screen.

import type { Env } from "../../env";
import { insertOne, one, run } from "../../lib/d1";
import { callLLM } from "../../llm/index";
import type { LlmContent, LlmMessage, LlmToolDef } from "../../llm/types";
import { TOOLS_BY_NAME, type ToolDef } from "../tools/index";

const WATCHER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_LOOP_ITERATIONS = 8;

// Curated subset of the chat tool registry. note_finding is the only
// watcher-specific tool; everything else is reused.
const WATCHER_TOOL_NAMES = [
  "fetch_url",
  "search_substrate",
  "create_source",
  "note_finding",
] as const;

interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  source_url: string;
  scout_prompt: string;
}

export interface WatcherResult {
  status: "found_new" | "no_change" | "failed";
  finding_summary: string | null;
  new_source_id: string | null;
  error?: string;
}

const PREAMBLE = `You are an autonomous monitor agent for the Canopticon operator. You run on a schedule; the operator is not watching this loop live. Your job is to check ONE source URL for a new item matching the operator's scout prompt, judge whether that item is genuinely new and significant, and act accordingly.

Rules:
1. Call fetch_url(source_url) FIRST to see what's on the page right now.
2. Identify the most recent item matching the scout prompt — usually the topmost dated entry.
3. Call search_substrate(q=<item title or URL>) to confirm whether the item is already in the substrate. If you find a matching source, you're DONE — call note_finding(kind="no_change", summary="already in substrate") and stop.
4. If the item is genuinely new, fetch its full text via fetch_url(item URL), then call create_source(...) with the content. The cascade will auto-fire — you do NOT need to call run_role or start_cascade.
5. After ingesting, search_substrate for the PRIOR readout/letter of the same kind (one back). Compare language. Call note_finding(kind="language_shift", summary=<one paragraph: what's new, what dropped, what's notable>).
6. Be terse. Be precise. No filler. Stop the loop as soon as your job is done.

If the page is empty, malformed, or nothing matches the scout prompt, call note_finding(kind="no_match", summary=<reason>) and stop.`;

export async function runWatcher(env: Env, monitorId: string): Promise<WatcherResult> {
  const monitor = await one<MonitorRow>(
    env.DB,
    "SELECT id, user_id, name, source_url, scout_prompt FROM monitors WHERE id = ?",
    [monitorId],
  );
  if (!monitor)
    return {
      status: "failed",
      finding_summary: null,
      new_source_id: null,
      error: "monitor not found",
    };

  await run(env.DB, "UPDATE monitors SET last_status = 'running', last_run_at = ? WHERE id = ?", [
    new Date().toISOString(),
    monitorId,
  ]);

  await insertOne(env.DB, "orchestrator_events", {
    user_id: monitor.user_id,
    event_type: "watcher.started",
    subject_kind: "monitor",
    subject_id: monitorId,
    payload: { name: monitor.name, source_url: monitor.source_url },
  });

  const systemPrompt = `${PREAMBLE}\n\n--- THIS MONITOR ---\n\nName: ${monitor.name}\nSource URL: ${monitor.source_url}\n\nScout prompt:\n${monitor.scout_prompt}`;

  const messages: LlmMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Check ${monitor.source_url} now. Follow the rules in your system prompt exactly.`,
        },
      ],
    },
  ];

  const tools: LlmToolDef[] = WATCHER_TOOL_NAMES.filter((n) => TOOLS_BY_NAME[n]).map(toLlmTool);

  let foundNewSourceId: string | null = null;
  let findingSummary: string | null = null;
  let findingKind: string | null = null;

  try {
    for (let iter = 0; iter < MAX_LOOP_ITERATIONS; iter++) {
      const out = await callLLM(env, {
        provider: "workers_ai",
        model: WATCHER_MODEL,
        system: systemPrompt,
        messages,
        tools,
        max_tokens: 1200,
        temperature: 0.4,
        top_p: 0.9,
        ledger: { user_id: monitor.user_id, operation_type: "workers_ai.watcher" },
      });

      const assistantContent: LlmContent[] = [];
      if (out.text) assistantContent.push({ type: "text", text: out.text });
      for (const tu of out.tool_uses) {
        assistantContent.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
      }
      messages.push({ role: "assistant", content: assistantContent });

      if (out.tool_uses.length === 0 || out.stop_reason !== "tool_use") break;

      const toolResults: LlmContent[] = [];
      for (const tu of out.tool_uses) {
        const tool = TOOLS_BY_NAME[tu.name];
        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            output: `Unknown tool: ${tu.name}`,
            is_error: true,
          });
          continue;
        }
        try {
          const result = await tool.exec(
            { env, userId: monitor.user_id, conversationId: "" },
            tu.input,
          );
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, output: result.output });
          // Capture watcher-specific outcomes.
          if (tu.name === "create_source") {
            const created = result.side_effects.find((s) => s.kind === "source");
            if (created) foundNewSourceId = created.id;
          }
          if (tu.name === "note_finding") {
            findingKind = String(tu.input.kind ?? "");
            findingSummary = String(tu.input.summary ?? "");
          }
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            output: (err as Error).message ?? "tool failure",
            is_error: true,
          });
        }
      }
      messages.push({ role: "tool", content: toolResults });
    }

    const status: WatcherResult["status"] =
      foundNewSourceId !== null
        ? "found_new"
        : findingKind === "language_shift" ||
            findingKind === "no_change" ||
            findingKind === "no_match"
          ? "no_change"
          : "no_change";

    await run(
      env.DB,
      `UPDATE monitors
          SET last_status = ?, last_finding = ?, last_source_id = COALESCE(?, last_source_id),
              updated_at = ?
        WHERE id = ?`,
      [status, findingSummary, foundNewSourceId, new Date().toISOString(), monitorId],
    );

    await insertOne(env.DB, "orchestrator_events", {
      user_id: monitor.user_id,
      event_type: status === "found_new" ? "watcher.found_new" : "watcher.no_change",
      subject_kind: "monitor",
      subject_id: monitorId,
      payload: {
        name: monitor.name,
        finding_kind: findingKind,
        finding_summary: findingSummary,
        new_source_id: foundNewSourceId,
      },
    });

    return {
      status,
      finding_summary: findingSummary,
      new_source_id: foundNewSourceId,
    };
  } catch (err) {
    const message = (err as Error).message ?? "watcher failed";
    await run(
      env.DB,
      "UPDATE monitors SET last_status = 'failed', last_finding = ?, updated_at = ? WHERE id = ?",
      [message, new Date().toISOString(), monitorId],
    );
    await insertOne(env.DB, "orchestrator_events", {
      user_id: monitor.user_id,
      event_type: "watcher.failed",
      subject_kind: "monitor",
      subject_id: monitorId,
      payload: { name: monitor.name, error: message },
    });
    return { status: "failed", finding_summary: null, new_source_id: null, error: message };
  }
}

function toLlmTool(name: string): LlmToolDef {
  const t = TOOLS_BY_NAME[name] as ToolDef;
  return { name: t.name, description: t.description, input_schema: t.input_schema };
}
