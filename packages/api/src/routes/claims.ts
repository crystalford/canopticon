// Claims routes — see canopticon-api-v1.0.md §6.
//
//   GET  /v1/claims                  list with filters
//   GET  /v1/claims/:id              single claim with current version
//   POST /v1/claims/:id/verify       cost-gated; invokes the Verifier role
//
// The verify endpoint demonstrates the cost-approval retry pattern. First
// call may return 202 with a proposal_id when the cost gate needs operator
// approval; the client surfaces the modal, operator approves, client
// retries with `?proposal_id=...`. The gate consumes the approval and the
// Verifier runs.

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { invokeRole } from "../orchestrator/role_runner.ts";

const claims = new Hono<AuthContext>();
claims.use("*", requireAuth());

claims.get("/", async (c) => {
  const limit = Math.min(Math.max(1, Number(c.req.query("limit") ?? 50)), 200);
  const layer = c.req.query("layer");
  const verification = c.req.query("verification_status");
  const client = userClient(c.env, c.get("jwt"));

  let q = client
    .from("claims")
    .select("id, layer, admiralty_grade, verification_status, is_linchpin, slug, created_at")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (layer) q = q.eq("layer", layer);
  if (verification) q = q.eq("verification_status", verification);

  const { data, error } = await q;
  if (error) throw new Error(`claims.list: ${error.message}`);
  return c.json({ data });
});

claims.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("claims")
    .select("*, current:current_version_id(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`claims.get: ${error.message}`);
  if (!data) throw notFound("Claim not found");
  return c.json({ data });
});

const verifySchema = z.object({
  proposal_id: z.string().uuid().optional(),
});

interface ClaimRow {
  id: string;
  user_id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
  current_version_id: string | null;
}

interface ClaimVersionRow {
  id: string;
  data: string;
  claim_text: string;
  warrant: string | null;
  qualifier: string | null;
  primary_source_id: string;
}

interface SourceRow {
  id: string;
  title: string;
  source_type: string;
  raw_text: string | null;
}

claims.post("/:id/verify", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");

  const body = await c.req.json().catch(() => ({}));
  const parsed = verifySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw badRequest("Invalid verify payload", { issues: parsed.error.issues });
  }

  const userId = c.get("user_id");
  const userScoped = userClient(c.env, c.get("jwt"));

  // Pull the claim + current version + primary source. We need the source
  // body to pass to the Verifier (it grounds against the source).
  const { data: claim, error: claimErr } = await userScoped
    .from("claims")
    .select("id, user_id, layer, admiralty_grade, verification_status, current_version_id")
    .eq("id", id)
    .maybeSingle<ClaimRow>();
  if (claimErr) throw new Error(`claims.verify.fetch: ${claimErr.message}`);
  if (!claim) throw notFound("Claim not found");
  if (!claim.current_version_id) throw badRequest("Claim has no current version to verify");

  const { data: version, error: versionErr } = await userScoped
    .from("claim_versions")
    .select("id, data, claim_text, warrant, qualifier, primary_source_id")
    .eq("id", claim.current_version_id)
    .maybeSingle<ClaimVersionRow>();
  if (versionErr) throw new Error(`claims.verify.version: ${versionErr.message}`);
  if (!version) throw notFound("Claim version not found");

  const { data: source, error: sourceErr } = await userScoped
    .from("sources")
    .select("id, title, source_type, raw_text")
    .eq("id", version.primary_source_id)
    .maybeSingle<SourceRow>();
  if (sourceErr) throw new Error(`claims.verify.source: ${sourceErr.message}`);
  if (!source) throw notFound("Primary source not found");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await invokeRole(ctx, {
    user_id: userId,
    role_name: "verifier",
    triggered_by: `manual:${id}`,
    related_source_id: source.id,
    snapshot: {
      claim: {
        id: claim.id,
        data: version.data,
        claim_text: version.claim_text,
        warrant: version.warrant,
        qualifier: version.qualifier,
        admiralty_grade: claim.admiralty_grade,
      },
      source: {
        id: source.id,
        source_type: source.source_type,
        title: source.title,
        raw_text: source.raw_text ?? "",
      },
    },
    documents: source.raw_text ? [{ title: source.title, text: source.raw_text }] : [],
    ...(parsed.data.proposal_id ? { proposal_id: parsed.data.proposal_id } : {}),
    approval_context: {
      claim_id: claim.id,
      claim_text: version.claim_text.slice(0, 200),
      source_title: source.title,
    },
  });

  if (result.status === "denied") {
    // Cost gate denied. If it's a requires_approval (the modal flow), surface
    // the proposal_id so the client can show the modal and retry.
    return c.json(
      {
        data: {
          status: "pending_approval",
          decision: result.decision,
        },
      },
      202,
    );
  }

  // Persist the Verifier's structured output onto claims.verification_status.
  const structured = result.output.structured as {
    verification_status?: "grounded" | "partial" | "unsupported" | "contradicted";
    citations?: Array<{ cited_text?: string }>;
  } | null;
  const newStatus = structured?.verification_status ?? "partial";

  await ctx.service.from("claims").update({ verification_status: newStatus }).eq("id", claim.id);

  return c.json({
    data: {
      status: "completed",
      role_invocation_id: result.role_invocation_id,
      cost_ledger_id: result.cost_ledger_id,
      verification_status: newStatus,
      citations_count: structured?.citations?.length ?? 0,
      output_text: result.output.text.slice(0, 500),
    },
  });
});

export default claims;
