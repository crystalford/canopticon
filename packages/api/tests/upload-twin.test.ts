// An upload made after the handoff has a Markdown twin with one front-matter
// block: the site's. Bodies that arrive with their own header lose it.

import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import app from "../src/index";

const BODY =
  "---\ntitle: old header\nsource: upload\n---\n\n# Housing starts\n\nStarts fell 31% [1].";

function db(): D1Database {
  const stmt = (sql: string) => {
    const s = {
      bind: () => s,
      first: async () => {
        if (/FROM users/.test(sql)) return { id: "op" };
        if (/FROM pieces/.test(sql) && /slug = \?/.test(sql))
          return {
            slug: "housing-starts",
            title: "Housing starts",
            body_md: BODY,
            published_at: "2026-10-18T00:00:00Z",
            metadata: JSON.stringify({ library_topic: "Housing" }),
          };
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => ({ results: [], meta: { changes: 0 } }),
    };
    return s;
  };
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

describe("an upload's Markdown twin", () => {
  it("carries the site's front matter once and the body once", async () => {
    const env = { LOG_LEVEL: "error", DB: db() } as unknown as Env;
    const res = await app.fetch(new Request("http://test/p/housing-starts.md"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const md = await res.text();
    expect(md.match(/^---$/gm)?.length).toBe(2);
    expect(md).toContain('url: "https://canopticon.com/p/housing-starts"');
    expect(md).toContain('topic: "Housing"');
    expect(md).not.toContain("old header");
    expect(md.match(/# Housing starts/g)?.length).toBe(1);
  });
});

describe("held documents stay unlinked", () => {
  it("no concept or open-problem page links to or names a held document", async () => {
    const { heldResearch, problems, terms } = await import("../src/site/content/store");
    const held = heldResearch();
    const env = { LOG_LEVEL: "error" } as unknown as Env;
    for (const it of [...problems(), ...terms()]) {
      const html = await (await app.fetch(new Request(`http://test${it.route}`), env)).text();
      for (const d of held) {
        expect(html, `${it.route} → ${d.id}`).not.toContain(`/p/${d.id}`);
      }
    }
    const timing = await (
      await app.fetch(new Request("http://test/open/timing-antivirals-to-the-body-clock"), env)
    ).text();
    expect(timing).not.toContain("Disrupting HSV Latency");
    const ideas = await (await app.fetch(new Request("http://test/ideas"), env)).text();
    expect(ideas).not.toContain("Disrupting HSV Latency");
  });
});
