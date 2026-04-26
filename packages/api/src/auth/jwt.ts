// Supabase JWT verification.
//
// Supabase signs user JWTs with HS256 against the project's JWT secret
// (SUPABASE_JWT_SECRET). The Worker validates the signature and extracts
// the `sub` claim (= auth.uid() in Postgres). Routes downstream of the
// auth middleware can trust c.get("user_id").
//
// We use the WebCrypto SubtleCrypto API directly — no JWT library needed
// for HS256 verification, and pulling jose into the Worker bundle would
// be excess for a single algorithm.

const TEXT = new TextEncoder();

export interface SupabaseJwtClaims {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  exp: number;
  iat: number;
  iss?: string;
}

export class JwtError extends Error {
  constructor(
    public readonly code: "missing" | "malformed" | "bad_signature" | "expired" | "wrong_role",
    message: string,
  ) {
    super(message);
    this.name = "JwtError";
  }
}

export async function verifySupabaseJwt(token: string, secret: string): Promise<SupabaseJwtClaims> {
  if (!token || token.length === 0) {
    throw new JwtError("missing", "JWT token is empty");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("malformed", "JWT must have three dot-separated parts");
  }

  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: { alg?: string; typ?: string };
  let payload: SupabaseJwtClaims;
  try {
    header = JSON.parse(b64UrlDecodeToString(headerB64));
    payload = JSON.parse(b64UrlDecodeToString(payloadB64)) as SupabaseJwtClaims;
  } catch {
    throw new JwtError("malformed", "JWT header/payload is not valid base64url JSON");
  }

  if (header.alg !== "HS256") {
    throw new JwtError("malformed", `Unsupported JWT algorithm: ${String(header.alg)}`);
  }

  // Verify signature.
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signingInput = TEXT.encode(`${headerB64}.${payloadB64}`);
  const signature = b64UrlDecodeToBytes(sigB64);
  const valid = await crypto.subtle.verify("HMAC", key, signature, signingInput);
  if (!valid) {
    throw new JwtError("bad_signature", "JWT signature verification failed");
  }

  // Verify expiry (allow 5s clock skew).
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec - 5) {
    throw new JwtError("expired", "JWT is expired");
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new JwtError("malformed", "JWT is missing sub claim");
  }

  // Reject service-role tokens (those have role='service_role').
  // Only authenticated end-user tokens are valid for the v1 API.
  if (payload.role && payload.role !== "authenticated") {
    throw new JwtError("wrong_role", `JWT role '${payload.role}' is not allowed`);
  }

  return payload;
}

function b64UrlDecodeToString(input: string): string {
  return new TextDecoder().decode(b64UrlDecodeToBytes(input));
}

function b64UrlDecodeToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
