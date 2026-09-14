// About — what this publication is, how a piece is put together, and the
// terms it's published under.
//
// This page used to 301 to /method, which meant the site had a page
// explaining how verification works and no page explaining what the site
// IS. /method keeps the verification detail; this is the plain answer to
// "what am I looking at", which is also the question an answer engine asks
// first when it decides whether a source is worth citing.

import { escapeHtml, renderPage } from "../layout";

const CANONICAL = "https://canopticon.com";

interface Standard {
  title: string;
  body: string;
}

const STANDARDS: Standard[] = [
  {
    title: "Dates are visible",
    body: "Every piece shows when it was published and, if it changed, when it was updated. Undated writing cannot be checked against what was known at the time.",
  },
  {
    title: "Sources are named",
    body: "Claims point at documents. Where a document is stored here, the quote is checked word-for-word against it by machine — not vouched for.",
  },
  {
    title: "Nothing is written twice",
    body: "A page, its markdown twin and its structured data are generated from one source. They cannot drift apart, because there is only one of them.",
  },
  {
    title: "Published as itself",
    body: "A research document is not summarised into a blog post. It keeps its own page, its own address, and its own text.",
  },
];

export function renderAbout(): string {
  const standards = STANDARDS.map(
    (s) => `<div class="std-card">
    <h3>${escapeHtml(s.title)}</h3>
    <p>${escapeHtml(s.body)}</p>
  </div>`,
  ).join("\n");

  const body = `<header class="phead">
  <div class="eyebrow">About</div>
  <h1>A record, kept in public</h1>
  <p class="phead-dek">Canopticon publishes two things: research documents, kept whole, and
  essays that argue from them. Both are free to read, free to quote, and built to be
  cited by people and machines alike.</p>
</header>

<section class="sec">
  <h2>What's published here</h2>
  <p class="lead">Two kinds of thing, and nothing else.</p>
  <p><strong>Research</strong> is a primary document — a report, a filing, a record —
  published as itself rather than summarised away. It keeps its own page and its own
  address so it can be pointed at directly.</p>
  <p><strong>Essays</strong> are arguments made once, in full. Each section opens by
  answering the question it asks, so a passage can be quoted on its own without
  misrepresenting the whole.</p>
</section>

<section class="sec">
  <h2>How a piece is structured</h2>
  <p class="lead">The structure is the point, not decoration.</p>
  <p>An essay opens with a one-paragraph summary that stands alone, then proceeds as a
  series of questions. The first sentence under each question is the answer to it. The
  supporting material comes after. Sources are numbered at the end and referenced inline.</p>
  <p>This is a deliberate constraint. Writing that answers first is easier to read, harder
  to hide a weak argument inside, and can be quoted accurately by a search or answer
  engine without the surrounding paragraphs. The table of contents, the structured data
  and the markdown twin on every page are all derived from that same structure — nothing
  is authored twice.</p>
  <p>Concretely, an essay is a Markdown file shaped like this:</p>
  <pre class="convention"># Title
A one-line dek.

A summary paragraph that stands alone.

## A question ending in a question mark?
The answer, in the first sentence or two.
Supporting paragraphs after that, citing sources as [1].

## Sources
1. Author. Title. Publisher, 2026.</pre>
</section>

<section class="sec">
  <h2>Open by design</h2>
  <p class="lead">Everything here is published under
  <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a> —
  quote it, republish it, train on it, with attribution.</p>
  <p>Every page has a plain-text twin at the same address with <code>.md</code> on the end,
  and the site publishes <a href="/llms.txt">llms.txt</a>,
  <a href="/sitemap.xml">sitemap.xml</a> and <a href="/feed.json">feed.json</a>.
  AI crawlers are explicitly allowed in
  <a href="/robots.txt">robots.txt</a> rather than merely un-blocked.</p>
  <p>That is a choice, and an uncommon one. Most publishers are busy closing this door.
  A record that cannot be cited does not function as a record.</p>
</section>

<section class="sec">
  <h2>Standards</h2>
  <div class="std">
${standards}
  </div>
</section>

<section class="sec">
  <h2>How verification works</h2>
  <p>Quotes drawn from stored documents are checked mechanically: the quoted text must
  appear, character for character, in the source on file, and its position in that file is
  recorded. Quotes that fail are removed. Each one has its own citable address.
  <a href="/method">The full method →</a></p>
</section>

<section class="sec">
  <h2>Contact</h2>
  <p>Corrections and questions: <a href="https://x.com/canoptics">@canoptics</a> ·
  <a href="https://github.com/crystalford/canopticon">source on GitHub</a></p>
</section>`;

  return renderPage({
    title: "About",
    description:
      "Canopticon publishes research documents kept whole and essays that argue from them — CC BY 4.0, machine-readable, and citable by people and answer engines alike.",
    body,
    activeNav: "/about",
    zone: "about",
    canonical: `${CANONICAL}/about`,
  });
}
