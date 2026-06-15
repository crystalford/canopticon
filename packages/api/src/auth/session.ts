// Operator session — re-export the shared HMAC verifier (lifted into
// @canopticon/shared/auth so the daily video Worker can verify the same
// cookie). The api Worker keeps its existing import paths working
// through the re-exports here; new code can import directly from
// @canopticon/shared/auth.
//
// The cookie domain (".canopticon.com" in production so it crosses
// canopticon.com → video.canopticon.com) is read from
// env.SESSION_COOKIE_DOMAIN at the call sites that set / clear the
// cookie. Routes that build the Set-Cookie header pass the env-var
// through to the shared helpers; tests / local dev leave it unset so
// Set-Cookie works without a Domain attribute.

export {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionCookie,
  SESSION_COOKIE_NAME,
  type SessionPayload,
  sessionTtlSeconds,
  signSession,
  verifySession,
} from "@canopticon/shared/auth";
