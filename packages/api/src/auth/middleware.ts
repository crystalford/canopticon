// Hono middleware that validates the bearer JWT and attaches user_id + token
// to the request context. Use on every authenticated route.

import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.ts";
import { unauthorized } from "../lib/errors.ts";
import { JwtError, verifySupabaseJwt } from "./jwt.ts";

export interface AuthVariables {
  user_id: string;
  jwt: string;
}

export type AuthContext = {
  Bindings: Env;
  Variables: AuthVariables & { trace_id: string };
};

export const requireAuth = (): MiddlewareHandler<AuthContext> => async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header) {
    throw unauthorized("Missing Authorization header");
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw unauthorized("Authorization header must be 'Bearer <token>'");
  }

  try {
    const claims = await verifySupabaseJwt(token, c.env.SUPABASE_JWT_SECRET);
    c.set("user_id", claims.sub);
    c.set("jwt", token);
  } catch (err) {
    if (err instanceof JwtError) {
      throw unauthorized(err.message);
    }
    throw err;
  }

  await next();
};
