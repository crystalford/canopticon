// Operator auth: gated by Cloudflare Access.
//
// Cloudflare Access sits in front of the Worker (configured in the
// Zero Trust dashboard). On every request that's passed Access, two
// headers are injected:
//
//   Cf-Access-Authenticated-User-Email: the verified email
//   Cf-Access-Jwt-Assertion: signed JWT we could verify if needed
//
// For the single-operator model we accept the email header as the
// identity. We also gate by OPERATOR_EMAIL: only that exact email is
// allowed. (Belt-and-suspenders with the Access policy.)

import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";
import { getOrSeedOperator } from "../lib/seed.ts";

export interface AuthVariables {
  email: string;
  user_id: string;
}

export type AuthContext = {
  Bindings: Env;
  Variables: AuthVariables & { trace_id: string };
};

export const requireAuth = (): MiddlewareHandler<AuthContext> => async (c, next) => {
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email) {
    throw unauthorized("Cloudflare Access did not provide an email");
  }
  const operatorEmail = c.env.OPERATOR_EMAIL;
  if (operatorEmail && email.toLowerCase() !== operatorEmail.toLowerCase()) {
    throw forbidden(`Only ${operatorEmail} can use this app`);
  }

  const userId = await getOrSeedOperator(c.env.DB, email);
  c.set("email", email);
  c.set("user_id", userId);
  await next();
};
