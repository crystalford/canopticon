// Indicators routes — see canopticon-api-v1.0.md §12 and schema-v1.0 §8.3.
//
//   GET    /v1/indicators                         list (filter active, thesis_id)
//   GET    /v1/indicators/:id                     one indicator with recent
//                                                  observations + last validation
//                                                  report
//   POST   /v1/indicators                         declare; fires the Indicator
//                                                  Validator inline (returns the
//                                                  report; persists the link)
//   POST   /v1/indicators/:id/validate            re-fire the Indicator Validator
//                                                  on demand (after operator
//                                                  edits the indicator definition)
//   POST   /v1/indicators/:id/observations        record an observation
//   PATCH  /v1/indicators/:id                     edit fields (definition,
//                                                  threshold, cadence, is_active)

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runIndicatorValidator } from "../orchestrator/indicator_validator.ts";

const indicators = new Hono<AuthContext>();
indicators.use("*", requireAuth());

// --- list ----------------------------------------------------------------

indicators.get("/", async (c) => {
  const thesisId = c.req.query("thesis_id");
  const activeQuery = c.req.query("active");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("indicators")
    .select(
      "id, thesis_id, name, definition, source_uri, cadence, threshold, is_active, validation_role_invocation_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (thesisId) q = q.eq("thesis_id", thesisId);
  if (activeQuery === "true") q = q.eq("is_active", true);
  if (activeQuery === "false") q = q.eq("is_active", false);
  const { data, error } = await q;
  if (error) throw new Error(`indicators.list: ${error.message}`);
  return c.json({ data });
});

// --- detail --------------------------------------------------------------

indicators.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: indicator, error } = await client
    .from("indicators")
    .select(
      "id, thesis_id, name, definition, source_uri, cadence, threshold, is_active, validation_role_invocation_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`indicators.get: ${error.message}`);
  if (!indicator) throw notFound("Indicator not found");
  const ind = indicator as { id: string; validation_role_invocation_id: string | null };

  const [observations, validation] = await Promise.all([
    client
      .from("indicator_observations")
      .select("id, observed_value, observed_at, notes, source_id, created_at")
      .eq("indicator_id", ind.id)
      .order("observed_at", { ascending: false })
      .limit(50),
    ind.validation_role_invocation_id
      ? client
          .from("role_invocations")
          .select("output_structured, started_at")
          .eq("id", ind.validation_role_invocation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return c.json({
    data: {
      ...indicator,
      observations: observations.data ?? [],
      validation_report: validation.data ?? null,
    },
  });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  thesis_id: z.string().uuid().nullable().optional(),
  name: z.string().min(3).max(200),
  definition: z.string().min(10).max(4000),
  source_uri: z.string().url().max(500).optional(),
  cadence: z.string().max(120).optional(),
  threshold: z.unknown().optional(),
  proposal_id: z.string().uuid().optional(),
});

indicators.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid indicator payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: row, error } = await client
    .from("indicators")
    .insert({
      user_id: userId,
      thesis_id: parsed.data.thesis_id ?? null,
      name: parsed.data.name,
      definition: parsed.data.definition,
      source_uri: parsed.data.source_uri ?? null,
      cadence: parsed.data.cadence ?? null,
      threshold: parsed.data.threshold ?? null,
      is_active: true,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`indicators.create: ${error.message}`);

  // Fire the Validator inline. If the cost gate denies, the indicator
  // still exists; the operator can re-run validation after approval.
  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const validationResult = await runIndicatorValidator(ctx, {
    user_id: userId,
    triggered_by: "indicators.create",
    indicator_id: row.id as string,
    ...(parsed.data.proposal_id ? { proposal_id: parsed.data.proposal_id } : {}),
  });

  if (validationResult.status === "denied") {
    return c.json(
      {
        data: {
          id: row.id,
          status: "validation_pending_approval",
          decision: validationResult.decision,
        },
      },
      202,
    );
  }
  if (validationResult.status === "skipped") {
    return c.json(
      { data: { id: row.id, validation: null, skipped: validationResult.reason } },
      201,
    );
  }

  return c.json(
    { data: { id: row.id, created_at: row.created_at, validation: validationResult.report } },
    201,
  );
});

// --- re-validate ---------------------------------------------------------

indicators.post("/:id/validate", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const userId = c.get("user_id");

  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };

  const result = await runIndicatorValidator(ctx, {
    user_id: userId,
    triggered_by: "indicators.validate",
    indicator_id: id,
  });

  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({ data: { validation: result.report } });
});

// --- observations --------------------------------------------------------

const observationSchema = z.object({
  observed_value: z.unknown(),
  observed_at: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  source_id: z.string().uuid().optional(),
});

indicators.post("/:id/observations", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = observationSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid observation payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("indicator_observations")
    .insert({
      user_id: userId,
      indicator_id: id,
      observed_value: parsed.data.observed_value ?? null,
      observed_at: parsed.data.observed_at ?? new Date().toISOString(),
      notes: parsed.data.notes ?? null,
      source_id: parsed.data.source_id ?? null,
    })
    .select("id, observed_value, observed_at, notes, created_at")
    .single();
  if (error) throw new Error(`indicators.observations: ${error.message}`);

  return c.json({ data }, 201);
});

// --- patch ---------------------------------------------------------------

const patchSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  definition: z.string().min(10).max(4000).optional(),
  source_uri: z.string().url().max(500).nullable().optional(),
  cadence: z.string().max(120).nullable().optional(),
  threshold: z.unknown().optional(),
  is_active: z.boolean().optional(),
});

indicators.patch("/:id", async (c) => {
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
    .from("indicators")
    .update(parsed.data)
    .eq("id", id)
    .select("id, name, definition, source_uri, cadence, threshold, is_active, updated_at")
    .single();
  if (error) throw new Error(`indicators.patch: ${error.message}`);

  return c.json({ data });
});

export default indicators;
