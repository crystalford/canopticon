// Small colored pill used throughout the UI for grades, postures, states.
// Tone palette mirrors the design tokens in globals.css.

export type ChipTone = "default" | "signal" | "amber" | "sage" | "blue" | "tan" | "cream";

const toneStyles: Record<ChipTone, string> = {
  default: "border-border-soft text-text-dim",
  signal: "border-signal-dim text-signal",
  amber: "border-amber-dim text-amber",
  sage: "border-sage-dim text-sage",
  blue: "border-blue-dim text-blue",
  tan: "border-tan-dim text-tan",
  cream: "border-cream-dim text-cream",
};

export function StatusChip({
  tone = "default",
  children,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${toneStyles[tone]}`}
    >
      {children}
    </span>
  );
}

const gradeTones: Record<string, ChipTone> = {
  A: "sage",
  B: "blue",
  C: "amber",
  D: "tan",
  E: "signal",
  F: "default",
};

export function GradeChip({ grade }: { grade: string }) {
  const tone = gradeTones[grade] ?? "default";
  return <StatusChip tone={tone}>{grade}</StatusChip>;
}
