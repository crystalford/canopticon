// The research workspace — what it must show, and what it must not invent.
//
// The screen it replaces rendered a four-line checklist and nothing else, while
// the run underneath it had a plan, six sources with titles and sizes, and 273
// extracted facts sitting in the database. So the tests that matter here are
// about the page being HONEST about a run: showing what happened, staying
// usable when the poller is dead, and never claiming more than it has.

import { describe, expect, it } from "vitest";
import type { ResearchStatus } from "../src/graph/lib/deep-research";
import {
  renderAction,
  renderMetrics,
  renderPlan,
  renderResearchWorkspace,
  renderSources,
} from "../src/public/render/research-workspace";

const status = (over: Partial<ResearchStatus> = {}): ResearchStatus => ({
  terminal: false,
  warn: false,
  headline: "Working",
  steps: [],
  ...over,
});

describe("the plan", () => {
  it("shows the operator's own question first, marked as theirs", () => {
    const html = renderPlan(
      status({
        plan: [
          { query: "Why did housing rise?", state: "done", opening: true },
          { query: "cmhc starts 2026", state: "queued", opening: false },
        ],
      }),
    );
    expect(html.indexOf("Why did housing rise?")).toBeLessThan(html.indexOf("cmhc starts 2026"));
    expect(html).toContain("your question");
  });

  it("prints each proposed search in full rather than counting them", () => {
    // "3 follow-up searches" says nothing. The text of the query is how the
    // operator tells whether the run understood the question at all.
    const html = renderPlan(
      status({
        plan: [{ query: "retail media incrementality gaps", state: "queued", opening: false }],
      }),
    );
    expect(html).toContain("retail media incrementality gaps");
  });

  it("carries each search's state as a class, so done and queued differ", () => {
    const html = renderPlan(
      status({
        plan: [
          { query: "a query that is done", state: "done", opening: false },
          { query: "a query still running", state: "running", opening: false },
          { query: "a query still queued", state: "queued", opening: false },
        ],
      }),
    );
    expect(html).toContain("rw-step-done");
    expect(html).toContain("rw-step-running");
    expect(html).toContain("rw-step-queued");
  });

  it("does not render an empty plan as an empty box", () => {
    expect(renderPlan(status())).toContain("Opening search");
  });
});

describe("the sources", () => {
  const src = {
    title: "The post-cookie measurement scramble",
    url: "https://digiday.com/marketing/x",
    domain: "digiday.com",
    chars: 18700,
    state: "banked" as const,
  };

  it("names the page and where it came from", () => {
    const html = renderSources(status({ sources: [src] }));
    expect(html).toContain("The post-cookie measurement scramble");
    expect(html).toContain("digiday.com");
    expect(html).toContain('href="https://digiday.com/marketing/x"');
  });

  it("sends every outbound source link out nofollow, in a new tab", () => {
    // These are third-party pages the run happened to read, not endorsements,
    // and the operator is mid-run — a link that navigates away loses the page.
    const html = renderSources(status({ sources: [src] }));
    expect(html).toContain('rel="nofollow noopener"');
    expect(html).toContain('target="_blank"');
  });

  it("says plainly when nothing has been read yet", () => {
    expect(renderSources(status())).toContain("Nothing read yet");
  });

  it("marks a source already held rather than pretending it is new", () => {
    const html = renderSources(status({ sources: [{ ...src, state: "duplicate" }] }));
    expect(html).toContain("already held");
  });
});

describe("the numbers", () => {
  it("counts only sources actually kept, not everything touched", () => {
    // A page that was fetched and turned out to be a duplicate, or is still
    // being fetched, is not a source this run has. Counting it would inflate
    // the one number the operator might quote.
    const html = renderMetrics(
      status({
        sources: [
          { title: "a", url: "u1", domain: "d", state: "banked" },
          { title: "b", url: "u2", domain: "d", state: "duplicate" },
          { title: "c", url: "u3", domain: "d", state: "fetching" },
          {
            title: "Just a moment...",
            url: "u4",
            domain: "d",
            state: "rejected",
            reason: "bot challenge",
          },
        ],
      }),
    );
    expect(html).toMatch(/Sources kept<\/dt><dd>1</);
    expect(html).toMatch(/Rejected<\/dt><dd>1</);
  });

  it("shows zero rather than nothing when a run has just started", () => {
    expect(renderMetrics(status())).toMatch(/<dd>0</);
  });
});

describe("the page works without the poller", () => {
  it("renders the whole run server-side, sources included", () => {
    // The live layer is an enhancement. With JavaScript off the operator
    // refreshes instead of watching — they do not get an empty frame.
    const html = renderResearchWorkspace({
      label: "A question",
      status: status({
        plan: [{ query: "A question", state: "done", opening: true }],
        sources: [
          { title: "A source", url: "https://x.test/a", domain: "x.test", state: "banked" },
          {
            title: "Just a moment...",
            url: "https://x.test/b",
            domain: "x.test",
            state: "rejected",
            reason: "bot challenge",
          },
        ],
      }),
      pollUrl: "/op/research-status?q=A+question",
    });
    expect(html).toContain("A source");
    expect(html).toContain("x.test");
    expect(html).toContain("A question");
    // A refused page is listed with its reason, so "why only one source?" is
    // answered on the page rather than in a log.
    expect(html).toContain("rejected — bot challenge");
  });

  it("renders the waiting run's press as a real form, not a script hook", () => {
    const html = renderAction(
      status({
        terminal: true,
        action: { label: "Write the brief", postTo: "/op/research/advance", auto: true },
      }),
    );
    expect(html).toContain('method="POST"');
    expect(html).toContain('action="/op/research/advance"');
    expect(html).toContain("Write the brief");
  });

  it("offers the draft once there is one, instead of another step", () => {
    const html = renderAction(
      status({ terminal: true, reviewUrl: "/op/library/research/p1/review" }),
    );
    expect(html).toContain("/op/library/research/p1/review");
    expect(html).not.toContain("<form");
  });

  it("escapes a question rather than letting it become markup", () => {
    const html = renderResearchWorkspace({
      label: '<img src=x onerror="alert(1)">',
      status: null,
      pollUrl: "/x",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
