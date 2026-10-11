// Digging a lead — the Wikipedia inversion.
//
// On Wikipedia you click a link and arrive at a page someone already wrote.
// Here, clicking is the act that CREATES the next page. That makes this the
// one button on the site that spends real money and real time on the
// operator's behalf, so what it must never do matters more than what it does:
//
//   · never start a run for someone who is not the operator
//   · never start a run with nothing to search for
//   · never carry the seed WITHOUT the angle, which is the difference between
//     a topic's worth of material and an answer to something
//   · never 500 the request that started a perfectly good run

import { describe, expect, it } from "vitest";
import { buildSessionCookie, signSession } from "../src/auth/session.ts";
import app from "../src/index.ts";

const SECRET = "test-secret-for-digging";

function env(opts: { withOperator?: boolean } = {}) {
  const mk = (sql: string) => {
    const stmt = {
      bind: () => stmt,
      first: async () => (opts.withOperator && /FROM users/i.test(sql) ? { id: "op1" } : null),
      all: async () => ({ results: [] }),
      run: async () => ({ results: [], meta: { changes: 0 } }),
    };
    return stmt;
  };
  return {
    ANTHROPIC_API_KEY: "test",
    LOG_LEVEL: "error",
    SESSION_SECRET: SECRET,
    DB: {
      prepare: (sql: string) => mk(sql),
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    },
  };
}

async function dig(body: Record<string, string>, opts: { signedIn?: boolean } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (opts.signedIn !== false) {
    const cookie = await signSession(
      { uid: "op1", exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    headers.cookie = buildSessionCookie(cookie).split(";")[0] as string;
  }
  return app.fetch(
    new Request("http://test/op/leads/dig", {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
    }),
    env({ withOperator: opts.signedIn !== false }),
  );
}

describe("what the dig button must refuse", () => {
  it("does nothing for a request with no operator", async () => {
    const res = await dig({ seed: "housing spending" }, { signedIn: false });
    // Redirected away, and crucially not into a research run.
    expect([301, 302, 303, 307, 401]).toContain(res.status);
    expect(res.headers.get("location") ?? "").not.toContain("/op/research");
  });

  it("refuses a lead that carried nothing to search for", async () => {
    // A lead with an empty seed would start a run against an empty query and
    // burn a research budget on nothing.
    const res = await dig({ seed: "   ", angle: "an angle with no subject" });
    expect(res.headers.get("location") ?? "").toContain("/admin/workbench?error=");
    expect(res.headers.get("location") ?? "").not.toContain("/op/research");
  });
});

describe("what it carries into the run", () => {
  it("passes the seed through to the research screen", async () => {
    const res = await dig({ seed: "housing spending rose 32.3%" });
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/op/research?q=");
    expect(decodeURIComponent(loc)).toContain("housing spending rose 32.3%");
  });

  it("carries the angle, not just the seed", async () => {
    // THE POINT OF THE WHOLE BUTTON. A run seeded with a bare topic comes back
    // with a topic's worth of material; seeded with why it was worth running,
    // it comes back with an answer. If the angle is ever dropped here, the
    // feature still "works" and quietly becomes worthless.
    const res = await dig({
      seed: "housing spending",
      angle: "Two documents on the record disagree about this. Find which is right.",
    });
    const loc = decodeURIComponent(res.headers.get("location") ?? "");
    expect(loc).toContain("angle=");
    expect(loc).toContain("Two documents on the record disagree");
  });

  it("survives having no ExecutionContext", async () => {
    // c.executionCtx THROWS when there is none. Unguarded, that 500s the
    // request that just started a perfectly good run — the operator sees an
    // error page and assumes nothing happened. Exactly the bug the subscribe
    // route had.
    const res = await dig({ seed: "a seed", angle: "an angle" });
    expect(res.status).toBeLessThan(500);
  });
});

describe("nothing runs unattended", () => {
  it("is a POST, so nothing can trigger it by fetching a URL", async () => {
    // Standing rule 4: work happens when a person does something. A GET-able
    // research trigger is one crawler away from running continuously.
    //
    // What a GET actually does is 301 to /op/synthesis — an /op/* catch-all
    // that predates this route. The status is incidental; what matters is
    // that it never reaches the research screen, which is the only evidence
    // from out here that a run was started.
    const res = await app.fetch(
      new Request("http://test/op/leads/dig?seed=x"),
      env({ withOperator: true }),
    );
    expect(res.headers.get("location") ?? "").not.toContain("/op/research");
  });
});

describe("the lead's own copy", () => {
  it("builds a seed and an angle for every lead it emits", async () => {
    // The renderer reads these off the lead; a lead without them renders a
    // button that would start an empty run, so they are produced by the query
    // rather than assembled in the template.
    const { unsourcedFigureLeads } = await import("../src/graph/lib/leads");
    const db = {
      prepare: () => {
        const stmt = {
          bind: () => stmt,
          first: async () => null,
          all: async () => ({
            results: [
              {
                figure: "$1.2B",
                measures: "total transfers",
                quote_id: "q1",
                verbatim_text: "transfers totalled 1.2 billion",
                piece_id: "p1",
                piece_slug: "doc",
                piece_title: "Doc",
                created_at: "2026-09-01T00:00:00Z",
              },
            ],
          }),
          run: async () => ({ results: [], meta: { changes: 0 } }),
        };
        return stmt;
      },
    } as unknown as Parameters<typeof unsourcedFigureLeads>[0];
    const [lead] = await unsourcedFigureLeads(db, "u1");
    expect(lead?.seed).toContain("$1.2B");
    expect(lead?.angle).toMatch(/no source named/i);
    // It asks for the provenance, which is the only thing worth finding here.
    expect(lead?.angle).toMatch(/who first reported it/i);
  });
});
