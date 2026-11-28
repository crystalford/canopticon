import type { Article } from "../content/store";
import { esc } from "../layout";
import { inline } from "../md";

/** How an essay is built (2026-11-27): the argument as a chain of moves, each
 *  with its role, one line, and what it rests on. The summary line shows the
 *  whole chain at once; the list says what each move does. A move that rests
 *  on nothing cited says so, unless its role never needs a source. */
export interface Move {
  role: string;
  text: string;
  refs: string[];
}

const NEEDS_NO_SOURCE = new Set([
  "opening",
  "question",
  "puzzle",
  "claim",
  "name",
  "link",
  "objection",
  "limit",
  "so",
  "method",
  "example",
]);

export function moves(a: Pick<Article, "build">): Move[] {
  return (a.build ?? []).map((m) => {
    const [role = "", text = "", refs = ""] = String(m.move ?? "").split("|");
    return {
      role: role.trim(),
      text: text.trim(),
      refs: refs
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
    };
  });
}

const refLabel = (r: string) =>
  r === "record" ? "the record" : r === "series" ? "the series" : /^\d+$/.test(r) ? `[${r}]` : r;

export function buildBlock(a: Pick<Article, "build">): string {
  const ms = moves(a);
  if (!ms.length) return "";
  const chain = ms
    .map((m) => `<span class="bd-r">${esc(m.role)}</span>`)
    .join('<span class="gl-arrow" aria-hidden="true">→</span>');
  const items = ms
    .map((m) => {
      const rest = m.refs.length
        ? `<span class="bd-s">${m.refs.map(refLabel).map(esc).join(" ")}</span>`
        : NEEDS_NO_SOURCE.has(m.role.toLowerCase())
          ? ""
          : '<span class="bd-s bd-none">reasoned, no source</span>';
      return `<li><span class="bd-role">${esc(m.role)}</span><span class="bd-t">${inline(m.text)}</span>${rest}</li>`;
    })
    .join("");
  return `<details class="bld"><summary><span class="gl-l">How it's built · ${ms.length} moves</span><span class="bd-chain">${chain}</span></summary><ol class="bd-list">${items}</ol></details>`;
}

/** The same skeleton for the .md twin. */
export function buildMarkdown(a: Pick<Article, "build">): string[] {
  const ms = moves(a);
  if (!ms.length) return [];
  return [
    "## How it's built",
    "",
    ms.map((m) => m.role).join(" → "),
    "",
    ...ms.map(
      (m, i) =>
        `${i + 1}. **${m.role}.** ${m.text}${m.refs.length ? ` ${m.refs.map(refLabel).join(" ")}` : ""}`,
    ),
    "",
  ];
}
