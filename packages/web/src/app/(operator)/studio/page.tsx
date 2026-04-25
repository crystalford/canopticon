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
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ThesisRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  cynefin_domain: string | null;
  is_public: boolean;
  declared_at: string;
  updated_at: string;
}

export default function StudioIndexPage() {
  const [theses, setTheses] = useState<ThesisRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    apiGet<ThesisRow[]>("/v1/theses")
      .then(setTheses)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : (err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <ScreenHeader
        title="Studio"
        subtitle="theses · investigations · publications"
        actions={
          <Button tone={showNew ? "secondary" : "primary"} onClick={() => setShowNew(!showNew)}>
            {showNew ? "cancel" : "+ new thesis"}
          </Button>
        }
      />

      {showNew && (
        <Card tone="amber" className="mb-8">
          <NewThesisForm
            onCreated={() => {
              setShowNew(false);
              load();
            }}
          />
        </Card>
      )}

      {loadError && (
        <p className="text-signal font-mono text-xs mb-4">could not load: {loadError}</p>
      )}

      {theses.length === 0 ? (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
          no theses yet · declare one above
        </p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {theses.map((t) => (
            <li key={t.id} className="py-4">
              <Link
                href={`/studio/${t.id}` as never}
                className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-baseline hover:bg-bg-subtle -mx-2 px-2 py-1"
              >
                <div>
                  <p className="text-cream font-serif text-lg">{t.title}</p>
                  <p className="text-text-faint font-mono text-xs mt-1">
                    {t.slug}
                    {t.cynefin_domain ? ` · ${t.cynefin_domain}` : ""} · declared{" "}
                    {new Date(t.declared_at).toLocaleDateString()}
                  </p>
                </div>
                {t.is_public && <Badge tone="amber">public</Badge>}
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NewThesisForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [seed, setSeed] = useState("");
  const [cynefin, setCynefin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/v1/theses", {
        title: title.trim(),
        slug: slug.trim(),
        seed_paragraph: seed.trim(),
        ...(cynefin ? { cynefin_domain: cynefin } : {}),
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
      <h2 className="font-serif text-lg text-amber">Declare thesis</h2>
      <div>
        <Label htmlFor="title">title</Label>
        <Input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The Carney–Brookfield reorganization shifted beneficial ownership offshore"
        />
      </div>
      <div>
        <Label htmlFor="slug">slug</Label>
        <Input
          id="slug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="carney-brookfield-reorg"
        />
      </div>
      <div>
        <Label htmlFor="seed">seed paragraph</Label>
        <Textarea
          id="seed"
          required
          rows={4}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="One paragraph framing the thesis. What is being claimed, against what evidence, with what expected disconfirmation criteria."
        />
      </div>
      <div>
        <Label htmlFor="cynefin">cynefin domain (optional)</Label>
        <select
          id="cynefin"
          value={cynefin}
          onChange={(e) => setCynefin(e.target.value)}
          className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
        >
          <option value="">—</option>
          <option value="clear">clear</option>
          <option value="complicated">complicated</option>
          <option value="complex">complex</option>
          <option value="chaotic">chaotic</option>
          <option value="disorder">disorder</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" tone="primary" disabled={submitting}>
          {submitting ? "declaring..." : "declare"}
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

function statusTone(status: string): "amber" | "sage" | "neutral" | "tan" {
  if (status === "active") return "sage";
  if (status === "declared") return "amber";
  if (status === "archived") return "neutral";
  return "tan";
}
