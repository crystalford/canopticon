"use client";

import { Button } from "@/components/primitives";
import { useOrchestratorEvents } from "@/hooks/use-orchestrator-events";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import { useEffect, useState } from "react";

export interface PendingApproval {
  id: string;
  proposal_id: string;
  operation_type: string;
  estimate_cents: number;
  provider: string;
  model_or_sku: string | null;
  context: Record<string, unknown> | null;
  status: string;
  expires_at: string;
  created_at: string;
}

const APPROVAL_FILTER = [
  "cost.operation_proposed",
  "cost.operation_approved",
  "cost.operation_denied",
];

export function CostApprovalModal() {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const { events } = useOrchestratorEvents({ filter: APPROVAL_FILTER, bufferSize: 50 });

  useEffect(() => {
    let cancelled = false;
    apiGet<PendingApproval[]>("/v1/orchestrator/approvals/pending")
      .then((data) => {
        if (!cancelled) setPending(data);
      })
      .catch(() => {
        // Pending list is best-effort on first load; SSE will catch up.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    apiGet<PendingApproval[]>("/v1/orchestrator/approvals/pending")
      .then(setPending)
      .catch(() => {
        /* swallow */
      });
  }, [events.length]);

  async function respond(proposal_id: string, decision: "approve" | "deny") {
    setResponding(proposal_id);
    setResponseError(null);
    try {
      await apiPost("/v1/orchestrator/approve-cost", { proposal_id, decision });
      setPending((prev) => prev.filter((p) => p.proposal_id !== proposal_id));
    } catch (err) {
      setResponseError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setResponding(null);
    }
  }

  if (pending.length === 0) return null;
  const current = pending[0];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deeper/85 px-4">
      <dialog
        open
        aria-modal="true"
        aria-labelledby="cost-approval-title"
        className="bg-bg-card border border-amber max-w-lg w-full p-6 text-text"
      >
        <header className="flex items-baseline justify-between mb-4">
          <h2 id="cost-approval-title" className="font-serif text-xl text-amber">
            Cost approval
          </h2>
          {pending.length > 1 && (
            <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
              {pending.length - 1} more queued
            </span>
          )}
        </header>

        <p className="text-text leading-relaxed mb-1">
          {labelForOperation(current.operation_type)} for{" "}
          <span className="text-amber font-mono">{current.estimate_cents}¢</span>
        </p>
        <p className="text-text-dim font-mono text-xs">
          {current.provider}
          {current.model_or_sku ? ` · ${current.model_or_sku}` : ""}
        </p>

        {current.context && Object.keys(current.context).length > 0 && (
          <ContextDetails context={current.context} />
        )}

        <p className="text-text-faint font-mono text-xs mt-4">
          expires {new Date(current.expires_at).toLocaleTimeString()}
        </p>

        <div className="flex gap-2 mt-6">
          <Button
            tone="primary"
            fullWidth
            onClick={() => respond(current.proposal_id, "approve")}
            disabled={responding === current.proposal_id}
          >
            approve
          </Button>
          <Button
            tone="danger"
            fullWidth
            onClick={() => respond(current.proposal_id, "deny")}
            disabled={responding === current.proposal_id}
          >
            deny
          </Button>
        </div>

        {responseError && <p className="text-signal font-mono text-xs mt-3">{responseError}</p>}
      </dialog>
    </div>
  );
}

function labelForOperation(op: string): string {
  switch (op) {
    case "anthropic_call":
      return "Anthropic API call";
    case "cross_model_call":
      return "Cross-model verification call";
    case "transcription":
      return "Audio transcription";
    case "image_gen":
      return "Image generation";
    default:
      return op;
  }
}

function ContextDetails({ context }: { context: Record<string, unknown> }) {
  const entries = Object.entries(context).filter(([, v]) => v != null);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-faint uppercase tracking-widest">{k.replace(/_/g, " ")}</dt>
          <dd className="text-text-dim break-all">
            {typeof v === "string" ? v : JSON.stringify(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
