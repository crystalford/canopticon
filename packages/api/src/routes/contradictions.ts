import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, updateById } from "../lib/d1.ts";
import { badRequest } from "../lib/errors.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const posture = c.req.query("posture");
  const contradictions = posture
    ? await all(
        c.env.DB,
        "SELECT * FROM contradictions WHERE user_id = ? AND posture = ? ORDER BY created_at DESC",
        [userId, posture],
      )
    : await all(
        c.env.DB,
        "SELECT * FROM contradictions WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
      );
  return c.json({ contradictions });
});

const postureSchema = z.object({
  posture: z.enum(["open", "resolved_a", "resolved_b", "machloket", "retired"]),
  resolution_reasoning: z.string().optional(),
});

app.patch("/:id/posture", async (c) => {
  const id = c.req.param("id");
  const parsed = postureSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  await updateById(c.env.DB, "contradictions", id, parsed.data);
  return c.json({ ok: true });
});

export default app;
