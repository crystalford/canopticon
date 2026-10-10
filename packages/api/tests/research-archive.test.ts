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
  MAX_DOCS_PER_ZIP,
  archiveFilename,
  archiveParts,
  buildArchive,
  frontMatter,
  planParts,
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

describe("splitting into parts", () => {
  // The reason this exists: Claude Design reads about twenty files from a zip
  // and silently drops the rest. 52 reports plus an index arrived as roughly
  // the first twenty, with nothing to say the others had been cut.
  it("never plans a part bigger than the cap", () => {
    for (let n = 0; n <= 200; n++) {
      for (const size of planParts(n)) expect(size).toBeLessThanOrEqual(MAX_DOCS_PER_ZIP);
    }
  });

  it("plans every document into exactly one part", () => {
    for (let n = 0; n <= 200; n++) expect(planParts(n).reduce((a, b) => a + b, 0)).toBe(n);
  });

  it("deals them out evenly, so no part looks like a mistake", () => {
    // 15/15/15/7 is four downloads with a stub on the end; 13/13/13/13 is not.
    expect(planParts(52)).toEqual([13, 13, 13, 13]);
    for (let n = 1; n <= 200; n++) {
      const sizes = planParts(n);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("uses as few parts as the cap allows", () => {
    expect(planParts(15)).toEqual([15]);
    expect(planParts(16)).toEqual([8, 8]);
    expect(planParts(1)).toEqual([1]);
    expect(planParts(0)).toEqual([]);
  });

  it("keeps order and loses nothing across parts", () => {
    const pieces = Array.from({ length: 52 }, (_, i) =>
      piece({ slug: `d-${i}`, title: `Doc ${i}` }),
    );
    const { parts } = archiveParts(pieces);
    expect(parts.map((p) => p.length)).toEqual([13, 13, 13, 13]);
    expect(parts.flat().map((p) => p.slug)).toEqual(pieces.map((p) => p.slug));
  });

  it("drops empty documents BEFORE splitting, so one cannot shift the parts", () => {
    const pieces = Array.from({ length: 20 }, (_, i) =>
      piece({ slug: `d-${i}`, body_md: i === 3 ? "  " : `body ${i}` }),
    );
    const { parts, skipped } = archiveParts(pieces);
    expect(skipped).toBe(1);
    expect(parts.flat()).toHaveLength(19);
    expect(parts.map((p) => p.length)).toEqual([10, 9]);
  });

  it("keeps every zip under the file limit, index included", () => {
    // The cap is on documents; the real constraint is files in the zip, and
    // INDEX.md is one of them.
    const pieces = Array.from({ length: 52 }, (_, i) => piece({ slug: `d-${i}` }));
    for (const docs of archiveParts(pieces).parts) {
      expect(Object.keys(open(docs).files).length).toBeLessThanOrEqual(MAX_DOCS_PER_ZIP + 1);
    }
  });

  it("tells each part where it sits in the whole", () => {
    const pieces = Array.from({ length: 30 }, (_, i) =>
      piece({ slug: `d-${i}`, title: `Doc ${i}` }),
    );
    const { parts } = archiveParts(pieces);
    const { bytes } = buildArchive(parts[1] ?? [], {
      part: 2,
      parts: parts.length,
      first: 16,
      total: 30,
    });
    const idx = new TextDecoder().decode(unzipSync(bytes)["INDEX.md"]);
    expect(idx).toContain("Part 2 of 2");
    expect(idx).toContain("documents 16–30 of 30");
  });
});

// The route end to end: real handler, stub DB, real zip bytes back out.
describe("the download, end to end", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      slug: `doc-${String(i + 1).padStart(2, "0")}`,
      title: `Document ${i + 1}`,
      body_md: `# Document ${i + 1}\n\nBody ${i + 1}.`,
      published_at: "2026-01-01T00:00:00Z",
      publication_status: "published",
    }));
  let sawGuard = "";
  const db = (operator: boolean, rows = many(40)) =>
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
  const fetchAs = async (path: string, d: D1Database) => {
    const { default: app } = await import("../src/index.ts");
    return app.fetch(new Request(`http://test${path}`), {
      DB: d,
      ANTHROPIC_API_KEY: "t",
      LOG_LEVEL: "info",
    } as never);
  };

  it("returns the requested part, and only that part", async () => {
    // 40 documents -> 3 parts of 14/13/13. Part 2 is documents 15-27.
    const res = await fetchAs("/op/export/research.zip?part=2", db(true));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("x-archive-part")).toBe("2");
    expect(res.headers.get("x-archive-parts")).toBe("3");
    expect(res.headers.get("x-archive-included")).toBe("13");
    expect(res.headers.get("content-disposition")).toMatch(/part-2-of-3-\d{4}-\d{2}-\d{2}\.zip"$/);

    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const names = Object.keys(files).sort();
    expect(names).toHaveLength(14); // 13 documents + INDEX.md
    expect(names).toContain("doc-15.md");
    expect(names).toContain("doc-27.md");
    expect(names).not.toContain("doc-14.md");
    expect(names).not.toContain("doc-28.md");
  });

  it("every part together is every document, once", async () => {
    const seen: string[] = [];
    for (const part of [1, 2, 3]) {
      const res = await fetchAs(`/op/export/research.zip?part=${part}`, db(true));
      const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
      seen.push(...Object.keys(files).filter((n) => n !== "INDEX.md"));
    }
    expect(seen).toHaveLength(40);
    expect(new Set(seen).size).toBe(40);
  });

  it("sends a missing or impossible part to the list, never to an error", async () => {
    for (const q of ["", "?part=0", "?part=4", "?part=abc", "?part=-1"]) {
      const res = await fetchAs(`/op/export/research.zip${q}`, db(true));
      expect(res.status, q).toBe(302);
      expect(res.headers.get("location"), q).toBe("/op/export");
    }
  });

  it("lists every part with its own download link and every title", async () => {
    const res = await fetchAs("/op/export", db(true));
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const part of [1, 2, 3]) expect(html).toContain(`/op/export/research.zip?part=${part}`);
    expect(html).not.toContain("research.zip?part=4");
    expect(html).toContain("Part 1 of 3");
    expect(html).toContain("Documents 15–27");
    expect(html).toContain("Document 40");
  });

  it("says plainly when there is nothing to download", async () => {
    const res = await fetchAs("/op/export", db(true, []));
    expect(await res.text()).toContain("no uploaded reports");
  });

  it("only ever asks for the operator's own uploads", async () => {
    await fetchAs("/op/export", db(true));
    // The guard that keeps the research pipeline's drafts and any third-party
    // text out of an archive. If someone drops it, this is the test that says so.
    expect(sawGuard).toContain("json_extract(metadata, '$.ingested_from') = 'feed-upload'");
    expect(sawGuard).toContain("web-fetched");
  });

  it("hands nothing to a request with no operator behind it", async () => {
    for (const path of ["/op/export", "/op/export/research.zip?part=1"]) {
      const res = await fetchAs(path, db(false));
      expect(res.headers.get("content-type") ?? "", path).not.toContain("zip");
      expect([301, 302, 303], path).toContain(res.status);
    }
  });
});
