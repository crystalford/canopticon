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

import {
  type IndexPiece,
  type PublicEnv,
  listEssays,
  listResearch,
  publicationCounts,
  readMinutes,
  resolveOperatorId,
} from "../data";
import { escapeHtml, renderPage } from "../layout";
import { siteJsonLd } from "../machine";
import { formatDate } from "./components";
import { essayRow, researchCard } from "./indexes";

const CANONICAL = "https://canopticon.com";

function stateStrip(counts: {
  essays: number;
  research: number;
  sources: number;
  lastPublished: string | null;
}): string {
  const cells: Array<[string, string]> = [
    [String(counts.essays), "Essays"],
    [String(counts.research), "Research items"],
    [String(counts.sources), "Sources on file"],
    [counts.lastPublished ? formatDate(counts.lastPublished) : "—", "Last published"],
  ];
  return `<div class="state">
${cells
  .map(
    ([n, k]) =>
      `  <div class="state-cell"><div class="state-n">${escapeHtml(n)}</div><div class="state-k">${escapeHtml(k)}</div></div>`,
  )
  .join("\n")}
</div>`;
}

// The lead essay gets the summary treatment: the standalone paragraph is the
// one a reader — or an answer engine — is most likely to quote, so it is the
// thing the front page actually shows, not a truncated first line.
function lead(p: IndexPiece): string {
  const date = p.published_at ? formatDate(p.published_at) : "";
  return `<section class="sec" style="margin-bottom:52px">
  <div class="eyebrow">Latest essay</div>
  <h1 style="font-family:var(--sans);font-weight:700;font-size:clamp(28px,3.8vw,38px);line-height:1.06;letter-spacing:-0.03em;margin:0 0 14px">
    <a href="/p/${escapeHtml(p.slug)}" style="color:var(--ink);text-decoration:none;border:0">${escapeHtml(p.title)}</a>
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

export async function renderFront(env: PublicEnv): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const [essays, research, counts] = userId
    ? await Promise.all([
        listEssays(env.DB, userId),
        listResearch(env.DB, userId),
        publicationCounts(env.DB, userId),
      ])
    : [
        [] as IndexPiece[],
        [] as IndexPiece[],
        { essays: 0, research: 0, sources: 0, lastPublished: null },
      ];

  const [first, ...restEssays] = essays;
  const body = `${stateStrip(counts)}
${
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
${
  research.length
    ? `<section style="margin:0 0 52px">
${sectionHead("Research", "/research", "All research")}
<div class="rgrid">${research.slice(0, 6).map(researchCard).join("\n")}</div>
</section>`
    : ""
}`;

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
