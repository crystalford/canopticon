// Calibration routes — see canopticon-api-v1.0.md §17.
//
//   GET  /v1/calibration/latest    most recent calibration narrative
//   POST /v1/calibration/run       fire the Calibration role on demand
//
// The Calibration role also auto-fires from POST /v1/predictions/:id/resolve
// after each resolution. See packages/api/src/routes/predictions.ts.

import { Hono } from "hono";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { AnthropicClient } from "../lib/anthropic.ts";
import { serviceClient, userClient } from "../lib/supabase.ts";
import { runCalibration } from "../orchestrator/calibration.ts";

const calibration = new Hono<AuthContext>();
calibration.use("*", requireAuth());

calibration.get("/latest", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const { data, error } = await client
    .from("role_invocations")
    .select("id, output_structured, started_at, ended_at, triggered_by")
    .eq("role_name", "calibration")
    .eq("status", "success")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`calibration.latest: ${error.message}`);
  return c.json({ data });
});

calibration.post("/run", async (c) => {
  const userId = c.get("user_id");
  const ctx = {
    service: serviceClient(c.env),
    anthropic: new AnthropicClient({ apiKey: c.env.ANTHROPIC_API_KEY }),
  };
  const result = await runCalibration(ctx, {
    user_id: userId,
    triggered_by: "calibration.run",
  });
  if (result.status === "denied") {
    return c.json({ data: { status: "pending_approval", decision: result.decision } }, 202);
  }
  if (result.status === "skipped") {
    return c.json({ data: { status: "skipped", reason: result.reason } });
  }
  return c.json({ data: { ...result.report, role_invocation_id: result.role_invocation_id } });
});

export default calibration;
