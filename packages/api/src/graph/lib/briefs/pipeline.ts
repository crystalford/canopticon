// Brief build pipeline — the trust boundary.
//
// Per canopticon-briefs-spec: every factual claim must survive a literal
// verbatim substring check against actually-fetched source text. If it
// doesn't, the claim is KILLED (dropped from the publish). A different
// model then independently judges whether the quote supports the claim.
// Same-model self-verification is explicitly NOT acceptable — that's
// theater.
//
// Four steps:
//   1. retrieve  — fetch source pages, sha256 + store in R2, record hash
//   2. generate  — Workers AI Llama 3.3 70B drafts the Brief in the
//                  chosen content-type template; the model returns
//                  structured claims with {claim_text, source_url,
//                  source_quote}
//   3. verify    — for each claim, check source_quote is a literal
//                  substring of the fetched source text (case-sensitive);
//                  record the offset; mark killed=1 on miss
//   4. judge     — for each verified claim, ask a DIFFERENT model
//                  (Workers AI QwQ-32B reasoning model) whether the
//                  quote actually supports the claim. judge_pass=0 marks
//                  the claim as failing the independent check.
//
// Each step writes an orchestrator_events row. The pipeline runs
// synchronously inside the request; UI shows the result after redirect.

import { renderMarkdown } from "../../../cms/lib/render-post";
import type { Env } from "../../../env";
import { all, insertOne, one, run } from "../../../lib/d1";
import { callLLM } from "../../../llm/index";

const GENERATE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const JUDGE_MODEL = "@cf/qwen/qwq-32b"; // Reasoning model — different family from generator

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
  why_proposed_md: string;
}

interface DraftClaim {
  claim_text: string;
  source_url: string;
  source_quote: string;
}

export async function buildBrief(env: Env, briefId: string, userId: string): Promise<BuildResult> {
  const brief = await one<BriefRow>(
    env.DB,
    "SELECT id, user_id, slug, title, content_type, why_proposed_md FROM briefs WHERE id = ? AND user_id = ?",
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

  let drafted: { body_md: string; claims: DraftClaim[] };
  // ---- 2. generate ----
  // (We do generate before retrieve because the model proposes which URLs
  // to fetch; the retrieve step fetches just those.)
  await emit(env, userId, briefId, "build.generate.started", { brief_slug: brief.slug });
  try {
    drafted = await generate(env, brief, userId);
    result.cost_cents += 0; // workers_ai is free
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

  // ---- 1. retrieve ----
  await emit(env, userId, briefId, "build.retrieve.started", {
    brief_slug: brief.slug,
    urls: [...new Set(drafted.claims.map((c) => c.source_url))].length,
  });
  const sourceByUrl = new Map<string, { text: string; hash: string }>();
  try {
    const uniqueUrls = [...new Set(drafted.claims.map((c) => c.source_url).filter((u) => u))];
    for (const url of uniqueUrls) {
      const fetched = await retrieveSource(env, userId, url);
      sourceByUrl.set(url, fetched);
    }
    await emit(env, userId, briefId, "build.retrieve.completed", {
      brief_slug: brief.slug,
      sources_cached: sourceByUrl.size,
    });
  } catch (err) {
    result.failed_step = "retrieve";
    result.failed_reason = (err as Error).message;
    await fail(env, userId, briefId, "retrieve", result.failed_reason);
    return result;
  }

  // ---- 3. verbatim verify ----
  await emit(env, userId, briefId, "build.verify.started", { brief_slug: brief.slug });
  const verifiedClaims: Array<DraftClaim & { offset: number; hash: string }> = [];
  const killedClaims: Array<DraftClaim & { reason: string }> = [];
  for (const c of drafted.claims) {
    const src = sourceByUrl.get(c.source_url);
    if (!src) {
      killedClaims.push({ ...c, reason: "source URL was not fetched" });
      continue;
    }
    const offset = src.text.indexOf(c.source_quote.trim());
    if (offset < 0) {
      killedClaims.push({
        ...c,
        reason: "verbatim match not found in fetched source — claim dropped",
      });
      continue;
    }
    verifiedClaims.push({ ...c, offset, hash: src.hash });
  }
  result.claims_verified = verifiedClaims.length;
  result.claims_killed = killedClaims.length;
  await emit(env, userId, briefId, "build.verify.completed", {
    brief_slug: brief.slug,
    verified: verifiedClaims.length,
    killed: killedClaims.length,
  });

  // ---- 4. independent judge ----
  // Run claim-by-claim against a different model (QwQ reasoning).
  await emit(env, userId, briefId, "build.judge.started", { brief_slug: brief.slug });
  const judgedClaims: Array<
    DraftClaim & { offset: number; hash: string; judge_pass: 0 | 1; judge_notes: string }
  > = [];
  for (const v of verifiedClaims) {
    try {
      const judgement = await judge(env, v, userId);
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

  // ---- persist claims + finalize Brief ----
  // Wipe any prior brief_claims (this is an idempotent rebuild).
  await run(env.DB, "DELETE FROM brief_claims WHERE brief_id = ?", [briefId]);
  let order = 0;
  for (const v of judgedClaims) {
    await insertOne(env.DB, "brief_claims", {
      brief_id: briefId,
      user_id: userId,
      claim_text: v.claim_text,
      source_url: v.source_url,
      source_quote: v.source_quote,
      source_hash: v.hash,
      source_offset: v.offset,
      verified: 1,
      killed: 0,
      judge_pass: v.judge_pass,
      judge_notes: v.judge_notes,
      sort_order: order++,
    });
  }
  for (const k of killedClaims) {
    await insertOne(env.DB, "brief_claims", {
      brief_id: briefId,
      user_id: userId,
      claim_text: k.claim_text,
      source_url: k.source_url,
      source_quote: k.source_quote,
      source_hash: null,
      source_offset: null,
      verified: 0,
      killed: 1,
      kill_reason: k.reason,
      sort_order: order++,
    });
  }

  // Render body_html. Body comes from the generation step.
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
      GENERATE_MODEL,
      JUDGE_MODEL,
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

async function generate(
  env: Env,
  brief: BriefRow,
  userId: string,
): Promise<{ body_md: string; claims: DraftClaim[] }> {
  const system = systemPromptFor(brief.content_type);
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: GENERATE_MODEL,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Title: ${brief.title}\n\nContent type: ${brief.content_type}\n\nWhy proposed: ${brief.why_proposed_md}\n\nDraft the Brief. Return a JSON object with two top-level keys:\n  body_md (string, the full markdown body with citation levers)\n  claims  (array of {claim_text, source_url, source_quote})\nEvery claim's source_quote MUST be a literal verbatim substring of a real fetched page at source_url. We will mechanically verify this — fabricated quotes are dropped. Use real public-web URLs; prefer primary sources.`,
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
              claim_text: { type: "string" },
              source_url: { type: "string" },
              source_quote: { type: "string" },
            },
            required: ["claim_text", "source_url", "source_quote"],
          },
        },
      },
      required: ["body_md", "claims"],
    },
    ledger: {
      user_id: userId,
      operation_type: "workers_ai.briefs.generate",
    },
  });

  const parsed = (out.structured ?? safeJsonParse(out.text)) as {
    body_md?: string;
    claims?: DraftClaim[];
  };
  if (!parsed) throw new Error("generate: model returned unparseable output");
  return {
    body_md: parsed.body_md ?? "",
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  };
}

function systemPromptFor(contentType: string): string {
  const base = `You are drafting a CANOPTICON Brief — a neutral, factual, citable answer-object. Hard constraints:
- Plain English, no opinion (opinions live in Investigations, not Briefs).
- Cite EXTERNAL sources only — never cite CANOPTICON or any internal page.
- Facts in the top 30% of the body (~55% of AI Overview citations originate there).
- 120–180 word section blocks (70% more citations than sub-50-word sections).
- Statistics density — aim for ≥1 stat per section (biggest single citation lever).
- Every factual claim MUST carry a verbatim source_quote from a real public web page.`;
  switch (contentType) {
    case "definition":
      return `${base}\n\nThis Brief is a DEFINITION/CONCEPT page. Lead with a canonical 1-paragraph definition. Then sections: Origin, Mechanism, Scale, Status. Cite primary sources (statutes, official reports, named individuals' published statements).`;
    case "comparison":
      return `${base}\n\nThis Brief is a COMPARISON MATRIX. Body should be mostly a markdown table comparing the two subjects across structural axes (governance, scope, mandate, etc.). Aim for ~3 tables. The table is the citation magnet.`;
    case "timeline":
      return `${base}\n\nThis Brief is a TIMELINE. Body is a chronological list of dated events, each with a verbatim source_quote. Lead with a 1-paragraph framing of why this timeline matters.`;
    case "faq":
      return `${base}\n\nThis Brief is a FAQ. Each section is a Q & A. Use the questions humans and machines actually ask. 5-8 Q&As.`;
    case "stat-roundup":
      return `${base}\n\nThis Brief is a STAT ROUNDUP. Aim for ≥19 statistics (Princeton GEO paper: 2x citation rate at 19+). Each stat as its own bullet with verbatim source_quote.`;
    default:
      return base;
  }
}

async function retrieveSource(
  env: Env,
  userId: string,
  url: string,
): Promise<{ text: string; hash: string }> {
  // Hash on the URL only for the cache lookup. (We could also key on
  // content but URL is good enough for v1.)
  const urlHash = await sha256(url);
  const cached = await one<{ hash: string; r2_key: string }>(
    env.DB,
    "SELECT hash, r2_key FROM brief_sources WHERE user_id = ? AND url = ? ORDER BY fetched_at DESC LIMIT 1",
    [userId, url],
  );
  if (cached) {
    const obj = await env.FILES.get(cached.r2_key);
    if (obj) {
      return { text: await obj.text(), hash: cached.hash };
    }
  }
  // Fetch fresh.
  const res = await fetch(url, {
    headers: {
      "user-agent": "Canopticon/1.0 (briefs verification)",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const body = await res.text();
  const text = stripHtml(body);
  const hash = await sha256(text);
  const r2_key = `briefs/sources/${hash}.txt`;
  await env.FILES.put(r2_key, text, { httpMetadata: { contentType: "text/plain" } });
  await insertOne(env.DB, "brief_sources", {
    hash,
    user_id: userId,
    url,
    r2_key,
    byte_length: text.length,
  });
  // urlHash unused here; reserved for future content-aware dedup.
  void urlHash;
  return { text, hash };
}

async function judge(
  env: Env,
  claim: DraftClaim,
  userId: string,
): Promise<{ judge_pass: 0 | 1; judge_notes: string }> {
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: JUDGE_MODEL,
    system: `You are an independent fact-checker. You are NOT the model that drafted the claim — your job is to assess, neutrally, whether the verbatim quote actually supports the claim. Return JSON only: {pass: boolean, notes: string}. Be strict. A quote that mentions the topic but doesn't substantiate the claim → pass=false.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Claim:\n${claim.claim_text}\n\nVerbatim source quote (from ${claim.source_url}):\n"${claim.source_quote}"\n\nDoes the quote support the claim?`,
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
    ledger: { user_id: userId, operation_type: "workers_ai.briefs.judge" },
  });
  const parsed = (out.structured ?? safeJsonParse(out.text)) as {
    pass?: boolean;
    notes?: string;
  };
  return {
    judge_pass: parsed?.pass ? 1 : 0,
    judge_notes: parsed?.notes?.slice(0, 600) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Manual-compose verify path — Phase 5 of the architecture pivot.
//
// The auto pipeline runs generate → retrieve → verify → judge. Manual
// composition skips generate entirely (operator wrote the body and supplied
// each citation), so we just run retrieve → verify → judge → persist on the
// already-inserted brief_claims rows. Idempotent: re-running re-verifies all
// claims and refreshes the brief's counts.
// ---------------------------------------------------------------------------
export async function verifyManualBrief(
  env: Env,
  briefId: string,
  userId: string,
): Promise<BuildResult> {
  const brief = await one<BriefRow>(
    env.DB,
    "SELECT id, user_id, slug, title, content_type, why_proposed_md FROM briefs WHERE id = ? AND user_id = ?",
    [briefId, userId],
  );
  if (!brief) throw new Error(`Brief not found: ${briefId}`);

  await emit(env, userId, briefId, "build.started", { brief_slug: brief.slug, mode: "manual" });
  await run(
    env.DB,
    "UPDATE briefs SET status = 'building', build_started_at = ?, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), new Date().toISOString(), briefId],
  );

  const claims = await all<{
    id: string;
    claim_text: string;
    source_url: string;
    source_quote: string;
  }>(
    env.DB,
    `SELECT id, claim_text, source_url, source_quote FROM brief_claims
      WHERE brief_id = ? AND user_id = ?
      ORDER BY sort_order ASC`,
    [briefId, userId],
  );

  const result: BuildResult = {
    briefId,
    claims_total: claims.length,
    claims_verified: 0,
    claims_killed: 0,
    cost_cents: 0,
  };

  // If the operator composed without citations, just flip to draft.
  if (claims.length === 0) {
    await run(
      env.DB,
      `UPDATE briefs SET status = 'draft', claims_verified = 0, claims_killed = 0,
          generate_model = 'manual', judge_model = ?,
          build_completed_at = ?, updated_at = ?
        WHERE id = ?`,
      [JUDGE_MODEL, new Date().toISOString(), new Date().toISOString(), briefId],
    );
    await emit(env, userId, briefId, "build.judge.completed", {
      brief_slug: brief.slug,
      mode: "manual",
      passed: 0,
      total: 0,
    });
    return result;
  }

  // ---- retrieve unique URLs ----
  const sourceByUrl = new Map<string, { text: string; hash: string }>();
  const uniqueUrls = [...new Set(claims.map((c) => c.source_url).filter((u) => u))];
  for (const url of uniqueUrls) {
    try {
      const fetched = await retrieveSource(env, userId, url);
      sourceByUrl.set(url, fetched);
    } catch {
      // leave it absent — verify step will kill the claim with a clean reason
    }
  }

  // ---- verbatim verify + judge per claim ----
  for (const c of claims) {
    const src = sourceByUrl.get(c.source_url);
    let verified = 0;
    let killed = 0;
    let kill_reason: string | null = null;
    let source_hash: string | null = null;
    let source_offset: number | null = null;
    let judge_pass = 0;
    let judge_notes = "";

    if (!src) {
      killed = 1;
      kill_reason = "source URL could not be fetched";
    } else {
      const offset = src.text.indexOf(c.source_quote.trim());
      if (offset < 0) {
        killed = 1;
        kill_reason = "verbatim match not found in fetched source — claim dropped";
      } else {
        verified = 1;
        source_hash = src.hash;
        source_offset = offset;
        try {
          const j = await judge(
            env,
            {
              claim_text: c.claim_text,
              source_url: c.source_url,
              source_quote: c.source_quote,
            },
            userId,
          );
          judge_pass = j.judge_pass;
          judge_notes = j.judge_notes;
        } catch (err) {
          judge_pass = 0;
          judge_notes = `judge call failed: ${(err as Error).message}`;
        }
      }
    }

    await run(
      env.DB,
      `UPDATE brief_claims
          SET verified = ?, killed = ?, kill_reason = ?, source_hash = ?, source_offset = ?,
              judge_pass = ?, judge_notes = ?
        WHERE id = ?`,
      [verified, killed, kill_reason, source_hash, source_offset, judge_pass, judge_notes, c.id],
    );

    if (verified) result.claims_verified++;
    if (killed) result.claims_killed++;
  }

  await run(
    env.DB,
    `UPDATE briefs SET
        status = 'draft',
        claims_verified = ?, claims_killed = ?,
        generate_model = 'manual', judge_model = ?,
        build_completed_at = ?, updated_at = ?
      WHERE id = ?`,
    [
      result.claims_verified,
      result.claims_killed,
      JUDGE_MODEL,
      new Date().toISOString(),
      new Date().toISOString(),
      briefId,
    ],
  );

  await emit(env, userId, briefId, "build.judge.completed", {
    brief_slug: brief.slug,
    mode: "manual",
    passed: result.claims_verified,
    killed: result.claims_killed,
    total: result.claims_total,
  });
  return result;
}

// ---- helpers --------------------------------------------------------------

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const out = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(out))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Some models return JSON inside a code fence; try to extract.
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
