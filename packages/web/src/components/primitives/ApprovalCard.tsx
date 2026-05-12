"use client";

// Approval card. The chat agent stages a write tool with editable input;
// this card shows the proposal as a key/value table, lets the operator
// edit string and number fields, and emits confirm/reject.

import { useState } from "react";
import { Card, MetadataStrip } from "./Card";

type Primitive = string | number | boolean | null;

export function ApprovalCard({
  title,
  description,
  input,
  onConfirm,
  onReject,
  busy = false,
}: {
  title: string;
  description?: string;
  input: Record<string, unknown>;
  onConfirm: (edited: Record<string, unknown>) => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  const [edited, setEdited] = useState<Record<string, unknown>>(input);

  function setField(key: string, value: unknown) {
    setEdited((prev) => ({ ...prev, [key]: value }));
  }

  const entries = Object.entries(edited);

  return (
    <Card rail="amber" className="mt-2">
      <MetadataStrip>Pending · awaiting confirm</MetadataStrip>
      <h4 className="mt-1 font-sans text-sm font-bold uppercase tracking-tight text-cream-bright">
        {title}
      </h4>
      {description && <p className="mt-1 font-serif text-[13px] text-text-dim">{description}</p>}
      <dl className="mt-2 space-y-1 font-mono text-[11px]">
        {entries.map(([key, val]) => (
          <div key={key} className="grid grid-cols-[110px_1fr] gap-2">
            <dt className="uppercase tracking-wider text-text-dim">{key}</dt>
            <dd>{renderEditableValue(val, (v) => setField(key, v))}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(edited)}
          className="border border-amber bg-amber/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber hover:bg-amber/20 disabled:opacity-50"
        >
          {busy ? "Committing…" : "Confirm"}
        </button>
        {onReject && (
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="border border-border-soft px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-text-dim hover:text-text disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </Card>
  );
}

function renderEditableValue(value: unknown, onChange: (v: unknown) => void) {
  if (value === null || value === undefined) {
    return <span className="text-text-faint">null</span>;
  }
  if (typeof value === "string") {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border-soft bg-bg-deeper px-2 py-0.5 text-text"
      />
    );
  }
  if (typeof value === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-border-soft bg-bg-deeper px-2 py-0.5 text-text"
      />
    );
  }
  if (typeof value === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="border border-border-soft"
      />
    );
  }
  // Object / array: read-only JSON preview (the agent's first proposal).
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-text-dim">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// re-export Primitive for callers that want it
export type { Primitive };
