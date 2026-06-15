// GET / — the status page. Operator-only.

import { Hono } from "hono";
import { type AuthState, requireOperator } from "../auth.ts";
import type { Env } from "../env.ts";
import { renderStatusPage } from "../pages/status.ts";
import { loadLatestJob } from "../storage/d1.ts";
import { signedAssetUrl } from "../storage/r2.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthState }>();

app.get("/", async (c) => {
  const gate = await requireOperator(c);
  if (gate) return gate;
  const latestJob = await loadLatestJob(c.env.DB).catch(() => null);
  const videoUrl =
    latestJob?.status === "succeeded" && latestJob.r2_key
      ? await signedAssetUrl(c.env.ASSETS, latestJob.r2_key).catch(() => null)
      : null;
  return renderStatusPage({ latestJob, videoUrl });
});

export default app;
