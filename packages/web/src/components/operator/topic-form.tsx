"use client";

import { ApiError, apiPost } from "@/lib/api-client";
import { useState } from "react";

export interface ResearchRunSummary {
  research_run_id: string;
  status: string;
  iterations: number;
  sources_registered: number;
  total_cost_cents: number;
  done_summary: string | null;
}

export function TopicForm({
  onSubmitted,
}: {
  onSubmitted?: (run: ResearchRunSummary) => void;
}) {
  const [topic, setTopic] = useState("");
  const [budget, setBudget] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (topic.trim().length < 3) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await apiPost<ResearchRunSummary>("/v1/research", {
        topic: topic.trim(),
        budget_cents: budget,
      });
      setTopic("");
      onSubmitted?.(result);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-cream-dim font-mono text-xs uppercase tracking-widest mb-2">
          research topic
        </span>
        <textarea
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          className="w-full bg-ink-dim text-cream border border-amber-dim px-3 py-2 font-serif text-base focus:border-amber focus:outline-none resize-none"
          placeholder="e.g., Brookfield's reorganization history under Mark Carney's chairmanship, 2014–2020"
          disabled={submitting}
        />
      </label>

      <div className="flex items-end gap-4">
        <label className="flex-1">
          <span className="block text-cream-dim font-mono text-xs uppercase tracking-widest mb-2">
            budget (cents)
          </span>
          <input
            type="number"
            min={1}
            max={10000}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full bg-ink-dim text-cream border border-amber-dim px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
            disabled={submitting}
          />
        </label>
        <button
          type="submit"
          disabled={submitting || topic.trim().length < 3}
          className="bg-amber-deep text-ink font-mono text-sm uppercase tracking-widest px-6 py-2 hover:bg-amber disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "running..." : "research"}
        </button>
      </div>

      {errorMessage && <p className="text-signal-red font-mono text-xs">{errorMessage}</p>}
    </form>
  );
}
