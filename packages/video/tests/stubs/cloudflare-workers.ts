// Test-only stub for the `cloudflare:workers` virtual module, which only
// exists inside the real Workers runtime (or vitest-pool-workers). Plain
// vitest can't resolve it. @cloudflare/containers imports DurableObject +
// WorkerEntrypoint from it at module scope (packages/video/src/render/
// container.ts extends Container, which extends DurableObject from here).
//
// Every test in this package exercises HTTP routing only (Hono's
// app.fetch against mocked bindings) — nothing instantiates a real
// Container or calls into Durable Object behavior. So this stub only
// needs to be shaped enough that the import doesn't throw; it is never
// meaningfully exercised.
export class DurableObject<Env = unknown> {
  ctx: unknown;
  env: Env;
  constructor(ctx?: unknown, env?: Env) {
    this.ctx = ctx;
    this.env = env as Env;
  }
}

export class WorkerEntrypoint<Env = unknown> {
  ctx: unknown;
  env: Env;
  constructor(ctx?: unknown, env?: Env) {
    this.ctx = ctx;
    this.env = env as Env;
  }
}
