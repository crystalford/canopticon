// MARKDOWN → HTML for the publication.
//
// WHY THIS EXISTS SEPARATELY FROM src/cms/lib/render-post.ts
//
// The CMS renderer handles the subset of markdown the operator types into a
// post editor. A research document is a different animal: it arrives from a
// deep-research run as a file, and it is full of the things that renderer
// does not do — pipe tables, nested lists, multi-paragraph blockquotes, and
// hard-wrapped prose. Rendered through it, a dossier came out as a wall of
// text with raw pipe characters in it. That is the whole of the "looks like
// copy-paste" complaint.
//
// It is also not only a cosmetic problem. Retrieval is passage-level, and a
// section that runs past ~300 words with no subheading forces a model to find
// the relevant passage inside a wall of text, which measurably lowers the
// odds of being cited. The typographic structure IS the retrieval structure,
// so a renderer that drops headings, tables and lists is throwing away
// citability, not just prettiness.
//
// Rather than change the CMS renderer and move a second surface's behaviour
// underneath it, the publication gets its own. Two renderers with two jobs,
// each one small enough to read in a sitting.
//
// DIFFERENCES THAT MATTER, vs. the CMS renderer:
//   · GFM pipe tables, with alignment. The single biggest visual win.
//   · Headings carry stable slug ids and a self-link, so any section of a
//     document is directly citable. (Essays use positional s1/s2 anchors via
//     lib/essay.ts — those are load-bearing for existing links and are left
//     alone here, but slugs are what new work should use: an anchor that
//     shifts when the document is edited is a broken citation.)
//   · Blockquotes group across lines instead of becoming one element per line.
//   · Lists nest by indentation.
//   · A single newline is a SPACE, not a <br />. Hard-wrapped source text is
//     normal in research documents, and rendering every wrap as a line break
//     is most of why the pages looked mechanical.
//   · Text is escaped. The CMS renderer deliberately passes HTML through
//     because posts are operator-typed; documents are uploaded files, so the
//     safe reading is that their content is content, not markup.

import { escapeHtml } from "../layout";

// Placeholders for content lifted out before parsing and put back after.
// Plain ASCII on purpose: a NUL sentinel is a control character, which the
// linter disallows inside a regex and which is invisible to anyone reading
// this file. A document containing one of these literally would have to be
// trying to.
const codeMark = (n: number) => `@@CODE${n}@@`;
const fenceMark = (n: number) => `@@FENCE${n}@@`;

/** A heading's stable anchor: lowercase, punctuation stripped, hyphenated. */
export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[`*_~[\]()]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "section"
  );
}

/** Inline markdown only — no block wrapping. For list items, cells, deks. */
export function renderInlineMarkdown(md: string): string {
  let s = escapeHtml(md);

  // Inline code first, so its contents are not then read as emphasis.
  const code: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    code.push(`<code>${c}</code>`);
    return codeMark(code.length - 1);
  });

  // Links. The href is already escaped; reject anything that is not a plain
  // http(s), mailto or same-site link so a document cannot smuggle in
  // javascript: through a markdown link.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    // An unrecognised scheme (javascript:, data:, …) keeps its text and loses
    // both the link and the URL — leaving the raw markdown in place would
    // print the rejected URL to the reader, which is the thing we declined.
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return text;
    // A receipt is not an ordinary link and should not read like one. It gets
    // its own class so the reading column can mark it as "checked" rather than
    // "go elsewhere", and an id so the findings block can point at the place
    // in the document where the passage actually sits.
    const receipt = href.match(/^\/q\/([A-Za-z0-9_-]+)$/);
    if (receipt) {
      return `<a class="receipt" id="q-${receipt[1]}" href="${href}">${text}</a>`;
    }
    const ext = /^https?:\/\//i.test(href);
    const rel = ext ? ' rel="nofollow noopener" target="_blank"' : "";
    return `<a href="${href}"${rel}>${text}</a>`;
  });

  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>");

  return s.replace(/@@CODE(\d+)@@/g, (_m, n: string) => code[Number(n)] ?? "");
}

interface Options {
  /** Start headings at this level (a document body sits under the page h1). */
  headingBase?: number;
  /** Render self-linking anchors on headings. Off for short excerpts. */
  anchors?: boolean;
}

export function renderMarkdown(md: string, opts: Options = {}): string {
  const base = opts.headingBase ?? 2;
  const anchors = opts.anchors ?? true;
  const src = md.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");

  // Fenced code is lifted out whole before anything else touches it.
  const fences: string[] = [];
  const staged = src.replace(/```[a-zA-Z0-9-]*\n([\s\S]*?)```/g, (_m, body: string) => {
    fences.push(`<pre><code>${escapeHtml(body.replace(/\n$/, ""))}</code></pre>`);
    return fenceMark(fences.length - 1);
  });

  const lines = staged.split("\n");
  const out: string[] = [];
  const seenAnchors = new Set<string>();
  let i = 0;

  /** Collect consecutive lines while the test holds. */
  const take = (test: (l: string) => boolean): string[] => {
    const block: string[] = [];
    while (i < lines.length && test(lines[i] as string)) block.push(lines[i++] as string);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i] as string;

    if (!line.trim()) {
      i++;
      continue;
    }

    // Staged fenced code.
    const fence = line.match(/^@@FENCE(\d+)@@$/);
    if (fence) {
      out.push(fences[Number(fence[1])] ?? "");
      i++;
      continue;
    }

    // Heading.
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const depth = Math.min(6, base + (h[1] as string).length - 1);
      const text = (h[2] as string).trim().replace(/\s*#+\s*$/, "");
      let slug = headingSlug(text);
      if (seenAnchors.has(slug)) {
        let n = 2;
        while (seenAnchors.has(`${slug}-${n}`)) n++;
        slug = `${slug}-${n}`;
      }
      seenAnchors.add(slug);
      const inner = renderInlineMarkdown(text);
      out.push(
        anchors
          ? `<h${depth} id="${slug}"><a class="anchor-link" href="#${slug}">${inner}</a></h${depth}>`
          : `<h${depth}>${inner}</h${depth}>`,
      );
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push("<hr />");
      i++;
      continue;
    }

    // Pipe table: a header row followed by a delimiter row. This is the one
    // construct a research document is most likely to carry and the one whose
    // absence looked worst — rows of raw pipe characters in a paragraph.
    if (line.includes("|") && isTableDelimiter(lines[i + 1])) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1] as string).map(columnAlign);
      i += 2;
      const rows = take((l) => l.includes("|") && !!l.trim()).map(splitRow);
      out.push(renderTable(header, align, rows));
      continue;
    }

    // Blockquote — grouped across consecutive lines, then rendered as its own
    // little document so a quote can carry paragraphs and lists.
    if (/^>\s?/.test(line)) {
      const quoted = take((l) => /^>\s?/.test(l));
      const inner = quoted.map((l) => l.replace(/^>\s?/, "")).join("\n");
      out.push(`<blockquote>${renderMarkdown(inner, { ...opts, anchors: false })}</blockquote>`);
      continue;
    }

    // Lists.
    if (isListItem(line)) {
      const block = take((l) => isListItem(l) || /^\s+\S/.test(l) || !l.trim());
      // Trailing blank lines belong to whatever comes next, not the list.
      while (block.length && !(block[block.length - 1] as string).trim()) block.pop();
      out.push(renderList(block));
      continue;
    }

    // Paragraph: everything up to the next blank line or block construct. A
    // single newline inside it is a space — see the note at the top.
    const para = take(
      (l) => !!l.trim() && !isListItem(l) && !/^>\s?/.test(l) && !/^(#{1,6})\s/.test(l),
    );
    if (para.length) out.push(`<p>${renderInlineMarkdown(para.join(" ").trim())}</p>`);
  }

  return out.join("\n");
}

// ---- tables ---------------------------------------------------------------

function isTableDelimiter(line: string | undefined): boolean {
  if (!line) return false;
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function columnAlign(spec: string): string {
  const left = spec.startsWith(":");
  const right = spec.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "";
}

function renderTable(header: string[], align: string[], rows: string[][]): string {
  const cell = (tag: string, text: string, n: number) => {
    const a = align[n];
    return `<${tag}${a ? ` style="text-align:${a}"` : ""}>${renderInlineMarkdown(text)}</${tag}>`;
  };
  const head = `<thead><tr>${header.map((c, n) => cell("th", c, n)).join("")}</tr></thead>`;
  const body = rows
    .map((r) => `<tr>${header.map((_c, n) => cell("td", r[n] ?? "", n)).join("")}</tr>`)
    .join("");
  // The wrapper is what lets a wide table scroll on a phone instead of
  // pushing the whole page sideways.
  return `<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`;
}

// ---- lists ----------------------------------------------------------------

function isListItem(line: string): boolean {
  return /^\s*([-*+]|\d+[.)])\s+/.test(line);
}

/**
 * Render a run of list lines, nesting by indentation.
 *
 * Indentation is measured against the first item rather than assuming two or
 * four spaces, because markdown in the wild uses both and a document that
 * mixes them should still nest rather than flatten.
 */
function renderList(block: string[]): string {
  const items: Array<{ indent: number; ordered: boolean; text: string; rest: string[] }> = [];
  for (const line of block) {
    if (isListItem(line)) {
      const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (!m) continue;
      items.push({
        indent: (m[1] as string).length,
        ordered: /\d/.test(m[2] as string),
        text: m[3] as string,
        rest: [],
      });
    } else if (items.length) {
      // A continuation line belongs to the item above it.
      (items[items.length - 1] as { rest: string[] }).rest.push(line.trim());
    }
  }
  if (!items.length) return "";

  const build = (start: number, indent: number): [string, number] => {
    const ordered = (items[start] as { ordered: boolean }).ordered;
    const parts: string[] = [];
    let n = start;
    while (n < items.length) {
      const it = items[n] as (typeof items)[number];
      if (it.indent < indent) break;
      if (it.indent > indent) {
        const [nested, next] = build(n, it.indent);
        parts[parts.length - 1] = `${parts[parts.length - 1] ?? ""}${nested}`;
        n = next;
        continue;
      }
      const body = [it.text, ...it.rest].join(" ").trim();
      parts.push(`<li>${renderInlineMarkdown(body)}`);
      n++;
    }
    const tag = ordered ? "ol" : "ul";
    return [`<${tag}>${parts.map((p) => `${p}</li>`).join("")}</${tag}>`, n];
  };

  return build(0, (items[0] as { indent: number }).indent)[0];
}
