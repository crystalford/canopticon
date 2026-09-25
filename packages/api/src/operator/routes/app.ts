// The one Hono type every operator module shares. `operator/routes.ts` mounts
// each module's app at "/" so the paths stay exactly what they were when all
// ~35 handlers lived in one file; the split (2026-09-24) is by concern only.
import { Hono } from "hono";
import type { Env } from "../../env";

export type OperatorEnv = { Bindings: Env };

export function operatorApp(): Hono<OperatorEnv> {
  return new Hono<OperatorEnv>();
}
