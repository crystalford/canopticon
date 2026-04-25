"use client";

import { Button, Card, ScreenHeader, StatList } from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

interface SourceDetail {
  id: string;
  source_type: string;
  title: string;
  url: string | null;
  publication: string | null;
  author: string | null;
  published_at: string | null;
  retrieved_at: string;
  admiralty_grade: string;
  bias_profile: Record<string, unknown> | null;
  ingestion_mode: string;
  ingestion_state: string;
  raw_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface CriticReport {
  id: string;
  proposed_grade: string;
  bias_assessment: string;
  compatibility_check: string;
  contradiction_flags: unknown[];
  watch_set_matches: unknown[];
  paid_op_required: boolean;
  paid_op_estimate_cents: number | null;
  reasoning: string;
  created_at: string;
}

const TERMINAL_STATES = new Set(["approved", "rejected"]);

export default function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [source, setSource] = useState<SourceDetail | null>(null);
  const [report, setReport] = useState<CriticReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SourceDetail>(`/v1/sources/${id}`)
      .then((data) => {
        if (!cancelled) setSource(data);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof ApiError ? err.message : (err as Error).message);
      });

    apiGet<CriticReport>(`/v1/sources/${id}/critic-report`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        // No critic report yet — fine, will appear after the cascade runs.
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(action: "approve" | "defer" | "reject") {
    setActing(action);
    setActionError(null);
    try {
      await apiPost(`/v1/sources/${id}/${action}`, {});
      setSource((prev) => (prev ? { ...prev, ingestion_state: actionToState(action) } : prev));
      if (action !== "defer") {
        router.push("/sources" as never);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  if (loadError) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <BackLink />
        <p className="text-signal font-mono text-xs mt-6">could not load: {loadError}</p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATES.has(source.ingestion_state);
  const biasSpectrum = (source.bias_profile?.spectrum as string | undefined) ?? null;

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <BackLink />

      <ScreenHeader
        title={source.title}
        subtitle={
          <>
            {source.source_type}
            {source.publication ? ` · ${source.publication}` : ""}
            {source.author ? ` · ${source.author}` : ""}
            {source.published_at
              ? ` · published ${new Date(source.published_at).toLocaleDateString()}`
              : ""}
            {` · retrieved ${new Date(source.retrieved_at).toLocaleString()}`}
          </>
        }
      />

      {source.url && (
        <p className="font-mono text-xs mb-6 -mt-3">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue hover:text-amber underline-offset-4 hover:underline break-all"
          >
            {source.url}
          </a>
        </p>
      )}

      <section className="mb-8">
        <StatList
          stats={[
            { label: "Grade", value: source.admiralty_grade },
            { label: "State", value: source.ingestion_state.replace(/_/g, " ") },
            { label: "Mode", value: source.ingestion_mode },
            { label: "Bias", value: biasSpectrum ?? (source.bias_profile ? "noted" : "—") },
          ]}
        />
      </section>

      {report ? (
        <CriticReportPanel report={report} />
      ) : (
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-8">
          no Critic report yet · run a cascade to grade this source
        </p>
      )}

      {!isTerminal && (
        <section className="mt-8 border-t border-border-soft pt-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-3">decide</h2>
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={() => act("approve")} disabled={acting === "approve"}>
              {acting === "approve" ? "..." : "approve"}
            </Button>
            <Button tone="secondary" onClick={() => act("defer")} disabled={acting === "defer"}>
              {acting === "defer" ? "..." : "defer"}
            </Button>
            <Button tone="danger" onClick={() => act("reject")} disabled={acting === "reject"}>
              {acting === "reject" ? "..." : "reject"}
            </Button>
          </div>
          {actionError && <p className="text-signal font-mono text-xs mt-3">{actionError}</p>}
        </section>
      )}

      {source.raw_text && (
        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-3">
            source body
          </h2>
          <pre className="bg-bg-elevated text-text-dim font-mono text-xs p-4 max-h-96 overflow-auto whitespace-pre-wrap">
            {source.raw_text.slice(0, 8000)}
            {source.raw_text.length > 8000 ? "\n\n…(truncated)" : ""}
          </pre>
        </section>
      )}
    </div>
  );
}

function actionToState(action: "approve" | "defer" | "reject"): string {
  if (action === "approve") return "approved";
  if (action === "defer") return "deferred";
  return "rejected";
}

function BackLink() {
  return (
    <Link
      href={"/sources" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← back to sources
    </Link>
  );
}

function CriticReportPanel({ report }: { report: CriticReport }) {
  return (
    <Card tone="amber">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-lg text-amber">Critic report</h2>
        <time className="text-text-faint font-mono text-xs">
          {new Date(report.created_at).toLocaleString()}
        </time>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <div>
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            proposed grade
          </p>
          <p className="text-cream font-serif text-xl">{report.proposed_grade}</p>
        </div>
        <div>
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            recommendation
          </p>
          <p className="text-cream font-serif">{report.compatibility_check}</p>
        </div>
        <div>
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">bias</p>
          <p className="text-cream font-serif text-sm">{report.bias_assessment}</p>
        </div>
      </div>

      <p className="text-text leading-relaxed">{report.reasoning}</p>

      {report.contradiction_flags.length > 0 && (
        <div className="mt-4">
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest mb-2">
            contradiction flags ({report.contradiction_flags.length})
          </p>
          <pre className="bg-bg-elevated text-text-dim font-mono text-xs p-3 overflow-auto">
            {JSON.stringify(report.contradiction_flags, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
