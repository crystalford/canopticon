// The Cloudflare Container running ffmpeg + Remotion (packages/video-renderer).
//
// A Container is a Durable Object that proxies fetch() to a long-running
// process inside a container image — built from the Dockerfile at
// packages/video-renderer/Dockerfile and wired via wrangler.toml's
// [[containers]] block (image = "../video-renderer/Dockerfile",
// class_name = "RenderContainer", matching this class's export name).
//
// The base Container.fetch() (from @cloudflare/containers) already starts
// the container on first use and forwards the request to `defaultPort` —
// no custom routing needed here. The video-renderer's Fastify server
// listens on 8080 (PORT env var; packages/video-renderer/src/server.ts).
// render/client.ts calls the DO stub's fetch() directly with a
// POST /render request; the container's own Fastify app owns that route.
import { Container } from "@cloudflare/containers";
import type { Env } from "../env.ts";

export class RenderContainer extends Container<Env> {
  override defaultPort = 8080;
  // A render is one request/response (POST /render, wait for the MP4).
  // Keep the container warm briefly in case another segment renders
  // shortly after, without paying for indefinite idle container time.
  override sleepAfter = "5m";
}
