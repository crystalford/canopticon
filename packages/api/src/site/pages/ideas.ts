// /ideas — every concept the record named and every open problem it stated.
// docs/blackbox/README.md §Ideas; pages/Canopticon Ideas.dc.html. Read from
// the same library rows as everything else, newest first.

import type { LibraryItem } from "../content/store";
import { type Idea, libraryItems, problems, researchDoc, terms } from "../content/store";
import { esc, pill, shell } from "../layout";
import { kindColours } from "../theme";

/** The register entry behind a row (terms.json / problems.json), if any. */
function entry(r: LibraryItem): Idea | null {
  const id = r.route.split("/").pop() ?? "";
  return (r.kind === "Concept" ? terms() : problems()).find((x) => x.id === id) ?? null;
}

/** "from <the document it came from>": the register's own words when it has
 *  them, otherwise the source document's title up to its colon. */
function fromLine(it: Idea | null): string {
  if (!it) return "";
  if (it.from) return it.from;
  const id = /^\/p\/([^#?]+)/.exec(it.docRoute ?? "")?.[1];
  const title = id ? researchDoc(id)?.title : undefined;
  return title ? (title.split(":")[0]?.replace(/^#\s*/, "").trim() ?? "") : "";
}

function row(r: LibraryItem, last: boolean): string {
  const concept = r.kind === "Concept";
  const it = entry(r);
  const pending = /pending/.test(r.stat ?? "");
  const status: [string, string, string] = concept
    ? pending
      ? ["Name check pending", "#f3e9d4", "#6b4e14"]
      : ["No prior use found", "#e3f0e6", "#1f5e36"]
    : ["Open", "#fbe9df", "#8a3a1f"];
  const topic = r.topic;
  const counter = concept && /counter-argument/.test(it?.foot ?? "");
  const from = concept ? "" : fromLine(it);
  return `<a href="${esc(r.route)}" class="irow${last ? " last" : ""}"><span class="irow-t">${esc(r.title)}</span>${r.dek ? `<span class="irow-d">${esc(r.dek)}</span>` : ""}<span class="irow-m">${pill(r.kind, kindColours(r.kind))}${pill(topic, kindColours("Topic"))}${
    concept
      ? `<span>Named ${esc(r.dateLabel ?? "")}</span>${pill(status[0], [status[1], status[2]])}${
          counter ? pill("1 counter-argument", ["#fbe9df", "#8a3a1f"]) : ""
        }`
      : from
        ? `<span>from ${esc(from)}</span>`
        : ""
  }</span></a>`;
}

function block(title: string, kind: string, rows: LibraryItem[]): string {
  return `<div class="ruled-h" style="margin:40px 0 0">${`<h2>${esc(title)}</h2>`}${pill(String(rows.length), kindColours(kind))}</div><div class="ilist">${rows
    .map((r, i) => row(r, i === rows.length - 1))
    .join("")}</div>`;
}

export function renderIdeas(opts: { signedIn?: boolean } = {}): string {
  const all = libraryItems();
  const byDate = (a: LibraryItem, b: LibraryItem) => b.date.localeCompare(a.date);
  // The three hand-built concept pages lead, as on the prototype page.
  const LEAD = [
    "/concepts/self-extinguishing-maintenance",
    "/concepts/the-overhearer",
    "/concepts/cpai",
  ];
  const rank = (r: LibraryItem) => (LEAD.includes(r.route) ? LEAD.indexOf(r.route) : LEAD.length);
  const concepts = all
    .filter((r) => r.kind === "Concept")
    .sort((a, b) => rank(a) - rank(b) || byDate(a, b));
  const open = all.filter((r) => r.kind === "Open problem").sort(byDate);
  return shell({
    title: "Ideas",
    description:
      "Concepts are patterns that had no name, so the research gave them one; open problems are questions nobody has answered, or things nobody has built.",
    path: "/ideas",
    nav: "library",
    signedIn: opts.signedIn ?? false,
    body: `<div><h1 class="h-page">Ideas</h1></div><p class="lede" style="color:var(--muted)">Concepts are patterns that had no name, so the research gave them one; open problems are questions nobody has answered, or things nobody has built.</p>${block("Concepts", "Concept", concepts)}${block("Open problems", "Open problem", open)}`,
  });
}
