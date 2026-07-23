// Comprehensive profile generator — the missing middle between the raw
// fact pile (Established/Contested on the File) and the signed reading
// (one argumentative thesis). A profile is a comprehensive, low-advocacy
// narrative synthesis of a subject's established facts — organized prose
// covering what's known, not an argument persuading toward one thesis.
//
// Deliberately decoupled from pages.thesis/body_md (see
// 0041_page_profiles.sql) so a subject can have a profile with no signed
// reading, a signed reading with no profile yet, or both — they don't
// compete for one slot.
//
// Same trust discipline as draft-reading.ts: the model cites stored quote
// ids inline, the server substitutes verbatim text (never trusts the
// model's own wording of a quote), an independent judge checks each
// citation, and applyCitationMarkers turns surviving [qN] markers into
// real links — killed ones are dropped, never left as bracket text.
//
// Runs one candidate per settle tick, same execution-ceiling discipline
// as every other step in this pipeline (a chained-writer-plus-N-judges
// call is already expensive; do not add more work per call than that).

import type { Env } from "../../env";
import { all, insertOne, run } from "../../lib/d1";
import { callRole, modelForRole } from "../../llm/router";
import { judgeClaim } from "./briefs/pipeline";
import { applyCitationMarkers, extractClaimSentence } from "./draft-reading";

const TOP_N_PER_RUN = 1;
const MIN_QUOTES = 6;
// draft-reading.ts's equivalent grounding query uses LIMIT 40 and is
// production-proven to finish inside one waitUntil's CPU/wall-clock budget.
// An earlier version of this file used 200 (5x that) with the large_context
// model — live-verified via the admin probe to silently never complete
// (no settle_step_failed, no profiles.generated event, ever) — the same
// "platform tears down the execution context, no catchable error" failure
// settle-pipeline.ts's header comment warns about. 60 gives some extra
// breadth over draft-reading's bar without repeating that mistake.
const GROUNDING_LIMIT = 60;

export interface GenerateProfilesReport {
  generated: number;
  skipped: number;
  errors: string[];
}

export async function generateProfiles(env: Env, userId: string): Promise<GenerateProfilesReport> {
  const report: GenerateProfilesReport = { generated: 0, skipped: 0, errors: [] };

  // Candidates: any entity/event/theme node with enough grounding material,
  // whether or not it has a page yet or a signed reading. Two cases:
  //   - no profile row yet (status = 'none' via LEFT JOIN, i.e. no row)
  //   - an existing profile whose subject has grown by MIN_QUOTES or more
  //     since the last generation — same "don't freeze on day one"
  //     principle as the re-draftable-drafts fix.
  const candidates = await all<{
    node_id: string;
    label: string;
    profile_id: string | null;
    qcount: number;
  }>(
    env.DB,
    `SELECT n.id AS node_id, n.label, pp.id AS profile_id,
            (SELECT COUNT(*) FROM quotes q
              WHERE q.user_id = ?
                AND (q.node_id = n.id OR EXISTS (
                  SELECT 1 FROM edges e WHERE
                    (e.src_node_id = q.node_id AND e.dst_node_id = n.id) OR
                    (e.dst_node_id = q.node_id AND e.src_node_id = n.id)
                ))
            ) AS qcount
       FROM nodes n
       LEFT JOIN page_profiles pp ON pp.subject_node_id = n.id
      WHERE n.user_id = ?
        AND n.kind IN ('entity', 'event', 'theme')
        AND (
          pp.id IS NULL
          OR (SELECT COUNT(*) FROM quotes q
               WHERE q.user_id = ?
                 AND (q.node_id = n.id OR EXISTS (
                   SELECT 1 FROM edges e WHERE
                     (e.src_node_id = q.node_id AND e.dst_node_id = n.id) OR
                     (e.dst_node_id = q.node_id AND e.src_node_id = n.id)
                 ))
             ) >= COALESCE(pp.claims_verified, 0) + COALESCE(pp.claims_killed, 0) + ${MIN_QUOTES}
        )
      ORDER BY qcount DESC
      LIMIT 12`,
    [userId, userId, userId],
  ).catch(() => []);
  const eligible = candidates.filter((c) => c.qcount >= MIN_QUOTES);

  let generated = 0;
  for (const c of eligible) {
    if (generated >= TOP_N_PER_RUN) break;
    try {
      const ok = await generateOne(env, userId, c.node_id, c.label, c.profile_id);
      if (ok) {
        generated++;
        report.generated++;
      } else {
        report.skipped++;
      }
    } catch (err) {
      report.errors.push(`${c.label}: ${(err as Error).message}`);
    }
  }

  await insertOne(env.DB, "orchestrator_events", {
    user_id: userId,
    event_type: "profiles.generated",
    subject_kind: "graph",
    subject_id: null,
    payload: report,
  }).catch(() => {});

  return report;
}

async function generateOne(
  env: Env,
  userId: string,
  nodeId: string,
  label: string,
  existingProfileId: string | null,
): Promise<boolean> {
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
      LIMIT ${GROUNDING_LIMIT}`,
    [userId, nodeId, nodeId, nodeId],
  ).catch(() => []);

  if (rawQuotes.length < MIN_QUOTES) return false;

  const shortToReal = new Map<string, string>();
  const quotes = new Map<
    string,
    { text: string; node_kind: string; actor: string | null; stance: string | null }
  >();
  rawQuotes.forEach((r, i) => {
    const shortId = `q${i + 1}`;
    quotes.set(shortId, {
      text: r.verbatim_text,
      node_kind: r.node_kind,
      actor: r.actor,
      stance: r.stance,
    });
    shortToReal.set(shortId, r.quote_id);
  });

  const factLines: string[] = [];
  const assertionLines: string[] = [];
  for (const [id, q] of quotes) {
    if (q.node_kind === "assertion") {
      assertionLines.push(
        `[${id}] ASSERTION by ${q.actor ?? "UNKNOWN"} (${q.stance ?? "neutral"}): "${q.text.slice(0, 240)}"`,
      );
    } else {
      factLines.push(`[${id}] "${q.text.slice(0, 240)}"`);
    }
  }

  const out = await callRole(env, "writer", {
    userId,
    system: `You write a COMPREHENSIVE, NEUTRAL PROFILE of a subject — organized prose covering everything established about it, grounded entirely in supplied facts.

THIS IS NOT AN ARGUMENT. No thesis, no persuasion, no cherry-picking facts to support one point. Cover the material comprehensively and organize it into natural sections (use markdown ## headings — e.g. background, key ideas or activities, relationships, later developments — whatever sections the actual material supports; do not force a template that doesn't fit).

HARD RULES:
- THE FIREWALL: an attributed assertion is NEVER stated as neutral fact. Write "According to X, ..." for contested material — never smooth it into settled fact just because this is a synthesis, not an argument.
- Every load-bearing fact must reference a grounded quote id, marked inline like this: the claim text [q3]. We verify mechanically; invented ids are dropped.
- Cover the full breadth of what's supplied, not just the most dramatic facts. This is meant to be comprehensive, the way a reference article is, not punchy.
- Plain, clear prose. No throat-clearing intro, no "in conclusion."

Return ONLY JSON:
{
  "body_md": "the full markdown profile, organized into ## sections, with [qN] markers on load-bearing facts",
  "claims": [{ "quote_id": "qN", "kind": "fact" | "assertion", "asserted_by": "actor (required if assertion)" }]
}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Subject: ${label}

ESTABLISHED FACTS:
${factLines.join("\n") || "(none)"}

ATTRIBUTED ASSERTIONS (contested — attribute, never state as fact):
${assertionLines.join("\n") || "(none)"}

Write the comprehensive profile.`,
          },
        ],
      },
    ],
    max_tokens: 4000,
    response_schema: {
      type: "object",
      properties: {
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
      required: ["body_md"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    body_md?: string;
    claims?: Array<{ quote_id?: string; kind?: string; asserted_by?: string }>;
  } | null;
  if (!parsed?.body_md || parsed.body_md.length < 200) return false;

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
      quote_id: qid,
      text: q.text,
      kind: isAssertion ? "assertion" : "fact",
      asserted_by: isAssertion ? attribution : null,
    });
  }
  if (verified < 3) return false;

  const judgments = await Promise.all(
    verifiedClaims.map((vc) => {
      const claimSentence = extractClaimSentence(parsed.body_md ?? "", vc.quote_id) || vc.text;
      return judgeClaim(env, claimSentence, vc.text, userId).catch((err) => ({
        judge_pass: 0 as 0 | 1,
        judge_notes: `judge call failed: ${(err as Error).message}`,
      }));
    }),
  );
  const judgedClaims = verifiedClaims.map((vc, i) => ({
    ...vc,
    judge_pass: judgments[i]?.judge_pass ?? 0,
    judge_notes: judgments[i]?.judge_notes ?? "",
  }));
  const judgePassed = judgedClaims.filter((c) => c.judge_pass === 1);
  const judgeKilled = verified - judgePassed.length;
  killed += judgeKilled;
  if (judgePassed.length < 3) return false;

  const passedShort = new Set(judgePassed.map((c) => c.quote_id));
  const bodyMd = applyCitationMarkers(parsed.body_md, shortToReal, passedShort);
  const { renderMarkdown } = await import("../../cms/lib/render-post");
  const now = new Date().toISOString();
  const profileId = existingProfileId ?? crypto.randomUUID();

  if (existingProfileId) {
    await run(
      env.DB,
      `UPDATE page_profiles SET body_md = ?, body_html = ?, claims_verified = ?, claims_killed = ?,
          status = 'ready', generate_model = ?, judge_model = ?, error = NULL, updated_at = ?
        WHERE id = ?`,
      [
        bodyMd,
        renderMarkdown(bodyMd),
        verified,
        killed,
        modelForRole("writer").model,
        modelForRole("judge").model,
        now,
        existingProfileId,
      ],
    );
  } else {
    await insertOne(env.DB, "page_profiles", {
      id: profileId,
      subject_node_id: nodeId,
      user_id: userId,
      body_md: bodyMd,
      body_html: renderMarkdown(bodyMd),
      claims_verified: verified,
      claims_killed: killed,
      status: "ready",
      generate_model: modelForRole("writer").model,
      judge_model: modelForRole("judge").model,
      updated_at: now,
    });
  }

  await run(env.DB, "DELETE FROM page_profile_claims WHERE profile_id = ?", [profileId]).catch(
    () => {},
  );
  let order = 0;
  for (const vc of judgePassed) {
    await insertOne(env.DB, "page_profile_claims", {
      profile_id: profileId,
      user_id: userId,
      claim_text: vc.text.slice(0, 500),
      quote_id: realQuoteId(rawQuotes, vc.text),
      kind: vc.kind,
      asserted_by: vc.asserted_by,
      judge_pass: 1,
      judge_notes: vc.judge_notes.slice(0, 600),
      sort_order: order++,
    }).catch(() => {});
  }

  return true;
}

function realQuoteId(
  rawQuotes: Array<{ quote_id: string; verbatim_text: string }>,
  text: string,
): string {
  return rawQuotes.find((r) => r.verbatim_text === text)?.quote_id ?? rawQuotes[0]?.quote_id ?? "";
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
