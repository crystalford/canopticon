// The front door.
//
// `/` used to render the graph era's home: five doors, a findings strip, an
// activity feed and a system briefing — most of it pointing at surfaces that
// are now unlinked. With the nav reduced to Essays / Research / About, a
// visitor's first page was the one page still describing the old project.
//
// This is the whole of it: what exists, the newest essay, then the recent
// work. Built from the same row and card components the indexes use, so the
// front door and the indexes cannot drift into looking like two sites.

import { UNGROUPED } from "../../graph/lib/topics";
import { displayTitle } from "../../lib/title";
import {
  type IndexPiece,
  type PublicEnv,
  listEssays,
  listResearch,
  readMinutes,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { siteJsonLd } from "../machine";
import { formatDate } from "./components";
import { essayRow, researchCard } from "./indexes";

const CANONICAL = "https://canopticon.com";

// THE STATE STRIP IS GONE. It ran across the top of the front page as four
// cells — Essays, Research items, Sources on file, Last published — and it was
// the first thing any visitor saw.
//
// It was a waste of the best space on the site, and worse than neutral: it
// opened with "0 Essays" and a Last-published date two months stale. The
// first sentence the front page spoke was that it is empty and nobody is
// tending it. Vanity metrics are a bad trade even when the numbers flatter;
// these did not.
//
// What replaces it is the work itself, which is what a publication should
// lead with. publicationCounts() is still used by other surfaces.

// The lead essay gets the summary treatment: the standalone paragraph is the
// one a reader — or an answer engine — is most likely to quote, so it is the
// thing the front page actually shows, not a truncated first line.
function lead(p: IndexPiece): string {
  const date = p.published_at ? formatDate(p.published_at) : "";
  return `<section class="sec" style="margin-bottom:52px">
  <div class="eyebrow">Latest essay</div>
  <h1 style="font-family:var(--sans);font-weight:700;font-size:clamp(28px,3.8vw,38px);line-height:1.06;letter-spacing:-0.03em;margin:0 0 14px">
    <a href="/p/${escapeHtml(p.slug)}" style="color:var(--ink);text-decoration:none;border:0">${escapeHtml(displayTitle(p.title, p.body_head))}</a>
  </h1>
  ${p.subtitle ? `<p class="phead-dek" style="margin:0 0 18px">${escapeHtml(p.subtitle)}</p>` : ""}
  <div class="coord" style="gap:12px;flex-wrap:wrap">
    <span>${escapeHtml(date)}</span><span class="sep">·</span><span>${readMinutes(p.body_chars)} min read</span>
  </div>
  <p style="margin-top:18px"><a href="/p/${escapeHtml(p.slug)}">Read the full essay →</a></p>
</section>`;
}

function sectionHead(label: string, href: string, allLabel: string): string {
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 0 16px">
  <div class="eyebrow" style="margin:0">${escapeHtml(label)}</div>
  <a href="${escapeHtml(href)}" style="font-family:var(--mono);font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-mute);text-decoration:none">${escapeHtml(allLabel)} →</a>
</div>`;
}

/**
 * Research on the front page, in its sections.
 *
 * The operator: "the homepage just has some splashed randomly on the homepage
 * and that's all the homepage is." Six documents, newest-first, from a corpus
 * spanning several unrelated worlds — so the front page said nothing about
 * what the site covers, only that it had recently published something.
 *
 * Sections fix that in the one place it matters most. A visitor sees the
 * SHAPE of the corpus — the subjects it actually has — rather than a slice of
 * its recency order. That is also what topical authority is built from: a
 * crawler reading this page learns the site has areas, not just posts.
 *
 * A few per section rather than everything, with the section itself linking
 * on: the front page advertises the corpus, it does not reproduce it.
 *
 * Falls back to the flat newest-first grid when nothing has been filed yet —
 * one section holding all of it is worse than none, because it claims a
 * taxonomy and then shows none of it.
 */
function renderResearchByTopic(research: IndexPiece[]): string {
  if (!research.length) return "";

  const groups = new Map<string, IndexPiece[]>();
  for (const d of research) {
    const key = d.topic?.trim() || UNGROUPED;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  if (groups.size < 2) {
    return `<section style="margin:0 0 52px">
${sectionHead("Research", "/research", "All research")}
<div class="rgrid">${research.slice(0, 6).map(researchCard).join("\n")}</div>
</section>`;
  }

  // Biggest sections first; the ungrouped holding pen never leads, and is not
  // shown on the front page at all — "Everything else" is not an advertisement
  // for anything. It is still reachable in full at /research.
  const ordered = [...groups.entries()]
    .filter(([topic]) => topic !== UNGROUPED)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);

  return `<section style="margin:0 0 52px">
${sectionHead("Research", "/research", "All research")}
${ordered
  .map(
    ([topic, list]) => `<div class="topic-sec">
  <div class="topic-head">
    <h2>${escapeHtml(topic)}</h2>
    <span class="topic-n">${list.length} document${list.length === 1 ? "" : "s"}</span>
  </div>
  <div class="rgrid">${list.slice(0, 3).map(researchCard).join("\n")}</div>
</div>`,
  )
  .join("\n")}
</section>`;
}

export async function renderFront(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const [essays, research] = userId
    ? await Promise.all([listEssays(env.DB, userId), listResearch(env.DB, userId)])
    : [[] as IndexPiece[], [] as IndexPiece[]];

  const [first, ...restEssays] = essays;
  const body = `${
    first
      ? lead(first)
      : `<header class="phead">
  <div class="eyebrow">Canopticon</div>
  <h1>A record, kept in public</h1>
  <p class="phead-dek">Research documents published as themselves, and essays that argue
  from them. Free to read, free to quote, built to be cited.</p>
</header>`
  }
${
  restEssays.length
    ? `<section style="margin:0 0 52px">
${sectionHead("Essays", "/essays", "All essays")}
<div class="tbl">${restEssays.slice(0, 5).map(essayRow).join("\n")}</div>
</section>`
    : ""
}
${renderResearchByTopic(research)}`;

  return renderPage({
    title: "",
    description:
      "Canopticon publishes research documents kept whole and essays that argue from them — CC BY 4.0, machine-readable, and citable by people and answer engines alike.",
    body: `${body}\n${siteJsonLd()}`,
    activeNav: "/",
    zone: "home",
    canonical: `${CANONICAL}/`,
  });
}
