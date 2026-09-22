// The on-demand research screen — one live workspace for one investigation.
//
// It used to be a title, a paragraph of explanation and a four-line checklist,
// with the rest of the screen empty. That checklist was the entire visible
// output of a run that had searched the web, read six pages, extracted 273
// verbatim facts and written down a plan of follow-up searches naming exactly
// what it could not cover. All of that was already in the database. None of it
// was on the page.
//
// So the change here is not new capability, it is the run no longer hiding:
// the plan, the sources as they land, two numbers that mean something, and the
// one action worth taking next.
//
// The screen renders COMPLETE on the server — every source found so far — and
// the live layer only keeps it current. With JavaScript off you refresh
// instead of watching, which is the same contract every public page holds.

import type { ResearchStatus } from "../../graph/lib/deep-research";
import { RESEARCH_LIVE_JS } from "../../public/render/research-live";
import { renderResearchWorkspace } from "../../public/render/research-workspace";
import { renderLiveStatusBanner } from "../../public/render/status-banner";
import { renderOpPage } from "../layout";

export function renderResearchScreen(args: {
  label: string;
  angle?: string | undefined;
  /** State at load. Null on a run that has only just started. */
  status?: ResearchStatus | null;
}): string {
  const { label, angle } = args;
  const pollUrl = `/op/research-status?q=${encodeURIComponent(label)}`;
  const title = label.length > 64 ? `${label.slice(0, 61)}…` : label;

  const body = `${renderResearchWorkspace({
    label,
    angle,
    status: args.status ?? null,
    pollUrl,
  })}
${RESEARCH_LIVE_JS}`;

  return renderOpPage({
    title,
    sub: "researching · not yet in the record",
    body,
    activeNav: "/",
    // fullBleed, because the workspace brings its own shell width (--shell,
    // the same one the public site uses). Without it the surface's .wrap caps
    // everything at 760px, and a two-column workspace inside 760px gives the
    // plan a 320px column with a third of the screen left empty beside it.
    fullBleed: true,
  });
}

// renderLiveStatusBanner is still the right component for the OTHER places a
// run is narrated — the library's video import, a plain "expand this file" —
// which are single-step jobs where a checklist is the whole story. Re-exported
// so this module's consumers do not have to know that.
export { renderLiveStatusBanner };
