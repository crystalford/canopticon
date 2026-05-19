// Minimal markdown renderer. Supports headings (h2-h4), paragraphs,
// inline code, code blocks, bold, italic, links, bullet/numbered lists.
// No HTML pass-through — we escape everything.
//
// Visual register: Vercel-pro. Headings normal-cased, prose breathable,
// inline code in a soft pill. Inherits the operator/public token palette.

import { Fragment, type ReactNode } from "react";

export function Markdown({ source }: { source: string }) {
  const blocks = splitBlocks(source);
  return (
    <div
      style={{
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        fontSize: 14.5,
        lineHeight: 1.6,
        color: "var(--ink)",
      }}
    >
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

function splitBlocks(src: string): string[] {
  return src.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
}

function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (trimmed.startsWith("```")) {
    const end = trimmed.lastIndexOf("```");
    const inner = end > 3 ? trimmed.slice(3, end).replace(/^[a-zA-Z]+\n/, "") : trimmed.slice(3);
    return (
      <pre
        key={key}
        style={{
          margin: "12px 0",
          overflowX: "auto",
          background: "var(--paper-2)",
          border: "1px solid var(--rule)",
          borderRadius: 8,
          padding: "10px 12px",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--ink-2)",
        }}
      >
        {inner}
      </pre>
    );
  }
  const heading = trimmed.match(/^(#{2,4})\s+(.*)$/);
  if (heading) {
    const level = heading[1]?.length ?? 4;
    const text = heading[2] ?? "";
    if (level === 2)
      return (
        <h2
          key={key}
          style={{
            margin: "20px 0 6px",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {renderInline(text)}
        </h2>
      );
    if (level === 3)
      return (
        <h3
          key={key}
          style={{
            margin: "16px 0 4px",
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          {renderInline(text)}
        </h3>
      );
    return (
      <h4
        key={key}
        style={{
          margin: "14px 0 2px",
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {renderInline(text)}
      </h4>
    );
  }
  if (/^[-*]\s+/.test(trimmed)) {
    const items = trimmed.split("\n").filter((l) => /^[-*]\s+/.test(l));
    return (
      <ul
        key={key}
        style={{ margin: "8px 0", paddingLeft: 22, listStyle: "disc", color: "var(--ink)" }}
      >
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            {renderInline(it.replace(/^[-*]\s+/, ""))}
          </li>
        ))}
      </ul>
    );
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    const items = trimmed.split("\n").filter((l) => /^\d+\.\s+/.test(l));
    return (
      <ol
        key={key}
        style={{ margin: "8px 0", paddingLeft: 22, listStyle: "decimal", color: "var(--ink)" }}
      >
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            {renderInline(it.replace(/^\d+\.\s+/, ""))}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p key={key} style={{ margin: "8px 0" }}>
      {renderInline(trimmed)}
    </p>
  );
}

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let i = 0;
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > i) parts.push(<Fragment key={parts.length}>{text.slice(i, m.index)}</Fragment>);
    const token = m[0];
    if (token.startsWith("`")) {
      parts.push(
        <code
          key={parts.length}
          style={{
            background: "var(--paper-2)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            padding: "1px 5px",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 12.5,
            color: "var(--ink-2)",
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={parts.length} style={{ fontWeight: 600, color: "var(--ink)" }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={parts.length}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--ink)",
              textDecoration: "underline",
              textDecorationColor: "var(--ink-faint)",
            }}
          >
            {linkMatch[1]}
          </a>,
        );
      }
    }
    i = m.index + token.length;
  }
  if (i < text.length) parts.push(<Fragment key={parts.length}>{text.slice(i)}</Fragment>);
  return parts;
}
