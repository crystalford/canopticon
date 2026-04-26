// Books routes — see canopticon-api-v1.0.md §14 and schema-v1.0 §13.
//
// The book graph is the long-context substrate: works that the operator
// has read (or wants the system to know exist) at one of three depths:
//
//   - surface    : the system knows the title/author exists; can recognize
//                   citations to it but does not import its claims.
//   - substrate  : the operator has imported the book's claims as
//                   substrate. Each claim, like any other claim, has a
//                   source pointer back to the book.
//   - influence  : the book is part of the operator's intellectual
//                   lineage. Surfaces in the meta-narrative but is not
//                   imported as substrate.
//
// Routes:
//
//   GET    /v1/books                         list (filter ingest_mode)
//   GET    /v1/books/:id                     one book with its registered
//                                              source row (if any) + claim
//                                              count (substrate-mode only)
//   POST   /v1/books                         register a book; if
//                                              ingest_mode='substrate', also
//                                              creates a source row of type
//                                              'book' that subsequent
//                                              cascades can extract from
//   PATCH  /v1/books/:id                     edit metadata
//   DELETE /v1/books/:id                     soft delete (only if no
//                                              substrate-mode claims yet)

import { Hono } from "hono";
import { z } from "zod";
import type { AuthContext } from "../auth/middleware.ts";
import { requireAuth } from "../auth/middleware.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { userClient } from "../lib/supabase.ts";

const books = new Hono<AuthContext>();
books.use("*", requireAuth());

// --- list ----------------------------------------------------------------

books.get("/", async (c) => {
  const mode = c.req.query("ingest_mode");
  const client = userClient(c.env, c.get("jwt"));
  let q = client
    .from("books")
    .select(
      "id, title, authors, isbn, publication_year, publisher, ingest_mode, source_id, notes, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (mode) q = q.eq("ingest_mode", mode);
  const { data, error } = await q;
  if (error) throw new Error(`books.list: ${error.message}`);
  return c.json({ data });
});

// --- detail --------------------------------------------------------------

books.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = userClient(c.env, c.get("jwt"));

  const { data: book, error } = await client
    .from("books")
    .select(
      "id, title, authors, isbn, publication_year, publisher, ingest_mode, source_id, notes, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`books.get: ${error.message}`);
  if (!book) throw notFound("Book not found");
  const b = book as { id: string; source_id: string | null };

  let source: unknown = null;
  let claim_count = 0;
  if (b.source_id) {
    const [{ data: srcRow }, { count }] = await Promise.all([
      client
        .from("sources")
        .select("id, title, source_type, ingestion_state, admiralty_grade, retrieved_at")
        .eq("id", b.source_id)
        .maybeSingle(),
      client
        .from("claim_versions")
        .select("id", { count: "exact", head: true })
        .eq("primary_source_id", b.source_id),
    ]);
    source = srcRow ?? null;
    claim_count = count ?? 0;
  }

  return c.json({ data: { ...book, source, claim_count } });
});

// --- create --------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(2).max(500),
  authors: z.array(z.string().min(1)).default([]),
  isbn: z.string().max(20).optional(),
  publication_year: z.number().int().min(1400).max(2100).optional(),
  publisher: z.string().max(200).optional(),
  ingest_mode: z.enum(["surface", "substrate", "influence"]),
  notes: z.string().max(4000).optional(),
  /** Substrate-mode only: optional raw_text to seed claim_extraction. */
  raw_text: z.string().max(2_000_000).optional(),
});

books.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid book payload", { issues: parsed.error.issues });
  }
  const userId = c.get("user_id");
  const client = userClient(c.env, c.get("jwt"));

  // For substrate mode, register a source row first so cascade
  // claim_extraction has somewhere to extract from. Surface and
  // influence books skip this — they don't generate substrate claims.
  let sourceId: string | null = null;
  if (parsed.data.ingest_mode === "substrate") {
    const sourceTitle =
      parsed.data.authors.length > 0
        ? `${parsed.data.title} — ${parsed.data.authors.join(", ")}`
        : parsed.data.title;
    const { data: src, error: sErr } = await client
      .from("sources")
      .insert({
        user_id: userId,
        source_type: "book",
        title: sourceTitle,
        publication: parsed.data.publisher ?? null,
        author: parsed.data.authors.join(", ") || null,
        published_at: parsed.data.publication_year ? `${parsed.data.publication_year}-01-01` : null,
        raw_text: parsed.data.raw_text ?? null,
        ingestion_mode: "operator",
        ingestion_state: parsed.data.raw_text ? "pending_critic" : "approved",
        admiralty_grade: "B",
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`books.create.source: ${sErr.message}`);
    sourceId = src.id as string;
  }

  const { data: row, error } = await client
    .from("books")
    .insert({
      user_id: userId,
      title: parsed.data.title,
      authors: parsed.data.authors,
      isbn: parsed.data.isbn ?? null,
      publication_year: parsed.data.publication_year ?? null,
      publisher: parsed.data.publisher ?? null,
      ingest_mode: parsed.data.ingest_mode,
      source_id: sourceId,
      notes: parsed.data.notes ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`books.create: ${error.message}`);

  return c.json({ data: { ...row, source_id: sourceId } }, 201);
});

// --- patch ---------------------------------------------------------------

const patchSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  authors: z.array(z.string().min(1)).optional(),
  isbn: z.string().max(20).nullable().optional(),
  publication_year: z.number().int().min(1400).max(2100).nullable().optional(),
  publisher: z.string().max(200).nullable().optional(),
  ingest_mode: z.enum(["surface", "substrate", "influence"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

books.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const body = await c.req.json().catch(() => null);
  if (!body) throw badRequest("Request body must be JSON");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid patch payload", { issues: parsed.error.issues });
  }
  const client = userClient(c.env, c.get("jwt"));

  const { data, error } = await client
    .from("books")
    .update(parsed.data)
    .eq("id", id)
    .select("id, title, ingest_mode, updated_at")
    .single();
  if (error) throw new Error(`books.patch: ${error.message}`);
  return c.json({ data });
});

// --- delete --------------------------------------------------------------

books.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing :id parameter");
  const client = userClient(c.env, c.get("jwt"));

  // Refuse to delete substrate-mode books that already produced claims.
  const { data: book } = await client
    .from("books")
    .select("source_id")
    .eq("id", id)
    .maybeSingle<{ source_id: string | null }>();
  if (!book) throw notFound("Book not found");
  if (book.source_id) {
    const { count } = await client
      .from("claim_versions")
      .select("id", { count: "exact", head: true })
      .eq("primary_source_id", book.source_id);
    if ((count ?? 0) > 0) {
      throw badRequest(
        "Cannot delete a book whose source has produced claims; deactivate the book instead",
      );
    }
  }

  const { error } = await client.from("books").delete().eq("id", id);
  if (error) throw new Error(`books.delete: ${error.message}`);
  return c.json({ data: { id, deleted: true } });
});

export default books;
