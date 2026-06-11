import { describe, expect, it } from "vitest";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionCookie,
  signSession,
  verifySession,
} from "../src/auth/session.ts";

const SECRET = "test-secret-do-not-use-in-prod";

describe("session sign + verify", () => {
  it("round-trips a payload", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const cookie = await signSession({ uid: "op1", exp }, SECRET);
    const decoded = await verifySession(cookie, SECRET);
    expect(decoded).toEqual({ uid: "op1", exp });
  });

  it("rejects a forged signature (wrong secret)", async () => {
    const cookie = await signSession(
      { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    expect(await verifySession(cookie, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const cookie = await signSession(
      { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    // Flip a character in the payload portion (before the dot).
    const dot = cookie.indexOf(".");
    const tampered = `${cookie.slice(0, dot - 1)}x${cookie.slice(dot)}`;
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const cookie = await signSession({ uid: "op1", exp: 1 }, SECRET);
    expect(await verifySession(cookie, SECRET)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not.a.cookie.x.y", SECRET)).toBeNull();
    expect(await verifySession("", SECRET)).toBeNull();
    expect(await verifySession("no-dot", SECRET)).toBeNull();
  });
});

describe("cookie header parsing", () => {
  it("extracts the session cookie when others are present", () => {
    const header = "foo=bar; canopticon_op=abc.def; baz=qux";
    expect(readSessionCookie(header)).toBe("abc.def");
  });

  it("returns null when the cookie is absent", () => {
    expect(readSessionCookie("foo=bar")).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });

  it("returns null when the cookie is empty", () => {
    expect(readSessionCookie("canopticon_op=")).toBeNull();
  });
});

describe("Set-Cookie builders", () => {
  it("sets HttpOnly + Secure + SameSite=Lax on a fresh session", () => {
    const c = buildSessionCookie("abc.def");
    expect(c).toContain("canopticon_op=abc.def");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
  });

  it("clear-cookie sets Max-Age=0 with an empty value", () => {
    const c = buildClearSessionCookie();
    expect(c).toContain("canopticon_op=;");
    expect(c).toContain("Max-Age=0");
  });
});
