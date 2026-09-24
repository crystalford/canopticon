// The outline checklist in the research workspace: what a sectioned run
// shows while it is being written, and what a single-mode run never shows.

import { describe, expect, it } from "vitest";
import type { ResearchStatus } from "../src/graph/lib/deep-research";
import { RESEARCH_LIVE_JS } from "../src/public/render/research-live";
import {
  renderOutline,
  renderOutlineHeading,
  renderResearchWorkspace,
} from "../src/public/render/research-workspace";

const status = (over: Partial<ResearchStatus> = {}): ResearchStatus => ({
  terminal: true,
  warn: false,
  headline: "Writing · 2 of 5 sections.",
  steps: [],
  ...over,
});

const mid = status({
  mode: "sectioned",
  sectionsDone: 2,
  sectionsTotal: 5,
  outline: [
    { heading: "Where vendors compete", state: "done", quotesOk: 3, quotesKilled: 0 },
    { heading: "What networks measure", state: "done", quotesOk: 2, quotesKilled: 1 },
    { heading: "The identity layer", state: "queued" },
    { heading: "Incrementality", state: "queued" },
    { heading: "Standards bodies", state: "queued" },
  ],
  action: { label: "Write section 3 of 5", postTo: "/op/research/advance", auto: true },
});

describe("the outline checklist", () => {
  it("counts the sections written against the plan", () => {
    expect(renderOutlineHeading(mid)).toContain("Writing");
    expect(renderOutlineHeading(mid)).toContain("2 of 5 sections");
    expect(renderOutlineHeading(status({ sectionsDone: 5, sectionsTotal: 5 }))).toContain(
      "Written",
    );
  });

  it("ticks the sections that have landed and queues the rest", () => {
    const html = renderOutline(mid);
    expect(html.match(/rw-step-done/g)).toHaveLength(2);
    expect(html.match(/rw-step-queued/g)).toHaveLength(3);
    expect(html.indexOf("Where vendors compete")).toBeLessThan(html.indexOf("Standards bodies"));
  });

  it("shows a killed quote count in red, and no count when nothing was killed", () => {
    const html = renderOutline(mid);
    expect(html).toContain('<span class="lead-ans-disc">1 killed</span>');
    expect(html.match(/lead-ans-disc/g)).toHaveLength(1);
    expect(html).toContain("3 quotes verified");
  });

  it("is on the page, complete, without JavaScript — and hidden for a run with no outline", () => {
    const page = renderResearchWorkspace({ label: "Q", status: mid, pollUrl: "/x" });
    expect(page).toContain('data-rw="outline-panel">');
    expect(page).toContain("The identity layer");
    expect(page).toContain("Write section 3 of 5");

    const single = renderResearchWorkspace({ label: "Q", status: status(), pollUrl: "/x" });
    expect(single).toContain('data-rw="outline-panel" hidden');
  });

  it("the live layer paints the same panel and presses each section's own label", () => {
    expect(RESEARCH_LIVE_JS).toContain('set("outline", outline(s))');
    expect(RESEARCH_LIVE_JS).toContain('at("outline-panel")');
    // Seven sections plus outline, assembly, a synthesis and two searches
    // must fit inside the auto-press budget, or the run stalls waiting for a
    // hand on a button after every section.
    const left = Number(/var autoLeft = (\d+);/.exec(RESEARCH_LIVE_JS)?.[1]);
    expect(left).toBeGreaterThanOrEqual(12);
  });
});
