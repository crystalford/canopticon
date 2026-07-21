// Instruments — the index for canopticon's third product arm.
//
// An instrument is a standalone, code-built measurement tool. Each one
// makes something visible that the official measurement structurally
// cannot, and each ships with three layers: a method paper that proves
// it, a live instrument that shows it, and a content layer that spreads
// it. Instruments live on their own subdomains (blindspot.canopticon.com,
// …); this page is the doorway to them from the publication.
//
// Card pattern lifted from render/topics.ts + components.ts so the arm
// reads as one system with the rest of the site. Emits a schema.org
// ItemList of CreativeWork so the instruments are machine-citable.

import { escapeAttr, escapeHtml, renderPage } from "../layout";

interface Instrument {
  slug: string;
  name: string;
  /** Absolute URL — instruments live on their own subdomains. */
  url: string;
  /** The received measure the instrument interrogates. */
  kicker: string;
  /** One-sentence dek — what it makes visible. */
  dek: string;
  /** The headline quantity the instrument publishes. */
  measure: string;
  status: "live" | "building";
}

// Single source of truth for the instruments arm. Adding an instrument =
// adding a row here (mirrors docs/instruments/README.md's "how to add").
const INSTRUMENTS: Instrument[] = [
  {
    slug: "blindspot",
    name: "The Blind Spot",
    url: "https://blindspot.canopticon.com",
    kicker: "Canadian top-tail wealth",
    dek: "Canada has three official ways of measuring the wealth of its richest households, and they disagree most precisely where it matters most — at the very top. The instrument renders the disagreement itself as the subject and quantifies it as one number.",
    measure: "The Invisibility Index",
    status: "live",
  },
];

export function renderInstrumentsIndex(): string {
  const cards = INSTRUMENTS.map(instrumentCard).join("");
  const placeholder = comingSoonCard();

  const body = `
${instrumentsJsonLd()}
<header class="page-head" style="margin-bottom:28px">
  <div class="label" style="margin-bottom:10px">Instruments</div>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:clamp(30px,4.6vw,46px);letter-spacing:-0.02em;line-height:1.06;max-width:16ch;margin-bottom:16px">Measuring what the official numbers miss.</h1>
  <p style="font-family:var(--serif);font-size:18px;line-height:1.5;color:var(--ink-3);max-width:60ch">
    An instrument is a standalone measurement tool, built in code, that makes
    something visible the official statistics structurally cannot. Each one is
    published with the method that proves it, the sources it stands on, and the
    live figure it produces — nothing vouched, everything reproducible.
  </p>
</header>

<div class="cards-2">
  ${cards}
  ${placeholder}
</div>`;

  return renderPage({
    title: "Instruments",
    description:
      "Standalone measurement tools that make visible what the official statistics structurally cannot. Each instrument ships with its method, its sources, and its live figure.",
    body,
    activeNav: "/instruments",
    zone: "instruments",
    canonical: "https://canopticon.com/instruments",
  });
}

function instrumentCard(i: Instrument): string {
  const badge =
    i.status === "live"
      ? `<span class="card-type" style="--td:var(--confirmed)">live</span>`
      : `<span class="card-type" style="--td:var(--ink-faint)">building</span>`;
  return `<a class="cardlink" href="${escapeAttr(i.url)}">
  <article class="card" style="height:100%;display:flex;flex-direction:column;gap:2px">
    <div class="card-meta" style="margin-bottom:12px">${badge}<span>${escapeHtml(i.kicker)}</span></div>
    <div class="card-title" style="font-size:24px">${escapeHtml(i.name)}</div>
    <p class="card-dek" style="font-size:15px">${escapeHtml(i.dek)}</p>
    <div class="card-meta" style="margin-top:auto;padding-top:14px;border-top:1px solid var(--rule-soft)">
      <span style="color:var(--accent-2);font-weight:500">${escapeHtml(i.measure)}</span>
      <span>${escapeHtml(new URL(i.url).host)} →</span>
    </div>
  </article>
</a>`;
}

function comingSoonCard(): string {
  return `<div class="card soft" style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:1px dashed var(--rule);background:transparent;min-height:180px">
  <div class="label" style="margin-bottom:8px">More instruments</div>
  <p style="font-family:var(--serif);font-size:14.5px;color:var(--ink-mute);max-width:32ch">
    Each new instrument gets its own method paper, its own sources, and its own subdomain.
  </p>
</div>`;
}

/** schema.org ItemList of the published instruments — machine-citable.
 *  Embedded in the page body (valid placement for JSON-LD). */
function instrumentsJsonLd(): string {
  const items = INSTRUMENTS.map((i, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    item: {
      "@type": "CreativeWork",
      name: i.name,
      url: i.url,
      abstract: i.dek,
      creator: { "@type": "Organization", name: "CANOPTICON", url: "https://canopticon.com" },
    },
  }));
  const doc = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "CANOPTICON Instruments",
    description:
      "Standalone measurement tools that make visible what official statistics structurally cannot.",
    itemListElement: items,
  };
  return `<script type="application/ld+json">${JSON.stringify(doc)}</script>`;
}
