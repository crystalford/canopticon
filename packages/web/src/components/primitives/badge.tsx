"use client";

import type { ReactNode } from "react";
import { cn } from "./utils";

type Tone = "neutral" | "amber" | "signal" | "sage" | "blue" | "tan" | "cream";
type Variant = "outline" | "solid" | "text";

const TEXT_COLOR: Record<Tone, string> = {
  neutral: "text-text-faint",
  amber: "text-amber",
  signal: "text-signal",
  sage: "text-sage",
  blue: "text-blue",
  tan: "text-tan",
  cream: "text-cream",
};

const SOLID_BG: Record<Tone, string> = {
  neutral: "bg-bg-elevated text-text-dim",
  amber: "bg-amber text-bg",
  signal: "bg-signal text-bg",
  sage: "bg-sage text-bg",
  blue: "bg-blue text-bg",
  tan: "bg-tan text-bg",
  cream: "bg-cream text-bg",
};

const OUTLINE_BORDER: Record<Tone, string> = {
  neutral: "border-border-soft text-text-dim",
  amber: "border-amber-dim text-amber",
  signal: "border-signal-dim text-signal",
  sage: "border-sage-dim text-sage",
  blue: "border-blue-dim text-blue",
  tan: "border-tan-dim text-tan",
  cream: "border-cream-dim text-cream",
};

export interface BadgeProps {
  tone?: Tone;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", variant = "text", className, children }: BadgeProps) {
  const base = "inline-flex items-center font-mono text-xs uppercase tracking-widest";
  const tonal =
    variant === "solid"
      ? `${SOLID_BG[tone]} px-2 py-0.5`
      : variant === "outline"
        ? `border ${OUTLINE_BORDER[tone]} px-2 py-0.5`
        : TEXT_COLOR[tone];
  return <span className={cn(base, tonal, className)}>{children}</span>;
}
