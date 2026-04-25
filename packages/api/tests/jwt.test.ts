import { describe, expect, it } from "vitest";
import { JwtError, verifySupabaseJwt } from "../src/auth/jwt.ts";

const SECRET = "test-secret-with-some-length-for-hmac-key";

async function signJwt(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const sigB64 = Buffer.from(sig)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${sigB64}`;
}

describe("verifySupabaseJwt", () => {
  it("accepts a well-signed token", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt({
      sub: "11111111-1111-1111-1111-111111111111",
      role: "authenticated",
      exp,
      iat: Math.floor(Date.now() / 1000),
    });
    const claims = await verifySupabaseJwt(token, SECRET);
    expect(claims.sub).toBe("11111111-1111-1111-1111-111111111111");
    expect(claims.role).toBe("authenticated");
  });

  it("rejects expired tokens", async () => {
    const exp = Math.floor(Date.now() / 1000) - 600;
    const token = await signJwt({ sub: "x", role: "authenticated", exp, iat: exp - 60 });
    await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
      code: "expired",
    });
  });

  it("rejects tokens signed with a different secret", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt(
      { sub: "x", role: "authenticated", exp, iat: 0 },
      "different-secret-for-signing",
    );
    await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
      code: "bad_signature",
    });
  });

  it("rejects service-role tokens", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signJwt({ sub: "x", role: "service_role", exp, iat: 0 });
    await expect(verifySupabaseJwt(token, SECRET)).rejects.toMatchObject({
      code: "wrong_role",
    });
  });

  it("rejects malformed tokens", async () => {
    await expect(verifySupabaseJwt("not.a.jwt.at.all", SECRET)).rejects.toBeInstanceOf(JwtError);
    await expect(verifySupabaseJwt("only.two", SECRET)).rejects.toBeInstanceOf(JwtError);
    await expect(verifySupabaseJwt("", SECRET)).rejects.toMatchObject({ code: "missing" });
  });
});
