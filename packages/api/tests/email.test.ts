// Mail is the one thing here with no undo.
//
// Every other destructive path in this codebase writes to a database the
// operator controls, and can be reversed by writing again. A sent email is in
// someone else's inbox. So the rules that keep it safe are pinned here rather
// than left to the reading of a route handler.

import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { sendAnnouncement, sendConfirmation } from "../src/lib/email";

const noKey = {} as Env;

describe("nothing sends without a key", () => {
  // An unconfigured deploy must be INERT, not half-working. If this ever
  // starts attempting a send with no key, the failure is silent at the
  // provider and looks identical to a verified-domain problem.
  it("refuses a confirmation and says why", async () => {
    const r = await sendConfirmation(noKey, "reader@example.com", "tok");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/RESEND_API_KEY/);
  });

  it("refuses an announcement and says why", async () => {
    const r = await sendAnnouncement(noKey, "reader@example.com", {
      title: "A piece",
      url: "https://canopticon.com/p/a-piece",
      unsubscribeToken: "tok",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/RESEND_API_KEY/);
  });

  it("never throws — a mail failure must not break the request that caused it", async () => {
    // Signup calls this. If it threw, a successful subscription would render
    // an error page and the reader would assume they are not on the list.
    await expect(sendConfirmation(noKey, "reader@example.com", "tok")).resolves.toBeDefined();
  });
});

describe("what goes in the message", () => {
  function capture() {
    const calls: Array<Record<string, unknown>> = [];
    const env = { RESEND_API_KEY: "test-key", MAILING_ADDRESS: "PO Box 1, Hamilton ON" } as Env;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, text: async () => "" } as unknown as Response;
    }) as unknown as typeof fetch;
    return { env, calls, restore: () => (globalThis.fetch = orig) };
  }

  it("puts the confirm link in the confirmation and nothing else", async () => {
    const { env, calls, restore } = capture();
    await sendConfirmation(env, "reader@example.com", "abc123");
    restore();
    const body = String(calls[0]?.text ?? "");
    expect(body).toContain("/confirm?token=abc123");
    // The promise the copy makes, pinned: a reader who ignores this must not
    // be written to again.
    expect(body).toMatch(/nothing is sent until you confirm/i);
  });

  it("carries a one-click unsubscribe header, not just a footer link", async () => {
    // Readers who cannot find the link press "spam" instead, and that costs
    // the sending domain far more than the subscriber was worth.
    const { env, calls, restore } = capture();
    await sendAnnouncement(env, "reader@example.com", {
      title: "A piece",
      url: "https://canopticon.com/p/a-piece",
      unsubscribeToken: "unsub-tok",
    });
    restore();
    const headers = calls[0]?.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toContain("unsub-tok");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(String(calls[0]?.text)).toContain("/unsubscribe?token=unsub-tok");
  });

  it("reports the provider's own reason when a send is rejected", async () => {
    // A bad key and an unverified sending domain both yield zero sends and
    // are indistinguishable without this.
    const env = { RESEND_API_KEY: "bad", MAILING_ADDRESS: "PO Box 1" } as Env;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 403,
        text: async () => "domain not verified",
      }) as unknown as Response) as unknown as typeof fetch;
    const r = await sendConfirmation(env, "reader@example.com", "tok");
    globalThis.fetch = orig;
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("403");
    expect(r.reason).toContain("domain not verified");
  });

  it("names the sender and a mailing address in every message (CASL)", async () => {
    const { env, calls, restore } = capture();
    await sendConfirmation(env, "reader@example.com", "abc123");
    restore();
    const body = String(calls[0]?.text ?? "");
    expect(body).toContain("Chris Telford");
    expect(body).toContain("PO Box 1, Hamilton ON");
  });
});

describe("no mailing address, no mail", () => {
  it("refuses to send anything until a mailing address is set", async () => {
    const orig = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const r = await sendConfirmation({ RESEND_API_KEY: "k" } as Env, "reader@example.com", "t");
    globalThis.fetch = orig;
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/MAILING_ADDRESS/);
    expect(called).toBe(false);
  });
});
