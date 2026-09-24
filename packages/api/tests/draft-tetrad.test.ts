// A model-drafted tetrad from a document (graph/lib/draft-tetrad.ts), clearly
// labelled and never stored. The writer is asked once; the file says whether
// the draft parsed as a tetrad and how many of its quotations the document
// actually contains — verification is mechanical, the label reports it.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import type { PublicEnv } from "../src/public/data";

const writer = vi.fn();
vi.mock("../src/llm/router", () => ({
  callResearchWriter: (...args: unknown[]) => writer(...args),
}));

import { checkQuotations, draftTetrad } from "../src/graph/lib/draft-tetrad";
import { parseTetrad } from "../src/lib/essay";
import { renderPiece } from "../src/public/render/piece-template";

const VERBATIM =
  "Provincial health spending grew 4.8 percent over the same period, outpacing the transfer escalator of 3.0 percent set in 2023.";
const BODY = `# Housing in the record\n\n${VERBATIM}\n\nThe Parliamentary Budget Officer noted in March 2026 that the gap would compound.\n`;

const PIECE = {
  id: "p1",
  slug: "housing-record",
  title: "Housing in the record",
  body_md: BODY,
};

interface Call {
  sql: string;
  params: unknown[];
}

function makeDb(opts: { piece?: typeof PIECE | null; quotes?: string[] } = {}) {
  const calls: Call[] = [];
  const mk = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async first() {
        calls.push({ sql, params: bound });
        if (/FROM pieces\s+WHERE id = \? AND user_id = \?/i.test(sql)) {
          const p = opts.piece === undefined ? PIECE : opts.piece;
          return p && bound[0] === p.id && bound[1] === "u1" ? p : null;
        }
        return null;
      },
      async all() {
        calls.push({ sql, params: bound });
        if (/FROM quotes q JOIN nodes n/.test(sql)) {
          return {
            results: (opts.quotes ?? [VERBATIM]).map((verbatim_text) => ({ verbatim_text })),
          };
        }
        return { results: [] };
      },
      async run() {
        calls.push({ sql, params: bound });
        return { results: [], meta: { changes: 0 } };
      },
    };
    return stmt as unknown as D1PreparedStatement;
  };
  const db = {
    prepare: (sql: string) => mk(sql),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
  return { db, calls };
}

const env = (db: D1Database) => ({ DB: db }) as unknown as Env;

const GOOD = `# The transfer escalator

A tetrad on a formula that decides what a province gets.

An escalator is a promise made once and paid forever.

## Enhances
Predictability. A province can plan against a number it already knows, and "${VERBATIM}"

## Obsolesces
The annual negotiation, and with it the annual leverage.

## Retrieves
The block grant: money that arrives without a question attached.

## Reverses into
A ceiling. "The escalator was designed to be generous and became the argument for spending less."

## Sources
1. Housing in the record. Canopticon, https://canopticon.com/p/housing-record
`;

const reply = (text: string) => ({
  text,
  structured: null,
  tool_uses: [],
  stop_reason: "end_turn",
  usage: { input_tokens: 1, output_tokens: 1 },
  cost_cents: 0,
  cost_ledger_id: null,
  model: "anthropic/claude-test",
  provider: "claude_gateway",
});

beforeEach(() => writer.mockReset());

describe("checkQuotations", () => {
  it("counts a verbatim quotation as checked and marks a fabricated one", () => {
    const r = checkQuotations(GOOD, BODY);
    expect(r.checked).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.text).toContain(`"${VERBATIM}"\n`);
    expect(r.text).toContain('became the argument for spending less." ⚠');
  });

  it("ignores short quoted phrases", () => {
    const r = checkQuotations('He called it "a promise" and moved on.', BODY);
    expect(r.checked).toBe(0);
    expect(r.failed).toBe(0);
  });
});

describe("draftTetrad", () => {
  it("asks the writer once, labels the file, and reports the shape and the quotation check", async () => {
    writer.mockResolvedValueOnce(reply(`\`\`\`markdown\n${GOOD}\n\`\`\``));
    const { db } = makeDb();
    const r = await draftTetrad(env(db), "u1", "p1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(writer).toHaveBeenCalledTimes(1);
    const args = writer.mock.calls[0]?.[1] as {
      max_tokens: number;
      messages: Array<{ content: Array<{ text: string }> }>;
    };
    expect(args.max_tokens).toBe(1500);
    expect(args.messages[0]?.content[0]?.text).toContain(`- "${VERBATIM}"`);
    expect(args.messages[0]?.content[0]?.text).toContain("https://canopticon.com/p/housing-record");
    expect(writer.mock.calls[0]?.[2]).toEqual({ writer: null });

    expect(r.parsed).toBe(true);
    expect(r.filename).toBe("tetrad-draft-housing-record.md");
    expect(r.markdown).toMatch(
      /^<!-- DRAFTED BY anthropic\/claude-test as a tetrad from "Housing in the record" \(https:\/\/canopticon\.com\/p\/housing-record\) on \d{4}-\d{2}-\d{2}\. Not published\. Edit before uploading; the byline will be yours\. -->/,
    );
    expect(r.markdown).not.toContain("did not parse as a tetrad");
    expect(r.markdown).toContain(
      "<!-- 2 quotations checked against the document; 1 not found verbatim (marked ⚠ in the text). -->",
    );
    expect(r.checked).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.markdown).toContain('spending less." ⚠');
    expect(r.markdown).not.toContain("```");
    // The labels are comments, so the file still parses as a tetrad.
    expect(parseTetrad(r.markdown)).not.toBeNull();
  });

  it("returns the raw text with a warning label when the draft is not a tetrad", async () => {
    writer.mockResolvedValueOnce(
      reply("# A subject\n\nA dek.\n\n## Enhances\nOne.\n\n## What does it obsolesce?\nTwo.\n"),
    );
    const { db } = makeDb();
    const r = await draftTetrad(env(db), "u1", "p1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed).toBe(false);
    expect(r.markdown).toContain(
      "<!-- This draft did not parse as a tetrad; fix the four headings before uploading. -->",
    );
    expect(r.markdown).toContain("## What does it obsolesce?");
    expect(r.markdown).toContain(
      "<!-- 0 quotations checked against the document; 0 not found verbatim. -->",
    );
  });

  it("refuses a document that is not the operator's, without calling the writer", async () => {
    const { db } = makeDb({ piece: null });
    const r = await draftTetrad(env(db), "u1", "p1");
    expect(r).toEqual({ ok: false, reason: "no such document" });
    expect(writer).not.toHaveBeenCalled();
  });

  it("scopes the document query to the operator and to published or working-material", async () => {
    writer.mockResolvedValueOnce(reply(GOOD));
    const { db, calls } = makeDb();
    await draftTetrad(env(db), "u1", "p1");
    const q = calls.find((c) => /FROM pieces/.test(c.sql));
    expect(q?.sql).toMatch(/publication_status IN \('published', 'working-material'\)/);
    expect(q?.params).toEqual(["p1", "u1"]);
  });
});

describe("the action bar", () => {
  const FULL = {
    ...PIECE,
    subtitle: null,
    kind: "research",
    subtype: null,
    publication_status: "published",
    byline: "Chris Telford",
    published_at: "2026-09-01T00:00:00Z",
    signed_by: null,
    body_html: null,
    chain_id: null,
    tags: "[]",
    metadata: "{}",
    argument_summary_md: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
  function pageEnv(): PublicEnv {
    const mk = (sql: string) => {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first() {
          if (/FROM users/i.test(sql)) return { id: "u1" };
          if (/FROM pieces WHERE user_id = \? AND slug = \?/i.test(sql)) {
            return bound[1] === FULL.slug ? FULL : null;
          }
          if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { results: [], meta: { changes: 0 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    };
    return {
      DB: {
        prepare: (sql: string) => mk(sql),
        dump: async () => new ArrayBuffer(0),
        batch: async () => [],
        exec: async () => ({ count: 0, duration: 0 }),
      },
    } as unknown as PublicEnv;
  }

  it("offers the labelled tetrad draft to the operator and to nobody else", async () => {
    const op = (await renderPiece(pageEnv(), FULL.slug, { isOperator: true })) ?? "";
    expect(op).toContain('action="/op/pieces/p1/draft-tetrad"');
    expect(op).toContain("Draft a tetrad (labelled)");
    const anon = (await renderPiece(pageEnv(), FULL.slug)) ?? "";
    expect(anon).not.toContain("draft-tetrad");
  });
});
