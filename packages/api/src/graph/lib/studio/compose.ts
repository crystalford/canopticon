// Studio script composer — generates beats from a source finding +
// medium + the operator's locked skeleton.
//
// Stage 1 only: produces a script (beats array). Stages 2 (audio) and 3
// (video/export) are deferred per the handoff.

import type { Env } from "../../../env";
import { one } from "../../../lib/d1";
import { callLLM } from "../../../llm/index";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MEDIUM_GUIDE: Record<string, string> = {
  "x-thread":
    "An X (Twitter) thread of 6–10 beats. Each beat ≤ 280 chars. Hook in beat 1; conclusion + share-prompt at the end.",
  tiktok:
    "A TikTok script of 5–8 beats. Each beat is a single line of spoken audio. Open with the hook; close with a question for the audience.",
  "video-essay":
    "A long-form video-essay script of 8–14 beats. Each beat is 2–4 sentences of voice-over with [B-roll: …] notes inline.",
  podcast:
    "A podcast monologue of 8–12 beats. Each beat is 3–6 sentences of conversational speech. Include 1–2 [SFX:] notes where natural.",
  "meme-brief":
    "A meme-brief of 4–6 beats. Each beat is a tight epigram (≤ 140 chars). Lead with the strongest line.",
  "book-chapter":
    "A book-chapter outline of 6–10 beats. Each beat is a section heading + a 2–3 sentence summary.",
};

export interface ComposeArgs {
  userId: string;
  title: string;
  medium: string;
  sourceTitle: string;
  sourceBody: string;
}

export async function composeScript(
  env: Env,
  args: ComposeArgs,
): Promise<{ beats: string[]; cost_cents: number }> {
  const skeleton = await one<{ beats_json: string; never_json: string }>(
    env.DB,
    "SELECT beats_json, never_json FROM studio_skeleton WHERE user_id = ?",
    [args.userId],
  );

  const skeletonBeats = parseJson<Array<{ n: number; text: string }>>(skeleton?.beats_json ?? "[]");
  const neverList = parseJson<string[]>(skeleton?.never_json ?? "[]");

  const guide = MEDIUM_GUIDE[args.medium] ?? MEDIUM_GUIDE["video-essay"] ?? "";

  const system = `You are CANOPTICON's Studio composer. You take a signed finding and produce a script in the operator's locked argument skeleton, applied to the requested medium.

The operator's skeleton (apply IN ORDER, one beat per skeleton step):
${
  skeletonBeats.length > 0
    ? skeletonBeats.map((b) => `  ${b.n}. ${b.text}`).join("\n")
    : "  (no skeleton locked yet — use a natural 5-beat flow: hook · context · the finding · the implication · close)"
}

Never:
${neverList.length > 0 ? neverList.map((n) => `  ✕ ${n}`).join("\n") : "  (no banned moves)"}

Medium guidance: ${guide}

Return ONLY a JSON object: {beats: [string, string, ...]} where each string is the script for one beat.`;

  const out = await callLLM(env, {
    provider: "workers_ai",
    model: MODEL,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Title: ${args.title}\n\nSource finding:\n${args.sourceTitle}\n\n${args.sourceBody.slice(0, 6000)}\n\nDraft the beats now.`,
          },
        ],
      },
    ],
    max_tokens: 3000,
    response_schema: {
      type: "object",
      properties: {
        beats: { type: "array", items: { type: "string" } },
      },
      required: ["beats"],
    },
    ledger: { user_id: args.userId, operation_type: "workers_ai.studio.compose" },
  });

  const parsed = (out.structured ?? safeJsonParse(out.text)) as { beats?: string[] };
  const beats = Array.isArray(parsed?.beats) ? parsed.beats : [];
  return { beats, cost_cents: out.cost_cents };
}

function parseJson<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return [] as unknown as T;
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
