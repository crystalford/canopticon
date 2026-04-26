// Assumptions routes — see canopticon-api-v1.0.md §13 and schema-v1.0 §8.1.
//
//   GET    /v1/assumptions                            list (status, thesis_id,
//                                                      linchpin filters)
//   GET    /v1/assumptions/:id                        one assumption with
//                                                      supporting claims + last
//                                                      audit
//   POST   /v1/assumptions                            declare manually
//   PATCH  /v1/assumptions/:id                        edit text / status / linchpin
//   POST   /v1/assumptions/:id/audit                  re-audit a single
//                                                      assumption (fires the role
//                                                      over its single-element list)
//   POST   /v1/assumptions/audit-thesis/:thesis_id    sweep every linchpin on a
//                                                      thesis
//   POST   /v1/assumptions/:id/supporting_claims      attach a supporting claim
//   DELETE /v1/assumptions/:id/supporting_claims/:claim_id
//                                                      detach

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runAssumptionAuditor } from "../orchestrator/assumption_auditor.ts";

const assumptions = new Hono<AuthContext>();
assumptions.use("*", requireAuth());

// --- list ----------------------------------------------------------------

assumptions.get("/", async (c) => {
  const status = c.req.query("status");
  const thesisId = c.req.query("thesis_id");
  const linchpinQuery = c.req.query("linchpin");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("assumptions")
    .select(
      "id, thesis_id, text, status, is_linchpin, consequence_if_failed, last_audited_at, last_audit_role_invocation_id, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (thesisId) q = q.eq("thesis_id", thesisId);
  if (linchpinQuery === "true") q = q.eq("is_linchpin", true);
  if (linchpinQuery === "false") q = q.eq("is_linchpin", false);
  const { data, error } = await q;
  if (error) throw new Error(`assumptions.list: ${error.message}`);
  return c.json({ data });
});

// --- detail --------------------------------------------------------------

assumptions.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: assumption, error } = await client
    .from("assumptions")
    .select(
      "id, thesis_id, text, status, is_linchpin, consequence_if_failed, last_audited_at, last_audit_role_invocation_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`assumptions.get: ${error.message}`);
  if (!assumption) throw notFound("Assumption not found");
  const a = assumption as { id: string; last_audit_role_invocation_id: string | null };

  const [supporting, audit] = await Promise.all([
    client
      .from("assumption_supporting_claims")
      .select("id, claim_id, supports, created_at")
      .eq("assumption_id", a.id),
    a.last_audit_role_invocation_id
      ? client
          .from("role_invocations")
          .select("output_structured, started_at")
          .eq("id", a.last_audit_role_invocation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return c.json({
    data: {
      ...assumption,
      supporting_claims: supporting.data ?? [],
      last_audit: audit.data ?? null,
    },
  });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  thesis_id: z.string().uuid().nullable().optional(),
  text: z.string().min(10).max(2000),
  is_linchpin: z.boolean().optional(),
  consequence_if_failed: z.string().max(2000).optional(),
});

assumptions.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid assumption payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: row, error } = await client
    .from("assumptions")
    .insert({
      user_id: userId,
      thesis_id: parsed.data.thesis_id ?? null,
      text: parsed.data.text,
      status: "holding",
      is_linchpin: parsed.data.is_linchpin ?? false,
      consequence_if_failed: parsed.data.consequence_if_failed ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`assumptions.create: ${error.message}`);

  return c.json({ data: row }, 201);
});

// --- patch ---------------------------------------------------------------

const patchSchema = z.object({
  text: z.string().min(10).max(2000).optional(),
  status: z.enum(["holding", "shaken", "broken", "retired"]).optional(),
  is_linchpin: z.boolean().optional(),
  consequence_if_failed: z.string().max(2000).nullable().optional(),
});

assumptions.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid patch payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("assumptions")
    .update(parsed.data)
    .eq("id", id)
    .select("id, text, status, is_linchpin, consequence_if_failed, updated_at")
    .single();
  if (error) throw new Error(`assumptions.patch: ${error.message}`);
  return c.json({ data });
});

// --- audit one -----------------------------------------------------------

assumptions.post("/:id/audit", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: assumption } = await client
    .from("assumptions")
    .select("id, thesis_id")
    .eq("id", id)
    .maybeSingle<{ id: string; thesis_id: string | null }>();
  if (!assumption) throw notFound("Assumption not found");
  if (!assumption.thesis_id) {
    throw badRequest("Assumption is not scoped to a thesis; auditor needs thesis context");
  }

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runAssumptionAuditor(ctx, {
    user_id: userId,
    triggered_by: "assumptions.audit",
    thesis_id: assumption.thesis_id,
    assumption_ids: [id],
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({
    data: {
      audits: result.report.audits,
      summary: result.report.summary,
      updated: result.assumptions_updated,
    },
  });
});

// --- audit all on a thesis ----------------------------------------------

assumptions.post("/audit-thesis/:thesis_id", async (c) => {
  const thesisId = c.req.param("thesis_id");
  if (!thesisId) throw badRequest("Missing :thesis_id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runAssumptionAuditor(ctx, {
    user_id: userId,
    triggered_by: "assumptions.audit_thesis",
    thesis_id: thesisId,
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({
    data: {
      audits: result.report.audits,
      summary: result.report.summary,
      updated: result.assumptions_updated,
    },
  });
});

// --- supporting claims --------------------------------------------------

const supportSchema = z.object({
  claim_id: z.string().uuid(),
  supports: z.boolean().optional(),
});

assumptions.post("/:id/supporting_claims", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = supportSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid supporting-claim payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("assumption_supporting_claims")
    .insert({
      user_id: userId,
      assumption_id: id,
      claim_id: parsed.data.claim_id,
      supports: parsed.data.supports ?? true,
    })
    .select("id, claim_id, supports, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw badRequest("Claim already linked to this assumption");
    throw new Error(`assumptions.supporting: ${error.message}`);
  }
  return c.json({ data }, 201);
});

assumptions.delete("/:id/supporting_claims/:claim_id", async (c) => {
  const id = c.req.param("id");
  const claimId = c.req.param("claim_id");
  if (!id || !claimId) throw badRequest("Missing parameter");
  const client = userClient(c.env, c.get("jwt"));

  const { error } = await client
    .from("assumption_supporting_claims")
    .delete()
    .eq("assumption_id", id)
    .eq("claim_id", claimId);
  if (error) throw new Error(`assumptions.supporting.remove: ${error.message}`);
  return c.json({ data: { assumption_id: id, claim_id: claimId, removed: true } });
});

export default assumptions;
