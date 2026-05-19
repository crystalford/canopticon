// Markdown → HTML renderer for posts. Lightweight: handles the subset of
// markdown the operator actually writes — headers, paragraphs, lists,
// blockquotes, emphasis, links, code, horizontal rules. Preserves
// `[claim:ID]` markers as anchor tags pointing to /claims/:id.
//
// Posts are operator-authored only (gated by Cloudflare Access). HTML
// in the markdown source passes through. We don't try to sanitize.
// Replace this with a real markdown library if/when posts become
// multi-author.

export function renderMarkdown(md: string): string {
  let s = md.trim().replace(/\r\n/g, "\n");

  // Fenced code blocks first — protect their contents from other passes.
  const codeBlocks: string[] = [];
  s = s.replace(/```([\s\S]*?)```/g, (_m, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return `@@CODE_BLOCK_${idx}@@`;
  });

  // Headings.
  s = s.replace(/^(#{1,6})\s+(.+)$/gm, (_m, hashes: string, text: string) => {
    const level = hashes.length;
    return `<h${level}>${text.trim()}</h${level}>`;
  });

  // Horizontal rule.
  s = s.replace(/^---+$/gm, "<hr />");

  // Blockquotes (single-line, paragraph-level).
  s = s.replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists — unordered.
  s = s.replace(/(?:^[-*]\s+.+(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .map((item) => `<li>${item}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });
  // Ordered.
  s = s.replace(/(?:^\d+\.\s+.+(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s+/, "").trim())
      .map((item) => `<li>${item}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Claim citations -> link.
  s = s.replace(/\[claim:([A-Z0-9]{20,40})\]/g, (_m, id: string) => {
    return `<a class="citation-chip" href="/claims/${id}">[claim:${id.slice(0, 8)}…]</a>`;
  });

  // Inline links [text](url).
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text: string, href: string) => `<a href="${href}">${text}</a>`,
  );

  // Bold / italic / inline code.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Paragraphs: split on blank lines, wrap raw text blocks.
  const blocks = s
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  let html = blocks
    .map((b) => {
      if (/^(<(h[1-6]|ul|ol|pre|blockquote|hr|p|div)|@@CODE_BLOCK_)/i.test(b)) return b;
      return `<p>${b.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  // Restore code blocks.
  html = html.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, n: string) => codeBlocks[Number(n)] ?? "");
  return html;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
