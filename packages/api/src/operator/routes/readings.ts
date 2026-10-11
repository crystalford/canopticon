// Readings and the model-drafted files (essay, tetrad). Split out of
// operator/routes.ts on 2026-09-24; every handler is unchanged.

import { one } from "../../lib/d1";
import { resolveOperatorId } from "../../public/data";
import { operatorApp } from "./app";

const app = operatorApp();

// ---- readings (docs/the-record.md §5c) ----------------------------------------
//
// The operator's half of verification: a note anchored to a passage, the
// passage a quotes row like any receipt. Written from the /p/ page ("Note
// this", public/render/notes-live.ts), rendered by piece-template.ts. No
// model is involved in creating or deleting one. Imports are dynamic so this
// block stays append-only, as the deep-research handlers above already are.

async function readingRedirect(db: D1Database, userId: string, pieceId: string): Promise<string> {
  const p = await one<{ slug: string }>(
    db,
    "SELECT slug FROM pieces WHERE id = ? AND user_id = ?",
    [pieceId, userId],
  );
  return p ? `/p/${p.slug}` : "/desk";
}

// form: piece_id, passage (verbatim, ≥40 chars), note (markdown)
app.post("/readings", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk?error=No%20operator%20user");
  const form = await c.req.parseBody();
  const pieceId = typeof form.piece_id === "string" ? form.piece_id.trim() : "";
  const passage = typeof form.passage === "string" ? form.passage : "";
  const note = typeof form.note === "string" ? form.note : "";
  if (!pieceId) return c.redirect("/desk?error=No%20document");
  const back = await readingRedirect(c.env.DB, userId, pieceId);
  const { createReading } = await import("../../lib/readings");
  const result = await createReading(c.env, userId, pieceId, passage, note);
  if (!result.ok) return c.redirect(`${back}?error=${encodeURIComponent(result.reason)}`);
  return c.redirect(`${back}#reading-${result.id}`);
});

app.post("/readings/:id/delete", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.redirect("/desk?error=No%20operator%20user");
  const id = c.req.param("id");
  const row = await one<{ piece_id: string }>(
    c.env.DB,
    "SELECT piece_id FROM readings WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  const back = row ? await readingRedirect(c.env.DB, userId, row.piece_id) : "/desk";
  const { deleteReading } = await import("../../lib/readings");
  await deleteReading(c.env.DB, userId, id);
  return c.redirect(`${back}#readings`);
});

// The "Note this" client, operator-only by virtue of living under /op.
app.get("/notes.js", async () => {
  const { NOTES_LIVE_JS } = await import("../../public/render/notes-live");
  return new Response(NOTES_LIVE_JS, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "private, max-age=3600",
    },
  });
});

// A MODEL-DRAFTED essay from a reading, CLEARLY LABELLED as such, returned as
// a file and never stored. The operator edits it and uploads it like any
// document; the byline is theirs because the words will be. The passage is
// quoted with its receipt so the one verified thing in the draft is marked
// as the one verified thing.
app.post("/readings/:id/draft-essay", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.text("No operator user", 401);
  const id = c.req.param("id");
  const reading = await one<{
    note_md: string;
    quote_id: string;
    verbatim_text: string;
    piece_id: string;
    slug: string;
    title: string;
  }>(
    c.env.DB,
    `SELECT r.note_md, r.quote_id, q.verbatim_text, r.piece_id, p.slug, p.title
       FROM readings r
       JOIN quotes q ON q.id = r.quote_id
       JOIN pieces p ON p.id = r.piece_id
      WHERE r.id = ? AND r.user_id = ?`,
    [id, userId],
  );
  if (!reading) return c.text("No such reading", 404);
  const { findingsForPiece } = await import("../../graph/lib/aeo-extract");
  const findings = (
    await findingsForPiece(c.env.DB, userId, reading.piece_id).catch(() => [])
  ).slice(0, 6);
  const findingLines = findings.map(
    (f) =>
      `- ${f.figure} — ${f.measures}${f.period ? ` (${f.period})` : ""}${
        f.attributed_to ? `, per ${f.attributed_to}` : ""
      }`,
  );
  const { callRole } = await import("../../llm/router");
  const out = await callRole(c.env, "writer", {
    userId,
    system: [
      "You draft essays for a research publication. Write in Markdown, in exactly this shape and nothing else:",
      "",
      "# Title",
      "A one-line dek.",
      "",
      "A summary paragraph that stands alone.",
      "",
      "## A question ending in a question mark?",
      "The answer in the first sentence or two, then supporting paragraphs citing sources as [1].",
      "",
      "(three to five such question sections)",
      "",
      "## Sources",
      "1. Author. Title. Publisher, year.",
      "",
      "Rules: every ## heading except Sources is a question ending in '?'. Open each section with the answer.",
      "Do not invent figures; use only the findings supplied, and cite the document as source [1].",
      "Do not include any preamble or commentary outside the essay.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Document: "${reading.title}" (source [1]: Canopticon, https://canopticon.com/p/${reading.slug})`,
              "",
              "The passage the operator read:",
              `> ${reading.verbatim_text}`,
              "",
              "The operator's note on it (this is the essay's argument):",
              reading.note_md,
              "",
              findingLines.length
                ? `Verified findings from the document:\n${findingLines.join("\n")}`
                : "The document has no verified findings yet; make no numerical claims.",
            ].join("\n"),
          },
        ],
      },
    ],
    max_tokens: 2500,
    idempotency_key: `${id}:draft-essay:${Date.now()}`,
  });
  let body = out.text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "");
  // The passage, as a blockquote with its receipt, straight after the title
  // and dek — so the verified thing in the draft is marked as such.
  const quoteBlock = `> ${reading.verbatim_text.replace(/\n/g, "\n> ")}\n>\n> — *${reading.title}*, [verified](/q/${reading.quote_id})`;
  const lines = body.split("\n");
  const h1 = lines.findIndex((l) => l.startsWith("# "));
  if (h1 >= 0) {
    let at = h1 + 1;
    while (at < lines.length && (lines[at] ?? "").trim() !== "") at++;
    lines.splice(at, 0, "", quoteBlock);
    body = lines.join("\n");
  } else {
    body = `${quoteBlock}\n\n${body}`;
  }
  const date = new Date().toISOString().slice(0, 10);
  const file = `<!-- DRAFTED BY ${out.model} from a reading on "${reading.title}" on ${date}. Not published. Edit before uploading; the byline will be yours. -->\n\n${body}\n`;
  return new Response(file, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="essay-draft-${reading.slug}.md"`,
      "cache-control": "no-store",
    },
  });
});

// A MODEL-DRAFTED TETRAD from a document (docs/the-record.md §1b), CLEARLY
// LABELLED as such, returned as a file and never stored — the same rule as
// /readings/:id/draft-essay. graph/lib/draft-tetrad.ts asks the writer once,
// checks the shape with parseTetrad and every quotation with locateVerbatim,
// and says in the file what it found. form: optional `writer=anthropic`.
app.post("/pieces/:id/draft-tetrad", async (c) => {
  const userId = await resolveOperatorId(c.env.DB);
  if (!userId) return c.text("No operator user", 401);
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const writer = form.writer === "anthropic" ? "anthropic" : null;
  const { draftTetrad } = await import("../../graph/lib/draft-tetrad");
  const draft = await draftTetrad(c.env, userId, c.req.param("id"), { writer });
  if (!draft.ok) return c.text(draft.reason, draft.reason === "no such document" ? 404 : 400);
  return new Response(draft.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${draft.filename}"`,
      "cache-control": "no-store",
    },
  });
});

export default app;
