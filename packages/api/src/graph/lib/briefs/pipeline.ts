// Output build pipeline — GRAPH-GROUNDED draft → mechanical verify → judge.
//
// v2.4 rewrite. The old pipeline asked the model to invent public-web URLs +
// quotes and then fetched those URLs to verify — which meant the model had to
// guess real quotes from memory, and nearly everything died on the verbatim
// check. The new pipeline grounds generation in the TYPED GRAPH (spec Part 5):
//
//   1. gather    — pull relevant nodes / quotes / assertions for the title
//   2. generate  — writer role drafts body_md + claims; each claim REFERENCES
//                  a stored quote by id ([q:...]) instead of inventing one
//   3. verify    — mechanical: quote id must exist; the server substitutes the
//                  stored verbatim text + source itself (the model cannot
//                  fabricate evidence). FIREWALL: assertion-backed claims
//                  without attribution are KILLED (spec Part 5, Part 10 #5).
//   4. judge     — independent model (different family) assesses support
//   5. persist   — brief_claims + briefs row; status -> draft for approval
//
// Sources are the operator's stored documents (public Library pages) — the
// receipts. No self-citing: the source is the document, never a generated page.

import { renderMarkdown } from "../../../cms/lib/render-post";
import type { Env } from "../../../env";
import { all, insertOne, one, run } from "../../../lib/d1";
import { callRole, modelForRole } from "../../../llm/router";

export interface BuildResult {
  briefId: string;
  claims_total: number;
  claims_verified: number;
  claims_killed: number;
  cost_cents: number;
  failed_step?: string;
  failed_reason?: string;
}

interface BriefRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  content_type: string;
  layer: string;
  why_proposed_md: string;
}

// What the model returns per claim. quote_id references the grounding pack.
interface DraftClaim {
  claim_text: string;
  quote_id: string;
  /** 'fact' (neutral) or 'assertion' (attributed/contested). */
  kind?: string;
  /** Required for kind='assertion' — who asserts it (the firewall). */
  asserted_by?: string;
}

// One grounded quote handed to the model and used for mechanical verification.
interface GroundingQuote {
  id: string;
  verbatim_text: string;
  byte_offset: number | null;
  node_label: string;
  node_kind: string;
  piece_slug: string | null;
  piece_title: string | null;
  /** For assertion nodes: the actor + stance + balance (firewall metadata). */
  asserted_by: string | null;
  stance: string | null;
  evidence_balance: number | null;
}

interface Grounding {
  quotes: Map<string, GroundingQuote>;
  factsBlock: string;
  assertionsBlock: string;
  threadsBlock: string;
}

export async function buildBrief(env: Env, briefId: string, userId: string): Promise<BuildResult> {
  const brief = await one<BriefRow>(
    env.DB,
    "SELECT id, user_id, slug, title, content_type, layer, why_proposed_md FROM briefs WHERE id = ? AND user_id = ?",
    [briefId, userId],
  );
  if (!brief) throw new Error(`Brief not found: ${briefId}`);

  await emit(env, userId, briefId, "build.started", { brief_slug: brief.slug });
  await run(
    env.DB,
    "UPDATE briefs SET status = 'building', build_started_at = ?, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), new Date().toISOString(), briefId],
  );

  const result: BuildResult = {
    briefId,
    claims_total: 0,
    claims_verified: 0,
    claims_killed: 0,
    cost_cents: 0,
  };

  // ---- 1. gather grounding from the typed graph ----
  await emit(env, userId, briefId, "build.gather.started", { brief_slug: brief.slug });
  const grounding = await gatherGrounding(env, userId, brief.title);
  if (grounding.quotes.size === 0) {
    result.failed_step = "gather";
    result.failed_reason =
      "no grounded material in the typed graph — extract documents in Library first";
    await fail(env, userId, briefId, "gather", result.failed_reason);
    return result;
  }
  await emit(env, userId, briefId, "build.gather.completed", {
    brief_slug: brief.slug,
    quotes: grounding.quotes.size,
  });

  // ---- 2. generate ----
  await emit(env, userId, briefId, "build.generate.started", { brief_slug: brief.slug });
  let drafted: { body_md: string; claims: DraftClaim[] };
  try {
    drafted = await generate(env, brief, grounding, userId);
    await emit(env, userId, briefId, "build.generate.completed", {
      brief_slug: brief.slug,
      claims_drafted: drafted.claims.length,
      body_chars: drafted.body_md.length,
    });
  } catch (err) {
    result.failed_step = "generate";
    result.failed_reason = (err as Error).message;
    await fail(env, userId, briefId, "generate", result.failed_reason);
    return result;
  }
  result.claims_total = drafted.claims.length;

  // ---- 3. mechanical verify against STORED quotes ----
  // The model only references quote ids; the server substitutes the verbatim
  // text + source. A claim whose quote_id doesn't exist is killed. An
  // assertion-backed claim with no attribution is killed (FIREWALL).
  await emit(env, userId, briefId, "build.verify.started", { brief_slug: brief.slug });
  interface VerifiedClaim {
    claim_text: string;
    source_url: string;
    source_quote: string;
    offset: number | null;
    kind: string;
    asserted_by: string | null;
  }
  const verifiedClaims: VerifiedClaim[] = [];
  const killedClaims: Array<{ claim_text: string; quote_id: string; reason: string }> = [];
  for (const c of drafted.claims) {
    const text = (c.claim_text ?? "").trim();
    if (!text) continue;
    const q = grounding.quotes.get((c.quote_id ?? "").trim());
    if (!q) {
      killedClaims.push({
        claim_text: text,
        quote_id: c.quote_id ?? "",
        reason: "quote id not in grounding — claim dropped (model fabricated a reference)",
      });
      continue;
    }
    const isAssertion = q.node_kind === "assertion" || c.kind === "assertion";
    const attribution = (c.asserted_by ?? q.asserted_by ?? "").trim();
    if (isAssertion && !attribution) {
      killedClaims.push({
        claim_text: text,
        quote_id: q.id,
        reason: "FIREWALL: assertion-backed claim without attribution — never rendered as fact",
      });
      continue;
    }
    verifiedClaims.push({
      claim_text: isAssertion && !text.includes(attribution) ? `${attribution}: ${text}` : text,
      source_url: q.piece_slug ? `/library/${q.piece_slug}` : "",
      source_quote: q.verbatim_text,
      offset: q.byte_offset,
      kind: isAssertion ? "assertion" : "fact",
      asserted_by: isAssertion ? attribution : null,
    });
  }
  result.claims_verified = verifiedClaims.length;
  result.claims_killed = killedClaims.length;
  await emit(env, userId, briefId, "build.verify.completed", {
    brief_slug: brief.slug,
    verified: verifiedClaims.length,
    killed: killedClaims.length,
  });

  // ---- 4. independent judge ----
  await emit(env, userId, briefId, "build.judge.started", { brief_slug: brief.slug });
  const judgedClaims: Array<VerifiedClaim & { judge_pass: 0 | 1; judge_notes: string }> = [];
  for (const v of verifiedClaims) {
    try {
      const judgement = await judgeClaim(env, v.claim_text, v.source_quote, userId);
      judgedClaims.push({ ...v, ...judgement });
    } catch (err) {
      judgedClaims.push({
        ...v,
        judge_pass: 0,
        judge_notes: `judge call failed: ${(err as Error).message}`,
      });
    }
  }
  const judgePassedCount = judgedClaims.filter((c) => c.judge_pass === 1).length;
  await emit(env, userId, briefId, "build.judge.completed", {
    brief_slug: brief.slug,
    passed: judgePassedCount,
    total: judgedClaims.length,
  });

  // ---- 5. persist claims + finalize ----
  await run(env.DB, "DELETE FROM brief_claims WHERE brief_id = ?", [briefId]);
  let order = 0;
  for (const v of judgedClaims) {
    await insertOne(env.DB, "brief_claims", {
      brief_id: briefId,
      user_id: userId,
      claim_text: v.claim_text,
      source_url: v.source_url,
      source_quote: v.source_quote,
      source_hash: null,
      source_offset: v.offset,
      verified: 1,
      killed: 0,
      judge_pass: v.judge_pass,
      judge_notes: v.judge_notes,
      kind: v.kind,
      asserted_by: v.asserted_by,
      sort_order: order++,
    });
  }
  for (const k of killedClaims) {
    await insertOne(env.DB, "brief_claims", {
      brief_id: briefId,
      user_id: userId,
      claim_text: k.claim_text,
      source_url: "",
      source_quote: "",
      source_hash: null,
      source_offset: null,
      verified: 0,
      killed: 1,
      kill_reason: k.reason,
      kind: "fact",
      asserted_by: null,
      sort_order: order++,
    });
  }

  await run(
    env.DB,
    `UPDATE briefs SET
        status = 'draft',
        body_md = ?,
        body_html = ?,
        claims_verified = ?,
        claims_killed = ?,
        cost_cents = ?,
        generate_model = ?,
        judge_model = ?,
        build_completed_at = ?,
        updated_at = ?
      WHERE id = ?`,
    [
      drafted.body_md,
      renderMarkdown(drafted.body_md),
      result.claims_verified,
      result.claims_killed,
      result.cost_cents,
      modelForRole("writer").model,
      modelForRole("judge").model,
      new Date().toISOString(),
      new Date().toISOString(),
      briefId,
    ],
  );

  await emit(env, userId, briefId, "build.completed", {
    brief_slug: brief.slug,
    verified: result.claims_verified,
    killed: result.claims_killed,
  });
  return result;
}

// ---- step impls ----------------------------------------------------------

/** Pull the grounding pack for a title from the typed graph: matching nodes,
 *  their stored quotes (with source piece), and the corpus's assertions with
 *  attribution + stance + evidence balance. */
async function gatherGrounding(env: Env, userId: string, title: string): Promise<Grounding> {
  const words = [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ),
  ].slice(0, 8);

  // Matching nodes by label keyword; fall back to most-recent if few match.
  const likeClauses = words.map(() => "lower(label) LIKE ?").join(" OR ");
  const likeBinds = words.map((w) => `%${w}%`);
  let nodes = words.length
    ? await all<{ id: string; kind: string; label: string; piece_id: string | null }>(
        env.DB,
        `SELECT id, kind, label, piece_id FROM nodes
          WHERE user_id = ? AND kind != 'source' AND (${likeClauses})
          ORDER BY created_at DESC LIMIT 60`,
        [userId, ...likeBinds],
      )
    : [];
  if (nodes.length < 5) {
    nodes = await all(
      env.DB,
      `SELECT id, kind, label, piece_id FROM nodes
        WHERE user_id = ? AND kind != 'source'
        ORDER BY created_at DESC LIMIT 60`,
      [userId],
    );
  }
  if (nodes.length === 0) {
    return { quotes: new Map(), factsBlock: "", assertionsBlock: "", threadsBlock: "" };
  }

  const nodeIds = nodes.map((n) => n.id);
  const ph = nodeIds.map(() => "?").join(",");

  // Quotes for those nodes, joined to the piece they came from.
  const quoteRows = await all<{
    id: string;
    node_id: string;
    verbatim_text: string;
    byte_offset: number | null;
  }>(
    env.DB,
    `SELECT id, node_id, verbatim_text, byte_offset FROM quotes
      WHERE user_id = ? AND node_id IN (${ph}) LIMIT 80`,
    [userId, ...nodeIds],
  );

  // Assertion metadata (stance, balance, actor label) for assertion nodes.
  const assertionMeta = await all<{
    node_id: string;
    stance: string;
    evidence_balance: number;
    actor_label: string | null;
  }>(
    env.DB,
    `SELECT a.node_id, a.stance, a.evidence_balance,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor_label
       FROM assertions a WHERE a.node_id IN (${ph})`,
    [...nodeIds],
  );
  const metaByNode = new Map(assertionMeta.map((m) => [m.node_id, m]));

  // Piece slugs for provenance links.
  const pieceIds = [...new Set(nodes.map((n) => n.piece_id).filter((x): x is string => !!x))];
  const pieceRows = pieceIds.length
    ? await all<{ id: string; slug: string; title: string }>(
        env.DB,
        `SELECT id, slug, title FROM pieces WHERE id IN (${pieceIds.map(() => "?").join(",")})`,
        [...pieceIds],
      )
    : [];
  const pieceById = new Map(pieceRows.map((p) => [p.id, p]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const quotes = new Map<string, GroundingQuote>();
  for (const q of quoteRows) {
    const n = nodeById.get(q.node_id);
    if (!n) continue;
    const piece = n.piece_id ? pieceById.get(n.piece_id) : undefined;
    const meta = metaByNode.get(q.node_id);
    quotes.set(q.id, {
      id: q.id,
      verbatim_text: q.verbatim_text,
      byte_offset: q.byte_offset,
      node_label: n.label,
      node_kind: n.kind,
      piece_slug: piece?.slug ?? null,
      piece_title: piece?.title ?? null,
      asserted_by: meta?.actor_label ?? null,
      stance: meta?.stance ?? null,
      evidence_balance: meta?.evidence_balance ?? null,
    });
  }

  // Open inquiry threads (context for interpretive intents).
  const threads = await all<{ question: string }>(
    env.DB,
    "SELECT question FROM inquiry_threads WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 10",
    [userId],
  );

  // Serialize for the prompt.
  const factLines: string[] = [];
  const assertionLines: string[] = [];
  for (const q of quotes.values()) {
    const src = q.piece_title ? ` (source: ${q.piece_title})` : "";
    if (q.node_kind === "assertion") {
      assertionLines.push(
        `[q:${q.id}] ASSERTION by ${q.asserted_by ?? "UNKNOWN ACTOR"} (stance: ${q.stance ?? "neutral"}, evidence balance: ${q.evidence_balance ?? 0}): "${q.node_label}" — quote: "${q.verbatim_text.slice(0, 300)}"${src}`,
      );
    } else {
      factLines.push(
        `[q:${q.id}] (${q.node_kind}) ${q.node_label} — quote: "${q.verbatim_text.slice(0, 300)}"${src}`,
      );
    }
  }
  // Nodes without quotes still inform the body (but can't back claims).
  const unquoted = nodes
    .filter((n) => ![...quotes.values()].some((q) => q.node_label === n.label))
    .slice(0, 30)
    .map((n) => `- (${n.kind}) ${n.label}`);

  return {
    quotes,
    factsBlock: `${factLines.join("\n")}\n\nAdditional graph context (no quotes — do NOT base claims on these):\n${unquoted.join("\n")}`,
    assertionsBlock: assertionLines.join("\n"),
    threadsBlock: threads.map((t) => `- ${t.question}`).join("\n"),
  };
}

async function generate(
  env: Env,
  brief: BriefRow,
  grounding: Grounding,
  userId: string,
): Promise<{ body_md: string; claims: DraftClaim[] }> {
  const system = systemPromptFor(brief.content_type, brief.layer);
  const out = await callRole(env, "writer", {
    userId,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Title: ${brief.title}
Content type: ${brief.content_type}
Why proposed: ${brief.why_proposed_md}

GROUNDED FACTS (each has a quote id you may cite):
${grounding.factsBlock}

ATTRIBUTED ASSERTIONS (contested material — NEVER state these as neutral fact; always name who asserts them):
${grounding.assertionsBlock || "(none)"}

OPEN INQUIRY THREADS (context):
${grounding.threadsBlock || "(none)"}

Draft the output. Return ONLY a JSON object:
{
  "body_md": "full markdown body (do NOT include the title as a heading)",
  "claims": [{ "claim_text": "...", "quote_id": "the id from [q:...]", "kind": "fact" or "assertion", "asserted_by": "actor name (REQUIRED when kind=assertion)" }]
}
Rules:
- Every claim's quote_id MUST be one of the [q:...] ids above. We verify mechanically; invented ids are dropped.
- Use ONLY the grounded material. Do not import outside knowledge as fact.
- 5-12 claims. Front-load the direct answer in the first 2 sentences of body_md.`,
          },
        ],
      },
    ],
    max_tokens: 3500,
    response_schema: {
      type: "object",
      properties: {
        body_md: { type: "string" },
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim_text: { type: "string" },
              quote_id: { type: "string" },
              kind: { type: "string" },
              asserted_by: { type: "string" },
            },
            required: ["claim_text", "quote_id"],
          },
        },
      },
      required: ["body_md", "claims"],
    },
  });

  const parsed = (out.structured ?? safeJsonParse(out.text)) as {
    body_md?: string;
    claims?: DraftClaim[];
  } | null;
  if (!parsed || typeof parsed.body_md !== "string") {
    throw new Error("generate: model returned unparseable output");
  }
  return {
    body_md: parsed.body_md,
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  };
}

function systemPromptFor(contentType: string, layer: string): string {
  const base = `You draft CANOPTICON outputs — citable reference pages grounded EXCLUSIVELY in the supplied graph material. Hard constraints:
- THE FIREWALL: an attributed assertion is NEVER stated as neutral fact. Contested material always names who asserts it ("According to X, ..."). Violating this is a stop-work bug.
- Facts in the top 30% of the body. Front-load a direct 1-2 sentence answer.
- 120-180 word section blocks. Statistics density where the grounding supports it.
- Question-shaped headings where natural.
- Plain English. No outside knowledge presented as fact.`;
  const interpretive = `
This is an INTERPRETIVE piece (layer: interpretive) — a SIGNED reading on top of the facts. You may reason, connect, and probe; but every factual anchor still cites a grounded quote, contested material stays attributed, and open questions are stated as open. State your analytical confidence (low/moderate/high) explicitly in the final section.`;
  const byType: Record<string, string> = {
    definition:
      "DEFINITION page. Lead with a canonical 1-paragraph definition (the first sentence IS the answer). Sections: Origin, Mechanism, Scale, Status.",
    comparison:
      "COMPARISON MATRIX. Mostly markdown tables comparing the subjects across structural axes. The table is the citation magnet.",
    timeline:
      "TIMELINE. A chronological list of dated events from the grounded material, each anchored to a quote id. Lead with 1-paragraph framing.",
    faq: "FAQ. 5-8 question-and-answer sections using questions humans and machines actually ask.",
    "stat-roundup":
      "STAT ROUNDUP. Every quantitative fact in the grounding as its own bullet with its quote id. Aim high on statistics density.",
    "entity-profile":
      "ENTITY / ACTOR PROFILE. Who/what the entity is (first sentence = the answer), attributes, relationships, what's asserted about them (attributed!), appearances across sources.",
    "claim-table":
      "CLAIM-AND-SOURCE TABLE. Each contested assertion as a row: the claim, who asserts it, stance, supporting/contradicting evidence — shown NEUTRALLY. This page is the firewall made visible.",
    investigation:
      "INVESTIGATION — an open skeptical probe. Are the asserted claims sound? What doesn't add up? May conclude OR remain open; unresolved questions are listed explicitly as open threads.",
    argument:
      "ARGUMENT / THESIS — a closed case. State the thesis, then build it strictly from grounded facts; engage the strongest counter-assertion (attributed) and answer it.",
    assessment:
      "ASSESSMENT — a probabilistic judgment. Enumerate competing explanations, weigh grounded evidence against EACH, conclude with an explicit likelihood + confidence statement.",
  };
  return `${base}${layer === "interpretive" ? interpretive : ""}\n\n${byType[contentType] ?? "Reference page over the grounded material."}`;
}

async function judgeClaim(
  env: Env,
  claimText: string,
  sourceQuote: string,
  userId: string,
): Promise<{ judge_pass: 0 | 1; judge_notes: string }> {
  const out = await callRole(env, "judge", {
    userId,
    system: `You are an independent fact-checker. You are NOT the model that drafted the claim — assess neutrally whether the verbatim quote actually supports the claim. Return JSON only: {"pass": boolean, "notes": string}. Be strict: a quote that mentions the topic but doesn't substantiate the claim → pass=false.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Claim:\n${claimText}\n\nVerbatim source quote:\n"${sourceQuote}"\n\nDoes the quote support the claim?`,
          },
        ],
      },
    ],
    max_tokens: 400,
    response_schema: {
      type: "object",
      properties: { pass: { type: "boolean" }, notes: { type: "string" } },
      required: ["pass", "notes"],
    },
  });
  const parsed = (out.structured ?? safeJsonParse(out.text)) as {
    pass?: boolean;
    notes?: string;
  } | null;
  return {
    judge_pass: parsed?.pass ? 1 : 0,
    judge_notes: parsed?.notes?.slice(0, 600) ?? "",
  };
}

// ---- helpers --------------------------------------------------------------

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

async function emit(
  env: Env,
  userId: string,
  briefId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: type,
    subject_kind: "brief",
    subject_id: briefId,
    payload,
  });
}

async function fail(
  env: Env,
  userId: string,
  briefId: string,
  step: string,
  reason: string,
): Promise<void> {
  await emit(env, userId, briefId, `build.${step}.failed`, { error: reason });
  await run(env.DB, "UPDATE briefs SET status = 'proposal', updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    briefId,
  ]);
}
