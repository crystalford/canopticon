"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "./utils";

const SHARED =
  "block w-full bg-bg-elevated border border-border-bright text-text px-3 py-2 focus:border-amber focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-text-dim font-mono text-xs uppercase tracking-widest mb-2",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(SHARED, "font-mono text-sm", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(SHARED, "font-serif text-base resize-none", className)} {...rest} />
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-signal font-mono text-xs">{message}</p>;
}
