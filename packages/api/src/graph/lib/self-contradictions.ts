// Self-contradiction finder — memetic content #3 (2026-07-24). A new
// ANALYSIS capability, not a new template: finds pairs of assertions BY
// THE SAME PERSON, about the same subject, that genuinely conflict —
// contradicted by their OWN record, not "disputed by someone else"
// (assertions.rank already covers that case). This is the highest-yield
// format for content that's both funny and unimpeachable: a receipts-
// backed flip-flop needs no editorializing, the gap does the work.
//
// Same trust discipline as draft-reading.ts/profile-generator.ts: both
// quotes are already verbatim (real `quotes` rows), the model only picks
// WHICH pair and writes a neutral one-line description of the tension,
// and an INDEPENDENT judge call (different from the generator, same
// spec hard constraint as everywhere else) confirms the two genuinely
// conflict before a pair is ever surfaced. Rejected pairs are kept
// (judge_pass=0), not deleted — so a candidate person isn't re-evaluated
// every tick once checked once.
//
// Cron-driven, one candidate PERSON per tick — same execution-ceiling
// discipline as every other step in this pipeline (a writer call plus a
// judge call is already the same shape as profile-generator.ts's per-
// claim judge loop, just for one pair instead of many).

import type { Env } from "../../env";
import { all, insertOne } from "../../lib/d1";
import { callRole } from "../../llm/router";

const MIN_OWN_ASSERTIONS = 2;
const MIN_OWN_PIECES = 2;
const MAX_ASSERTIONS_FED = 30;

export interface SelfContradictionReport {
  candidates_examined: number;
  found: boolean;
  judge_pass: boolean | null;
  errors: string[];
}

export async function advanceSelfContradictions(
  env: Env,
  userId: string,
): Promise<SelfContradictionReport> {
  const report: SelfContradictionReport = {
    candidates_examined: 0,
    found: false,
    judge_pass: null,
    errors: [],
  };

  let candidatePersons: Array<{ person_node_id: string; person_label: string }>;
  try {
    candidatePersons = await findCandidatePersons(env, userId);
  } catch (err) {
    report.errors.push(`candidates: ${(err as Error).message}`);
    return report;
  }
  report.candidates_examined = candidatePersons.length;
  if (candidatePersons.length === 0) return report;

  const person = candidatePersons[0];
  if (!person) return report;

  try {
    const assertions = await loadOwnAssertions(env, userId, person.person_node_id);
    if (assertions.length < MIN_OWN_ASSERTIONS) return report;

    const picked = await pickContradiction(env, userId, person.person_label, assertions);
    if (!picked) return report;
    report.found = true;

    const judged = await judgeContradiction(
      env,
      userId,
      picked.quoteA.text,
      picked.quoteB.text,
      picked.tension_summary,
    );
    report.judge_pass = judged.pass;

    await insertOne(env.DB, "self_contradictions", {
      user_id: userId,
      person_node_id: person.person_node_id,
      person_label: person.person_label,
      tension_summary: picked.tension_summary,
      assertion_a_node_id: picked.quoteA.node_id,
      quote_a_id: picked.quoteA.quote_id,
      quote_a_text: picked.quoteA.text,
      piece_a_title: picked.quoteA.piece_title,
      assertion_b_node_id: picked.quoteB.node_id,
      quote_b_id: picked.quoteB.quote_id,
      quote_b_text: picked.quoteB.text,
      piece_b_title: picked.quoteB.piece_title,
      judge_pass: judged.pass ? 1 : 0,
      judge_notes: judged.notes,
    });
  } catch (err) {
    report.errors.push(`${person.person_label}: ${(err as Error).message}`);
  }

  return report;
}

// ---------------------------------------------------------------------------
// Step 1: deterministic — people with enough of their own cross-document
// material to plausibly contain a self-contradiction, not yet evaluated.
// ---------------------------------------------------------------------------
async function findCandidatePersons(
  env: Env,
  userId: string,
): Promise<Array<{ person_node_id: string; person_label: string }>> {
  const rows = await all<{
    person_node_id: string;
    person_label: string;
    n: number;
    pieces: number;
  }>(
    env.DB,
    `SELECT a.asserted_by_node_id AS person_node_id,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS person_label,
            COUNT(*) AS n,
            COUNT(DISTINCT n.piece_id) AS pieces
       FROM assertions a
       JOIN nodes n ON n.id = a.node_id
      WHERE n.user_id = ? AND a.asserted_by_node_id IS NOT NULL
      GROUP BY a.asserted_by_node_id
     HAVING n >= ? AND pieces >= ?
      ORDER BY n DESC
      LIMIT 20`,
    [userId, MIN_OWN_ASSERTIONS, MIN_OWN_PIECES],
  );
  // Skip anyone already evaluated (judge_pass 0 or 1 — either way, checked).
  const evaluated = await all<{ person_node_id: string }>(
    env.DB,
    "SELECT DISTINCT person_node_id FROM self_contradictions WHERE user_id = ?",
    [userId],
  ).catch(() => []);
  const evaluatedSet = new Set(evaluated.map((r) => r.person_node_id));
  return rows.filter((r) => r.person_label && !evaluatedSet.has(r.person_node_id));
}

// ---------------------------------------------------------------------------
// Step 2: load one person's own assertions, most recent first.
// ---------------------------------------------------------------------------
interface OwnAssertion {
  node_id: string;
  label: string;
  quote_id: string | null;
  quote_text: string | null;
  piece_id: string | null;
  piece_title: string | null;
}

async function loadOwnAssertions(
  env: Env,
  userId: string,
  personNodeId: string,
): Promise<OwnAssertion[]> {
  return all<OwnAssertion>(
    env.DB,
    `SELECT n.id AS node_id, n.label,
            (SELECT id FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_id,
            (SELECT verbatim_text FROM quotes WHERE node_id = n.id LIMIT 1) AS quote_text,
            n.piece_id,
            (SELECT title FROM pieces WHERE id = n.piece_id) AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
      WHERE n.user_id = ? AND a.asserted_by_node_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?`,
    [userId, personNodeId, MAX_ASSERTIONS_FED],
  );
}

// ---------------------------------------------------------------------------
// Step 3: the model picks WHICH pair (if any) genuinely conflicts. It can't
// invent text — it references short ids, the server substitutes the real
// verbatim quote, same discipline as draft-reading.ts's citation markers.
// ---------------------------------------------------------------------------
interface PickedContradiction {
  tension_summary: string;
  quoteA: { node_id: string; quote_id: string | null; text: string; piece_title: string | null };
  quoteB: { node_id: string; quote_id: string | null; text: string; piece_title: string | null };
}

async function pickContradiction(
  env: Env,
  userId: string,
  personLabel: string,
  assertions: OwnAssertion[],
): Promise<PickedContradiction | null> {
  const withQuotes = assertions.filter((a) => a.quote_text);
  if (withQuotes.length < MIN_OWN_ASSERTIONS) return null;

  const byShortId = new Map<string, OwnAssertion>();
  const lines = withQuotes.map((a, i) => {
    const shortId = `a${i + 1}`;
    byShortId.set(shortId, a);
    return `[${shortId}] (${a.piece_title ?? "untitled source"}): "${(a.quote_text ?? "").slice(0, 300)}"`;
  });

  const out = await callRole(env, "writer", {
    userId,
    system: `You find GENUINE SELF-CONTRADICTIONS: two things the SAME person said, in different places, that actually conflict — not elaboration, not a natural evolution of a position they stated as an update, not two claims about different things that only sound similar.

Look for a real reversal: they asserted X, and elsewhere asserted the opposite of X (or something incompatible with X), with no acknowledgment that their position changed.

Return the SINGLE sharpest pair you find. Write tension_summary as ONE plain, neutral sentence describing the tension — no verdict on which one is "true," no snark, just what's in tension. If nothing here is a genuine contradiction, return {"found": false}.

Return ONLY JSON:
{"found": true, "quote_a": "aN", "quote_b": "aN", "tension_summary": "..."}
or
{"found": false}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Person: ${personLabel}\n\nTheir own assertions, across their own material:\n${lines.join("\n")}\n\nDo any two of these genuinely contradict each other?`,
          },
        ],
      },
    ],
    max_tokens: 500,
    response_schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        quote_a: { type: "string" },
        quote_b: { type: "string" },
        tension_summary: { type: "string" },
      },
      required: ["found"],
    },
  });

  const parsed = (out.structured ?? safeParse(out.text)) as {
    found?: boolean;
    quote_a?: string;
    quote_b?: string;
    tension_summary?: string;
  } | null;
  if (!parsed?.found || !parsed.quote_a || !parsed.quote_b || !parsed.tension_summary) return null;
  const a = byShortId.get(parsed.quote_a.trim().toLowerCase());
  const b = byShortId.get(parsed.quote_b.trim().toLowerCase());
  if (!a || !b || a.node_id === b.node_id || !a.quote_text || !b.quote_text) return null;
  const tension = parsed.tension_summary.trim();
  if (tension.length < 15 || tension.length > 300) return null;

  return {
    tension_summary: tension,
    quoteA: {
      node_id: a.node_id,
      quote_id: a.quote_id,
      text: a.quote_text,
      piece_title: a.piece_title,
    },
    quoteB: {
      node_id: b.node_id,
      quote_id: b.quote_id,
      text: b.quote_text,
      piece_title: b.piece_title,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 4: independent judge — a DIFFERENT model family confirms the two
// quotes genuinely conflict, same spec hard constraint (Part 10 #4) that
// gates every other verification pass in this codebase.
// ---------------------------------------------------------------------------
async function judgeContradiction(
  env: Env,
  userId: string,
  quoteA: string,
  quoteB: string,
  claimedTension: string,
): Promise<{ pass: boolean; notes: string }> {
  const out = await callRole(env, "judge", {
    userId,
    system: `You independently verify a claimed self-contradiction. You'll be given two verbatim quotes from the SAME person and a claimed description of how they conflict. Confirm ONLY if the quotes genuinely say incompatible things — not if they're merely about a similar topic, or one adds detail to the other, or the "tension" is a stretch.

Return ONLY JSON: {"pass": true|false, "notes": "one short sentence explaining your call"}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Quote A: "${quoteA}"\n\nQuote B: "${quoteB}"\n\nClaimed tension: ${claimedTension}\n\nDo these genuinely conflict?`,
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
    return null;
  }
}
