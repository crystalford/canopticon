// /articles/<slug>/changes — what changed between a paper's versions, word
// by word. Unchanged paragraphs fold away (<details>, so no script is
// needed); a changed passage shows removed words struck through and added
// words marked, the way a code review shows a diff.

import type { Paper, PaperVersion } from "../content/store";
import { type Block, type Op, diffParagraphs } from "../diff";
import { esc, shell } from "../layout";

const PARA = " ";

function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months =
    "January February March April May June July August September October November December".split(
      " ",
    );
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

/** A token as it reads on the page: Markdown marks dropped. */
function show(tok: string): string {
  return esc(tok.replace(/\*\*|\*|`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
}

/** One unchanged paragraph, as plain text (a heading stays a heading). */
function plainPara(p: string): string {
  const h = /^(#{1,6})\s+(.*)$/.exec(p);
  if (h) return `<h3 class="chg-h">${show(h[2] as string)}</h3>`;
  const lines = p.split("\n").map((l) => show(l.replace(/^\s*[-*]\s+/, "• ")));
  return `<p>${lines.join("<br>")}</p>`;
}

/** A changed run: paragraphs rebuilt from word operations. */
function changedHtml(ops: Op[]): string {
  const paras: Array<{ heading: boolean; html: string }> = [];
  let cur = { heading: false, html: "", start: true };
  let run: { t: Op["t"]; words: string[] } | null = null;
  const flushRun = () => {
    if (!run) return;
    const text = run.words.join(" ");
    const sep = cur.html && !cur.html.endsWith("<br>") ? " " : "";
    cur.html +=
      sep + (run.t === "eq" ? text : run.t === "del" ? `<del>${text}</del>` : `<ins>${text}</ins>`);
    run = null;
  };
  const endPara = () => {
    flushRun();
    if (cur.html) paras.push({ heading: cur.heading, html: cur.html });
    cur = { heading: false, html: "", start: true };
  };
  for (const o of ops) {
    if (o.v === PARA) {
      endPara();
      continue;
    }
    if (o.v === "\n") {
      flushRun();
      cur.html += "<br>";
      cur.start = true;
      continue;
    }
    if (cur.start && /^#{1,6}$/.test(o.v)) {
      cur.heading = true;
      continue;
    }
    const word = cur.start && /^[-*]$/.test(o.v) ? "•" : show(o.v);
    cur.start = false;
    if (run && run.t === o.t) run.words.push(word);
    else {
      flushRun();
      run = { t: o.t, words: [word] };
    }
  }
  endPara();
  return paras
    .map((p) => (p.heading ? `<h3 class="chg-h">${p.html}</h3>` : `<p>${p.html}</p>`))
    .join("\n");
}

function sameHtml(paras: string[], first: boolean, last: boolean): string {
  // Keep one paragraph of context on each side of a change; fold the rest.
  const before: string[] = first ? [] : paras.slice(0, 1);
  const after = last || paras.length < 2 ? [] : paras.slice(-1);
  let folded = paras.slice(before.length, paras.length - after.length);
  // A single paragraph is shown, not folded: a fold that hides one line is noise.
  if (folded.length === 1) {
    before.push(...folded);
    folded = [];
  }
  const fold = folded.length
    ? `<details class="chg-fold"><summary>${folded.length} unchanged paragraph${folded.length === 1 ? "" : "s"}</summary><div class="chg-ctx">${folded.map(plainPara).join("\n")}</div></details>`
    : "";
  const ctx = (ps: string[]) =>
    ps.length ? `<div class="chg-ctx">${ps.map(plainPara).join("\n")}</div>` : "";
  return ctx(before) + fold + ctx(after);
}

export function renderChanges(
  p: Paper,
  from: PaperVersion,
  to: { n: number; date: string; body: string },
  opts: { signedIn?: boolean } = {},
): string {
  const blocks: Block[] = diffParagraphs(from.body, to.body);
  const changed = blocks.filter((b) => b.kind === "changed") as Extract<
    Block,
    { kind: "changed" }
  >[];
  const removed = changed.reduce((s, b) => s + b.removed, 0);
  const added = changed.reduce((s, b) => s + b.added, 0);
  const body = blocks
    .map((b, i) =>
      b.kind === "same"
        ? sameHtml(b.paras, i === 0, i === blocks.length - 1)
        : `<div class="chg-hunk">${changedHtml(b.ops)}</div>`,
    )
    .join("\n");
  const path = `/articles/${p.slug}`;
  return shell({
    title: `${p.title}: what changed`,
    description: `Every change between version ${from.n} and version ${to.n} of ${p.title}, word by word.`,
    path: `${path}/changes`,
    nav: "library",
    signedIn: opts.signedIn ?? false,
    body: `<article class="chg">
<p class="chg-kick"><a href="${path}">${esc(p.title)}</a> · What changed</p>
<h1>Version ${from.n} → version ${to.n}</h1>
<p class="chg-sum">Version ${from.n}, ${esc(longDate(from.date))}, against version ${to.n}, ${esc(longDate(to.date))}. ${changed.length} passage${changed.length === 1 ? "" : "s"} changed: <span class="chg-n del">${removed} words removed</span> <span class="chg-n ins">${added} words added</span> Unchanged paragraphs are folded.</p>
<p class="chg-links"><a href="${path}">Read version ${to.n}</a> · <a href="${path}/v${from.n}">Read version ${from.n}</a> · <a href="${path}#versions">Why it changed</a></p>
<div class="chg-body">
${body}
</div>
</article>`,
  });
}
