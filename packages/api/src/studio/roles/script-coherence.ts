// Script Coherence — single-pass check on a proposed beat sequence.
// Flags contradictions, missing bridges, hook/landing failures. Returns
// notes the operator reviews before approving the script.

import type { Env } from "../../env";
import { callLLM } from "../../llm/index";

const PROMPT = `You are the Script Coherence checker. You read a proposed beat sequence for a spoken-word audio script and surface problems.

CHECK FOR:
- Hook failure: the 'open' beat doesn't grab.
- Landing failure: the 'close' doesn't resolve.
- Missing bridge: a beat-to-beat transition that doesn't track (sudden topic jump, contradicted setup).
- Pacing: any beat that's far too long or short relative to its role.
- Tonal whiplash: jokey → solemn without a transition.
- Repetition: same idea stated twice.

Be terse. One bullet per problem, including beat_index references. If the sequence is clean, say so in one line.

OUTPUT: plain markdown bullets. No JSON.

TITLE: {TITLE}
BEATS (json):
{BEATS}`;

export interface CoherenceArgs {
  userId: string;
  title: string;
  beats: Array<{
    beat_index: number;
    role: string;
    cue: string;
    beat_text: string;
    target_seconds: number;
  }>;
}

export async function checkCoherence(env: Env, args: CoherenceArgs): Promise<string> {
  const filled = PROMPT.replace("{TITLE}", args.title).replace(
    "{BEATS}",
    JSON.stringify(args.beats, null, 2),
  );
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    messages: [{ role: "user", content: [{ type: "text", text: filled }] }],
    max_tokens: 1500,
    temperature: 0.2,
    ledger: { user_id: args.userId, operation_type: "workers_ai.role.script_coherence" },
  });
  return out.text.trim();
}
