// Synthesist — composes a publication draft from selected claim_ids.
//
// Two prompt variants: article mode (a regular post) and thesis mode
// (forensic, four-layer decomposition + coined phrase + methodology
// hooks). Both forbid paraphrasing claim text — the Synthesist composes
// around verbatim quotes pulled from D1 by claim ID. Citations are
// emitted as `[claim:ID]` markers; the renderer turns those into
// clickable chips.
//
// Default model: Llama 3.3 70B. Operator can opt-in to Claude Sonnet 4.6
// via AI Gateway for higher-quality prose (synth_quality > cost).

import type { Env } from "../../env";
import { all } from "../../lib/d1";
import { callLLM } from "../../llm/index";

const ARTICLE_PROMPT = `You are the Synthesist. You compose publishable articles from a curated set of grounded claims provided by the operator.

ABSOLUTE RULES:
1. Every factual assertion in the article MUST come from one of the supplied claims. Paraphrasing is allowed for transitions, framing, and structure. NEVER paraphrase a claim's evidence_text.
2. Cite every load-bearing claim inline using [claim:ID] markers. The renderer turns these into clickable chips on the public site.
3. Use the verbatim evidence_text from a claim as a direct quotation when the prose calls for one. Mark quotes clearly.
4. Preserve hedged language. If a claim has stance='hedged', the article must hedge too.
5. Write in plain English. Avoid jargon. The reader is curious and educated but not a specialist.

STRUCTURE:
- Open with a 1-paragraph framing (what this is about, why it matters).
- Body paragraphs each carry one main idea, each grounded in 1-3 claims.
- Close with a forward-looking line that names what's still uncertain.

VOICE:
- Senior analyst talking to a peer. Direct, warm, a little opinionated.
- No corporate filler ("Certainly!", "Of course!"). No hype.
- Short, clear sentences. One idea per sentence when you can.

OUTPUT: pure markdown. Title is supplied by the operator — do NOT include a leading H1.

Working title: {TITLE}

Supplied claims (use only these as the factual substrate):
{CLAIMS}`;

const THESIS_PROMPT = `You are the Synthesist composing a forensic-grade thesis. This is a different shape from a regular article — it must pass the CANOPTICON undismissability gates: a coined phrase, four-layer decomposition, banked predictions, methodology appendix structure.

ABSOLUTE RULES:
1. Every factual assertion MUST come from one of the supplied claims. Cite with [claim:ID].
2. Open with a one-sentence BLUF (Bottom Line Up Front) stating the thesis plainly.
3. Then four layers, each a section:
   - What's documented (factual claims)
   - How it's framed (framing claims — language being used by stakeholders)
   - How it's wired (architectural claims — structural pattern)
   - Who pays, who gains (distributive claims — incidence, timing)
4. Introduce a coined phrase if the supplied thesis_statement gives you one — make it the name for the structural pattern in section 3.
5. End with a "Methodology" subsection listing the rough evidence base (counts) and any known limits.
6. Hedged claims stay hedged. Don't strengthen them.

VOICE: forensic register but readable. The reader is a Canadian citizen who reads The Walrus, not a quant.

OUTPUT: pure markdown, no leading H1.

Working title: {TITLE}
Thesis statement (one sentence): {THESIS}

Supplied claims:
{CLAIMS}`;

interface ClaimRow {
  id: string;
  text: string;
  evidence_text: string;
  claim_type: string;
  layer: string | null;
  source_title?: string | null;
  source_author?: string | null;
  source_url?: string | null;
}

export interface SynthesizeArgs {
  userId: string;
  workingTitle: string;
  thesisStatement?: string;
  claimIds: string[];
  mode: "article" | "thesis";
  useAnthropic?: boolean;
}

export async function synthesize(env: Env, args: SynthesizeArgs): Promise<string> {
  if (args.claimIds.length === 0) return "";
  const placeholders = args.claimIds.map(() => "?").join(",");
  const claims = await all<ClaimRow>(
    env.DB,
    `SELECT c.id, c.text, c.evidence_text, c.claim_type, c.layer,
            s.title AS source_title, s.url AS source_url
       FROM claims c LEFT JOIN sources s ON s.id = c.source_id
      WHERE c.id IN (${placeholders})`,
    args.claimIds,
  );

  const template = args.mode === "thesis" ? THESIS_PROMPT : ARTICLE_PROMPT;
  const filled = template
    .replace("{TITLE}", args.workingTitle)
    .replace("{THESIS}", args.thesisStatement ?? "")
    .replace("{CLAIMS}", JSON.stringify(claims, null, 2));

  const out = await callLLM(env, {
    provider: args.useAnthropic ? "anthropic" : "workers_ai",
    model: args.useAnthropic ? "claude-sonnet-4-6" : "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    messages: [{ role: "user", content: [{ type: "text", text: filled }] }],
    max_tokens: 8000,
    temperature: 0.7,
    ledger: {
      user_id: args.userId,
      operation_type: args.useAnthropic
        ? "anthropic.role.synthesist"
        : "workers_ai.role.synthesist",
    },
  });
  return out.text;
}
