// THE RESEARCH WORKSPACE — one live surface for one investigation.
//
// What this replaces: a title, a paragraph of explanation, and a four-line
// checklist that collapsed everything the run produced into the word "banked"
// and a number. The rest of the screen was empty.
//
// What was already there to show, on every run, written and then discarded at
// the point of display:
//
//   · the PLAN. The writer proposes follow-up searches naming exactly what the
//     first pass could not cover. They were stored in the database and never
//     rendered. This is the most interesting thing a research run produces —
//     watching it fill in is watching an investigation take shape, which is
//     the difference between a research tool and a progress bar.
//   · the SOURCES. record-builder emits url, title and length for every page
//     it reads. The banner counted the events.
//   · the FACTS. A number the extractor already returns.
//
// So this is not new capability. It is the same run, no longer hiding.
//
// STILL NO JAVASCRIPT REQUIRED TO READ — the server renders the whole thing,
// including every source found so far, and the poller only replaces what has
// changed. Open it with JS off and you see the state at load; refresh and you
// see the state now. The live updating is an enhancement on top of a page
// that is already complete, which is the same contract every public page
// holds.

import type { ResearchStatus } from "../../graph/lib/deep-research";
import { escapeAttr, escapeHtml } from "../layout";

/**
 * The workspace body.
 *
 * `status` is the state at render time — possibly null on a brand-new run,
 * which renders the same frame with empty panels rather than a different page.
 * Nothing here is conditional on there being a poller.
 */
export function renderResearchWorkspace(args: {
  label: string;
  angle?: string | undefined;
  status: ResearchStatus | null;
  pollUrl: string;
}): string {
  const { label, angle, status, pollUrl } = args;
  return `<section class="rw" data-poll-url="${escapeAttr(pollUrl)}">
  <header class="rw-head">
    <div class="rw-kicker">Investigation</div>
    <h1 class="rw-q">${escapeHtml(label)}</h1>
    ${angle ? `<p class="rw-angle">${escapeHtml(angle)}</p>` : ""}
    <div class="rw-state" data-rw="state">${renderState(status)}</div>
  </header>

  <div class="rw-grid">
    <div class="rw-main">
      <div class="rw-panel">
        <div class="rw-panel-h">Plan<span class="rw-count" data-rw="plan-count">${
          status?.plan?.length ?? 1
        }</span></div>
        <ol class="rw-plan" data-rw="plan">${renderPlan(status)}</ol>
      </div>

      <div class="rw-panel">
        <div class="rw-panel-h">Sources read<span class="rw-count" data-rw="src-count">${
          status?.sources?.length ?? 0
        }</span></div>
        <ul class="rw-sources" data-rw="sources">${renderSources(status)}</ul>
      </div>
    </div>

    <aside class="rw-side">
      <dl class="rw-metrics" data-rw="metrics">${renderMetrics(status)}</dl>
      <div class="rw-actions" data-rw="actions">${renderAction(status)}</div>
      <p class="rw-note">
        Nothing enters the record until you read the draft and publish it
        yourself. The operator approves, never authors.
      </p>
    </aside>
  </div>
</section>`;
}

/** The one-line state, with the dot that says whether anything is moving. */
export function renderState(s: ResearchStatus | null): string {
  const headline = s?.headline ?? "Starting…";
  const cls = !s ? "run" : s.warn ? "warn" : s.terminal ? "rest" : "run";
  return `<span class="rw-dot rw-dot-${cls}"></span><span class="rw-headline">${escapeHtml(
    headline,
  )}</span>`;
}

/**
 * The searches, in order, with the operator's own question first.
 *
 * A queued search is shown with its full text rather than a count, because the
 * text is the interesting part: "3 follow-up searches" says nothing, while
 * seeing the actual query the writer proposed tells the operator whether the
 * run understood the question.
 */
export function renderPlan(s: ResearchStatus | null): string {
  const plan = s?.plan ?? [];
  if (!plan.length) return `<li class="rw-step rw-step-running">Opening search</li>`;
  return plan
    .map(
      (q) => `<li class="rw-step rw-step-${q.state}">
      <span class="rw-mark"></span>
      <span class="rw-step-q">${escapeHtml(q.query)}</span>
      ${q.opening ? `<span class="rw-tag">your question</span>` : ""}
    </li>`,
    )
    .join("");
}

/** Every page the run actually read. Newest first, so new ones appear on top. */
export function renderSources(s: ResearchStatus | null): string {
  const sources = s?.sources ?? [];
  if (!sources.length) {
    return `<li class="rw-empty">Nothing read yet. Sources appear here as they are fetched.</li>`;
  }
  return sources
    .map(
      (src) => `<li class="rw-src rw-src-${src.state}">
      <a href="${escapeAttr(src.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(
        src.title,
      )}</a>
      <span class="rw-src-meta">${escapeHtml(src.domain)}${
        src.chars ? ` · ${Math.round(src.chars / 1000)}k` : ""
      }${src.state === "duplicate" ? " · already held" : ""}</span>
    </li>`,
    )
    .join("");
}

/** Two numbers that mean something to a person, not five that measure internals. */
export function renderMetrics(s: ResearchStatus | null): string {
  const banked = (s?.sources ?? []).filter((x) => x.state === "banked").length;
  const facts = s?.facts ?? 0;
  return `<div class="rw-metric"><dt>Sources kept</dt><dd>${banked}</dd></div>
    <div class="rw-metric"><dt>Verbatim facts</dt><dd>${facts}</dd></div>`;
}

/**
 * The one thing to do next.
 *
 * A finished run offers the draft; a waiting run offers the press that moves
 * it. Both are POSTs or links rendered server-side, so the run remains
 * operable with the poller dead.
 */
export function renderAction(s: ResearchStatus | null): string {
  if (s?.draft) {
    return `<a class="rw-btn rw-btn-primary" href="${escapeAttr(
      s.draft.reviewUrl,
    )}">Read the draft →</a>`;
  }
  if (s?.reviewUrl) {
    return `<a class="rw-btn rw-btn-primary" href="${escapeAttr(
      s.reviewUrl,
    )}">Read the draft →</a>`;
  }
  if (s?.action) {
    return `<form method="POST" action="${escapeAttr(s.action.postTo)}">
      ${
        s.action.returnTo
          ? `<input type="hidden" name="return_to" value="${escapeAttr(s.action.returnTo)}" />`
          : ""
      }
      <button type="submit" class="rw-btn rw-btn-primary">${escapeHtml(s.action.label)}</button>
    </form>`;
  }
  return `<div class="rw-working">Working…</div>`;
}
