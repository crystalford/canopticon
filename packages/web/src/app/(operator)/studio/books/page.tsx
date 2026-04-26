"use client";

import {
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  ScreenHeader,
  Textarea,
} from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";

interface BookRow {
  id: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publication_year: number | null;
  ingest_mode: "surface" | "substrate" | "influence";
  source_id: string | null;
  notes: string | null;
  created_at: string;
}

const MODE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "surface", label: "surface" },
  { key: "substrate", label: "substrate" },
  { key: "influence", label: "influence" },
];

export default function BooksPage() {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    const qs = filter === "all" ? "" : `?ingest_mode=${filter}`;
    apiGet<BookRow[]>(`/v1/books${qs}`)
      .then(setBooks)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader
        title="Book graph"
        subtitle="surface · substrate · influence"
        actions={
          <Button tone={showNew ? "secondary" : "primary"} onClick={() => setShowNew(!showNew)}>
            {showNew ? "cancel" : "+ register book"}
          </Button>
        }
      />

      {showNew && (
        <Card tone="amber" className="mb-8">
          <RegisterBookForm
            onCreated={() => {
              setShowNew(false);
              load();
            }}
          />
        </Card>
      )}

      <nav className="mb-6 flex gap-2 flex-wrap">
        {MODE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? "border border-amber text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
                : "border border-border-soft text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest px-3 py-1"
            }
          >
            {f.label}
          </button>
        ))}
      </nav>

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {books.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no books in this mode
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {books.map((b) => (
            <li key={b.id} className="py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-cream font-serif text-lg">{b.title}</p>
                  <p className="text-text-faint font-mono text-xs mt-1">
                    {b.authors.join(", ") || "—"}
                    {b.publication_year ? ` · ${b.publication_year}` : ""}
                    {b.publisher ? ` · ${b.publisher}` : ""}
                  </p>
                </div>
                <Badge tone={modeTone(b.ingest_mode)}>{b.ingest_mode}</Badge>
              </div>
              {b.notes && <p className="text-text-dim text-sm mt-2 leading-relaxed">{b.notes}</p>}
              {b.source_id && (
                <p className="text-text-faint font-mono text-xs mt-1">
                  registered as source · cascade can extract claims
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RegisterBookForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [authorsRaw, setAuthorsRaw] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [mode, setMode] = useState<"surface" | "substrate" | "influence">("surface");
  const [notes, setNotes] = useState("");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const authors = authorsRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      await apiPost("/v1/books", {
        title: title.trim(),
        authors,
        ingest_mode: mode,
        ...(year ? { publication_year: Number(year) } : {}),
        ...(publisher ? { publisher: publisher.trim() } : {}),
        ...(notes ? { notes: notes.trim() } : {}),
        ...(mode === "substrate" && rawText ? { raw_text: rawText.trim() } : {}),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-serif text-lg text-amber">Register book</h2>
      <p className="text-text-faint font-mono text-xs leading-relaxed">
        surface = the system can recognize citations · substrate = imports the book&apos;s claims ·
        influence = part of the operator&apos;s lineage but not extracted
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="bk-title">title</Label>
          <Input id="bk-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bk-authors">authors (comma-separated)</Label>
          <Input
            id="bk-authors"
            value={authorsRaw}
            onChange={(e) => setAuthorsRaw(e.target.value)}
            placeholder="Linda McQuaig, Neil Brooks"
          />
        </div>
        <div>
          <Label htmlFor="bk-year">year</Label>
          <Input
            id="bk-year"
            type="number"
            min="1400"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bk-publisher">publisher</Label>
          <Input
            id="bk-publisher"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bk-mode">ingest mode</Label>
          <select
            id="bk-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "surface" | "substrate" | "influence")}
            className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
          >
            <option value="surface">surface</option>
            <option value="substrate">substrate</option>
            <option value="influence">influence</option>
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="bk-notes">notes (optional)</Label>
        <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {mode === "substrate" && (
        <div>
          <Label htmlFor="bk-raw">raw text (optional · for cascade extraction)</Label>
          <Textarea
            id="bk-raw"
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the book text or representative excerpts. Cascade will extract claims."
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" tone="primary" disabled={submitting || title.trim().length < 2}>
          {submitting ? "registering..." : "register"}
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

function modeTone(mode: string): "amber" | "sage" | "blue" | "neutral" {
  if (mode === "substrate") return "sage";
  if (mode === "influence") return "amber";
  if (mode === "surface") return "blue";
  return "neutral";
}
