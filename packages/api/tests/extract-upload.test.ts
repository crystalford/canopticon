// PDF and DOCX uploads go through Workers AI's document converter
// (env.AI.toMarkdown) and then down the same path as an .md upload. Images
// are still refused. These tests fake the binding and watch what reaches
// the database — a sources row is the thing the operator sees or does not.

import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { extractUpload } from "../src/graph/lib/extract";

interface Captured {
  sql: string;
  params: unknown[];
}

interface FakeWorld {
  env: Env;
  writes: Captured[];
  sources: Record<string, unknown>[];
  toMarkdownCalls: unknown[];
}

function makeWorld(opts: {
  file: { mime: string; classification: string | null; original_filename: string };
  bytes?: Uint8Array;
  toMarkdown?: (input: unknown) => Promise<unknown>;
}): FakeWorld {
  const writes: Captured[] = [];
  const sources: Record<string, unknown>[] = [];
  const toMarkdownCalls: unknown[] = [];
  const exec = (sql: string, params: unknown[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (
      s.startsWith(
        "SELECT id, user_id, r2_key, mime, classification, original_filename FROM uploaded_files",
      )
    ) {
      return [
        {
          id: "file_1",
          user_id: "user_1",
          r2_key: "uploads/user_1/x.bin",
          mime: opts.file.mime,
          classification: opts.file.classification,
          original_filename: opts.file.original_filename,
        },
      ];
    }
    writes.push({ sql: s, params });
    const ins = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/);
    if (ins && ins[1] === "sources") {
      const row: Record<string, unknown> = {};
      (ins[2] ?? "")
        .split(",")
        .map((c) => c.trim())
        .forEach((c, i) => {
          row[c] = params[i];
        });
      sources.push(row);
    }
    return [];
  };
  const db = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          bound = a;
          return stmt;
        },
        async first<T>() {
          return (exec(sql, bound)[0] as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: exec(sql, bound) as T[] };
        },
        async run() {
          exec(sql, bound);
          return { results: [], success: true, meta: { changes: 1 } };
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;

  const bytes = opts.bytes ?? new TextEncoder().encode("%PDF-1.4 fake bytes");
  const files = {
    async get(_key: string) {
      return {
        async arrayBuffer() {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
        async text() {
          return new TextDecoder().decode(bytes);
        },
      };
    },
    async put() {
      return null;
    },
  } as unknown as R2Bucket;

  const ai = {
    async run() {
      throw new Error("no embeddings in tests");
    },
    ...(opts.toMarkdown
      ? {
          async toMarkdown(input: unknown) {
            toMarkdownCalls.push(input);
            return opts.toMarkdown?.(input);
          },
        }
      : {}),
  } as unknown as Ai;

  const env = { DB: db, FILES: files, AI: ai, EMBEDDINGS: {} } as unknown as Env;
  return { env, writes, sources, toMarkdownCalls };
}

const PDF = { mime: "application/pdf", classification: "pdf", original_filename: "report.pdf" };
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("extractUpload — PDF through toMarkdown", () => {
  it("converts the bytes, writes a sources row, and titles it from the first heading", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async (input) => {
        const docs = input as { name: string; blob: Blob }[];
        return docs.map((d) => ({
          name: d.name,
          mimeType: "application/pdf",
          format: "markdown",
          tokens: 12,
          data: "# The Housing Estimate\n\nDepartmental spending was tabled on 4 March.",
        }));
      },
    });
    const result = await extractUpload(world.env, "file_1");

    // The call shape: an array of { name, blob } with the PDF bytes.
    expect(world.toMarkdownCalls).toHaveLength(1);
    const arg = world.toMarkdownCalls[0] as { name: string; blob: Blob }[];
    expect(Array.isArray(arg)).toBe(true);
    expect(arg[0]?.name).toBe("report.pdf");
    expect(arg[0]?.blob).toBeInstanceOf(Blob);
    expect(arg[0]?.blob.type).toBe("application/pdf");

    expect(result.classification).toBe("pdf");
    expect(result.extracted_chars).toBe(
      "# The Housing Estimate\n\nDepartmental spending was tabled on 4 March.".length,
    );
    expect(world.sources).toHaveLength(1);
    const src = world.sources[0] as Record<string, unknown>;
    expect(src.title).toBe("The Housing Estimate");
    expect(src.ingestion_state).toBe("pending_critic");
    expect(String(src.content_text)).toContain("Departmental spending");
    const meta = JSON.parse(String(src.metadata)) as Record<string, unknown>;
    expect(meta.extraction_method).toBe("to-markdown");
    expect(meta.extracted_chars).toBe(result.extracted_chars);
    expect(meta.upload_file_id).toBe("file_1");

    const status = world.writes.find((w) => w.sql.includes("extraction_status = 'extracted'"));
    expect(status).toBeDefined();
  });

  it("accepts the single-object form of the response", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async () => ({
        name: "report.pdf",
        mimeType: "application/pdf",
        format: "markdown",
        tokens: 3,
        data: "Plain paragraph with no heading.",
      }),
    });
    const result = await extractUpload(world.env, "file_1");
    expect(result.extracted_chars).toBe("Plain paragraph with no heading.".length);
    expect(world.sources[0]?.title).toBe("Plain paragraph with no heading.");
  });

  it("routes a .docx by MIME even though the upload route classifies it 'text'", async () => {
    const world = makeWorld({
      file: { mime: DOCX_MIME, classification: "text", original_filename: "memo.docx" },
      toMarkdown: async () => [
        {
          name: "memo.docx",
          mimeType: DOCX_MIME,
          format: "markdown",
          tokens: 2,
          data: "## Memo\n\nBody.",
        },
      ],
    });
    const result = await extractUpload(world.env, "file_1");
    expect(world.toMarkdownCalls).toHaveLength(1);
    expect(result.extracted_chars).toBe("## Memo\n\nBody.".length);
    const meta = JSON.parse(String(world.sources[0]?.metadata)) as Record<string, unknown>;
    expect(meta.extraction_method).toBe("to-markdown");
  });

  it("truncates converter output at 200,000 chars and records what was kept", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async () => [
        {
          name: "report.pdf",
          mimeType: "application/pdf",
          format: "markdown",
          tokens: 1,
          data: "x".repeat(250_000),
        },
      ],
    });
    const result = await extractUpload(world.env, "file_1");
    expect(result.extracted_chars).toBe(200_000);
    const meta = JSON.parse(String(world.sources[0]?.metadata)) as Record<string, unknown>;
    expect(meta.extracted_chars).toBe(200_000);
  });
});

describe("extractUpload — when the converter gives nothing", () => {
  it("names the likely cause (a scanned PDF) and marks the upload failed", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async () => [
        {
          name: "report.pdf",
          mimeType: "application/pdf",
          format: "markdown",
          tokens: 0,
          data: "   \n",
        },
      ],
    });
    await expect(extractUpload(world.env, "file_1")).rejects.toThrow(
      "PDF produced no text — scanned image without a text layer?",
    );
    expect(world.sources).toHaveLength(0);
    const failed = world.writes.find((w) => w.sql.includes("extraction_status = 'failed'"));
    expect(failed).toBeDefined();
    expect(String(failed?.params[0])).toContain("scanned image");
  });

  it("surfaces a converter error result as a stated reason", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async () => [
        {
          name: "report.pdf",
          mimeType: "application/pdf",
          format: "error",
          error: "encrypted document",
        },
      ],
    });
    await expect(extractUpload(world.env, "file_1")).rejects.toThrow("encrypted document");
    expect(world.sources).toHaveLength(0);
  });

  it("surfaces a thrown conversion as a stated reason", async () => {
    const world = makeWorld({
      file: PDF,
      toMarkdown: async () => {
        throw new Error("binding timeout");
      },
    });
    await expect(extractUpload(world.env, "file_1")).rejects.toThrow(
      "PDF conversion failed — Workers AI toMarkdown threw: binding timeout",
    );
  });

  it("says so when the binding has no toMarkdown at all", async () => {
    const world = makeWorld({ file: PDF });
    await expect(extractUpload(world.env, "file_1")).rejects.toThrow("no toMarkdown()");
  });
});

describe("extractUpload — what is still refused", () => {
  it("refuses images with the same stated reason, never calling the converter", async () => {
    const world = makeWorld({
      file: { mime: "image/png", classification: "image", original_filename: "scan.png" },
      toMarkdown: async () => [
        {
          name: "scan.png",
          mimeType: "image/png",
          format: "markdown",
          tokens: 1,
          data: "invented",
        },
      ],
    });
    await expect(extractUpload(world.env, "file_1")).rejects.toThrow(
      "Image extraction is not yet supported",
    );
    expect(world.toMarkdownCalls).toHaveLength(0);
    expect(world.sources).toHaveLength(0);
  });
});

describe("extractUpload — plain text keeps its path", () => {
  it("records extraction_method 'text' for a markdown upload and never calls the converter", async () => {
    const world = makeWorld({
      file: { mime: "text/markdown", classification: "markdown", original_filename: "notes.md" },
      bytes: new TextEncoder().encode("# Notes\n\nA paragraph."),
      toMarkdown: async () => {
        throw new Error("should not be called");
      },
    });
    const result = await extractUpload(world.env, "file_1");
    expect(world.toMarkdownCalls).toHaveLength(0);
    expect(result.classification).toBe("markdown");
    expect(world.sources[0]?.title).toBe("Notes");
    const meta = JSON.parse(String(world.sources[0]?.metadata)) as Record<string, unknown>;
    expect(meta.extraction_method).toBe("text");
  });
});
