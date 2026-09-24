// Extraction pipelines for uploaded files and URLs.
//
// All extractions land as a sources row with ingestion_state='pending_critic'
// so the downstream cascade (ingestion_critic -> claim_extraction -> ...)
// fires automatically.

import type { Env } from "../../env";
import { insertOne, one, parseJson, run } from "../../lib/d1";
import { fetchWithTimeout } from "../../lib/timeout";
import { embedText, upsertVector, vectorId } from "./embeddings";

const INLINE_TEXT_MAX = 8 * 1024; // 8KB head kept in D1; full text lives in R2
const EXTRACT_TEXT_MAX = 200_000; // hard ceiling on extracted text, whatever the format

// How the text in a sources row was obtained. Recorded in sources.metadata
// so the ingestion receipt can say it: "text" means the bytes WERE the text
// (md/txt/html, html stripped of tags); "to-markdown" means Workers AI's
// document converter produced it from a PDF or DOCX.
export type ExtractionMethod = "text" | "to-markdown";

// MIME types Workers AI's toMarkdown converts for us. Images are deliberately
// absent — see extractImage.
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TO_MARKDOWN_MIMES: Record<string, "pdf" | "docx"> = {
  "application/pdf": "pdf",
  [DOCX_MIME]: "docx",
};

// Read the FULL extracted text for a source — the inline 8KB head plus the R2
// overflow when the document was larger. Digestion uses this so claim/entity
// extraction sees the whole document, not just the first ~2 pages.
export async function readFullExtractedText(
  env: Env,
  sourceId: string,
  userId: string,
): Promise<{ text: string; title: string }> {
  const row = await one<{ content_text: string | null; title: string; metadata: string | null }>(
    env.DB,
    "SELECT content_text, title, metadata FROM sources WHERE id = ? AND user_id = ?",
    [sourceId, userId],
  );
  if (!row) return { text: "", title: "" };
  const meta = parseJson<{ extracted_chars?: number; upload_file_id?: string }>(row.metadata, {});
  let text = row.content_text ?? "";
  if ((meta.extracted_chars ?? 0) > INLINE_TEXT_MAX && meta.upload_file_id) {
    try {
      const obj = await env.FILES.get(`extracted/${meta.upload_file_id}.txt`);
      if (obj) text = await obj.text();
    } catch {
      // fall back to the inline head if R2 read fails
    }
  }
  return { text, title: row.title ?? "" };
}

interface UploadedFile {
  id: string;
  user_id: string;
  r2_key: string;
  mime: string;
  classification: string | null;
  original_filename: string;
}

export interface ExtractResult {
  source_id: string;
  extracted_chars: number;
  classification: string;
}

export async function extractUpload(env: Env, fileId: string): Promise<ExtractResult> {
  const file = await one<UploadedFile>(
    env.DB,
    `SELECT id, user_id, r2_key, mime, classification, original_filename
     FROM uploaded_files WHERE id = ?`,
    [fileId],
  );
  if (!file) throw new Error(`uploaded_file not found: ${fileId}`);

  await run(env.DB, `UPDATE uploaded_files SET extraction_status = 'extracting' WHERE id = ?`, [
    fileId,
  ]);

  let text = "";
  let summary = "";
  let extraction_method: ExtractionMethod = "text";

  try {
    const obj = await env.FILES.get(file.r2_key);
    if (!obj) throw new Error(`R2 object missing: ${file.r2_key}`);

    const binaryKind = binaryDocumentKind(file);
    if (binaryKind) {
      // PDF / DOCX: Workers AI converts the bytes to markdown, and from here
      // on the result is treated exactly like an uploaded .md file.
      text = (await extractViaToMarkdown(env, file, obj, binaryKind)).slice(0, EXTRACT_TEXT_MAX);
      summary = text.slice(0, 300);
      extraction_method = "to-markdown";
    } else if (file.classification === "image") {
      ({ text, summary } = await extractImage(env, file.user_id, obj));
    } else if (file.classification === "html") {
      const html = await obj.text();
      text = stripHtml(html).slice(0, EXTRACT_TEXT_MAX);
      summary = text.slice(0, 300);
    } else {
      // text / markdown / other plain
      text = (await obj.text()).slice(0, EXTRACT_TEXT_MAX);
      summary = text.slice(0, 300);
    }

    // Derive a real title from content for anything that isn't already
    // pre-titled (the URL path sets original_filename to its <title> tag
    // before calling extractUpload's sibling, extractUrl — html uploads and
    // plain text/markdown never had that). A shallow copy keeps the true
    // filename intact in uploaded_files itself; only the in-memory value
    // persistExtraction reads for sources.title changes.
    const derivedTitle = file.classification !== "html" ? extractTitleFromMarkdown(text) : null;
    const titledFile = derivedTitle ? { ...file, original_filename: derivedTitle } : file;
    return await persistExtraction(env, titledFile, text, summary, { extraction_method });
  } catch (err) {
    await run(
      env.DB,
      `UPDATE uploaded_files SET extraction_status = 'failed', metadata = ? WHERE id = ?`,
      [JSON.stringify({ error: (err as Error).message }), fileId],
    );
    throw err;
  }
}

export async function extractUrl(env: Env, userId: string, url: string): Promise<ExtractResult> {
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "user-agent": "Canopticon/1.0 (operator intake)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
      redirect: "follow",
    },
    undefined,
    `extractUrl[${new URL(url).hostname}]`,
  );
  if (!res.ok) throw new Error(`Fetch ${url} returned ${res.status}`);
  const body = await res.text();
  const text = stripHtml(body).slice(0, EXTRACT_TEXT_MAX);
  const summary = text.slice(0, 300);
  const title = extractTitle(body) ?? url;
  const r2_key = `uploads/${userId}/${crypto.randomUUID()}-url.html`;
  await env.FILES.put(r2_key, body, { httpMetadata: { contentType: "text/html" } });
  const fileId = await insertOne(env.DB, "uploaded_files", {
    user_id: userId,
    r2_key,
    original_filename: title.slice(0, 200),
    mime: "text/html",
    size_bytes: body.length,
    classification: "url",
    extraction_status: "extracted",
  });
  const file: UploadedFile = {
    id: fileId,
    user_id: userId,
    r2_key,
    mime: "text/html",
    classification: "url",
    original_filename: title,
  };
  return persistExtraction(env, file, text, summary, { url, extraction_method: "text" });
}

// Is this upload a PDF or a DOCX? Decided from the MIME type first, then the
// extension, then the upload route's own classification — the route only
// classifies "pdf", so a .docx arrives classified "text" and would otherwise
// be read as UTF-8 zip bytes.
function binaryDocumentKind(file: UploadedFile): "pdf" | "docx" | null {
  const mime = (file.mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (TO_MARKDOWN_MIMES[mime]) return TO_MARKDOWN_MIMES[mime];
  const ext = (file.original_filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (file.classification === "pdf") return "pdf";
  return null;
}

// The subset of Workers AI's Markdown Conversion we rely on. Typed locally so
// this file does not depend on a particular @cloudflare/workers-types release
// having it (the installed one does; older ones do not).
interface ToMarkdownDocument {
  name: string;
  blob: Blob;
}
type ToMarkdownResult =
  | { name: string; mimeType: string; format: "markdown"; tokens: number; data: string }
  | { name: string; mimeType: string; format: "error"; error: string };
interface ToMarkdownAi {
  toMarkdown(files: ToMarkdownDocument[]): Promise<ToMarkdownResult[]>;
  toMarkdown(file: ToMarkdownDocument): Promise<ToMarkdownResult>;
}

// PDF and DOCX go through Cloudflare's document converter
// (`env.AI.toMarkdown`), which reads the actual bytes. This replaces the
// 2026-07 fail-closed stub: the chat adapter never forwarded file bytes to a
// model, so anything "extracted" from a PDF was invented. toMarkdown is a
// parser, not a model — a PDF's text layer comes out as it was, and a PDF
// with no text layer (a scan) comes out empty, which we refuse rather than
// guess at.
async function extractViaToMarkdown(
  env: Env,
  file: UploadedFile,
  obj: R2ObjectBody,
  kind: "pdf" | "docx",
): Promise<string> {
  const label = kind === "pdf" ? "PDF" : "DOCX";
  const ai = env.AI as unknown as Partial<ToMarkdownAi>;
  if (typeof ai.toMarkdown !== "function") {
    throw new Error(
      `${label} extraction is unavailable — the AI binding has no toMarkdown() on this deploy.`,
    );
  }
  const mime = kind === "pdf" ? "application/pdf" : DOCX_MIME;
  const blob = new Blob([await obj.arrayBuffer()], { type: mime });
  const doc: ToMarkdownDocument = { name: file.original_filename || `upload.${kind}`, blob };

  let results: ToMarkdownResult[];
  try {
    const out = await ai.toMarkdown([doc]);
    results = Array.isArray(out) ? out : [out as ToMarkdownResult];
  } catch (err) {
    throw new Error(
      `${label} conversion failed — Workers AI toMarkdown threw: ${(err as Error).message ?? String(err)}`,
    );
  }

  const first = results[0];
  if (!first) throw new Error(`${label} conversion returned nothing — no result for the file.`);
  if (first.format === "error") {
    throw new Error(`${label} conversion failed — converter reported: ${first.error}`);
  }
  const text = (first.data ?? "").trim();
  if (text.length === 0) {
    throw new Error(
      kind === "pdf"
        ? "PDF produced no text — scanned image without a text layer? Nothing was added to the record; provide a text export or an OCR'd copy."
        : "DOCX produced no text — the document appears to be empty or image-only. Nothing was added to the record.",
    );
  }
  return text;
}

// FAIL CLOSED (integrity fix, 2026-07): the Workers AI chat adapter
// (llm/workers_ai.ts serializeContent) does NOT forward image bytes to the
// model — it substitutes a placeholder string, so the model fabricates text
// it never saw. Until a true vision model is wired, we refuse rather than
// fabricate. The upload is banked in R2 and marked failed with a clear,
// operator-facing reason; nothing enters the graph.
async function extractImage(
  _env: Env,
  _userId: string,
  _obj: R2ObjectBody,
): Promise<{ text: string; summary: string }> {
  throw new Error(
    "Image extraction is not yet supported — the model cannot read the image bytes, and we will not add invented text to the record. Provide the text of the document instead.",
  );
}

async function persistExtraction(
  env: Env,
  file: UploadedFile,
  text: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): Promise<ExtractResult> {
  const inline = text.slice(0, INLINE_TEXT_MAX);
  // Stash full text in R2 if it overflows the inline budget.
  if (text.length > INLINE_TEXT_MAX) {
    await env.FILES.put(`extracted/${file.id}.txt`, text, {
      httpMetadata: { contentType: "text/plain" },
    });
  }

  const sourceTitle = file.original_filename || "Untitled upload";
  const source_id = await insertOne(env.DB, "sources", {
    user_id: file.user_id,
    source_type: "report",
    ingestion_state: "pending_critic",
    title: sourceTitle,
    content_text: inline,
    ingested_via: "operator_upload",
    metadata: {
      ...metadata,
      upload_file_id: file.id,
      r2_key: file.r2_key,
      extracted_chars: text.length,
    },
  });

  await run(
    env.DB,
    `UPDATE uploaded_files
        SET extraction_status = 'extracted',
            extracted_text = ?,
            extracted_summary = ?,
            created_source_id = ?
      WHERE id = ?`,
    [inline, summary, source_id, file.id],
  );

  // Best-effort embedding for vector search.
  try {
    const values = await embedText(env, `${sourceTitle}\n${summary}`);
    await upsertVector(env, {
      id: vectorId("source", source_id),
      values,
      metadata: { user_id: file.user_id, kind: "source", id: source_id, title: sourceTitle },
    });
  } catch {
    // Non-fatal — embeddings are eventually consistent via the backfill route.
  }

  return {
    source_id,
    extracted_chars: text.length,
    classification: file.classification ?? "other",
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? m[1].trim() : null;
}

// File uploads never had this: persistExtraction always fell back to the
// raw uploaded filename (e.g. "compass_artifact_wf-c96cfa7c-...md"), so
// every uploaded document's title on the public Library was the ugly
// filename, which the frontend then had to detect and hide behind
// "Untitled research document." Pull a real title from the document's own
// first markdown heading or first line instead — same idea as extractTitle
// above, just for content the browser never parsed as HTML.
function extractTitleFromMarkdown(text: string): string | null {
  const heading = text.match(/^#{1,2}\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim().slice(0, 200);
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine.length <= 200) return firstLine;
  return null;
}
