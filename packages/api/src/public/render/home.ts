// Home — masthead + five-pillar entry. Phase 1 stub.
// Uses the design system's `cardlink` + `card-type` + `card-title`
// + `card-dek` classes directly so the page is polished from day one.
// Phase 2 swaps the static blurbs for live lead/recent/topic data.

import { PRIMARY_NAV, escapeHtml, renderPage } from "../layout";

interface PillarSpec {
  href: string;
  label: string;
  typeLabel: string;
  typeClass: string;
  blurb: string;
}

const PILLARS: PillarSpec[] = [
  {
    href: "/topics",
    label: "Topics",
    typeLabel: "Subject pillars",
    typeClass: "t-topic",
    blurb:
      "The corpus by subject — the structures, networks, and institutions the work is pointed at.",
  },
  {
    href: "/investigations",
    label: "Investigations",
    typeLabel: "Signed analysis",
    typeClass: "t-essay",
    blurb:
      "The signed read on the substrate. Theses, research reports, briefs — every assertion tied back to the evidence it rests on.",
  },
  {
    href: "/record",
    label: "The Record",
    typeLabel: "Reference",
    typeClass: "t-entity",
    blurb:
      "People, organizations, programs. Look up an entity and see every claim, source, and pattern that touches them.",
  },
  {
    href: "/patterns",
    label: "Patterns",
    typeLabel: "The lighthouse",
    typeClass: "t-pattern",
    blurb:
      "What the whole corpus reveals — signed by the operator. Patterns no single document contains; gaps the corpus surfaces; the timeline cast across documents.",
  },
  {
    href: "/library",
    label: "Library",
    typeLabel: "The raw research",
    typeClass: "t-research-report",
    blurb: "The working material the rest is built on — kept whole, kept honest, downloadable.",
  },
];

// Live fabric feed: recently active subjects + signed readings. The home is
// the doorway INTO the fabric, not a list of nav pillars.
export async function renderHome(env?: { DB: D1Database }): Promise<string> {
  if (env) {
    const feed = await renderActivityFeed(env).catch(() => "");
    if (feed) return feed;
  }
  // Fallback (no env / empty corpus): the pillar masthead.
  const cards = PILLARS.map(
    (p) => `<a class="cardlink" href="${p.href}">
  <div class="card-type ${p.typeClass}">${escapeHtml(p.typeLabel)}</div>
  <div class="card-title">${escapeHtml(p.label)}</div>
  <div class="card-dek">${escapeHtml(p.blurb)}</div>
</a>`,
  ).join("");
  // Touch PRIMARY_NAV to silence any future "unused import" lint.
  void PRIMARY_NAV;
  const body = `
<section style="margin-bottom:18px">
  <div class="kicker" style="margin-bottom:18px">
    <span class="live"></span> Forensic intelligence · sourced, structured, permanent
  </div>
  <h1 style="font-family:var(--serif);font-size:48px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 18px;color:var(--ink)">How things actually work, beneath the official account.</h1>
  <p style="font-family:var(--serif);font-size:19px;line-height:1.55;color:var(--ink-2);max-width:680px">
    A forensic intelligence system — mapping the architecture of systems and
    institutions through sourced claims, signed analysis, and a growing graph of
    verified connections. The facts are the foundation. The patterns are the point.
  </p>
</section>

<section style="margin-bottom:40px">
  <div class="row between" style="border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:16px">
    <div class="label">Five ways in</div>
  </div>
  <div class="cards-3">${cards}</div>
</section>
`;
  return renderPage({
    title: "",
    description:
      "Forensic intelligence. Sourced, structured, permanent. Mapping the architecture of systems and institutions through sourced claims and signed analysis.",
    body,
    activeNav: "/",
    zone: "home",
  });
}

async function renderActivityFeed(env: { DB: D1Database }): Promise<string> {
  const { all, one } = await import("../../lib/d1");
  const { resolveOperatorId } = await import("../data");
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return "";

  // Recently active subjects: pages ordered by recency, signed first.
  const subjects = await all<{
    slug: string;
    label: string;
    kind: string;
    signed_status: string;
    thesis: string | null;
    sources: number;
  }>(
    env.DB,
    `SELECT p.slug, n.label, n.kind, p.signed_status, p.thesis,
            (SELECT COUNT(DISTINCT piece_id) FROM nodes
              WHERE user_id = ? AND lower(label) = lower(n.label) AND piece_id IS NOT NULL) AS sources
       FROM pages p JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ?
      ORDER BY (p.signed_status = 'published') DESC, p.updated_at DESC
      LIMIT 12`,
    [userId, userId],
  ).catch(() => []);
  if (subjects.length === 0) return "";

  const counts = await one<{ subjects: number; themes: number; docs: number }>(
    env.DB,
    `SELECT
       (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS subjects,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
       (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs`,
    [userId, userId, userId],
  ).catch(() => null);

  const cards = subjects
    .map((s) => {
      const signed = s.signed_status === "published";
      const kindLabel = s.kind === "theme" ? "THEME" : s.kind === "event" ? "EVENT" : "SUBJECT";
      const badge = signed
        ? `<span class="chip" style="background:#f4e9e6;color:#8a3324;border:none">SIGNED READING</span>`
        : "";
      const dek =
        signed && s.thesis
          ? escapeHtml(s.thesis.slice(0, 130))
          : `${s.sources} source${s.sources === 1 ? "" : "s"}`;
      return `<a class="cardlink" href="/s/${escapeHtml(s.slug)}${signed ? "?mode=signed" : ""}">
  <div class="card-type">${kindLabel} ${badge}</div>
  <div class="card-title">${escapeHtml(s.label)}</div>
  <div class="card-dek">${dek}</div>
</a>`;
    })
    .join("");

  const body = `
<section style="margin-bottom:18px">
  <div class="kicker" style="margin-bottom:18px"><span class="live"></span> A forensic record of Canadian power — facts first, readings signed</div>
  <h1 style="font-family:var(--serif);font-size:44px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 16px;color:var(--ink)">How things actually work, beneath the official account.</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.55;color:var(--ink-2);max-width:680px">
    Recently active across the fabric. <b>${counts?.subjects ?? subjects.length} subjects</b> · <b>${counts?.themes ?? 0} themes</b> · <b>${counts?.docs ?? 0} source documents</b> — every claim carries its receipt.
  </p>
</section>
<section style="margin-bottom:40px">
  <div class="cards-3">${cards}</div>
</section>`;

  return renderPage({
    title: "",
    description:
      "A forensic record of Canadian power — facts first, readings signed. Recently active subjects and themes across the fabric.",
    body,
    activeNav: "/",
    zone: "home",
  });
}
