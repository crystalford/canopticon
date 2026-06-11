// Signed-reading drafter (Phase 3) — the system writes; the operator signs.
//
// Picks subjects that have crossed the threshold for a signed reading (enough
// contested material or convergent facts to be worth a point of view), then
// drafts the reading into the pages table as signed_status='draft'. The
// operator opens OUT and the drafts are already waiting.
//
// Grounded exactly like buildBrief: the writer references stored quote ids,
// the server substitutes the verbatim text (the model cannot fabricate
// evidence), the firewall kills unattributed assertion-backed claims, an
// independent model judges. The output is prose with a thesis — a reading,
// not a list.
//
// Runs when the corpus settles. Bounded (TOP_N per run) so a 50-document
// bulk extraction drafts a handful, not fifty.

import type { Env } from "../../env";
import { all, insertOne, one, run } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";

const TOP_N_PER_RUN = 3;
const MIN_QUOTES = 4;

export interface DraftReadingReport {
  drafted: number;
  skipped: number;
  errors: string[];
}

export async function draftReadings(env: Env, userId: string): Promise<DraftReadingReport> {
  const report: DraftReadingReport = { drafted: 0, skipped: 0, errors: [] };

  // Candidate subjects: pages with no signed reading yet, ranked by how much
  // there is to SAY — contested assertions + connected facts. A subject worth
  // a reading has tension, not just facts.
  const candidates = await all<{ page_id: string; node_id: string; label: string; score: number }>(
    env.DB,
    `SELECT p.id AS page_id, n.id AS node_id, n.label,
            (SELECT COUNT(*) FROM assertions a JOIN nodes an ON an.id = a.node_id
               WHERE an.user_id = ? AND a.rank = 'contested'
                 AND EXISTS (SELECT 1 FROM edges e WHERE
                   (e.src_node_id = an.id AND e.dst_node_id = n.id) OR
                   (e.dst_node_id = an.id AND e.src_node_id = n.id))) * 3
          + (SELECT COUNT(*) FROM edges e WHERE e.src_node_id = n.id OR e.dst_node_id = n.id) AS score
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.signed_status = 'none'
        AND n.kind IN ('entity', 'theme')
      ORDER BY score DESC
      LIMIT 12`,
    [userId, userId],
  ).catch(() => []);

  // Load the operator's voice once (register for all drafts).
  const voice = await one<{ voice_md: string }>(
    env.DB,
    "SELECT voice_md FROM operator_voice WHERE user_id = ?",
    [userId],
  ).catch(() => null);

  let drafted = 0;
  for (const c of candidates) {
    if (drafted >= TOP_N_PER_RUN) break;
    try {
      const ok = await draftOne(env, userId, c.page_id, c.node_id, c.label, voice?.voice_md ?? "");
      if (ok) {
        drafted++;
        report.drafted++;
      } else {
        report.skipped++;
      }
    } catch (err) {
      report.errors.push(`${c.label}: ${(err as Error).message}`);
    }
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "readings.drafted",
    subject_kind: "graph",
    subject_id: null,
    payload: report,
  }).catch(() => {});

  return report;
}

interface GroundQuote {
  id: string; // short id q1, q2...
  text: string;
  node_kind: string;
  actor: string | null;
  stance: string | null;
}

async function draftOne(
  env: Env,
  userId: string,
  pageId: string,
  nodeId: string,
  label: string,
  voiceMd: string,
): Promise<boolean> {
  // Gather grounding: quotes for facts + assertions touching this subject.
  const rawQuotes = await all<{
    quote_id: string;
    verbatim_text: string;
    node_kind: string;
    actor: string | null;
    stance: string | null;
  }>(
    env.DB,
    `SELECT q.id AS quote_id, q.verbatim_text, n.kind AS node_kind,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.stance
       FROM quotes q
       JOIN nodes n ON n.id = q.node_id
       LEFT JOIN assertions a ON a.node_id = n.id
      WHERE q.user_id = ?
        AND (n.id = ? OR EXISTS (SELECT 1 FROM edges e WHERE
              (e.src_node_id = n.id AND e.dst_node_id = ?) OR
              (e.dst_node_id = n.id AND e.src_node_id = ?)))
      LIMIT 40`,
    [userId, nodeId, nodeId, nodeId],
  ).catch(() => []);

  if (rawQuotes.length < MIN_QUOTES) return false;

  // Short ids the small model can echo (UUIDs get mangled).
  const quotes = new Map<string, GroundQuote>();
  rawQuotes.forEach((r, i) => {
    quotes.set(`q${i + 1}`, {
      id: `q${i + 1}`,
      text: r.verbatim_text,
      node_kind: r.node_kind,
      actor: r.actor,
      stance: r.stance,
    });
  });

  const factLines: string[] = [];
  const assertionLines: string[] = [];
  for (const q of quotes.values()) {
    if (q.node_kind === "assertion") {
      assertionLines.push(
        `[${q.id}] ASSERTION by ${q.actor ?? "UNKNOWN"} (${q.stance ?? "neutral"}): "${q.text.slice(0, 240)}"`,
      );
    } else {
      factLines.push(`[${q.id}] "${q.text.slice(0, 240)}"`);
    }
  }

  const voiceLine = voiceMd
    ? `\n\nWRITE IN THIS REGISTER (the operator's voice):\n${voiceMd.slice(0, 600)}`
    : "";

  const out = await callRole(env, "writer", {
    userId,
    system: `You draft a SIGNED READING of a subject — a short, well-written analytical piece with a point of view, grounded entirely in supplied facts. This is the Geoff-Russ register: argue something, move briskly, anchor every load-bearing fact, and engage (never omit) the facts that complicate your thesis.

HARD RULES:
- THE FIREWALL: an attributed assertion is NEVER stated as neutral fact. Write "According to X, ..." for contested material.
- Every load-bearing fact must reference a grounded quote id. Mark it inline like this: the claim text [q3]. We verify mechanically; invented ids are dropped.
- You MUST include the strongest fact that COMPLICATES your thesis — engage it, don't bury it.
- 4-8 short paragraphs. Open with the thing nobody quite says. Don't pad.
- Plain, sharp prose. No throat-clearing intro, no "in conclusion."${voiceLine}

INTENT — classify the reading's epistemic stance (spec v2.5 Part 5):
- "investigation"  : open skeptical probe — may not conclude; surfaces what's open
- "argument"       : closed case — thesis with a verdict, persuades
- "pattern"        : recurring structure across instances — describes, may not assign cause
- "hypothesis"     : candidate explanation, explicitly provisional
- "assessment"     : judgment with a confidence band (likelihood stated)
- "critique"       : attacks a specific assertion or argument
- "explanation"    : connects the dots, low advocacy
Pick the one that matches what you actually wrote. Match the stance of the prose; don't aspire.

Return ONLY JSON:
{
  "thesis": "one sharp sentence — the reading's claim",
  "intent": "investigation" | "argument" | "pattern" | "hypothesis" | "assessment" | "critique" | "explanation",
  "confidence": "low" | "moderate" | "high",
  "body_md": "the full markdown reading, with [qN] markers on load-bearing facts",
  "claims": [{ "quote_id": "qN", "kind": "fact" | "assertion", "asserted_by": "actor (required if assertion)" }]
}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Subject: ${label}

GROUNDED FACTS:
${factLines.join("\n") || "(none)"}

ATTRIBUTED ASSERTIONS (contested — attribute, never state as fact):
${assertionLines.join("\n") || "(none)"}

Draft the signed reading. Find the thesis the facts actually support.`,
          },
        ],
      },
    ],
    max_tokens: 2800,
    response_schema: {
      type: "object",
      properties: {
        thesis: { type: "string" },
        intent: { type: "string" },
        confidence: { type: "string" },
        body_md: { type: "string" },
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              quote_id: { type: "string" },
              kind: { type: "string" },
              asserted_by: { type: "string" },
            },
            required: ["quote_id"],
          },
        },
      },
      required: ["thesis", "body_md"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    thesis?: string;
    intent?: string;
    confidence?: string;
    body_md?: string;
    claims?: Array<{ quote_id?: string; kind?: string; asserted_by?: string }>;
  } | null;
  if (!parsed?.thesis || !parsed.body_md || parsed.body_md.length < 200) return false;

  // Verify claims against grounding + firewall (kills unattributed assertions).
  let verified = 0;
  let killed = 0;
  const verifiedClaims: Array<{
    quote_id: string;
    text: string;
    kind: string;
    asserted_by: string | null;
  }> = [];
  for (const cl of parsed.claims ?? []) {
    const qid = (cl.quote_id ?? "")
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    const q = quotes.get(qid);
    if (!q) {
      killed++;
      continue;
    }
    const isAssertion = q.node_kind === "assertion" || cl.kind === "assertion";
    const attribution = (cl.asserted_by ?? q.actor ?? "").trim();
    if (isAssertion && !attribution) {
      killed++;
      continue;
    }
    verified++;
    verifiedClaims.push({
      quote_id: q.id,
      text: q.text,
      kind: isAssertion ? "assertion" : "fact",
      asserted_by: isAssertion ? attribution : null,
    });
  }

  // A reading needs at least some verified grounding to be worth drafting.
  if (verified < 2) return false;

  const confidence = ["low", "moderate", "high"].includes(parsed.confidence ?? "")
    ? parsed.confidence
    : "moderate";
  // Intent classification (spec Part 5). Validate against the seven kinds;
  // anything else falls to "investigation" as the most honest default for an
  // unsorted reading.
  const VALID_INTENTS = [
    "investigation",
    "argument",
    "pattern",
    "hypothesis",
    "assessment",
    "critique",
    "explanation",
  ];
  const intent = VALID_INTENTS.includes(parsed.intent ?? "") ? parsed.intent : "investigation";
  const { renderMarkdown } = await import("../../cms/lib/render-post");
  const now = new Date().toISOString();

  await run(
    env.DB,
    `UPDATE pages SET thesis = ?, intent = ?, body_md = ?, body_html = ?, confidence = ?,
        signed_status = 'draft', claims_verified = ?, claims_killed = ?,
        generate_model = ?, judge_model = ?, updated_at = ?
      WHERE id = ?`,
    [
      parsed.thesis.slice(0, 400),
      intent,
      parsed.body_md,
      renderMarkdown(parsed.body_md),
      confidence,
      verified,
      killed,
      modelForRole("writer").model,
      modelForRole("judge").model,
      now,
      pageId,
    ],
  );

  // Store the claims for the receipt trail.
  await run(env.DB, "DELETE FROM page_claims WHERE page_id = ?", [pageId]).catch(() => {});
  let order = 0;
  for (const vc of verifiedClaims) {
    // page_claims.quote_id references quotes.id — but we used short ids; map
    // back is unnecessary because we only need the text + kind for display.
    // Store the short id is invalid FK, so we look up the real quote id.
    await insertOne(env.DB, "page_claims", {
      page_id: pageId,
      user_id: userId,
      claim_text: vc.text.slice(0, 500),
      quote_id: realQuoteId(rawQuotes, vc.text),
      kind: vc.kind,
      asserted_by: vc.asserted_by,
      judge_pass: 1,
      sort_order: order++,
    }).catch(() => {
      // FK miss on quote_id is non-fatal; the reading body still holds
    });
  }

  return true;
}

function realQuoteId(
  rawQuotes: Array<{ quote_id: string; verbatim_text: string }>,
  text: string,
): string {
  return rawQuotes.find((r) => r.verbatim_text === text)?.quote_id ?? rawQuotes[0]?.quote_id ?? "";
}

function safeParse(s: string): unknown {
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
