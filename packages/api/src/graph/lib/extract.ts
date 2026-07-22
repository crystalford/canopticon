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

  try {
    const obj = await env.FILES.get(file.r2_key);
    if (!obj) throw new Error(`R2 object missing: ${file.r2_key}`);

    if (file.classification === "pdf") {
      ({ text, summary } = await extractPdf(env, file.user_id, obj));
    } else if (file.classification === "image") {
      ({ text, summary } = await extractImage(env, file.user_id, obj));
    } else if (file.classification === "html") {
      const html = await obj.text();
      text = stripHtml(html).slice(0, 200_000);
      summary = text.slice(0, 300);
    } else {
      // text / markdown / other plain
      text = (await obj.text()).slice(0, 200_000);
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
    return await persistExtraction(env, titledFile, text, summary);
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
  const text = stripHtml(body).slice(0, 200_000);
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
  return persistExtraction(env, file, text, summary, { url });
}

// FAIL CLOSED (integrity fix, 2026-07): the Workers AI chat adapter
// (llm/workers_ai.ts serializeContent) does NOT forward document/image
// bytes to the model — it substitutes a placeholder string, so the model
// fabricates text it never saw. For a forensic-record system that means a
// PDF drop would produce a graph of invented "facts" with fake receipts.
// Until real multimodal extraction is wired (Cloudflare `env.AI.toMarkdown`
// for documents / a true vision model for images), we refuse rather than
// fabricate. The upload is banked in R2 and marked failed with a clear,
// operator-facing reason; nothing enters the graph.
async function extractPdf(
  _env: Env,
  _userId: string,
  _obj: R2ObjectBody,
): Promise<{ text: string; summary: string }> {
  throw new Error(
    "PDF extraction is not yet supported — the model cannot read the file bytes, and we will not add invented text to the record. Paste the document text (or a .txt/.md/.html export) instead.",
  );
}

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
