// Cascade orchestration: trigger runs, list past runs, view a single run.
// Actual 16-step orchestration is a stub for now — the cascade row is created,
// status flips through, and an orchestrator_event is emitted. Real role
// dispatch is wired in subsequent passes.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/runs", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const { data, error } = await client
    .from("cascade_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return c.json({ runs: data ?? [] });
});

app.get("/runs/:id", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const { data, error } = await client.from("cascade_runs").select("*").eq("id", id).single();
  if (error) throw error;

  const { data: invocations } = await client
    .from("role_invocations")
    .select("id, role_name, status, cost_cents, created_at")
    .eq("cascade_run_id", id)
    .order("created_at");

  return c.json({ run: data, invocations: invocations ?? [] });
});

app.post("/run", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));

  const { data: run, error } = await client
    .from("cascade_runs")
    .insert({
      user_id: userId,
      status: "pending",
      trigger_source: "operator",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  await client.from("orchestrator_events").insert({
    user_id: userId,
    event_type: "cascade.started",
    cascade_run_id: (run as { id: string }).id,
    subject_kind: "cascade_run",
    subject_id: (run as { id: string }).id,
    payload: { trigger: "operator" },
  });

  // Stub: in a full implementation, the cascade would now dispatch through
  // the 16 steps. For first launch, the cascade row exists and the operator
  // can see it; actual dispatch is wired in a follow-up pass.
  return c.json({ run_id: (run as { id: string }).id }, 202);
});

export default app;
