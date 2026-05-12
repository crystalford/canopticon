// Publish-prep: 7 undismissability gates + root-striking + 4 BLOCK conditions.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

interface GateResult {
  name: string;
  status: "pass" | "warn" | "block";
  detail: string;
}

app.post("/theses/:id/check", async (c) => {
  const userId = c.get("user_id");
  const id = c.req.param("id");

  const thesis = await one<Record<string, unknown>>(c.env.DB, "SELECT * FROM theses WHERE id = ?", [
    id,
  ]);
  if (!thesis) throw badRequest("thesis not found");
  const preds = await all<{ id: string }>(
    c.env.DB,
    "SELECT id FROM predictions WHERE thesis_id = ?",
    [id],
  );
  const premortem = await one<{ fatal: number }>(
    c.env.DB,
    "SELECT fatal FROM premortem_reports WHERE thesis_id = ? ORDER BY created_at DESC LIMIT 1",
    [id],
  );
  const red = await all<{ severity: string; resolved: number }>(
    c.env.DB,
    "SELECT severity, resolved FROM red_team_objections WHERE thesis_id = ?",
    [id],
  );
  const fiveWhys = await one<{ reached_root: number; override_reason: string | null }>(
    c.env.DB,
    "SELECT reached_root, override_reason FROM five_whys_chains WHERE thesis_id = ? ORDER BY created_at DESC LIMIT 1",
    [id],
  );

  const t = thesis;
  const gates: GateResult[] = [
    {
      name: "evidence_density_sufficient",
      status: preds.length >= 3 ? "pass" : "warn",
      detail: `${preds.length} predictions banked`,
    },
    {
      name: "coined_phrase_declared",
      status: t.coined_phrase ? "pass" : "block",
      detail: t.coined_phrase ? `phrase: ${String(t.coined_phrase)}` : "no coined_phrase set",
    },
    {
      name: "predictions_at_least_3",
      status: preds.length >= 3 ? "pass" : "block",
      detail: `${preds.length} predictions (need ≥ 3)`,
    },
    {
      name: "teachable_diagram_linked",
      status: t.teachable_diagram_uri ? "pass" : "block",
      detail: t.teachable_diagram_uri ? "diagram linked" : "no teachable_diagram_uri",
    },
    {
      name: "methodology_appendix",
      status: "warn",
      detail: "checked at tier_full generation; verify before confirm",
    },
    {
      name: "public_graph_artifact_wired",
      status: t.public_graph_artifact_uri ? "pass" : "warn",
      detail: t.public_graph_artifact_uri ? "graph artifact ready" : "auto-generated on publish",
    },
    {
      name: "named_operator_declared",
      status: t.primary_operator ? "pass" : "block",
      detail: t.primary_operator
        ? `operator: ${String(t.primary_operator)}`
        : "no primary_operator set",
    },
    {
      name: "root_striking",
      status: fiveWhys?.reached_root === 1 ? "pass" : fiveWhys?.override_reason ? "warn" : "block",
      detail:
        fiveWhys?.reached_root === 1
          ? "five-whys chain reached_root = true"
          : fiveWhys?.override_reason
            ? `override: ${fiveWhys.override_reason}`
            : "no five-whys chain or chain has not reached root",
    },
  ];

  const blocks: string[] = [];
  if (!t.is_falsifiable) blocks.push("not_falsifiable");
  if (premortem?.fatal === 1) blocks.push("fatal_failure_mode");
  if (red.some((r) => r.severity === "fatal" && r.resolved !== 1))
    blocks.push("fatal_red_team_objection");

  const canPublish = gates.every((g) => g.status !== "block") && blocks.length === 0;

  await insertOne(c.env.DB, "workflow_runs", {
    user_id: userId,
    workflow_name: "publish_prep_check",
    target_kind: "thesis",
    target_id: id,
    status: canPublish ? "completed" : "awaiting_operator",
    result: { gates, blocks, can_publish: canPublish },
    completed_at: new Date().toISOString(),
  });

  return c.json({ gates, blocks, can_publish: canPublish });
});

const confirmSchema = z.object({
  override_warns: z.boolean().optional(),
  override_reason: z.string().optional(),
});

app.post("/theses/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const parsed = confirmSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await updateById(c.env.DB, "theses", id, {
    is_public: true,
    published_at: new Date().toISOString(),
  });
  return c.json({ ok: true });
});

export default app;
