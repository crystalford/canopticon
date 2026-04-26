// Tiny prompt-template renderer.
//
// SKILL.md prompts use {{dotted.path}} placeholders inside the <input>
// XML block. This file resolves those placeholders against a snapshot
// dict. Missing keys render as empty strings (the prompt explicitly
// invites the model to handle missing context gracefully — see e.g.
// the Interrogator prompt's `{{open_questions}}` block).
//
// We intentionally do NOT use a full template language here. Keep the
// substrate-to-prompt path inspectable; the prompts in SKILL.md should
// be readable as-is.

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(template: string, snapshot: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_match, path: string) => {
    const value = lookup(snapshot, path);
    return stringify(value);
  });
}

function lookup(snapshot: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = snapshot;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value, null, 2);
}
