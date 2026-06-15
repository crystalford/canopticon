// Cloudflare Container entry — the canopticon-video renderer.
//
// Fastify on :8080.
//   POST /render — segment JSON in, MP4 binary out
//   GET  /health — liveness JSON
//
// The Worker calls this Container via env.RENDER_CONTAINER.fetch(...).
// Cloudflare routes the request to a Container instance; this server
// responds. Phase 0's contract:
//
//   request:  POST /render
//             Content-Type: application/json
//             Body: §7b Segment JSON (validated by zod)
//
//   response: 200
//             Content-Type: video/mp4
//             X-Walltime-Ms: <int>
//             X-Est-Cost-Cents: <float>
//             X-Chunks: <int>
//             Body: MP4 binary
//
//   On error: 4xx/5xx
//             Content-Type: application/json
//             Body: { ok: false, error: string }
//
// The Worker writes the MP4 to R2 from the response body. No long-lived
// R2 credentials inside the Container.

import { SegmentSchema } from "@canopticon/shared/video/segment-schema";
import Fastify from "fastify";
import { estimateContainerCostCents } from "./cost/meter";
import { renderSegment } from "./render/orchestrator";

const PORT = Number(process.env.PORT ?? 8080);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  bodyLimit: 5 * 1024 * 1024, // 5 MB — segment JSON should be much smaller
});

app.get("/health", async (_req, _reply) => ({
  ok: true,
  service: "canopticon-video-renderer",
  ts: new Date().toISOString(),
}));

app.post("/render", async (req, reply) => {
  const parsed = SegmentSchema.safeParse(req.body);
  if (!parsed.success) {
    reply.code(400);
    return { ok: false, error: `invalid segment: ${JSON.stringify(parsed.error.format())}` };
  }
  const segment = parsed.data;
  req.log.info({ segmentId: segment.id, template: segment.template }, "render start");
  const result = await renderSegment(segment);
  if (!result.ok || !result.mp4) {
    reply.code(500);
    return { ok: false, error: result.error ?? "unknown render failure" };
  }
  const cost = estimateContainerCostCents(result.walltime_ms);
  reply
    .code(200)
    .header("content-type", "video/mp4")
    .header("x-walltime-ms", String(result.walltime_ms))
    .header("x-est-cost-cents", cost.toFixed(4))
    .header("x-chunks", String(result.chunks));
  return result.mp4;
});

app.setErrorHandler((err: Error, _req, reply) => {
  app.log.error(err);
  reply.code(500).send({ ok: false, error: err.message });
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`canopticon-video-renderer listening on :${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
