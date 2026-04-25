"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

type Tone = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  /** Stretch to fill its container's width. */
  fullWidth?: boolean;
}

const TONE: Record<Tone, string> = {
  primary: "bg-amber-dim text-bg hover:bg-amber",
  secondary: "border border-border-bright text-text-dim hover:border-cream hover:text-cream",
  danger: "border border-signal text-signal hover:bg-signal hover:text-bg",
  ghost: "text-text-dim hover:text-cream",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-5 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  tone = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "font-mono uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        TONE[tone],
        SIZE[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
