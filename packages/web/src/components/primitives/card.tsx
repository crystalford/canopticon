import type { ReactNode } from "react";
import { cn } from "./utils";

type Tone = "default" | "amber" | "signal" | "sage";

const TONE: Record<Tone, string> = {
  default: "border border-border-soft bg-bg-card",
  amber: "border border-amber-dim bg-bg-card",
  signal: "border border-signal-dim bg-bg-card",
  sage: "border border-sage-dim bg-bg-card",
};

export function Card({
  tone = "default",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-4", TONE[tone], className)}>{children}</div>;
}
