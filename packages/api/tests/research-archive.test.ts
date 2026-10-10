// The research archive — checked by unzipping what it actually produces.
//
// An archive fails quietly. Two slugs that sanitise alike overwrite each other
// and the zip is still valid; a title with a quote in it breaks the front
// matter and nothing notices until someone parses it; an empty body becomes an
// empty file that looks like a document. So these tests open the real bytes.

import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  type ArchivePiece,
  archiveFilename,
  buildArchive,
  frontMatter,
} from "../src/lib/research-archive";

const piece = (over: Partial<ArchivePiece> = {}): ArchivePiece => ({
  slug: "a-report",
  title: "A Report",
  body_md: "# A Report\n\nBody text.",
  published_at: "2026-05-14T00:00:00.000Z",
  publication_status: "published",
  ...over,
});

const open = (pieces: ArchivePiece[]) => {
  const { bytes, included, skipped } = buildArchive(pieces);
  const files = unzipSync(bytes);
  const text = (n: string) => new TextDecoder().decode(files[n]);
  return { files, text, included, skipped, names: Object.keys(files).sort() };
};

describe("what goes in", () => {
  it("writes one .md per document plus an INDEX", () => {
    const { names, included } = open([piece(), piece({ slug: "b", title: "B" })]);
    expect(names).toEqual(["INDEX.md", "a-report.md", "b.md"]);
    expect(included).toBe(2);
  });

  it("keeps the body byte-for-byte, under the front matter and nothing else", () => {
    // The archive is an export of what was uploaded. A body that was tidied on
    // the way out would be a second, silently different copy of the record.
    const body =
      "# Heading\r\n\r\nA  line with   odd   spacing — and a “curly” quote.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    const { text } = open([piece({ body_md: body })]);
    expect(text("a-report.md").endsWith(body)).toBe(true);
  });

  it("skips a document with no body and counts it, rather than writing an empty file", () => {
    const { names, skipped, included } = open([
      piece(),
      piece({ slug: "empty", body_md: "  \n " }),
      piece({ slug: "none", body_md: null }),
    ]);
    expect(names).not.toContain("empty.md");
    expect(names).not.toContain("none.md");
    expect(skipped).toBe(2);
    expect(included).toBe(1);
  });

  it("is still a valid archive when there is nothing to put in it", () => {
    const { names, included } = open([]);
    expect(names).toEqual(["INDEX.md"]);
    expect(included).toBe(0);
  });
});

describe("filenames", () => {
  it("never lets two documents overwrite each other", () => {
    // A zip with a duplicate path keeps one and drops the other, and is still
    // perfectly valid — the loss is invisible.
    const { names, text } = open([
      piece({ slug: "Same Slug!", body_md: "first" }),
      piece({ slug: "same-slug", body_md: "second" }),
    ]);
    expect(names.filter((n) => n.startsWith("same-slug"))).toHaveLength(2);
    const bodies = names.filter((n) => n.startsWith("same-slug")).map((n) => text(n));
    expect(bodies.some((b) => b.endsWith("first"))).toBe(true);
    expect(bodies.some((b) => b.endsWith("second"))).toBe(true);
  });

  it("cannot collide with the index", () => {
    const { names } = open([piece({ slug: "index" })]);
    expect(names).toContain("index.md");
    expect(names).toContain("INDEX.md");
    expect(archiveFilename("INDEX", new Set(["INDEX.md"]))).not.toBe("INDEX.md");
  });

  it("is safe on every platform", () => {
    for (const slug of ["../../etc/passwd", "a/b\\c", "con:nul?", "  spaced  ", ""]) {
      const name = archiveFilename(slug, new Set());
      expect(name, slug).toMatch(/^[a-z0-9._-]+\.md$/);
      expect(name, slug).not.toContain("..");
      expect(name, slug).not.toContain("/");
    }
  });
});

describe("the front matter", () => {
  it("survives a title full of quotes and colons", () => {
    // These titles are real: 'Canada\'s €64M "Investment" …', 'Design Brief: … "The Draft Room"'.
    const title = `Design Brief: The Build Surface for Aldershot — "The Draft Room"`;
    const fm = frontMatter(piece({ title }));
    const line = fm.split("\n").find((l) => l.startsWith("title: "));
    // JSON string syntax is valid YAML, so parsing the value back is the check.
    expect(JSON.parse((line ?? "").slice("title: ".length))).toBe(title);
  });

  it("says where the document lives and says so plainly when the date is unknown", () => {
    const fm = frontMatter(piece({ published_at: null }));
    expect(fm).toContain('url: "https://canopticon.com/p/a-report"');
    expect(fm).toContain('published: "unknown"');
  });

  it("is a closed block", () => {
    const fm = frontMatter(piece());
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm.trimEnd().endsWith("---")).toBe(true);
  });
});

describe("the index", () => {
  it("lists every document with its size, and a title cannot break a link", () => {
    const { text } = open([piece({ title: "A [bracketed] title", body_md: "x".repeat(1234) })]);
    const idx = text("INDEX.md");
    expect(idx).toContain("1 documents, 1,234 characters");
    expect(idx).toContain("[A bracketed title](a-report.md)");
  });
});

describe("the route", () => {
  it("is behind the operator session, and sends a stranger to the library", async () => {
    const { default: app } = await import("../src/index.ts");
    const db = {
      prepare: () => ({
        bind() {
          return this;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { results: [], meta: { changes: 0 } };
        },
      }),
    } as unknown as D1Database;
    const res = await app.fetch(new Request("http://test/op/export/research.zip"), {
      DB: db,
      ANTHROPIC_API_KEY: "t",
      LOG_LEVEL: "info",
    } as never);
    // No operator resolves, so it must not hand out a corpus.
    expect(res.headers.get("content-type") ?? "").not.toContain("zip");
  });
});

// The route end to end: real handler, stub DB, real zip bytes back out.
describe("the download, end to end", () => {
  const rows = [
    {
      slug: "one",
      title: "One",
      body_md: "# One\n\nFirst.",
      published_at: "2026-01-01T00:00:00Z",
      publication_status: "published",
    },
    {
      slug: "two",
      title: 'Two: "quoted"',
      body_md: "# Two\n\nSecond.",
      published_at: null,
      publication_status: "published",
    },
  ];
  let sawGuard = "";
  const db = (operator: boolean) =>
    ({
      prepare(sql: string) {
        if (/FROM pieces/i.test(sql)) sawGuard = sql;
        const stmt = {
          bind() {
            return stmt;
          },
          async first() {
            return operator && /FROM users/i.test(sql) ? { id: "op1" } : null;
          },
          async all() {
            return { results: /FROM pieces/i.test(sql) ? rows : [] };
          },
          async run() {
            return { results: [], meta: { changes: 0 } };
          },
        };
        return stmt as unknown as D1PreparedStatement;
      },
    }) as unknown as D1Database;

  it("returns a zip whose files are the documents, with counts in the headers", async () => {
    const { default: app } = await import("../src/index.ts");
    const res = await app.fetch(new Request("http://test/op/export/research.zip"), {
      DB: db(true),
      ANTHROPIC_API_KEY: "t",
      LOG_LEVEL: "info",
    } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="canopticon-research-\d{4}-\d{2}-\d{2}\.zip"$/,
    );
    expect(res.headers.get("x-archive-included")).toBe("2");
    expect(res.headers.get("cache-control")).toBe("no-store");

    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["INDEX.md", "one.md", "two.md"]);
    expect(new TextDecoder().decode(files["one.md"]).endsWith("# One\n\nFirst.")).toBe(true);
  });

  it("only ever asks for the operator's own uploads", () => {
    // The guard that keeps the research pipeline's drafts and any third-party
    // text out of an archive. If someone drops it, this is the test that says so.
    expect(sawGuard).toContain("json_extract(metadata, '$.ingested_from') = 'feed-upload'");
    expect(sawGuard).toContain("web-fetched");
  });

  it("hands nothing to a request with no operator behind it", async () => {
    const { default: app } = await import("../src/index.ts");
    const res = await app.fetch(new Request("http://test/op/export/research.zip"), {
      DB: db(false),
      ANTHROPIC_API_KEY: "t",
      LOG_LEVEL: "info",
    } as never);
    expect(res.headers.get("content-type") ?? "").not.toContain("zip");
    expect([301, 302, 303]).toContain(res.status);
  });
});
