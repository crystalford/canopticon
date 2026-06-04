// Synthesis — oversight of system-surfaced findings (read, don't manage).
//
// P0 ships the lens toggle + filter chips + an empty cards area. The
// real surfacing (Pattern / Contradiction / Connection / Gap, computed
// from the chain-collapsed, evidence-bearing weighting model in spec §6.5)
// lands in P2. The single action — "Use in Studio →" — wires up in P5.

import { emptyState, lensToggle, renderOpPage } from "../layout";

export async function renderSynthesisScreen(
  _env: { DB: D1Database },
  view: "findings" | "corpus" = "findings",
): Promise<string> {
  const topbarActions = lensToggle([
    { label: "Findings", href: "/op/synthesis", active: view === "findings" },
    { label: "Corpus", href: "/op/synthesis?view=corpus", active: view === "corpus" },
  ]);

  const filterChips = `<div class="filters">
  <button class="fchip on"><span class="fcdot" style="background:var(--mute)"></span>All findings <span class="fccount">0</span></button>
  <button class="fchip"><span class="fcdot" style="background:var(--c-pattern)"></span>Pattern <span class="fccount">0</span></button>
  <button class="fchip"><span class="fcdot" style="background:var(--c-contra)"></span>Contradiction <span class="fccount">0</span></button>
  <button class="fchip"><span class="fcdot" style="background:var(--c-thesis)"></span>Thesis candidate <span class="fccount">0</span></button>
  <button class="fchip"><span class="fcdot" style="background:var(--c-connect)"></span>Connection <span class="fccount">0</span></button>
  <button class="fchip"><span class="fcdot" style="background:var(--c-gap)"></span>Gap <span class="fccount">0</span></button>
</div>`;

  const body =
    view === "findings"
      ? `${filterChips}
${emptyState({
  iconName: "synthesis",
  title: "No findings yet.",
  body: "Drop documents in Feed to grow the graph. Findings will surface here as the synthesizer notices patterns, contradictions, connections, and gaps. Read-only — silence is valid.",
  action: { href: "/op", label: "Open Feed" },
})}`
      : emptyState({
          iconName: "library",
          title: "Corpus view lands in P2.",
          body: "Documents grouped by chain, with claim counts and status. For now, see the full archive in Library.",
          action: { href: "/op/library", label: "Open Library" },
        });

  return renderOpPage({
    title: "Synthesis",
    sub: "oversight · the system surfaces; you read",
    topbarActions,
    body,
    activeNav: "/op/synthesis",
  });
}
