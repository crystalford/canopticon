// Markdown for the Black Box pages — two grammars, one file.
//
// DOCUMENTS (research, papers): a port of the prototype's own md2html
// (pages/Canopticon Doc.dc.html), server-side. Numbered ## sections with
// #s-N anchors, ### subheads, pipe tables in a card, blockquotes, lists,
// paragraphs. Raw HTML in a document is escaped, never passed through: these
// are uploads, and an upload is text.
//
// ARTICLES: the essay contract (docs/blackbox/ESSAY-CONTRACT.md). Every
// <q doc section>…</q> is a verbatim quotation — checked at build by
// scripts/build-content.mjs — rendered as a green mark with a receipt chip
// linking to the exact passage. Everything outside a <q> is the author's own
// and wears the dotted brick underline: "No receipt behind this sentence — it
// is the author's". [label](doc:<id>) is a plain link to a document.
// `> **Objection: …**` blocks, pipe tables (with an italic caption after),
// and <figure data-kind="chart|pull|names"> are the only other structures.

import { esc } from "./layout";

/** "/p/<id>#q=<passage>:~:text=<passage>" — ROUTES.md §Passage links.
 *  "-" is encoded as %2D (a bare hyphen is a text-fragment delimiter) and
 *  encodeURIComponent already keeps "&" out of the href. */
export function passageHref(docId: string, passage: string): string {
  const clean = passage
    .replace(/[*_`]/g, "")
    .replace(/\\([^\w\s])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  let p = clean;
  if (p.length > 200) {
    const cut = p.lastIndexOf(" ", 200);
    p = p.slice(0, cut > 80 ? cut : 200);
  }
  // encodeURIComponent leaves ' ( ) ! * ~ alone; they are encoded too, so a
  // passage link survives being pasted anywhere (and needs no HTML escaping).
  const enc = encodeURIComponent(p)
    .replace(/-/g, "%2D")
    .replace(/[!'()*~]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `/p/${encodeURIComponent(docId)}#q=${enc}:~:text=${enc}`;
}

/** Inline Markdown: escapes first, then code, bold, italic, http links. */
export function inline(s: string): string {
  return esc(s)
    .replace(/\\([*_[\]()#`~>|-])/g, "$1")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>',
    );
}

/** Plain text of an inline Markdown string — for TOC labels and summaries. */
export function plain(s: string): string {
  return s
    .replace(/\\([*_[\]()#`~>|-])/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Head {
  n: string;
  text: string;
  href: string;
}

const LIST = /^\s*([-*+]|\d+[.)])\s+/;
const BLOCK_START = /^(#|\s*\||\s*>|\s*([-*+]|\d+[.)])\s+|-{3,}\s*$)/;

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function table(rows: string[], cell: (s: string) => string, caption = ""): string {
  const body = rows.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
  const head = cells(body[0] ?? "");
  return `<figure class="tbl"><div class="tbl-wrap"><table><thead><tr>${head
    .map((h) => `<th scope="col">${cell(h)}</th>`)
    .join("")}</tr></thead><tbody>${body
    .slice(1)
    .map(
      (r) =>
        `<tr>${cells(r)
          .map((c) => `<td>${cell(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>${caption}</figure>`;
}

/** A research document or a paper → HTML and its section heads. */
/** A run of list lines, nested by indentation: a deeper line belongs to
 *  the item above it, as Markdown means it. */
function listHtml(rows: string[]): string {
  const depth = (l: string) => /^\s*/.exec(l)?.[0].length ?? 0;
  const base = depth(rows[0] ?? "");
  const items: Array<{ text: string; children: string[] }> = [];
  for (const r of rows) {
    const last = items[items.length - 1];
    if (depth(r) > base + 1 && last) last.children.push(r);
    else items.push({ text: r.replace(LIST, ""), children: [] });
  }
  const tag = /^\s*\d/.test(rows[0] ?? "") ? "ol" : "ul";
  return `<${tag}>${items
    .map((x) => `<li>${inline(x.text)}${x.children.length ? listHtml(x.children) : ""}</li>`)
    .join("")}</${tag}>`;
}

export function documentHtml(src: string): { html: string; heads: Head[] } {
  const lines = src.split("\n");
  const out: string[] = [];
  const heads: Head[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const l = lines[i] ?? "";
    if (!l.trim() || /^-{3,}\s*$/.test(l) || /^#\s/.test(l)) {
      i++;
      continue;
    }
    let m = /^##\s+(.+)/.exec(l);
    if (m) {
      n++;
      const t = (m[1] ?? "")
        .replace(/[*#]/g, "")
        .trim()
        .replace(/^\d+[.)]\s*/, "");
      heads.push({ n: String(n), text: plain(t), href: `#s-${n}` });
      out.push(`<h2 id="s-${n}"><span class="badge">${n}</span>${inline(t)}</h2>`);
      i++;
      continue;
    }
    m = /^#{3,6}\s+(.+)/.exec(l);
    if (m) {
      out.push(`<h3>${inline((m[1] ?? "").replace(/[*#]/g, "").trim())}</h3>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] ?? "")) rows.push(lines[i++] ?? "");
      out.push(table(rows, inline));
      continue;
    }
    if (/^\s*>/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] ?? "")) {
        q.push((lines[i++] ?? "").replace(/^\s*>\s?/, ""));
      }
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if (LIST.test(l)) {
      const rows: string[] = [];
      while (i < lines.length && LIST.test(lines[i] ?? "")) rows.push(lines[i++] ?? "");
      out.push(listHtml(rows));
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !BLOCK_START.test(lines[i] ?? "")) {
      p.push((lines[i++] ?? "").trim());
    }
    if (p.length) out.push(`<p>${inline(p.join(" "))}</p>`);
    else i++;
  }
  return { html: out.join(""), heads };
}

// ---- articles -------------------------------------------------------------

export interface ArticleContext {
  /** Title of a document by id, for receipt tooltips. Held ids return null. */
  docTitle: (id: string) => string | null;
  /** Set only by the workspace preview: false marks the quote as failing. */
  quoteOk?: (doc: string, text: string) => boolean;
}

const BAD_TITLE = "Not found word for word in the source";
const qClass = (ctx: ArticleContext, doc: string, text: string): string =>
  ctx.quoteOk && !ctx.quoteOk(doc, text) ? `q bad" title="${BAD_TITLE}` : "q";

const OWN_TITLE = "No receipt behind this sentence — it is the author's";

/** Inline article text: quotes become marks with receipts, doc links become
 *  links, and every run of the author's own words is underlined. */
export function articleInline(s: string, ctx: ArticleContext, own = true): string {
  const parts: string[] = [];
  const re = /<q\s+([^>]*)>([\s\S]*?)<\/q>|\[([^\]]+)\]\(doc:([^)\s]+)\)/g;
  let last = 0;
  const pushOwn = (t: string) => {
    if (!t) return;
    const h = inline(t);
    parts.push(
      own && /[A-Za-z0-9]/.test(t) ? `<span class="own" title="${OWN_TITLE}">${h}</span>` : h,
    );
  };
  for (const m of s.matchAll(re)) {
    pushOwn(s.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    if (m[1] !== undefined) {
      const doc = /doc="([^"]*)"/.exec(m[1])?.[1] ?? "";
      const section = /section="([^"]*)"/.exec(m[1])?.[1] ?? "Source";
      const text = m[2] ?? "";
      parts.push(
        `<mark class="${qClass(ctx, doc, text)}">${inline(text)}</mark>${receipt(doc, section, text, ctx)}`,
      );
    } else {
      const id = m[4] ?? "";
      const title = ctx.docTitle(id);
      parts.push(
        title === null
          ? esc(m[3] ?? "")
          : `<a class="doc" href="/p/${esc(id)}" title="${esc(title)}">${esc(m[3] ?? "")}</a>`,
      );
    }
  }
  pushOwn(s.slice(last));
  return parts.join("");
}

function receipt(doc: string, section: string, passage: string, ctx: ArticleContext): string {
  const title = ctx.docTitle(doc);
  if (title === null) return "";
  return `<a class="rc" href="${esc(passageHref(doc, passage))}" title="${esc(`${title} · ${section}`)}">${esc(section)}</a>`;
}

/** A caption paragraph like "*Copied from the research's side-by-side.[Details](doc:id)*":
 *  the doc link becomes a receipt chip on the caption. */
function captionHtml(line: string, ctx: ArticleContext): string {
  const body = line.trim().replace(/^\*|\*$/g, "");
  const link = /\[([^\]]+)\]\(doc:([^)\s]+)\)/.exec(body);
  const text = link ? body.slice(0, link.index) + body.slice(link.index + link[0].length) : body;
  let chip = "";
  if (link) {
    const title = ctx.docTitle(link[2] ?? "");
    if (title !== null) {
      chip = `<a class="rc" href="/p/${esc(link[2] ?? "")}" title="${esc(`${title} · ${link[1]}`)}">${esc(link[1] ?? "")}</a>`;
    }
  }
  return `<figcaption>${inline(text.trim())}${chip}</figcaption>`;
}

function figure(kind: string, attrs: string, lines: string[], ctx: ArticleContext): string {
  const doc = /doc="([^"]*)"/.exec(attrs)?.[1] ?? "";
  const section = /section="([^"]*)"/.exec(attrs)?.[1] ?? "";
  const title = ctx.docTitle(doc);
  if (kind === "pull") {
    const text = lines.join(" ").trim();
    const passage = text.replace(/^[“"]|[”"]$/g, "");
    const chip = title === null ? "" : receipt(doc, section, passage, ctx);
    return `<figure class="pull"><blockquote>${inline(text)}</blockquote><figcaption>${chip}</figcaption></figure>`;
  }
  if (kind === "names") {
    // Two named things side by side: "- label | name | definition | foot".
    // The definition may be a <q>, verified at build like any other.
    const green = /tone="green"/.test(attrs);
    const cards = lines
      .filter((l) => /^-\s/.test(l))
      .map((l) => {
        const [label = "", name = "", def = "", foot = ""] = l
          .replace(/^-\s+/, "")
          .split("|")
          .map((x) => x.trim());
        return `<div class="name-card"><div class="name-l">${esc(label)}</div><div class="name-n">${esc(name)}</div><div class="name-d">${articleInline(def, ctx)}</div>${foot ? `<div class="name-f">${articleInline(foot, ctx, !green)}</div>` : ""}</div>`;
      });
    return `<div class="names${green ? " green" : ""}">${cards.join("")}</div>`;
  }
  let caption = "";
  let note = "";
  const bars: string[] = [];
  for (const l of lines) {
    const kv = /^(caption|note):\s*(.*)$/.exec(l);
    if (kv?.[1] === "caption") caption = kv[2] ?? "";
    else if (kv?.[1] === "note") note = kv[2] ?? "";
    else if (/^-\s/.test(l)) {
      const [label = "", value = "", width = "0", colour = "#6b46a8"] = l
        .replace(/^-\s+/, "")
        .split("|")
        .map((x) => x.trim());
      const w = Math.max(0, Math.min(100, Number(width) || 0));
      const c = /^#[0-9a-fA-F]{3,8}$/.test(colour) ? colour : "#6b46a8";
      bars.push(
        `<div class="bar"><span class="bar-l">${esc(label)}</span><span class="bar-t"><span style="width:${w}%;background:${c}"></span></span><span class="bar-v">${esc(value)}</span></div>`,
      );
    }
  }
  const chip =
    title === null
      ? ""
      : `<a class="rc" href="/p/${esc(doc)}" title="${esc(`${title} · ${section}`)}">${esc(section)}</a>`;
  return `<figure class="chart" data-chart><figcaption>${esc(caption)}</figcaption><div class="bars">${bars.join("")}</div><div class="chart-note">${note ? `<span>${esc(note)}</span>` : ""}${chip}</div></figure>`;
}

/** An article body → HTML and its section heads (#e-N). */
export function articleHtml(src: string, ctx: ArticleContext): { html: string; heads: Head[] } {
  const lines = src.split("\n");
  const out: string[] = [];
  const heads: Head[] = [];
  let i = 0;
  let n = 0;
  let first = true;
  while (i < lines.length) {
    const l = lines[i] ?? "";
    if (!l.trim() || /^-{3,}\s*$/.test(l) || /^#\s/.test(l)) {
      i++;
      continue;
    }
    const fig = /^<figure\s+data-kind="(chart|pull|names)"([^>]*)>\s*$/.exec(l);
    if (fig) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^<\/figure>/.test(lines[i] ?? "")) body.push(lines[i++] ?? "");
      i++;
      out.push(figure(fig[1] ?? "", fig[2] ?? "", body, ctx));
      continue;
    }
    let m = /^##\s+(.+)/.exec(l);
    if (m) {
      n++;
      const t = (m[1] ?? "").replace(/[*#]/g, "").trim();
      heads.push({ n: String(n), text: plain(t), href: `#e-${n}` });
      out.push(`<h2 id="e-${n}"><span class="num">${n}</span>${inline(t)}</h2>`);
      i++;
      continue;
    }
    m = /^#{3,6}\s+(.+)/.exec(l);
    if (m) {
      out.push(`<h3>${inline((m[1] ?? "").replace(/[*#]/g, "").trim())}</h3>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] ?? "")) rows.push(lines[i++] ?? "");
      // An italic paragraph straight after a table is its caption.
      let j = i;
      while (j < lines.length && !(lines[j] ?? "").trim()) j++;
      let caption = "";
      if (/^\*[^*].*\*\s*$/.test(lines[j] ?? "")) {
        caption = captionHtml(lines[j] ?? "", ctx);
        i = j + 1;
      }
      out.push(table(rows, (c) => articleInline(c, ctx, false), caption));
      continue;
    }
    if (/^\s*>/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] ?? "")) {
        q.push((lines[i++] ?? "").replace(/^\s*>\s?/, ""));
      }
      const head = /^\*\*Objection:\s*(.+?)\*\*\s*$/.exec(q[0] ?? "");
      const paras = (head ? q.slice(1) : q)
        .join("\n")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      const bodyHtml = paras
        .map((p) => `<p>${articleInline(p.replace(/\n/g, " "), ctx)}</p>`)
        .join("");
      out.push(
        head
          ? `<aside class="objection"><div class="objection-h"><span class="pill lg">Objection</span><strong>${inline(head[1] ?? "")}</strong></div><div class="objection-b">${bodyHtml}</div></aside>`
          : `<blockquote class="aside-box">${bodyHtml}</blockquote>`,
      );
      continue;
    }
    if (LIST.test(l)) {
      const ord = /^\s*\d/.test(l);
      const items: string[] = [];
      while (i < lines.length && LIST.test(lines[i] ?? "")) {
        items.push((lines[i++] ?? "").replace(LIST, ""));
      }
      const tag = ord ? "ol" : "ul";
      out.push(
        `<${tag}>${items.map((x) => `<li>${articleInline(x, ctx)}</li>`).join("")}</${tag}>`,
      );
      continue;
    }
    const p: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !BLOCK_START.test(lines[i] ?? "") &&
      !/^<figure/.test(lines[i] ?? "")
    ) {
      p.push((lines[i++] ?? "").trim());
    }
    if (p.length) {
      out.push(
        `<p${first && n === 0 ? ' class="open"' : ""}>${articleInline(p.join(" "), ctx)}</p>`,
      );
      first = false;
    } else i++;
  }
  return { html: out.join(""), heads };
}

/** Every <q> in an article, in order — for counts and "Cited by". */
export function articleQuotes(src: string): Array<{ doc: string; section: string; text: string }> {
  return [...src.matchAll(/<q\s+([^>]*)>([\s\S]*?)<\/q>/g)].map((m) => ({
    doc: /doc="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
    section: /section="([^"]*)"/.exec(m[1] ?? "")?.[1] ?? "",
    text: m[2] ?? "",
  }));
}
