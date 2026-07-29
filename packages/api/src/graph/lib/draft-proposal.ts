// Proposal drafter (fabric redesign Phase 7) — the third fabric layer.
// Facts (neutral) -> Signed Analysis (interpretive, is/was/means) ->
// Proposal (prescriptive, should/ought to). A Proposal is a SEPARATE
// signed artifact, not a reading's thesis restated: the axis that
// distinguishes it from Analysis is grammatical mood, not topic or
// novelty — does the core claim describe reality or prescribe action.
//
// On-demand only, inside the operator's own request — no cron/settle
// involvement, matching draftReadingForSubject's precedent (autonomous
// drafting was deliberately removed from this codebase once already).
// Grounds on the subject's signed Analysis when one exists (its body_md +
// page_claims — a Proposal is explicitly built to argue FROM an existing
// reading, not re-derive everything from raw quotes); otherwise grounds
// directly on established + corroborated (rank='preferred') facts, same
// discipline as draft-reading.ts's own grounding query.
//
// Same non-negotiable gate as everywhere else: drafts land as
// status='draft', only an explicit operator sign action publishes.

import type { Env } from "../../env";
import { all, insertOne, one } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";
import { judgeClaim } from "./briefs/pipeline";
import { applyCitationMarkers, extractClaimSentence } from "./draft-reading";

const MIN_GROUNDING_ITEMS = 3;

export interface DraftProposalResult {
  ok: boolean;
  reason?: string;
  proposalId?: string;
}

interface GroundClaim {
  id: string; // short id c1, c2...
  text: string;
  kind: "fact" | "assertion";
  actor: string | null;
  quoteId: string; // always a real quotes.id — citation links resolve here, never to a page_claims id
  sourcePageClaimId: string | null; // set only when grounded via an existing Analysis claim
}

export async function draftProposalForSubject(
  env: Env,
  userId: string,
  subjectNodeId: string,
  subjectLabel: string,
  angleHint?: string,
): Promise<DraftProposalResult> {
  const grounding = await loadGrounding(env, userId, subjectNodeId);
  if (grounding.claims.size < MIN_GROUNDING_ITEMS) {
    return {
      ok: false,
      reason: `not enough grounded material on ${subjectLabel} yet for a proposal (needs at least ${MIN_GROUNDING_ITEMS} verified facts, assertions, or analysis claims)`,
    };
  }

  const factLines: string[] = [];
  const assertionLines: string[] = [];
  for (const c of grounding.claims.values()) {
    if (c.kind === "assertion") {
      assertionLines.push(
        `[${c.id}] ASSERTION by ${c.actor ?? "UNKNOWN"}: "${c.text.slice(0, 240)}"`,
      );
    } else {
      factLines.push(`[${c.id}] "${c.text.slice(0, 240)}"`);
    }
  }

  const angleLine = angleHint?.trim()
    ? `\n\nTHE OPERATOR ASSIGNED THIS ANGLE — build the proposal around it if the facts support it: "${angleHint.trim().slice(0, 400)}"\nIf the facts DON'T support a proposal along these lines, say so and decline rather than forcing one.`
    : "";
  const analysisLine = grounding.analysisThesis
    ? `\n\nThe subject already carries a signed Analysis with this thesis: "${grounding.analysisThesis}"\nYour proposal should build on that reading, not restate it — a proposal argues what should happen NEXT, given what the analysis established.`
    : "";

  const out = await callRole(env, "writer", {
    userId,
    system: `You draft a PROPOSAL — a short, well-written piece that argues what SHOULD happen, grounded entirely in supplied facts. This is the third fabric layer: Facts (neutral) -> Signed Analysis (interpretive: is/was/means) -> Proposal (prescriptive: should/ought to).

THE TEST THAT MATTERS MOST: a Proposal's core claim must be prescriptive — it recommends an action or a change, not just a bold or novel description of reality. "X caused Y" is an Analysis claim, however striking. "X should be required to do Y" is a Proposal claim. If the grounded facts only support a descriptive thesis, DECLINE — do not force a prescriptive frame onto material that doesn't warrant one.

HARD RULES:
- THE FIREWALL: an attributed assertion is NEVER stated as neutral fact.
- Every load-bearing fact must reference a grounded claim id. Mark it inline like this: the claim text [c3]. We verify mechanically; invented ids are dropped.
- The thesis MUST use should/ought/needs to/must language or equivalent — not is/was/means.
- 3-6 short paragraphs. Plain, sharp prose. No throat-clearing, no "in conclusion."${analysisLine}${angleLine}

Return ONLY JSON:
{
  "eligible": true | false,
  "decline_reason": "if eligible is false, why — e.g. the facts only support a descriptive reading, not a prescriptive one",
  "thesis": "one sharp should/ought sentence — the proposal's claim",
  "confidence": "low" | "moderate" | "high",
  "body_md": "the full markdown proposal, with [cN] markers on load-bearing facts",
  "claims": [{ "claim_id": "cN", "kind": "fact" | "assertion", "asserted_by": "actor (required if assertion)" }]
}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Subject: ${subjectLabel}

GROUNDED FACTS:
${factLines.join("\n") || "(none)"}

ATTRIBUTED ASSERTIONS (attribute, never state as fact):
${assertionLines.join("\n") || "(none)"}

Draft the proposal, or decline if nothing here genuinely supports a prescriptive claim.`,
          },
        ],
      },
    ],
    max_tokens: 2200,
    response_schema: {
      type: "object",
      properties: {
        eligible: { type: "boolean" },
        decline_reason: { type: "string" },
        thesis: { type: "string" },
        confidence: { type: "string" },
        body_md: { type: "string" },
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim_id: { type: "string" },
              kind: { type: "string" },
              asserted_by: { type: "string" },
            },
            required: ["claim_id"],
          },
        },
      },
      required: ["eligible"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    eligible?: boolean;
    decline_reason?: string;
    thesis?: string;
    confidence?: string;
    body_md?: string;
    claims?: Array<{ claim_id?: string; kind?: string; asserted_by?: string }>;
  } | null;

  if (!parsed?.eligible) {
    return {
      ok: false,
      reason: (
        parsed?.decline_reason ||
        "the facts here read as descriptive, not prescriptive — nothing to propose yet"
      ).slice(0, 400),
    };
  }
  if (!parsed.thesis || !parsed.body_md || parsed.body_md.length < 150) {
    return { ok: false, reason: "the draft came back too thin to publish" };
  }

  // Free deterministic pre-check BEFORE spending any judge calls — the
  // writer was told to self-decline, but a small model can still return
  // eligible=true on a thesis that reads as description with a "should"
  // bolted on. Reject cheaply here rather than trusting eligible alone.
  if (!PRESCRIPTIVE_RE.test(parsed.thesis)) {
    return {
      ok: false,
      reason:
        "the draft's thesis doesn't read as prescriptive (no should/ought/must/needs-to language) — declined before spending a verification pass",
    };
  }

  // Verify claims against grounding + firewall (kills unattributed assertions).
  let verified = 0;
  let killed = 0;
  const verifiedClaims: Array<{
    claim_id: string;
    text: string;
    kind: "fact" | "assertion";
    asserted_by: string | null;
  }> = [];
  for (const cl of parsed.claims ?? []) {
    const cid = (cl.claim_id ?? "")
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    const c = grounding.claims.get(cid);
    if (!c) {
      killed++;
      continue;
    }
    const isAssertion = c.kind === "assertion" || cl.kind === "assertion";
    const attribution = (cl.asserted_by ?? c.actor ?? "").trim();
    if (isAssertion && !attribution) {
      killed++;
      continue;
    }
    verified++;
    verifiedClaims.push({
      claim_id: c.id,
      text: c.text,
      kind: isAssertion ? "assertion" : "fact",
      asserted_by: isAssertion ? attribution : null,
    });
  }
  if (verified < 2)
    return {
      ok: false,
      reason: "too few of the drafted claims survived verbatim-check + firewall",
    };

  // INDEPENDENT JUDGE — spec Part 8 + Part 10 #4 hard constraint. Per-claim
  // citation-integrity check (same helper draft-reading.ts uses), plus one
  // dedicated call confirming the thesis is genuinely prescriptive, not a
  // relabeled Analysis claim — the second layer of verification the plan
  // calls for beyond the free regex pre-check above.
  const [judgments, thesisVerdict] = await Promise.all([
    Promise.all(
      verifiedClaims.map((vc) => {
        const claimSentence = extractClaimSentence(parsed.body_md ?? "", vc.claim_id) || vc.text;
        return judgeClaim(env, claimSentence, vc.text, userId).catch((err) => ({
          judge_pass: 0 as 0 | 1,
          judge_notes: `judge call failed: ${(err as Error).message}`,
        }));
      }),
    ),
    judgeProposalThesis(env, userId, parsed.thesis, factLines.concat(assertionLines).join("\n")),
  ]);
  if (!thesisVerdict.pass) {
    return {
      ok: false,
      reason: `independent judge rejected this as a genuine proposal: ${thesisVerdict.notes}`,
    };
  }
  const judgedClaims = verifiedClaims.map((vc, i) => ({
    ...vc,
    judge_pass: judgments[i]?.judge_pass ?? 0,
    judge_notes: judgments[i]?.judge_notes ?? "",
  }));
  const judgePassed = judgedClaims.filter((c) => c.judge_pass === 1);
  killed += verified - judgePassed.length;
  if (judgePassed.length < 2) {
    return { ok: false, reason: "too few claims survived independent judgment" };
  }

  const confidence = ["low", "moderate", "high"].includes(parsed.confidence ?? "")
    ? (parsed.confidence as string)
    : "moderate";
  const { renderMarkdown, slugify } = await import("../../cms/lib/render-post");
  const passedShort = new Set(judgePassed.map((c) => c.claim_id));
  const bodyMd = applyCitationMarkers(parsed.body_md, grounding.shortToReceipt, passedShort);
  const now = new Date().toISOString();

  const baseSlug = slugify(parsed.thesis) || slugify(subjectLabel) || "proposal";
  const slug = await uniqueSlug(env, userId, baseSlug);

  const proposalId = await insertOne(env.DB, "page_proposals", {
    subject_node_id: subjectNodeId,
    user_id: userId,
    slug,
    thesis: parsed.thesis.slice(0, 400),
    body_md: bodyMd,
    body_html: renderMarkdown(bodyMd),
    status: "draft",
    confidence,
    generate_model: modelForRole("writer").model,
    judge_model: modelForRole("judge").model,
    claims_verified: verified,
    claims_killed: killed,
    created_at: now,
    updated_at: now,
  });

  let order = 0;
  for (const vc of judgePassed) {
    const c = grounding.claims.get(vc.claim_id);
    await insertOne(env.DB, "page_proposal_claims", {
      proposal_id: proposalId,
      user_id: userId,
      claim_text: vc.text.slice(0, 500),
      quote_id: c?.sourcePageClaimId ? null : (c?.quoteId ?? null),
      source_page_claim_id: c?.sourcePageClaimId ?? null,
      kind: vc.kind,
      asserted_by: vc.asserted_by,
      judge_pass: 1,
      judge_notes: vc.judge_notes.slice(0, 600),
      sort_order: order++,
    }).catch(() => {});
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "proposals.drafted.manual",
    subject_kind: "node",
    subject_id: subjectNodeId,
    payload: { label: subjectLabel, angle: angleHint?.trim() || null, proposal_id: proposalId },
  }).catch(() => {});

  return { ok: true, proposalId };
}

async function uniqueSlug(env: Env, userId: string, base: string): Promise<string> {
  let candidate = base.slice(0, 70);
  let n = 1;
  while (
    await one<{ id: string }>(
      env.DB,
      "SELECT id FROM page_proposals WHERE user_id = ? AND slug = ?",
      [userId, candidate],
    ).catch(() => null)
  ) {
    n++;
    candidate = `${base.slice(0, 65)}-${n}`;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Grounding: prefer the subject's signed Analysis (page_claims), else
// established + corroborated (rank='preferred') facts directly.
// ---------------------------------------------------------------------------
interface Grounding {
  claims: Map<string, GroundClaim>;
  // Citation-marker links always resolve to a real quotes.id (the /q/:id
  // receipt page only ever accepts a quote id — never a page_claims id,
  // even when the claim itself was grounded via an Analysis claim).
  shortToReceipt: Map<string, string>;
  analysisThesis: string | null;
}

async function loadGrounding(env: Env, userId: string, subjectNodeId: string): Promise<Grounding> {
  const claims = new Map<string, GroundClaim>();
  const shortToReceipt = new Map<string, string>();

  const analysisPage = await one<{ id: string; thesis: string | null }>(
    env.DB,
    `SELECT id, thesis FROM pages WHERE user_id = ? AND subject_node_id = ?
       AND signed_status IN ('signed', 'published')`,
    [userId, subjectNodeId],
  ).catch(() => null);

  if (analysisPage) {
    const rows = await all<{
      id: string;
      claim_text: string;
      kind: string;
      asserted_by: string | null;
      quote_id: string;
    }>(
      env.DB,
      "SELECT id, claim_text, kind, asserted_by, quote_id FROM page_claims WHERE page_id = ? AND judge_pass = 1 LIMIT 40",
      [analysisPage.id],
    ).catch(() => []);
    rows.forEach((r, i) => {
      const shortId = `c${i + 1}`;
      claims.set(shortId, {
        id: shortId,
        text: r.claim_text,
        kind: r.kind === "assertion" ? "assertion" : "fact",
        actor: r.asserted_by,
        quoteId: r.quote_id,
        sourcePageClaimId: r.id,
      });
      shortToReceipt.set(shortId, r.quote_id);
    });
    return { claims, shortToReceipt, analysisThesis: analysisPage.thesis };
  }

  // No signed Analysis yet — ground directly on established facts and
  // corroborated (rank='preferred') assertions touching this subject.
  // Deliberately excludes rank='contested' assertions: a proposal has no
  // business building on a claim the corpus can't even settle is real.
  const rows = await all<{
    quote_id: string;
    verbatim_text: string;
    node_kind: string;
    actor: string | null;
    rank: string | null;
  }>(
    env.DB,
    `SELECT q.id AS quote_id, q.verbatim_text, n.kind AS node_kind,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.rank
       FROM quotes q
       JOIN nodes n ON n.id = q.node_id
       LEFT JOIN assertions a ON a.node_id = n.id
      WHERE q.user_id = ?
        AND (n.id = ? OR EXISTS (SELECT 1 FROM edges e WHERE
              (e.src_node_id = n.id AND e.dst_node_id = ?) OR
              (e.dst_node_id = n.id AND e.src_node_id = ?)))
        AND (n.kind = 'neutral_fact' OR (n.kind = 'assertion' AND a.rank != 'contested'))
      LIMIT 40`,
    [userId, subjectNodeId, subjectNodeId, subjectNodeId],
  ).catch(() => []);
  rows.forEach((r, i) => {
    const shortId = `c${i + 1}`;
    claims.set(shortId, {
      id: shortId,
      text: r.verbatim_text,
      kind: r.node_kind === "assertion" ? "assertion" : "fact",
      actor: r.actor,
      quoteId: r.quote_id,
      sourcePageClaimId: null,
    });
    shortToReceipt.set(shortId, r.quote_id);
  });
  return { claims, shortToReceipt, analysisThesis: null };
}

// Cheap pre-filter before any judge call is spent: does the thesis actually
// read as prescriptive (should/ought/must/needs-to), not a relabeled
// descriptive claim? See the module comment for why this matters.
const PRESCRIPTIVE_RE =
  /\b(should|must|ought to|need[s]? to|has to|have to|call(?:s)? for|require[sd]?|urge[sd]?|recommend(?:s|ed)?|propose[sd]?|demand[sd]?)\b/i;

async function judgeProposalThesis(
  env: Env,
  userId: string,
  thesis: string,
  groundingText: string,
): Promise<{ pass: boolean; notes: string }> {
  const out = await callRole(env, "judge", {
    userId,
    system: `You independently verify a claimed PROPOSAL. A proposal must be genuinely PRESCRIPTIVE (recommends an action or change — should/ought/must language) and not merely a bold or novel DESCRIPTIVE claim relabeled with "should." Confirm pass=true ONLY if the thesis actually prescribes action, AND the supplied grounding plausibly supports pursuing it. Reject if the thesis just restates what happened or what something means (that belongs to Analysis, not Proposal), or if it isn't reasonably grounded in the material shown.

Return ONLY JSON: {"pass": true|false, "notes": "one short sentence explaining your call"}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Proposed thesis: "${thesis}"\n\nGrounding material:\n${groundingText.slice(0, 3000)}\n\nIs this a genuine, grounded proposal?`,
          },
        ],
      },
    ],
    max_tokens: 300,
    response_schema: {
      type: "object",
      properties: { pass: { type: "boolean" }, notes: { type: "string" } },
      required: ["pass"],
    },
  });
  const parsed = (out.structured ?? safeParse(out.text)) as {
    pass?: boolean;
    notes?: string;
  } | null;
  return { pass: parsed?.pass === true, notes: (parsed?.notes ?? "").slice(0, 500) };
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
