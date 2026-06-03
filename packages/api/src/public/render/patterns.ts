// Patterns — the lighthouse index. Only operator-signed patterns reach
// the public site (candidates live in the operator Leads queue). The
// weighting model + detail pages land in Phase 4; Phase 2 ships the
// signed-pattern index so the surface reads from D1.

import { type PublicEnv, listSignedPatterns, resolveOperatorId } from "../data";
import { renderPage } from "../layout";
import { emptyState, patternCard, sectionHeader } from "./components";

export async function renderPatternsIndex(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const patterns = userId ? await listSignedPatterns(env.DB, userId) : [];

  const grid = patterns.length
    ? `<div class="cards-2">${patterns.map((p) => patternCard(p)).join("")}</div>`
    : emptyState(
        "No signed patterns yet. Patterns surface as candidates in the operator's review queue; only signed ones reach this page. The weighting model and detail surfaces land in a later phase.",
      );

  const body = `
<section style="margin-bottom:24px">
  <div class="kicker" style="margin-bottom:16px"><span class="live"></span> The lighthouse · signed patterns across the corpus</div>
  <h1 style="font-family:var(--serif);font-size:40px;line-height:1.12;letter-spacing:-0.015em;margin:0 0 12px;color:var(--ink)">Patterns</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    What the whole corpus reveals — insights no single document contains. Every
    pattern here is operator-signed, lists its constituent documents, and shows
    the evidence that cuts against it.
  </p>
</section>
<section>${sectionHeader(`Signed patterns (${patterns.length})`)}${grid}</section>
`;
  return renderPage({
    title: "Patterns",
    description:
      "Signed insights across the Canadian power corpus — what no single document contains.",
    body,
    activeNav: "/patterns",
    zone: "patterns",
  });
}
