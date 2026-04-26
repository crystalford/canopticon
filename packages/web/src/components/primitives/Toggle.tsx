"use client";

// Dark toggle switch used on the System screen for ingestion APIs and
// feature flags.

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <span className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ?? "toggle"}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 border transition ${
          checked ? "border-sage bg-sage-glow" : "border-border bg-bg-elevated"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 transition-all ${
            checked ? "left-[22px] bg-sage" : "left-0.5 bg-text-dim"
          }`}
        />
      </button>
      {label && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-cream-dim">
          {label}
        </span>
      )}
    </span>
  );
}
