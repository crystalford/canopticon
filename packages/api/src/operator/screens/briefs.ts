// Briefs — proposal-only citable-page builder.
//
// P0 ships the section header + the empty proposal queue + the published
// archive placeholder. The proposer (graph coverage gaps → proposal
// cards) and the four-step build pipeline (retrieve → generate → verbatim
// verify → independent judge) land in P4. The trust boundary is mechanical
// verbatim substring verification + independent-model judgment — not
// "operator vouched for it." Nothing auto-publishes.

import { emptyState, renderOpPage } from "../layout";

export async function renderBriefsScreen(_env: { DB: D1Database }): Promise<string> {
  const body = `
<div class="briefs-sh">
  <div class="bsh-title">Proposal queue</div>
  <div class="bsh-count">0</div>
  <div class="bsh-sub">graph coverage gaps · build is always your click · nothing auto-publishes</div>
</div>

<div class="briefs-queue">
  <div class="briefs-empty">
    No proposals yet. As entities accumulate references across claims, or as Synthesis surfaces concept clusters,
    the proposer will suggest Briefs to build here. Each is a question the corpus wants answered as a citable page.<br><br>
    Build flow lands in P4: retrieve → generate → verbatim substring verify → independent-model judge → review → publish or discard.
  </div>
</div>

<div style="margin-top:30px">
  <div class="briefs-sh">
    <div class="bsh-title">Published archive</div>
    <div class="bsh-count">0</div>
    <div class="bsh-sub">server-rendered citable pages · no JS required</div>
  </div>
  ${emptyState({
    iconName: "briefs",
    title: "No Briefs published yet.",
    body: "A Brief is a complete authoritative answer to one question, verified verbatim against external sources. Published Briefs render at /briefs/:slug on the public site (P4).",
  })}
</div>
`;

  return renderOpPage({
    title: "Briefs",
    sub: "citable answer-objects · proposal-only · verbatim-verified",
    body,
    activeNav: "/op/briefs",
  });
}
