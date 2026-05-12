"use client";

// FileDrop: drag-and-drop + click picker. Returns selected File[] to the
// parent. Renders any "pending" uploads as chips with size.

import { useRef, useState } from "react";

export interface PendingUpload {
  id: string;
  name: string;
  size_bytes: number;
  status: "uploading" | "ready" | "error";
}

export function FileDrop({
  accept,
  multiple = true,
  onFiles,
  pending = [],
  compact = false,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  pending?: PendingUpload[];
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex w-full items-center justify-center gap-2 border border-dashed px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          over
            ? "border-cream-bright text-cream-bright"
            : "border-border-soft text-text-dim hover:border-cream-dim hover:text-cream"
        } ${compact ? "py-2" : "py-4"}`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="h-4 w-4"
        >
          <title>Attach</title>
          <path d="M8 2 V11 M4 6 L8 2 L12 6 M2 13 H14" />
        </svg>
        {compact ? "Attach" : "Drop files or click to pick"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {pending.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {pending.map((p) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 border px-2 py-1 font-mono text-[10px] ${
                p.status === "error"
                  ? "border-signal text-signal"
                  : p.status === "ready"
                    ? "border-sage text-sage"
                    : "border-border-soft text-text-dim"
              }`}
            >
              <span className="truncate max-w-[160px]">{p.name}</span>
              <span className="opacity-60">{formatSize(p.size_bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}
