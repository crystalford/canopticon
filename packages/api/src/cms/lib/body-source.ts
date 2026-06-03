// Shared body-resolution helpers for the CMS chat tools (posts + pieces).
// Extracted so draft_post and draft_piece both reuse the same placeholder
// guard and the source_file_id → R2/D1 body loader.

import type { Env } from "../../env";
import { one } from "../../lib/d1";

// Llama 3.3 70B sometimes shortcuts a long body_md to a placeholder
// like "... (rest of the article)". That writes garbage to the DB.
// Detect the most common placeholders so the tool returns a refusal the
// model can react to instead of silently saving junk.
const PLACEHOLDER_PATTERNS = [
  /\(\s*rest of (the )?(article|post|content|body)[^)]*\)/i,
  /\[\s*(content continues?|rest of (the )?(article|post|body)|full body here|continued)\s*\]/i,
  /\.\.\.\s*\(?\s*(continued|truncated|full body|rest)\s*\)?/i,
  /\bTODO:\s*fill in\b/i,
  /^\s*\.\.\.\s*$/m,
];

export function detectPlaceholderBody(bodyMd: string): string | null {
  for (const p of PLACEHOLDER_PATTERNS) {
    const m = p.exec(bodyMd);
    if (m) return m[0];
  }
  return null;
}

// Load the full extracted body of an attached file for use as a piece's
// body. The model can't reliably echo long files through a JSON
// parameter, so the chat tools accept a source_file_id and we read the
// body server-side here.
//
// Storage: extract.ts caps uploaded_files.extracted_text at 8KB and
// stashes any overflow in R2 at extracted/<file_id>.txt. R2 is the
// source of truth for long files; D1 is the fallback for short ones.
export async function loadBodyFromFile(
  env: Env,
  userId: string,
  fileId: string,
): Promise<{ body_md: string; filename: string } | { error: string }> {
  const row = await one<{
    extraction_status: string;
    extracted_text: string | null;
    original_filename: string;
  }>(
    env.DB,
    "SELECT extraction_status, extracted_text, original_filename FROM uploaded_files WHERE id = ? AND user_id = ?",
    [fileId, userId],
  );
  if (!row) {
    return { error: `source_file_id ${fileId} not found or not owned by you` };
  }
  if (row.extraction_status !== "extracted") {
    return {
      error: `file ${fileId} not extracted yet (status=${row.extraction_status}) — wait a moment or pass body_md directly`,
    };
  }
  let body_md = "";
  try {
    const obj = await env.FILES.get(`extracted/${fileId}.txt`);
    if (obj) body_md = await obj.text();
  } catch {
    // R2 fetch failure is non-fatal; fall through to D1.
  }
  if (!body_md) body_md = row.extracted_text ?? "";
  if (!body_md) {
    return { error: `file ${fileId} has no extracted content` };
  }
  return { body_md, filename: row.original_filename };
}
