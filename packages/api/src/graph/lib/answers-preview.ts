// Search-miss "quick take" preview — operator-only research triage.
//
// A fast, clearly-labeled "here's roughly what's out there" preview shown
// when an operator's search comes up empty, to help decide whether it's
// worth a full expand (Search + fetch + verbatim extraction). It is an
// LLM's own synthesis, NOT a verbatim quote from any stored document, so
// per the firewall this text can never enter the typed graph as a fact —
// see graph/lib/record-builder.ts for the real, verified pipeline.
//
// Previously called Brave's "Answers" (AI Grounding) product — a separate
// metered 3rd-party API from Brave Search. That billed per call with no
// visible payoff (the preview isn't shown to public visitors, only
// operators triaging a miss) and blew through its monthly cap in days.
// Workers AI is already the account's inference bill for everything else
// this system does — same "writer" role used for output drafting — so
// this is one Cloudflare invoice instead of an assortment of vendor ones.
import type { Env } from "../../env";
import { callRole } from "../../llm/router";

export async function getAnswerPreview(
  env: Env,
  userId: string,
  query: string,
): Promise<string | null> {
  try {
    const result = await callRole(env, "writer", {
      userId,
      system:
        "Answer the user's question in 2-4 plain sentences from general knowledge. " +
        "No citations, no markdown, no hedging disclaimers — just the answer.",
      messages: [{ role: "user", content: [{ type: "text", text: query }] }],
      max_tokens: 300,
      idempotency_key: `search-preview:${userId}:${query}`,
    });
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}
