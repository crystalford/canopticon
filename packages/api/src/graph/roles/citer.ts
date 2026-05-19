// Citer — turns substrate search hits into a grounded answer with
// [claim:ID] citations. Cheap routing-tier model (Llama 3.1 8B).
// Called from the chat agent's query_substrate tool handler.

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";

const CITER_PROMPT = `You answer the operator's question using ONLY the supplied substrate hits. Every load-bearing factual sentence must be followed by a [claim:ID] marker referencing one of the supplied claims.

RULES:
1. NEVER invent claim IDs. Use only IDs from the supplied hits.
2. NEVER paraphrase a claim's evidence_text — quote it when you need exactness.
3. If the supplied hits do not answer the question, say so plainly. Suggest one specific next thing the operator could do (ingest X, run role Y).
4. Short answers preferred. The operator skims.
5. No filler openers.

OUTPUT: 1-3 short paragraphs, plain markdown.`;

interface CiterHit {
  id: string;
  text: string;
  evidence_text?: string;
  source_title?: string;
  kind: "claim" | "entity" | "thesis" | "article" | "source";
}

export interface CiterArgs {
  userId: string;
  question: string;
  hits: CiterHit[];
}

export async function cite(env: Env, args: CiterArgs): Promise<string> {
  if (args.hits.length === 0) {
    return "Nothing in the substrate matches that. Try ingesting a source first.";
  }
  const body = [
    "--- OPERATOR QUESTION ---",
    args.question,
    "",
    "--- SUBSTRATE HITS ---",
    JSON.stringify(args.hits, null, 2),
  ].join("\n");

  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    system: CITER_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: body }] }],
    max_tokens: 1200,
    temperature: 0.3,
    ledger: { user_id: args.userId, operation_type: "workers_ai.role.citer" },
  });
  return out.text;
}
