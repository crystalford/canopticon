// "How this works" — the site's own map of itself. Distills the internal
// design docs (canonical-spec-v2.6.md, the renovation doc) into something
// readable ON THE SITE, so the definition of what Canopticon IS doesn't
// live only in files an operator doesn't open day-to-day and quietly
// drift out of sync with what's actually built. /method explains why a
// claim can be trusted (the reader's question); this explains what the
// system actually is, what's really shipped vs still open, and what runs
// on its own between visits (the operator's question). Where cheap, it
// pulls live counts from D1 instead of hand-written numbers — a page
// about avoiding drift should itself drift as little as possible.

import { renderPage } from "../layout";

interface LiveStats {
  subjects: number;
  docs: number;
  facts: number;
  signed: number;
  themes: number;
  quotes: number;
}

async function loadLiveStats(env: { DB: D1Database }): Promise<LiveStats | null> {
  const { one } = await import("../../lib/d1");
  const { resolveOperatorId } = await import("../data");
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;
  return one<LiveStats>(
    env.DB,
    `SELECT
       (SELECT COUNT(*) FROM pages WHERE user_id = ?) AS subjects,
       (SELECT COUNT(*) FROM pieces WHERE user_id = ?) AS docs,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind IN ('neutral_fact','event')) AS facts,
       (SELECT COUNT(*) FROM pages WHERE user_id = ? AND signed_status = 'published') AS signed,
       (SELECT COUNT(*) FROM nodes WHERE user_id = ? AND kind = 'theme') AS themes,
       (SELECT COUNT(*) FROM quotes WHERE user_id = ?) AS quotes`,
    [userId, userId, userId, userId, userId, userId],
  ).catch(() => null);
}

const ARRANGEMENTS: Array<{
  name: string;
  url: string;
  schema: string;
  what: string;
  status: "live" | "heuristic" | "scaffold";
}> = [
  {
    name: "Definition",
    url: "/d/:slug",
    schema: "DefinedTerm",
    what: "The subject's highest-confidence neutral fact, framed as a definition.",
    status: "live",
  },
  {
    name: "Timeline",
    url: "/t/:slug",
    schema: "ItemList + Event",
    what: "Dated events involving the subject, in order. Embedded richly on the File.",
    status: "live",
  },
  {
    name: "Entity profile",
    url: "/profile/:slug",
    schema: "Person / Organization",
    what: "Typed attributes and relationships. Embedded richly on the File.",
    status: "live",
  },
  {
    name: "Ownership / network map",
    url: "/n/:slug",
    schema: "OwnershipInfo",
    what: "The relationship graph radiating out from the subject. Embedded richly on the File.",
    status: "live",
  },
  {
    name: "Who's-who roster",
    url: "/w/:slug",
    schema: "ItemList of Person",
    what: "The named people tied to this subject and their roles.",
    status: "heuristic",
  },
  {
    name: "Comparison matrix",
    url: "/c/:slug",
    schema: "Table + ClaimReview",
    what: "Side-by-side claims. The graph isn't tagged with comparison-shaped data yet — this always renders its honest empty state.",
    status: "scaffold",
  },
  {
    name: "FAQ / Q&A hub",
    url: "/f/:slug",
    schema: "FAQPage",
    what: "Facts shaped like questions and answers about the subject.",
    status: "heuristic",
  },
  {
    name: "Statistics roundup",
    url: "/stat/:slug",
    schema: "Dataset",
    what: "The subject's numeric facts, gathered in one place.",
    status: "heuristic",
  },
  {
    name: "Ledger of flows",
    url: "/l/:slug",
    schema: "Dataset + MonetaryAmount",
    what: "Money in, money out — where the graph has it.",
    status: "heuristic",
  },
  {
    name: "Mechanism explainer",
    url: "/m/:slug",
    schema: "HowTo / Article",
    what: "A causal chain of edges — how one thing led to another.",
    status: "heuristic",
  },
  {
    name: "Document-of-record",
    url: "/library/:slug",
    schema: "CreativeWork",
    what: "The raw source itself, with a provenance overlay showing what it fed the record.",
    status: "live",
  },
  {
    name: "Claim-and-source table",
    url: "/ct/:slug",
    schema: "Claim + ClaimReview",
    what: "Every attributed assertion about the subject, with who said it and against what. Embedded richly on the File.",
    status: "live",
  },
];

const STATUS_LABEL: Record<string, string> = {
  live: "live",
  heuristic: "live · simple rules",
  scaffold: "scaffold only",
};

const INTENTS: Array<{ name: string; stance: string }> = [
  { name: "Investigation", stance: "an open, skeptical probe — often doesn't conclude" },
  { name: "Argument", stance: "a closed case" },
  { name: "Pattern", stance: "a recurring structure across instances" },
  { name: "Hypothesis", stance: "a candidate explanation, held provisionally" },
  { name: "Assessment", stance: "a judgment with a stated confidence band" },
  { name: "Critique", stance: "attacks one specific claim" },
  { name: "Explanation", stance: "connects the dots, low advocacy" },
];

export async function renderHowItWorks(env: { DB: D1Database }): Promise<string> {
  const stats = await loadLiveStats(env);

  const statStrip = stats
    ? `<div class="hiw-stats">
  <div class="hiw-stat"><b>${stats.subjects}</b><span>subjects on file</span></div>
  <div class="hiw-stat"><b>${stats.docs}</b><span>source documents</span></div>
  <div class="hiw-stat"><b>${stats.facts}</b><span>documented facts</span></div>
  <div class="hiw-stat"><b>${stats.quotes}</b><span>verbatim quotes</span></div>
  <div class="hiw-stat"><b>${stats.signed}</b><span>signed investigations</span></div>
  <div class="hiw-stat"><b>${stats.themes}</b><span>themes surfaced</span></div>
</div>`
    : "";

  const arrangementRows = ARRANGEMENTS.map(
    (a) => `<tr>
  <td><a href="${a.url.replace(":slug", "")}" class="hiw-arr-link">${a.name}</a><div class="hiw-arr-url">${a.url}</div></td>
  <td>${a.what}</td>
  <td class="hiw-arr-status hiw-arr-status-${a.status}">${STATUS_LABEL[a.status]}</td>
</tr>`,
  ).join("");

  const intentRows = INTENTS.map(
    (i) =>
      `<div class="hiw-intent"><span class="hiw-intent-name">${i.name}</span><span class="hiw-intent-stance">${i.stance}</span></div>`,
  ).join("");

  const body = `
<section class="hiw-masthead">
  <div class="kicker"><span class="live"></span> How this works</div>
  <h1 class="hiw-h1">What Canopticon actually is.</h1>
  <p class="hiw-lede">
    Not a separate doc that goes stale in a repo nobody opens — this page. /method explains
    why a claim here can be trusted. This explains the shape of the whole thing: what content
    types exist and why, what's really built versus still open, and what runs on its own
    between visits.
  </p>
</section>

${statStrip}

<section class="hiw-section">
  <h2 class="hiw-h2">The one-sentence version</h2>
  <p>
    Canopticon reads research documents into a typed graph of facts, grows a citable public
    record from that graph automatically, drafts signed readings on top of it, and the
    operator approves what publishes. <b>The operator approves; the operator never authors.</b>
    Nobody writes a page by hand — pages grow as documents are read, and the same graph fans
    out into every format below without being regenerated from scratch each time.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">The content types</h2>
  <p>
    Everything public is one of five kinds of thing. This is the part that's easiest to lose
    track of session to session — so it's written down here, not just in a design doc.
  </p>

  <div class="hiw-ct">
    <div class="hiw-ct-name">Records</div>
    <p class="hiw-ct-body">One page per person, company, event, or theme — <code>/s/:slug</code>. Two
    modes: <b>neutral</b> (the facts and their receipts, disputed material shown gray) and
    <b>signed</b> (the operator's reading — the same facts, re-sequenced under a thesis, with
    a mandatory box of what complicates it). This is the spine everything else hangs off.</p>
  </div>

  <div class="hiw-ct">
    <div class="hiw-ct-name">Arrangements — twelve ways to view the same facts</div>
    <p class="hiw-ct-body">Every arrangement is <i>both</i> a section embedded inside a Record
    <i>and</i> its own standalone, independently-citable page with its own schema.org markup.
    That's deliberate, for GEO: a fine-grained URL with specific structured data out-cites a
    subject page that merely has the same content as one section among several. They're not
    meant to be found by clicking through site nav — they're meant to be found by search
    engines and AI answer engines, and reached from the Record they belong to.</p>
    <div class="hiw-arr-table-wrap">
      <table class="hiw-arr-table">
        <thead><tr><th>Type</th><th>What it shows</th><th>Status</th></tr></thead>
        <tbody>${arrangementRows}</tbody>
      </table>
    </div>
  </div>

  <div class="hiw-ct">
    <div class="hiw-ct-name">Investigations — the signed layer</div>
    <p class="hiw-ct-body">A signed reading wears one of seven intents as a badge — its
    epistemic stance, not a nav category:</p>
    <div class="hiw-intents">${intentRows}</div>
  </div>

  <div class="hiw-ct">
    <div class="hiw-ct-name">Faces — one reading, many formats</div>
    <p class="hiw-ct-body">Every signed reading renders as tabs: <b>Thread</b> and <b>Card</b>
    are pure template + query — no LLM call, instant, straight from the thesis and the
    highest-ranked stored quotes. <b>Video script</b> and <b>chapter outline</b> need real
    argumentative sequencing, so those get one LLM pass at the moment you sign, persisted
    from then on — every later view is still instant. Nothing here is "generating your script"
    on click; either it's already rendered, or it was rendered once and stored.</p>
  </div>

  <div class="hiw-ct">
    <div class="hiw-ct-name">Studio — the production room</div>
    <p class="hiw-ct-body">Not where you generate content — faces already did that. Studio
    turns a rendered face into a downloadable asset. <b>Shipped:</b> card / thread / carousel
    → PNG, newsletter → email-safe HTML, long-form → Markdown. <b>Not yet:</b> voice recording
    + cloning, video assembly (Flux stills → Wan animation → MiniMax voiceover), a documentary
    stage, a two-voice podcast stage, and a distribution log — all real, all deliberately
    deferred until there's a working voice profile to build them on.</p>
  </div>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">The firewall, briefly</h2>
  <p>
    A fact only exists on this site if it's a word-for-word quote from a document
    actually stored here, checked mechanically. An attributed claim (someone said X)
    is never silently stated as settled fact. This is the one rule everything else is
    built around — see <a href="/method">/method</a> for the full mechanics.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What runs on its own vs. what you drive</h2>
  <p>
    One thing runs unattended, on a schedule. Everything that grows the record —
    researching a subject, drafting a reading, producing a video — starts from you
    clicking something. There used to be more running automatically (a sweep that
    picked a thin subject and researched it every few hours, plus a pass that
    auto-published research briefs from that); both are retired — the sweep decided
    what to work on without you, and the auto-published briefs went live with no one
    reading them first. Growth is a click now, on purpose.
  </p>
  <div class="hiw-list">
    <div class="hiw-item">
      <div class="hiw-item-h">The settle pipeline</div>
      <p>After documents come in, six steps run in the background to turn raw
      extraction into a usable record: entity resolution, event dedup, scoring
      contested evidence, surfacing themes and cross-document patterns, seeding pages,
      and generating comprehensive profiles. One step runs per
      tick — chaining them all at once is exactly what silently broke this for a while;
      splitting it up is what fixed it. Drafting a signed reading isn't one of these
      steps — that's an action you take on a subject's page ("Draft a reading"), not
      something the corpus decides on its own.</p>
    </div>
  </div>
  <p>
    The homepage's <b>"Today"</b> line is the honest status check: how many sources
    got banked and duplicates merged today, so you're never left wondering if the
    settle pipeline is actually running.
  </p>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What you can do</h2>
  <div class="hiw-list">
    <div class="hiw-item">
      <div class="hiw-item-h">Sign a reading</div>
      <p>A drafted reading waits under "Awaiting your signature" until you read it and
      sign or discard it. The system writes; you're the only one who publishes.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Expand a thin file</div>
      <p>On any subject page, "Expand this file" fires a real search → fetch →
      verbatim-extract cycle on that one subject, right now.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Research a question</div>
      <p>On a search that comes up empty, an open thread/finding, or a watched subject,
      "Research this" / "Research now" searches → fetches → banks sources, then drafts a
      brief AND flags what it couldn't cover. If it flagged gaps, a second pass — picked
      up within a couple minutes, not chained into the same request — runs targeted
      follow-up searches and re-writes the brief over the combined sources. Either way
      the draft lands unpublished — readable only from its Library row, via a review
      screen with Publish/Discard. Nothing enters the record or goes public until you
      publish it.</p>
    </div>
    <div class="hiw-item">
      <div class="hiw-item-h">Bulk-expand the thinnest 3</div>
      <p>One button on the homepage's status line, for when you want to nudge several
      thin files at once instead of one at a time.</p>
    </div>
  </div>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What's real vs. still open</h2>
  <p>Said plainly, so it can be checked rather than assumed:</p>
  <div class="hiw-status-grid">
    <div class="hiw-status-col">
      <div class="hiw-status-h hiw-status-h-live">Shipped and live</div>
      <ul>
        <li>All twelve arrangement URLs (one, Comparison, is scaffold-only — see the table above)</li>
        <li>Template+query faces (thread, card, carousel) — instant, no LLM</li>
        <li>LLM-seasoned faces (video script, chapter outline) — one pass on signing, then instant</li>
        <li>Semantic search (<code>/search</code>)</li>
        <li>The citation tracker (<code>/citations</code>, operator-only)</li>
        <li>Record-building on click — search → fetch → extract, one subject at a time</li>
        <li>Studio Stage A — card/thread/carousel → PNG, newsletter, long-form export</li>
      </ul>
    </div>
    <div class="hiw-status-col">
      <div class="hiw-status-h hiw-status-h-open">Deliberately not built yet</div>
      <ul>
        <li>Comparison arrangement's real query logic (renders its honest empty state today)</li>
        <li>Studio Stage B–F — voice recording/cloning, video assembly, documentary, podcast, distribution log</li>
        <li>Concurrent extraction (Cloudflare Queues + Durable Objects) — parked on account setup</li>
        <li>The frontier-model tier — one line in the router, saved for near launch</li>
        <li>"Ask the corpus" as a conversational surface — shape not yet decided</li>
      </ul>
    </div>
  </div>
</section>

<section class="hiw-section">
  <h2 class="hiw-h2">What it costs</h2>
  <p>
    None of this is free: Brave Search calls and Workers AI inference both cost real
    money, metered. Growth is click-triggered now specifically so that spend only
    happens when you ask for it — one candidate per settle step in the background,
    bulk-expand capped at 3 per click, on purpose.
  </p>
</section>
`;

  return renderPage({
    title: "How this works · canopticon",
    description:
      "What Canopticon actually is — the content types, what runs on its own, and what's really shipped versus still open.",
    body: `${body}
<style>
  .hiw-masthead { max-width: 760px; margin: 40px auto 0; padding: 0 24px; }
  .hiw-h1 { font-family: var(--serif); font-size: 34px; margin: 12px 0 14px; color: var(--ink); }
  .hiw-lede { font-family: var(--serif); font-size: 17px; line-height: 1.6; color: var(--ink-2); }
  .hiw-stats {
    max-width: 760px; margin: 24px auto 0; padding: 0 24px;
    display: flex; flex-wrap: wrap; gap: 20px 32px;
  }
  .hiw-stat { display: flex; flex-direction: column; gap: 2px; }
  .hiw-stat b { font-family: var(--serif); font-size: 24px; color: var(--ink); line-height: 1; }
  .hiw-stat span { font-size: 11.5px; letter-spacing: .03em; color: var(--ink-3); }
  .hiw-section { max-width: 760px; margin: 0 auto; padding: 26px 24px; }
  .hiw-h2 { font-family: var(--serif); font-size: 21px; color: var(--ink); margin: 0 0 12px; }
  .hiw-section p { font-family: var(--serif); font-size: 15.5px; line-height: 1.65; color: var(--ink-2); }
  .hiw-section code { font-family: var(--mono); font-size: 13px; background: var(--paper-2, var(--surface)); padding: 1px 5px; border-radius: 3px; }
  .hiw-list { display: flex; flex-direction: column; gap: 18px; margin: 16px 0; }
  .hiw-item { padding: 14px 18px; border: 1px solid var(--rule); background: var(--paper-2, var(--surface)); border-radius: 8px; }
  .hiw-item-h { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .hiw-item p { margin: 0; font-size: 14.5px; }

  .hiw-ct { margin: 0 0 30px; padding-top: 22px; border-top: 1px solid var(--rule); }
  .hiw-ct:first-child { padding-top: 0; border-top: none; }
  .hiw-ct-name { font-family: var(--mono); font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
  .hiw-ct-body { margin: 0 0 14px; }

  .hiw-arr-table-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 8px; }
  .hiw-arr-table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 520px; }
  .hiw-arr-table th {
    text-align: left; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em;
    text-transform: uppercase; color: var(--ink-3); padding: 10px 14px; border-bottom: 1px solid var(--rule);
  }
  .hiw-arr-table td { padding: 11px 14px; border-bottom: 1px solid var(--rule); vertical-align: top; color: var(--ink-2); font-family: var(--serif); }
  .hiw-arr-table tr:last-child td { border-bottom: none; }
  .hiw-arr-link { color: var(--ink); text-decoration: none; font-weight: 600; }
  .hiw-arr-link:hover { color: var(--accent); }
  .hiw-arr-url { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 2px; }
  .hiw-arr-status { font-family: var(--mono); font-size: 11px; white-space: nowrap; }
  .hiw-arr-status-live { color: var(--confirmed, #4d9c6f); }
  .hiw-arr-status-heuristic { color: var(--ink-3); }
  .hiw-arr-status-scaffold { color: var(--correction, #c96a53); }

  .hiw-intents { display: flex; flex-direction: column; margin-top: 10px; }
  .hiw-intent { display: flex; gap: 14px; padding: 8px 0; border-top: 1px solid var(--rule); font-size: 13.5px; }
  .hiw-intent:first-child { border-top: none; }
  .hiw-intent-name { font-family: var(--mono); font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: var(--ink); min-width: 110px; flex-shrink: 0; }
  .hiw-intent-stance { color: var(--ink-3); font-family: var(--serif); }

  .hiw-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
  .hiw-status-h { font-family: var(--mono); font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 10px; }
  .hiw-status-h-live { color: var(--confirmed, #4d9c6f); }
  .hiw-status-h-open { color: var(--ink-3); }
  .hiw-status-grid ul { margin: 0; padding-left: 18px; }
  .hiw-status-grid li { font-family: var(--serif); font-size: 13.5px; line-height: 1.55; color: var(--ink-2); margin-bottom: 8px; }
  @media (max-width: 640px) {
    .hiw-status-grid { grid-template-columns: 1fr; }
  }
</style>`,
  });
}
