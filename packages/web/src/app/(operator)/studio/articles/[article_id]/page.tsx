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
import { use, useCallback, useEffect, useState } from "react";

interface ArticleVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  body: string;
  bluf: string | null;
  ipcc_likelihood: string | null;
  change_summary: string | null;
  written_by_role: string | null;
  created_at: string;
}

interface CitedClaim {
  id: string;
  claim_id: string;
  claim_text: string;
  admiralty_grade: string;
  verification_status: string;
  added_at: string;
}

interface Correction {
  id: string;
  correction_text: string;
  is_public: boolean;
  created_at: string;
}

interface ArticleDetail {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  status: string;
  is_public: boolean;
  published_at: string | null;
  current_version: ArticleVersion | null;
  versions: ArticleVersion[];
  cited_claims: CitedClaim[];
  corrections: Correction[];
}

interface CandidateClaim {
  id: string;
  layer: string;
  admiralty_grade: string;
  verification_status: string;
}

const IPCC_OPTIONS = [
  ["", "—"],
  ["virtually_certain", "virtually certain (>99%)"],
  ["extremely_likely", "extremely likely (>95%)"],
  ["very_likely", "very likely (>90%)"],
  ["likely", "likely (>66%)"],
  ["more_likely_than_not", "more likely than not (>50%)"],
  ["about_as_likely_as_not", "about as likely as not (33–66%)"],
  ["unlikely", "unlikely (<33%)"],
] as const;

export default function ArticleWorkspacePage({
  params,
}: {
  params: Promise<{ article_id: string }>;
}) {
  const { article_id } = use(params);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<ArticleDetail>(`/v1/articles/${article_id}`)
      .then(setArticle)
      .catch((err) => setError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [article_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <BackLink />
        <p className="text-signal font-mono text-xs mt-6">could not load: {error}</p>
      </div>
    );
  }
  if (!article) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <BackLink />

      <ScreenHeader
        title={article.title}
        subtitle={
          <>
            {article.slug} · {article.status}
            {article.current_version ? ` · v${article.current_version.version_number}` : ""}
            {article.is_public ? " · public" : ""}
          </>
        }
        actions={
          <div className="flex gap-2">
            {!article.is_public && <PublishButton articleId={article.id} onChanged={load} />}
            {article.status === "published" && (
              <RetractButton articleId={article.id} onChanged={load} />
            )}
          </div>
        }
      />

      {article.thesis_id && (
        <Link
          href={`/studio/${article.thesis_id}` as never}
          className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest mb-4 inline-block"
        >
          ← back to thesis
        </Link>
      )}

      {article.current_version?.bluf && (
        <Card tone="amber" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-2">BLUF</p>
          <p className="text-cream-bright font-serif text-lg leading-relaxed">
            {article.current_version.bluf}
          </p>
          {article.current_version.ipcc_likelihood && (
            <p className="text-text-faint font-mono text-xs mt-2 uppercase tracking-widest">
              {article.current_version.ipcc_likelihood.replace(/_/g, " ")}
            </p>
          )}
        </Card>
      )}

      <EditorPanel article={article} onSaved={load} />

      <section className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="font-serif text-xl text-cream mb-3">Cited claims</h2>
          {article.cited_claims.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
              no claims cited yet
            </p>
          ) : (
            <ul className="space-y-2 mb-4">
              {article.cited_claims.map((c) => (
                <li
                  key={c.id}
                  className="border-l-2 border-amber-dim pl-3 py-1 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-baseline"
                >
                  <Badge
                    tone={c.admiralty_grade === "A" ? "amber" : "tan"}
                    variant="solid"
                    className="w-7 justify-center"
                  >
                    {c.admiralty_grade}
                  </Badge>
                  <p className="text-text font-serif">{c.claim_text}</p>
                  <Badge tone={verificationTone(c.verification_status)}>
                    {c.verification_status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <CitePanel
            articleId={article.id}
            citedIds={article.cited_claims.map((c) => c.claim_id)}
            onCited={load}
          />
        </div>

        <div>
          <h2 className="font-serif text-xl text-cream mb-3">Version history</h2>
          {article.versions.length === 0 ? (
            <p className="text-text-faint font-mono text-xs uppercase tracking-widest">none</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {article.versions.map((v) => (
                <li
                  key={v.id}
                  className={
                    v.is_current
                      ? "border-l-2 border-amber pl-3"
                      : "border-l-2 border-border-soft pl-3"
                  }
                >
                  <p className="text-text font-mono text-xs uppercase tracking-widest">
                    v{v.version_number} · {new Date(v.created_at).toLocaleDateString()}
                    {v.is_current ? " · current" : ""}
                  </p>
                  {v.change_summary && (
                    <p className="text-text-dim text-xs mt-1">{v.change_summary}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-cream mb-3">Corrections</h2>
        {article.corrections.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-4">
            none yet
          </p>
        ) : (
          <ol className="space-y-3 mb-6">
            {article.corrections.map((c) => (
              <li key={c.id} className="border-l-2 border-amber-dim pl-3">
                <p className="text-text-faint font-mono text-xs">
                  {new Date(c.created_at).toLocaleDateString()} ·{" "}
                  {c.is_public ? "public" : "internal"}
                </p>
                <p className="text-text leading-relaxed mt-1">{c.correction_text}</p>
              </li>
            ))}
          </ol>
        )}
        <AppendCorrectionPanel articleId={article.id} onAppended={load} />
      </section>
    </div>
  );
}

function EditorPanel({
  article,
  onSaved,
}: {
  article: ArticleDetail;
  onSaved: () => void;
}) {
  const cv = article.current_version;
  const [body, setBody] = useState(cv?.body ?? "");
  const [bluf, setBluf] = useState(cv?.bluf ?? "");
  const [ipcc, setIpcc] = useState(cv?.ipcc_likelihood ?? "");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/articles/${article.id}/versions`, {
        body: body.trim(),
        ...(bluf ? { bluf: bluf.trim() } : {}),
        ...(ipcc ? { ipcc_likelihood: ipcc } : {}),
        ...(summary ? { change_summary: summary.trim() } : {}),
      });
      setSummary("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="font-mono text-xs uppercase tracking-widest text-amber mb-4">
        editor · v{(cv?.version_number ?? 0) + 1} (next)
      </h2>
      <div className="space-y-3">
        <div>
          <Label htmlFor="bluf">BLUF</Label>
          <Textarea
            id="bluf"
            rows={2}
            value={bluf}
            onChange={(e) => setBluf(e.target.value)}
            placeholder="One-sentence claim of the article."
          />
        </div>
        <div>
          <Label htmlFor="ipcc">IPCC likelihood</Label>
          <select
            id="ipcc"
            value={ipcc}
            onChange={(e) => setIpcc(e.target.value)}
            className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
          >
            {IPCC_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="body">body</Label>
          <Textarea
            id="body"
            required
            rows={18}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="summary">change summary</Label>
          <Input
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="what changed in this revision · optional"
          />
        </div>
        <div className="flex gap-2">
          <Button tone="primary" onClick={save} disabled={submitting || body.trim().length < 20}>
            {submitting ? "saving..." : "save new version"}
          </Button>
        </div>
        <FieldError message={error} />
      </div>
    </Card>
  );
}

function CitePanel({
  articleId,
  citedIds,
  onCited,
}: {
  articleId: string;
  citedIds: string[];
  onCited: () => void;
}) {
  const [candidates, setCandidates] = useState<CandidateClaim[]>([]);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<CandidateClaim[]>("/v1/claims?limit=100")
      .then(setCandidates)
      .catch(() => {});
  }, []);

  const filtered = candidates.filter((c) => !citedIds.includes(c.id));

  async function cite() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/articles/${articleId}/claims`, { claim_id: picked });
      setPicked("");
      onCited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (filtered.length === 0) {
    return (
      <p className="text-text-faint font-mono text-xs">
        no available claims to cite · run more research to extract more
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end mt-2">
      <div>
        <Label htmlFor="cite-pick">cite a claim</Label>
        <select
          id="cite-pick"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 font-mono text-xs focus:border-amber focus:outline-none"
        >
          <option value="">— select claim —</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id.slice(0, 8)} · {c.layer} · grade {c.admiralty_grade} · {c.verification_status}
            </option>
          ))}
        </select>
      </div>
      <Button tone="primary" onClick={cite} disabled={submitting || !picked}>
        {submitting ? "..." : "cite"}
      </Button>
      <FieldError message={error} />
    </div>
  );
}

function AppendCorrectionPanel({
  articleId,
  onAppended,
}: {
  articleId: string;
  onAppended: () => void;
}) {
  const [text, setText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/articles/${articleId}/corrections`, {
        correction_text: text.trim(),
        is_public: isPublic,
      });
      setText("");
      onAppended();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="correction">append correction</Label>
      <Textarea
        id="correction"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="describe what was wrong and what changed"
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-text-dim font-mono text-xs uppercase tracking-widest">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          public
        </label>
        <Button type="submit" tone="primary" disabled={submitting || text.trim().length < 10}>
          {submitting ? "..." : "append"}
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

function PublishButton({ articleId, onChanged }: { articleId: string; onChanged: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/articles/${articleId}/publish`, {});
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <Button tone="primary" size="sm" onClick={publish} disabled={submitting}>
        {submitting ? "..." : "publish"}
      </Button>
      {error && <span className="text-signal font-mono text-xs">{error}</span>}
    </>
  );
}

function RetractButton({ articleId, onChanged }: { articleId: string; onChanged: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function retract() {
    if (!confirm("Retract this article? It will remain visible with a retraction notice.")) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/v1/articles/${articleId}/retract`, {});
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <Button tone="secondary" size="sm" onClick={retract} disabled={submitting}>
        {submitting ? "..." : "retract"}
      </Button>
      {error && <span className="text-signal font-mono text-xs">{error}</span>}
    </>
  );
}

function BackLink() {
  return (
    <Link
      href={"/studio/articles" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← all articles
    </Link>
  );
}

function verificationTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "grounded") return "sage";
  if (s === "contradicted" || s === "unsupported") return "signal";
  if (s === "partial") return "amber";
  return "neutral";
}
