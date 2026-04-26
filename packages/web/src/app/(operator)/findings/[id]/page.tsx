"use client";

import {
  Badge,
  Button,
  Card,
  FieldError,
  Label,
  ScreenHeader,
  Textarea,
} from "@/components/primitives";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

interface SupportingClaim {
  id: string;
  claim_id: string;
  is_linchpin: boolean;
  added_at: string;
  admiralty_grade: string;
  verification_status: string;
  claim_text: string;
}

interface FindingDetail {
  id: string;
  thesis_id: string | null;
  title: string;
  slug: string;
  narrative: string;
  novelty_grade: "incremental" | "notable" | "breakthrough";
  pattern_type: string;
  confidence: number | null;
  status: string;
  is_public: boolean;
  surfaced_by: string;
  surfaced_by_role_invocation_id: string | null;
  published_at: string | null;
  retracted_at: string | null;
  retraction_note: string | null;
  created_at: string;
  updated_at: string;
  supporting_claims: SupportingClaim[];
}

interface ThesisInfo {
  id: string;
  title: string;
  slug: string;
}

export default function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [thesis, setThesis] = useState<ThesisInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<FindingDetail>(`/v1/findings/${id}`)
      .then((f) => {
        setFinding(f);
        if (f.thesis_id) {
          apiGet<ThesisInfo>(`/v1/theses/${f.thesis_id}`)
            .then((t) => setThesis(t))
            .catch(() => setThesis(null));
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : (err as Error).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirm() {
    setActing("confirm");
    setActionError(null);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/findings/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(await authHeader()),
        },
        body: JSON.stringify({ status: "confirmed" }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function publish() {
    setActing("publish");
    setActionError(null);
    try {
      await apiPost(`/v1/findings/${id}/publish`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function retract(retractionNote: string) {
    setActing("retract");
    setActionError(null);
    try {
      await apiPost(`/v1/findings/${id}/retract`, { retraction_note: retractionNote });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <BackLink />
        <p className="text-signal font-mono text-xs mt-6">could not load: {error}</p>
      </div>
    );
  }
  if (!finding) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-text-faint font-mono text-xs uppercase tracking-widest">loading...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <BackLink />

      <ScreenHeader
        title={finding.title}
        subtitle={
          <>
            {finding.slug} · {finding.status} · {finding.pattern_type.replace(/_/g, " ")}
            {finding.is_public ? " · public" : ""}
          </>
        }
        actions={
          <div className="flex gap-2 flex-wrap">
            {finding.status === "draft" && (
              <Button tone="primary" size="sm" onClick={confirm} disabled={acting === "confirm"}>
                {acting === "confirm" ? "..." : "confirm"}
              </Button>
            )}
            {finding.status === "confirmed" && !finding.is_public && (
              <Button tone="primary" size="sm" onClick={publish} disabled={acting === "publish"}>
                {acting === "publish" ? "..." : "publish"}
              </Button>
            )}
            {finding.status !== "retracted" && finding.status !== "draft" && (
              <RetractButton onRetract={retract} acting={acting === "retract"} />
            )}
          </div>
        }
      />

      {actionError && <p className="text-signal font-mono text-xs mb-4">{actionError}</p>}

      <Card
        {...(finding.novelty_grade === "breakthrough" ? { tone: "amber" as const } : {})}
        className="mb-6"
      >
        <div className="flex items-baseline gap-2 flex-wrap mb-3">
          <Badge tone={gradeTone(finding.novelty_grade)}>{finding.novelty_grade}</Badge>
          <Badge tone="neutral">{finding.pattern_type.replace(/_/g, " ")}</Badge>
          <Badge tone={statusTone(finding.status)}>{finding.status}</Badge>
          {finding.confidence !== null && (
            <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
              confidence {Number(finding.confidence).toFixed(2)}
            </span>
          )}
          <span className="text-text-faint font-mono text-xs uppercase tracking-widest">
            via {finding.surfaced_by}
          </span>
        </div>
        <p className="text-text leading-relaxed whitespace-pre-line">{finding.narrative}</p>
      </Card>

      {finding.status === "retracted" && finding.retraction_note && (
        <Card tone="signal" className="mb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-signal mb-2">
            retracted
            {finding.retracted_at ? ` ${new Date(finding.retracted_at).toLocaleDateString()}` : ""}
          </p>
          <p className="text-text leading-relaxed">{finding.retraction_note}</p>
        </Card>
      )}

      {thesis && (
        <p className="text-text-faint font-mono text-xs mb-6">
          drawn from →{" "}
          <Link href={`/studio/${thesis.id}` as never} className="text-text-dim hover:text-amber">
            {thesis.title}
          </Link>
        </p>
      )}

      <section>
        <h2 className="font-serif text-xl text-cream mb-3">
          Supporting claims ({finding.supporting_claims.length})
        </h2>
        {finding.supporting_claims.length === 0 ? (
          <p className="text-text-faint font-mono text-xs uppercase tracking-widest">
            no supporting claims linked yet
          </p>
        ) : (
          <ul className="space-y-2">
            {finding.supporting_claims.map((c) => (
              <li
                key={c.id}
                className={
                  c.is_linchpin
                    ? "border-l-2 border-amber pl-3 py-1"
                    : "border-l-2 border-border-soft pl-3 py-1"
                }
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  {c.admiralty_grade && (
                    <Badge tone={c.admiralty_grade === "A" ? "amber" : "tan"} variant="solid">
                      {c.admiralty_grade}
                    </Badge>
                  )}
                  {c.is_linchpin && <Badge tone="amber">linchpin</Badge>}
                  {c.verification_status && (
                    <Badge tone={verificationTone(c.verification_status)}>
                      {c.verification_status}
                    </Badge>
                  )}
                </div>
                <Link
                  href={`/claims/${c.claim_id}` as never}
                  className="text-text font-serif mt-1 block hover:text-amber"
                >
                  {c.claim_text || "(claim text unavailable)"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RetractButton({
  onRetract,
  acting,
}: {
  onRetract: (note: string) => void;
  acting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button tone="secondary" size="sm" onClick={() => setOpen(true)}>
        retract
      </Button>
    );
  }

  return (
    <div className="w-full">
      <Label htmlFor="retract-note">retraction note (required)</Label>
      <Textarea
        id="retract-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What was wrong, and what is no longer claimed?"
      />
      <div className="flex gap-2 mt-2">
        <Button
          tone="primary"
          size="sm"
          onClick={() => {
            if (note.trim().length < 10) {
              setError("retraction note must be at least 10 characters");
              return;
            }
            setError(null);
            onRetract(note.trim());
            setOpen(false);
          }}
          disabled={acting}
        >
          {acting ? "retracting..." : "confirm retract"}
        </Button>
        <Button tone="secondary" size="sm" onClick={() => setOpen(false)}>
          cancel
        </Button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

async function authHeader(): Promise<Record<string, string>> {
  const { browserClient } = await import("@/lib/supabase");
  const supabase = browserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

function BackLink() {
  return (
    <Link
      href={"/findings" as never}
      className="text-text-dim hover:text-amber font-mono text-xs uppercase tracking-widest"
    >
      ← all findings
    </Link>
  );
}

function gradeTone(g: string): "amber" | "sage" | "blue" {
  if (g === "breakthrough") return "amber";
  if (g === "notable") return "blue";
  return "sage";
}

function statusTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "public") return "sage";
  if (s === "confirmed") return "amber";
  if (s === "retracted") return "signal";
  return "neutral";
}

function verificationTone(s: string): "amber" | "sage" | "signal" | "neutral" {
  if (s === "grounded") return "sage";
  if (s === "contradicted" || s === "unsupported") return "signal";
  if (s === "partial") return "amber";
  return "neutral";
}
