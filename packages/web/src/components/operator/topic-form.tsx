"use client";

import { Button, FieldError, Input, Label, Textarea } from "@/components/primitives";
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
      <div>
        <Label htmlFor="topic">research topic</Label>
        <Textarea
          id="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          placeholder="e.g., Brookfield's reorganization history under Mark Carney's chairmanship, 2014–2020"
          disabled={submitting}
        />
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Label htmlFor="budget">budget (cents)</Label>
          <Input
            id="budget"
            type="number"
            min={1}
            max={10000}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            disabled={submitting}
          />
        </div>
        <Button type="submit" tone="primary" disabled={submitting || topic.trim().length < 3}>
          {submitting ? "running..." : "research"}
        </Button>
      </div>

      <FieldError message={errorMessage} />
    </form>
  );
}
