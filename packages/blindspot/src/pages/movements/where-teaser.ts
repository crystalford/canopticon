// Movement 4 teaser (on the landing) — an amber-tinted CTA into the
// dedicated /where calculator, seeded with the live top-1% threshold.

import type { ThresholdRow } from "../../data/queries.ts";
import { formatCadShort } from "../format.ts";
import { escapeHtml } from "../shell.ts";

export function renderWhereTeaser(threshold: ThresholdRow | null): string {
  const line = threshold
    ? `The official top 1% begins around ${escapeHtml(formatCadShort(threshold.thresholdCad))}${threshold.familyCount ? ` — some ${threshold.familyCount.toLocaleString("en-CA")} families` : ""} (${threshold.year}). Past that line, the official distribution stops being able to see.`
    : "Put in a net-worth figure and see where it places — and where the official distribution stops being able to see.";

  return `<section class="bs-where-teaser">
  <div class="bs-where-card">
    <div class="bs-label" style="margin-bottom:12px">Movement 04</div>
    <h2>Where do you stand?</h2>
    <p>${line}</p>
    <a class="bs-where-cta" href="/where">Place a number →</a>
    <p style="font-family:var(--mono);font-size:11px;color:var(--ink-mute);margin-top:18px;max-width:none">This calculation never leaves your browser.</p>
  </div>
</section>`;
}
