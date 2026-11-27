import type { Glance } from "../content/store";
import { esc } from "../layout";
import { inline } from "../md";

/** The short version, read before the long one: a few words, the formula
 *  (lines joined by " || ", arrows drawn), one sentence, and about thirty
 *  seconds to say aloud (folded). Theories, essays and papers all carry it. */
export function glance(g: Glance): string {
  if (!g.glance_words && !g.glance_sentence) return "";
  const lines = String(g.glance_formula ?? "")
    .split("||")
    .map((l) => l.trim())
    .filter(Boolean);
  const formula = lines.length
    ? `<div class="gl-f" aria-label="As a formula">${lines
        .map(
          (l) =>
            `<p>${esc(l)
              .split("→")
              .map((part) => part.trim())
              .join('<span class="gl-arrow" aria-hidden="true">→</span>')}</p>`,
        )
        .join("")}</div>`
    : "";
  return `<section class="glance" aria-label="At a glance">
  <div class="gl-l">At a glance</div>
  ${g.glance_words ? `<p class="gl-w">${esc(g.glance_words)}</p>` : ""}
  ${formula}
  ${g.glance_sentence ? `<p class="gl-s">${inline(g.glance_sentence)}</p>` : ""}
  ${g.glance_aloud ? `<details class="gl-a"><summary>Say it in thirty seconds</summary><p>${inline(g.glance_aloud)}</p></details>` : ""}
</section>`;
}

/** The same short version as Markdown, for the .md twin and the feeds. */
export function glanceMarkdown(g: Glance): string[] {
  if (!g.glance_words && !g.glance_sentence) return [];
  return [
    "## At a glance",
    "",
    ...(g.glance_words ? [`**In a few words:** ${g.glance_words}`, ""] : []),
    ...(g.glance_formula
      ? [
          `**As a formula:** ${String(g.glance_formula)
            .split("||")
            .map((l) => l.trim())
            .join("; ")}`,
          "",
        ]
      : []),
    ...(g.glance_sentence ? [`**In one sentence:** ${g.glance_sentence}`, ""] : []),
    ...(g.glance_aloud ? [`**Said aloud:** ${g.glance_aloud}`, ""] : []),
  ];
}
