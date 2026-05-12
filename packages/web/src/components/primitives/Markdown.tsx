// Minimal markdown renderer. Supports headings (h2-h4), paragraphs,
// inline code, code blocks, bold, italic, links, bullet/numbered lists.
// No HTML pass-through — we escape everything.

import { Fragment, type ReactNode } from "react";

export function Markdown({ source }: { source: string }) {
  const blocks = splitBlocks(source);
  return (
    <div className="font-serif text-[14px] leading-snug text-text">
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
        className="my-2 overflow-x-auto border border-border-soft bg-bg-deeper p-2 font-mono text-[11px] text-cream-dim"
      >
        {inner}
      </pre>
    );
  }
  const heading = trimmed.match(/^(#{2,4})\s+(.*)$/);
  if (heading) {
    const level = heading[1]?.length ?? 4;
    const text = heading[2] ?? "";
    const cls = "mt-3 mb-1 font-sans uppercase tracking-tight text-cream-bright";
    if (level === 2)
      return (
        <h2 key={key} className={`${cls} text-base font-extrabold`}>
          {renderInline(text)}
        </h2>
      );
    if (level === 3)
      return (
        <h3 key={key} className={`${cls} text-sm font-bold`}>
          {renderInline(text)}
        </h3>
      );
    return (
      <h4 key={key} className={`${cls} text-xs font-bold`}>
        {renderInline(text)}
      </h4>
    );
  }
  if (/^[-*]\s+/.test(trimmed)) {
    const items = trimmed.split("\n").filter((l) => /^[-*]\s+/.test(l));
    return (
      <ul key={key} className="my-2 list-disc pl-5 text-text">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it.replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    const items = trimmed.split("\n").filter((l) => /^\d+\.\s+/.test(l));
    return (
      <ol key={key} className="my-2 list-decimal pl-5 text-text">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it.replace(/^\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  return (
    <p key={key} className="my-2">
      {renderInline(trimmed)}
    </p>
  );
}

function renderInline(text: string): ReactNode {
  // Order matters: code first so its content is not re-parsed.
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
          className="border border-border-soft bg-bg-deeper px-1 font-mono text-[11px] text-cream-dim"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={parts.length} className="text-cream-bright">
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
            className="text-cream underline decoration-cream-dim hover:text-cream-bright"
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
