// Base card primitive. Both operator and public surfaces use this; the
// `tone` prop drives the optional left-edge color rail used in the
// operator's Live feed.

import type { ChipTone } from "./StatusChip";

const railColors: Record<ChipTone, string> = {
  default: "border-l-border",
  signal: "border-l-signal",
  amber: "border-l-amber",
  sage: "border-l-sage",
  blue: "border-l-blue",
  tan: "border-l-tan",
  cream: "border-l-cream",
};

export function Card({
  rail,
  children,
  className = "",
}: {
  rail?: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  const railClass = rail ? `border-l-[3px] ${railColors[rail]}` : "";
  return (
    <article className={`border border-border-soft bg-bg-card p-4 ${railClass} ${className}`}>
      {children}
    </article>
  );
}

export function MetadataStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-dim">{children}</div>
  );
}
