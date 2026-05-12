// Uploads: multipart -> R2 -> uploaded_files row. The extraction
// pipeline (PDF/image -> Llama 4 Scout, HTML/text -> straight through)
// is triggered explicitly via POST /uploads/:id/extract.

import { Hono } from "hono";
import { type AuthContext, requireAuth } from "../auth/middleware.ts";
import { all, insertOne, one } from "../lib/d1.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { extractUpload } from "../llm/extract.ts";

const app = new Hono<AuthContext>();
app.use("*", requireAuth());

app.post("/", async (c) => {
  const userId = c.get("user_id");
  const form = await c.req.formData();
  const conversationId = (form.get("conversation_id") as string | null) ?? null;
  const files: File[] = [];
  for (const value of form.getAll("file")) {
    if (isFile(value)) files.push(value);
  }
  if (files.length === 0)
    throw badRequest("No file parts in multipart body (use field name 'file').");

  const out: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const r2_key = `uploads/${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await c.env.FILES.put(r2_key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    const classification = classify(file.type, file.name);
    const id = await insertOne(c.env.DB, "uploaded_files", {
      user_id: userId,
      conversation_id: conversationId,
      r2_key,
      original_filename: file.name,
      mime: file.type || "application/octet-stream",
      size_bytes: file.size,
      classification,
    });
    out.push({
      file_id: id,
      classification,
      mime: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
  }

  return c.json({ files: out }, 201);
});

app.get("/", async (c) => {
  const userId = c.get("user_id");
  const conversationId = c.req.query("conversation_id");
  const rows = conversationId
    ? await all(
        c.env.DB,
        `SELECT id, original_filename, mime, size_bytes, classification, extraction_status, created_source_id, created_at
         FROM uploaded_files WHERE user_id = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT 100`,
        [userId, conversationId],
      )
    : await all(
        c.env.DB,
        `SELECT id, original_filename, mime, size_bytes, classification, extraction_status, created_source_id, created_at
         FROM uploaded_files WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
        [userId],
      );
  return c.json({ files: rows });
});

app.get("/:id", async (c) => {
  const userId = c.get("user_id");
  const row = await one(c.env.DB, "SELECT * FROM uploaded_files WHERE id = ? AND user_id = ?", [
    c.req.param("id"),
    userId,
  ]);
  if (!row) throw notFound("upload");
  return c.json(row);
});

app.post("/:id/extract", async (c) => {
  const userId = c.get("user_id");
  const owned = await one<{ id: string }>(
    c.env.DB,
    "SELECT id FROM uploaded_files WHERE id = ? AND user_id = ?",
    [c.req.param("id"), userId],
  );
  if (!owned) throw notFound("upload");
  const result = await extractUpload(c.env, owned.id);
  return c.json(result);
});

function isFile(v: unknown): v is File {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { name?: unknown }).name === "string" &&
    typeof (v as { size?: unknown }).size === "number" &&
    typeof (v as { stream?: unknown }).stream === "function"
  );
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

function classify(mime: string, name: string): string {
  const lower = (mime || "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (lower === "application/pdf" || ext === "pdf") return "pdf";
  if (lower.startsWith("image/")) return "image";
  if (lower === "text/html" || ext === "html" || ext === "htm") return "html";
  if (lower === "text/markdown" || ext === "md") return "markdown";
  if (lower.startsWith("text/")) return "text";
  return "other";
}

export default app;
