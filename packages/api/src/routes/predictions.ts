// Predictions routes — see canopticon-api-v1.0.md §9 and schema-v1.0 §9.
//
//   GET  /v1/predictions                 list (filter by status, thesis_id)
//   GET  /v1/predictions/:id             one prediction with premortem
//                                         report + linchpin assumptions
//   POST /v1/predictions                 declare a new prediction. Fires
//                                         Premortem first; the prediction
//                                         is only written if the cost gate
//                                         allows. Returns 202 + proposal_id
//                                         when the gate is paused.
//   POST /v1/predictions/:id/resolve     resolve as correct / incorrect /
//                                         ambiguous; computes Brier
//                                         contribution and updates rolling
//                                         calibration narrative trigger.
//
// Brier scoring uses the squared-error-on-binary form:
//   correct      → (1 - p)^2
//   incorrect    → p^2
//   ambiguous    → 0.25 (treated as a maximally uninformative outcome)

import { IPCC_LIKELIHOODS } from "@canopticon/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { brierContribution, computeRollingBrier } from "../lib/brier.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runCalibration } from "../orchestrator/calibration.ts";
import { runPremortem } from "../orchestrator/premortem.ts";

const predictions = new Hono<AuthContext>();
predictions.use("*", requireAuth());

// --- list ----------------------------------------------------------------

predictions.get("/", async (c) => {
  const status = c.req.query("status");
  const thesisId = c.req.query("thesis_id");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("predictions")
    .select(
      "id, thesis_id, text, probability, ipcc_qualifier, resolution_criteria, resolution_horizon_at, status, resolved_at, brier_contribution, domain, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (thesisId) q = q.eq("thesis_id", thesisId);
  const { data, error } = await q;
  if (error) throw new Error(`predictions.list: ${error.message}`);

  const summary = computeRollingBrier((data ?? []) as Array<{ brier_contribution: number | null }>);

  return c.json({ data: { predictions: data ?? [], summary } });
});

// --- detail --------------------------------------------------------------

predictions.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: prediction, error } = await client
    .from("predictions")
    .select(
      "id, thesis_id, text, probability, ipcc_qualifier, resolution_criteria, resolution_horizon_at, status, resolved_at, brier_contribution, domain, premortem_role_invocation_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`predictions.get: ${error.message}`);
  if (!prediction) throw notFound("Prediction not found");

  const premortemId = (prediction as { premortem_role_invocation_id: string | null })
    .premortem_role_invocation_id;
  let premortem_report: unknown = null;
  if (premortemId) {
    const { data: inv } = await client
      .from("role_invocations")
      .select("output_structured, output_text, started_at")
      .eq("id", premortemId)
      .maybeSingle();
    premortem_report = inv ?? null;
  }

  return c.json({ data: { ...prediction, premortem: premortem_report } });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  thesis_id: z.string().uuid().nullable().optional(),
  text: z.string().min(10).max(2000),
  probability: z.number().min(0).max(1),
  ipcc_qualifier: z.enum(IPCC_LIKELIHOODS as readonly [string, ...string[]]).optional(),
  resolution_criteria: z.string().min(10).max(4000),
  resolution_horizon_at: z.string().datetime().optional(),
  domain: z.string().max(120).optional(),
  /** Pass through after operator approves a paused premortem. */
  proposal_id: z.string().uuid().optional(),
});

predictions.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid prediction payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  // Fire Premortem first. If the cost gate denies, return the proposal
  // back to the operator and DO NOT write the prediction yet.
  const pre = await runPremortem(ctx, {
    user_id: userId,
    triggered_by: "predictions.create",
    thesis_id: parsed.data.thesis_id ?? null,
    prediction: {
      text: parsed.data.text,
      probability: parsed.data.probability,
      ipcc_qualifier: parsed.data.ipcc_qualifier ?? null,
      resolution_criteria: parsed.data.resolution_criteria,
      resolution_horizon_at: parsed.data.resolution_horizon_at ?? null,
      domain: parsed.data.domain ?? null,
    },
    ...(parsed.data.proposal_id ? { proposal_id: parsed.data.proposal_id } : {}),
  });

  if (pre.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: pre.decision } }, 202);
  }

  // Premortem ran. Write the prediction with the link.
  const userClientHandle = userClient(c.env, c.get("jwt"));
  const { data: row, error } = await userClientHandle
    .from("predictions")
    .insert({
      user_id: userId,
      thesis_id: parsed.data.thesis_id ?? null,
      text: parsed.data.text,
      probability: parsed.data.probability,
      ipcc_qualifier: parsed.data.ipcc_qualifier ?? null,
      resolution_criteria: parsed.data.resolution_criteria,
      resolution_horizon_at: parsed.data.resolution_horizon_at ?? null,
      domain: parsed.data.domain ?? null,
      status: "active",
      premortem_role_invocation_id: pre.role_invocation_id,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`predictions.create: ${error.message}`);

  return c.json(
    {
      data: {
        id: row.id,
        created_at: row.created_at,
        premortem: pre.report,
        assumptions_written: pre.assumptions_written,
      },
    },
    201,
  );
});

// --- resolve -------------------------------------------------------------

const resolveSchema = z.object({
  outcome: z.enum(["correct", "incorrect", "ambiguous"]),
  note: z.string().max(2000).optional(),
});

predictions.post("/:id/resolve", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid resolution payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const { data: prediction, error: fetchErr } = await client
    .from("predictions")
    .select("id, probability, status")
    .eq("id", id)
    .maybeSingle<{ id: string; probability: number; status: string }>();
  if (fetchErr) throw new Error(`predictions.resolve.fetch: ${fetchErr.message}`);
  if (!prediction) throw notFound("Prediction not found");
  if (prediction.status !== "active") {
    throw badRequest(`Prediction already in status '${prediction.status}'`);
  }

  const p = Number(prediction.probability);
  const outcome = parsed.data.outcome;
  const brier = brierContribution(p, outcome);
  const newStatus =
    outcome === "correct"
      ? "resolved_correct"
      : outcome === "incorrect"
        ? "resolved_incorrect"
        : "resolved_ambiguous";

  const { data: updated, error: updErr } = await client
    .from("predictions")
    .update({
      status: newStatus,
      resolved_at: new Date().toISOString(),
      brier_contribution: brier,
    })
    .eq("id", id)
    .select("id, status, brier_contribution, resolved_at")
    .single();
  if (updErr) throw new Error(`predictions.resolve.update: ${updErr.message}`);

  // Auto-fire Calibration over the operator's resolved-prediction
  // history. Errors and cost-gate denials are non-fatal — the
  // resolution itself has already landed. Operator can re-run via
  // POST /v1/calibration/run.
  const userId = c.get("user_id");
  const calibrationCtx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };
  let calibration: unknown = null;
  try {
    const cal = await runCalibration(calibrationCtx, {
      user_id: userId,
      triggered_by: "predictions.resolve",
      triggered_by_prediction_id: id,
    });
    if (cal.status === "completed") calibration = cal.report;
  } catch (err) {
    console.warn("calibration auto-fire failed", { message: (err as Error).message });
  }

  return c.json({ data: { ...updated, calibration } });
});

export default predictions;
