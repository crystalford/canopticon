// Extraction pipelines for uploaded files and URLs.
//
// All extractions land as a sources row with ingestion_state='pending_critic'
// so the downstream cascade (ingestion_critic -> claim_extraction -> ...)
// fires automatically.

import type { Env } from "../env";
import { insertOne, one, run } from "../lib/d1";
import { embedText, upsertVector, vectorId } from "./embeddings";
import { callLLM } from "./index";

const INLINE_TEXT_MAX = 8 * 1024; // 8KB head kept in D1; full text lives in R2

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

    return await persistExtraction(env, file, text, summary);
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
  const res = await fetch(url, {
    headers: {
      "user-agent": "Canopticon/1.0 (operator intake)",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
    redirect: "follow",
  });
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

async function extractPdf(
  env: Env,
  userId: string,
  obj: R2ObjectBody,
): Promise<{ text: string; summary: string }> {
  const bytes = await obj.arrayBuffer();
  const base64 = arrayBufferToBase64(bytes);
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    system:
      "You are extracting clean reading text from a document. Return ONLY the extracted text — no commentary, no headings you invent.",
    messages: [
      {
        role: "user",
        content: [
          { type: "document", mime: "application/pdf", base64 },
          {
            type: "text",
            text: "Extract the document's text. Then on a final line starting with 'SUMMARY: ' write a 1-sentence summary.",
          },
        ],
      },
    ],
    max_tokens: 4000,
    ledger: { user_id: userId, operation_type: "workers_ai.extract.pdf" },
  });
  return splitSummary(out.text);
}

async function extractImage(
  env: Env,
  userId: string,
  obj: R2ObjectBody,
): Promise<{ text: string; summary: string }> {
  const bytes = await obj.arrayBuffer();
  const base64 = arrayBufferToBase64(bytes);
  const out = await callLLM(env, {
    provider: "workers_ai",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    system:
      "Describe this image and OCR any visible text. Output the description first, then 'OCR:' followed by the transcribed text.",
    messages: [
      {
        role: "user",
        content: [{ type: "image", mime: obj.httpMetadata?.contentType ?? "image/png", base64 }],
      },
    ],
    max_tokens: 1500,
    ledger: { user_id: userId, operation_type: "workers_ai.extract.image" },
  });
  return { text: out.text, summary: out.text.slice(0, 300) };
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

function splitSummary(text: string): { text: string; summary: string } {
  const m = text.match(/\n\s*SUMMARY:\s*(.+)\s*$/i);
  if (!m || m.index === undefined || !m[1]) return { text, summary: text.slice(0, 300) };
  return { text: text.slice(0, m.index).trim(), summary: m[1].trim() };
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

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}
