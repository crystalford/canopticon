// Contradictions: list, fetch, set posture, propagation.

import { Hono } from "hono";
import { z } from "zod";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { badRequest } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";
import { getPublicUserId } from "../lib/user.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const userId = await getPublicUserId(client, c.get("user_id"));
  const posture = c.req.query("posture");
  let q = client
    .from("contradictions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (posture) q = q.eq("posture", posture);
  const { data, error } = await q;
  if (error) throw error;
  return c.json({ contradictions: data ?? [] });
});

const postureSchema = z.object({
  posture: z.enum(["open", "resolved_a", "resolved_b", "machloket", "retired"]),
  resolution_reasoning: z.string().optional(),
});

app.patch("/:id/posture", async (c) => {
  const client = userClient(c.env, c.get("jwt"));
  const id = c.req.param("id");
  const parsed = postureSchema.safeParse(await c.req.json());
  if (!parsed.success) throw badRequest("invalid body", { issues: parsed.error.issues });
  const { error } = await client.from("contradictions").update(parsed.data).eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

export default app;
