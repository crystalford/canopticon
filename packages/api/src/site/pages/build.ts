import type { Article, PlannedFigure } from "../content/store";
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

type Built = Pick<Article, "build" | "figure_plan" | "cycle">;

const rowsOf = (data: string) =>
  data
    .split("||")
    .map((r) => r.trim())
    .filter(Boolean);

/** One move's figure, drawn small under the move: HTML and CSS, no script. */
export function planFigure(f: PlannedFigure, cycle: string[] = []): string {
  const head = f.title ? `<span class="fp-t">${esc(f.title)}</span>` : "";
  let body = "";
  if (f.kind === "chain")
    body = `<span class="fp-chain">${f.data
      .split("|")
      .map((w) => `<span class="fp-w">${esc(w.trim())}</span>`)
      .join('<span class="gl-arrow" aria-hidden="true">→</span>')}</span>`;
  if (f.kind === "compare")
    body = `<span class="fp-cmp">${rowsOf(f.data)
      .map((r, i) => {
        const [label = "", value = ""] = r.split("|").map((x) => x.trim());
        return `<span class="fp-row${f.hot === i + 1 ? " hot" : ""}"><span class="fp-l">${esc(label)}</span><span class="fp-v">${esc(value)}</span></span>`;
      })
      .join("")}</span>`;
  if (f.kind === "steps")
    body = `<ol class="fp-steps">${rowsOf(f.data)
      .map((s) => `<li>${esc(s)}</li>`)
      .join("")}</ol>`;
  if (f.kind === "loop")
    body = `<span class="fp-chain">${cycle
      .map((c) => `<span class="fp-w">${esc(c.split("|")[0] ?? c)}</span>`)
      .join(
        '<span class="gl-arrow" aria-hidden="true">→</span>',
      )}<span class="fp-back" aria-label="and back to the start">↺</span></span>`;
  if (f.kind === "quote") body = `<q class="fp-q">${esc(f.data)}</q>`;
  return `<span class="fp fp-${f.kind}">${head}${body}</span>`;
}

/** The figure in words, for the .md twin. */
export function planFigureText(f: PlannedFigure, cycle: string[] = []): string {
  const what =
    f.kind === "chain"
      ? f.data
          .split("|")
          .map((w) => w.trim())
          .join(" → ")
      : f.kind === "compare"
        ? rowsOf(f.data)
            .map((r) =>
              r
                .split("|")
                .map((x) => x.trim())
                .join(": "),
            )
            .join("; ")
        : f.kind === "steps"
          ? rowsOf(f.data).join(" → ")
          : f.kind === "loop"
            ? `${cycle.map((c) => c.split("|")[0]).join(" → ")} → back to the start`
            : `"${f.data}"`;
  return `Figure${f.title ? ` (${f.title})` : ""}: ${what}`;
}

const refLabel = (r: string) =>
  r === "record" ? "the record" : r === "series" ? "the series" : /^\d+$/.test(r) ? `[${r}]` : r;

export function buildBlock(a: Built): string {
  const ms = moves(a);
  if (!ms.length) return "";
  const chain = ms
    .map((m) => `<span class="bd-r">${esc(m.role)}</span>`)
    .join('<span class="gl-arrow" aria-hidden="true">→</span>');
  const figs = new Map((a.figure_plan ?? []).map((f) => [f.move, f]));
  const items = ms
    .map((m, i) => {
      const fig = figs.get(i + 1);
      const rest = m.refs.length
        ? `<span class="bd-s">${m.refs.map(refLabel).map(esc).join(" ")}</span>`
        : NEEDS_NO_SOURCE.has(m.role.toLowerCase())
          ? ""
          : '<span class="bd-s bd-none">reasoned, no source</span>';
      return `<li><span class="bd-role">${esc(m.role)}</span><span class="bd-t">${inline(m.text)}</span>${rest}${fig ? planFigure(fig, a.cycle) : ""}</li>`;
    })
    .join("");
  const nFig = (a.figure_plan ?? []).length;
  return `<details class="bld"><summary><span class="gl-l">How it's built · ${ms.length} moves${nFig ? ` · ${nFig} figures` : ""}</span><span class="bd-chain">${chain}</span></summary><ol class="bd-list">${items}</ol></details>`;
}

/** The same skeleton for the .md twin. */
export function buildMarkdown(a: Built): string[] {
  const ms = moves(a);
  if (!ms.length) return [];
  return [
    "## How it's built",
    "",
    ms.map((m) => m.role).join(" → "),
    "",
    ...ms.flatMap((m, i) => {
      const fig = (a.figure_plan ?? []).find((f) => f.move === i + 1);
      return [
        `${i + 1}. **${m.role}.** ${m.text}${m.refs.length ? ` ${m.refs.map(refLabel).join(" ")}` : ""}`,
        ...(fig ? [`   ${planFigureText(fig, a.cycle)}`] : []),
      ];
    }),
    "",
  ];
}
