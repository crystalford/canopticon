// Brave Answers (AI Grounding) preview — never a fact source.
//
// POST /res/v1/chat/completions (Brave's AI Grounding product, OpenAI-
// chat-completions-compatible) returns a synthesized, LLM-written answer.
// It is NOT a verbatim quote from any stored document, so per the firewall
// this text can never enter the typed graph as a fact. It exists only to
// give a fast, clearly-labeled "here's roughly what's out there" preview
// while the real pipeline (Brave Search -> fetch -> verbatim extraction,
// the same one expandRecord/"Expand this file" already uses) does the
// actual verified work — see graph/lib/record-builder.ts.

import type { Env } from "../../env";
import { TIMEOUTS, fetchWithTimeout } from "../../lib/timeout";

const GROUNDING_ENDPOINT = "https://api.search.brave.com/res/v1/chat/completions";

export async function getAnswerPreview(env: Env, query: string): Promise<string | null> {
  if (!env.BRAVE_ANSWERS_API_KEY) return null;
  try {
    const res = await fetchWithTimeout(
      GROUNDING_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Subscription-Token": env.BRAVE_ANSWERS_API_KEY,
        },
        body: JSON.stringify({ stream: false, messages: [{ role: "user", content: query }] }),
      },
      TIMEOUTS.WEB_FETCH_MS,
      `brave-answers[${query}]`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
