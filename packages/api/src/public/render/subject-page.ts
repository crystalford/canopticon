// Unified subject page renderer — the fabric, made visible.
//
// One template, two modes, three subject kinds:
//
//   Subjects: entity | event | theme
//   Modes:    neutral (the Record — facts, receipts, contested as contested)
//             | signed (the operator's reading)
//
// A subject page in NEUTRAL mode is the knowledge graph rendered — facts
// with receipts, contested claims attributed, timeline, connections.
// Nobody writes it; it grows as extraction lands.
//
// A subject page in SIGNED mode is the SAME data with a thesis pulling
// the facts into order. The operator signed off; the prose argues.
//
// Mode switching is one query parameter. Same URL, same fabric, both modes
// link to each other at the top.

import { renderMarkdown } from "../../cms/lib/render-post";
import { all, one, parseJson } from "../../lib/d1";
import { type PublicEnv, resolveOperatorId } from "../data";
import { escapeAttr, escapeHtml, renderPage } from "../layout";
import { renderLiveStatusBanner } from "./status-banner";

interface SubjectRow {
  node_id: string;
  kind: string;
  label: string;
  metadata: string;
}

// Intent labels (spec v2.5 Part 5). The seven epistemic stances a signed
// reading can wear as a badge.
const INTENT_LABELS: Record<string, string> = {
  investigation: "Investigation",
  argument: "Argument",
  pattern: "Pattern",
  hypothesis: "Hypothesis",
  assessment: "Assessment",
  critique: "Critique",
  explanation: "Explanation",
};

interface PageRow {
  id: string;
  slug: string;
  thesis: string | null;
  intent: string | null;
  body_md: string | null;
  body_html: string | null;
  signed_status: string;
  signed_by: string | null;
  signed_at: string | null;
  confidence: string | null;
  claims_verified: number;
  judge_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface FactRow {
  id: string;
  label: string;
  kind: string;
  metadata: string;
  // Quote anchoring (when present)
  quote_id: string | null;
  quote_text: string | null;
  piece_slug: string | null;
  piece_title: string | null;
  edge_degree?: number;
}

interface AssertionRow {
  node_id: string;
  label: string;
  actor: string | null;
  stance: string;
  evidence_balance: number;
  quote_text: string | null;
  piece_slug: string | null;
  piece_title: string | null;
  rank: string;
}

interface EventRow {
  id: string;
  label: string;
  event_date: string | null;
  quote_text: string | null;
  piece_slug: string | null;
}

interface ConnectionRow {
  other_node_id: string;
  other_label: string;
  other_kind: string;
  /** metadata.entity_type on the other node ("person", "organization", …),
   *  null when the other node isn't an entity or has none set. The one
   *  real signal we have for "is this a person" — see digestion-typed.ts
   *  normalizeEntityType. Never fabricated beyond what extraction wrote. */
  other_entity_type: string | null;
  /** The other subject's own file, when it has one — lets People/Appears-in
   *  rows link to a real file instead of a guessed slug. */
  other_page_slug: string | null;
  edge_type: string;
  family: string;
  weight: number;
}

interface ThemeRow {
  received_account: string;
  convergence_count: number;
  /** JSON array of quote ids — the contradicting evidence the theme was
   *  surfaced from. Must be SELECTed or the "what the documents show"
   *  block silently renders empty. */
  evidence_quote_ids: string;
}

export async function renderSubjectPage(
  env: PublicEnv,
  slug: string,
  mode: "neutral" | "signed" = "neutral",
  opts: {
    isOperator?: boolean;
    expanding?: boolean;
    videoMsg?: string | undefined;
    draftMsg?: string | undefined;
  } = {},
): Promise<string | null> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return null;

  // Resolve the page + its subject node.
  const page = await one<
    PageRow & { node_id: string; kind: string; label: string; metadata: string }
  >(
    env.DB,
    `SELECT p.id, p.slug, p.thesis, p.intent, p.body_md, p.body_html, p.signed_status,
            p.signed_by, p.signed_at, p.confidence, p.claims_verified, p.judge_model,
            p.created_at, p.updated_at,
            n.id AS node_id, n.kind, n.label, n.metadata
       FROM pages p
       JOIN nodes n ON n.id = p.subject_node_id
      WHERE p.user_id = ? AND p.slug = ?`,
    [userId, slug],
  );
  if (!page) return null;

  // Mode resolution: if the operator asked for signed but no signed body
  // exists, fall back to neutral (and the band at top still offers nothing).
  //
  // A draft counts too, but ONLY for the operator — this is the entire
  // review step. The old dark console (operator/screens/out-stream.ts,
  // retired by the "one site" refactor) had "Sign & publish / Edit /
  // Preview / Discard" buttons directly on a draft row; the public page
  // that replaced it never got an equivalent, so a drafted reading had a
  // real backend action (POST /op/out/:id/sign, still mounted, still
  // works) with no reachable UI at all — the "Read & sign →" link on the
  // homepage's "awaiting your signature" card led here and showed nothing,
  // because this exact check excluded 'draft'. A draft must never be
  // visible to an anonymous viewer, so the operator gate here is load-
  // bearing, not cosmetic.
  const isDraftPreview = opts.isOperator === true && page.signed_status === "draft";
  const hasSignedReading =
    (page.signed_status === "signed" || page.signed_status === "published" || isDraftPreview) &&
    !!page.body_md;
  const resolvedMode: "neutral" | "signed" =
    mode === "signed" && hasSignedReading ? "signed" : "neutral";

  const subject: SubjectRow = {
    node_id: page.node_id,
    kind: page.kind,
    label: page.label,
    metadata: page.metadata,
  };

  if (resolvedMode === "signed") {
    return renderSigned(env, subject, page, hasSignedReading, !!opts.isOperator, opts.videoMsg);
  }
  return renderNeutral(
    env,
    subject,
    page,
    hasSignedReading,
    !!opts.isOperator,
    !!opts.expanding,
    opts.draftMsg,
  );
}

// ===========================================================================
// NEUTRAL MODE — the wiki view, rendered from the graph
// ===========================================================================
async function renderNeutral(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  hasSignedReading: boolean,
  isOperator: boolean,
  expanding = false,
  draftMsg?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId) return renderPage({ title: subject.label, body: "", description: "" });

  // Theme subjects render differently — they're about a received account,
  // not an entity with attributes. Branch here.
  if (subject.kind === "theme") {
    const theme = await one<ThemeRow>(
      env.DB,
      "SELECT received_account, convergence_count, evidence_quote_ids FROM themes WHERE node_id = ?",
      [subject.node_id],
    );
    return renderThemePageNeutral(env, subject, page, theme, hasSignedReading, isOperator);
  }

  // Pull the four neutral-mode sections in parallel. The timeline section
  // calls the SAME loader + renderer that backs the /t/:slug standalone
  // arrangement (spec v2.6 Part 6 — one renderer, two contexts). The other
  // sections keep their inline subject-page-specific treatments because
  // their visual context differs (contested cards are dramatised here;
  // connections are compact for the sidebar).
  const { loadEvents: loadArrangementEvents, renderTimelineBlock: renderArrangementTimeline } =
    await import("./arrangements/timeline");
  const arrangementSubject = {
    userId,
    nodeId: subject.node_id,
    kind: subject.kind,
    label: subject.label,
    slug: page.slug,
    signed_status: page.signed_status,
    thesis: page.thesis,
    signed_at: page.signed_at,
  };
  const { loadNarrativeProfile } = await import("./arrangements/profile");
  const [
    established,
    contested,
    corroborated,
    arrangementEvents,
    connections,
    sourceCount,
    narrative,
    selfContradictions,
    hasTranslation,
  ] = await Promise.all([
    loadEstablishedFacts(env, userId, subject.node_id),
    loadContestedAssertions(env, userId, subject.node_id),
    loadCorroboratedAssertions(env, userId, subject.node_id),
    loadArrangementEvents(env, arrangementSubject),
    loadConnections(env, userId, subject.node_id),
    loadSourceCount(env, userId, subject.node_id),
    loadNarrativeProfile(env, subject.node_id),
    loadSelfContradictions(env, userId, subject.node_id),
    loadHasTranslation(env, userId, subject.node_id),
  ]);
  // Legacy events shape — kept for buildLede + the empty-section count.
  const events = arrangementEvents.map((e) => ({
    id: e.id,
    label: e.label,
    event_date: e.event_date,
    quote_text: null,
    piece_slug: e.piece_slug,
  }));

  // The one real signal for "is this subject a person" — see
  // digestion-typed.ts normalizeEntityType, written at extraction time.
  const subjectMeta = parseJson<{ entity_type?: string }>(subject.metadata, {});
  const isPerson = subjectMeta.entity_type === "person";

  const lede = buildLede(subject, established);
  // The comprehensive-narrative synthesis (graph/lib/profile-generator.ts)
  // used to lead the page, ahead of the raw Established facts — "the
  // reading, then the receipts." That made neutral mode visually
  // resemble signed mode (both opened with essay-voice prose), which is
  // exactly the "I can't tell what layer I'm looking at" complaint this
  // fabric redesign starts from. Facts now lead; this renders second —
  // still the fastest way to get oriented on a subject, just not ahead
  // of the citable substrate it's a synthesis OF.
  // A neutral-mode "Produce a card" affordance (2026-07-24) — before this,
  // Studio's static formats only existed once a signed reading gave them a
  // thesis to build from; a well-sourced File with no reading yet had no
  // way to become a shareable image at all. Reuses the existing profile
  // synthesis's own judge-verified claims (page_profile_claims) — same
  // trust bar as everything else Studio produces, just no thesis required.
  // Card only (not thread/carousel/newsletter/long-form) — those assume an
  // argued reading's shape, a neutral profile doesn't have one to give them.
  const produceCardLink =
    isOperator && narrative
      ? `<a class="face-produce" href="/studio/${escapeAttr(page.slug)}/card">Produce a card from what's on file →</a>`
      : "";
  const narrativeBlock = narrative
    ? `<section class="subj-narrative">
  <div class="sec-k">Profile <a class="sec-standalone" href="/profile/${escapeAttr(page.slug)}">see standalone →</a></div>
  <div class="subj-narrative-body">${narrative.body_html}</div>
  ${produceCardLink ? `<div class="subj-narrative-produce">${produceCardLink}</div>` : ""}
</section>`
    : "";
  const establishedBlock = renderEstablishedBlock(established);
  const corroboratedBlock = renderCorroboratedBlock(corroborated);
  const contestedBlock = renderContestedBlock(contested, subject.label);
  const selfContradictionsBlock = renderSelfContradictionsBlock(selfContradictions, subject.label);
  // People connected to this file (folded out of Connections below). On a
  // person's own file, the inverse view — "appears in N files" — replaces
  // it; that's the cross-file accumulation that makes a person the story.
  const peopleBlock = isPerson ? "" : renderPeopleBlock(connections);
  const appearsInBlock = isPerson ? renderAppearsInBlock(connections) : "";
  // Timeline uses the arrangement renderer. The standalone /t/:slug link
  // sits beneath the section so readers can deep-link the chronology.
  // Timeline-drop card (2026-07-24) needs 3+ dated events, same bar as
  // studio/routes.ts's own hasNeutralDataFor check for this kind.
  const timelineDropProduceLink =
    isOperator && arrangementEvents.length >= 3
      ? ` <a class="face-produce" href="/studio/${escapeAttr(page.slug)}/timeline-drop">Produce a card →</a>`
      : "";
  const timelineBlock = arrangementEvents.length
    ? `<section id="timeline" data-schema="Event">
  <div class="sec-k">Timeline <a class="sec-standalone" href="/t/${escapeAttr(page.slug)}">see standalone →</a>${timelineDropProduceLink}</div>
  ${renderArrangementTimeline(arrangementEvents)}
</section>`
    : "";
  const connectionsBlock = renderConnectionsBlock(connections);
  // Where the embedded section maps to a standalone arrangement URL, add a
  // small "see standalone" affordance. AI engines + readers both benefit
  // from the deep link to the per-arrangement page with its own JSON-LD.
  const connectionsBlockWithStandalone = connections.length
    ? connectionsBlock.replace(
        `<div class="sec-k">Connections</div>`,
        `<div class="sec-k">Connections <a class="sec-standalone" href="/n/${escapeAttr(page.slug)}">see standalone →</a></div>`,
      )
    : connectionsBlock;
  const translateProduceLink =
    isOperator && hasTranslation
      ? ` <a class="face-produce" href="/studio/${escapeAttr(page.slug)}/translate">Produce a card →</a>`
      : "";
  const establishedBlockWithStandalone = established.length
    ? establishedBlock.replace(
        `<div class="sec-k">On the record</div>`,
        `<div class="sec-k">On the record <a class="sec-standalone" href="/profile/${escapeAttr(page.slug)}">see profile →</a>${translateProduceLink}</div>`,
      )
    : establishedBlock;
  const versusProduceLink =
    isOperator && contested.length
      ? ` <a class="face-produce" href="/studio/${escapeAttr(page.slug)}/versus">Produce a card →</a>`
      : "";
  const contestedBlockWithStandalone = contested.length
    ? contestedBlock.replace(
        `<div class="sec-k">Disputed — who says what, against what</div>`,
        `<div class="sec-k">Disputed — who says what, against what <a class="sec-standalone" href="/ct/${escapeAttr(page.slug)}">see standalone →</a>${versusProduceLink}</div>`,
      )
    : contestedBlock;
  const contradictionProduceLink =
    isOperator && selfContradictions.length
      ? ` <a class="face-produce" href="/studio/${escapeAttr(page.slug)}/contradiction">Produce a card →</a>`
      : "";
  const selfContradictionsBlockWithProduce = contradictionProduceLink
    ? selfContradictionsBlock.replace(
        `<div class="sec-k">On record, both ways</div>`,
        `<div class="sec-k">On record, both ways${contradictionProduceLink}</div>`,
      )
    : selfContradictionsBlock;
  const provenanceBlock = renderProvenance(sourceCount, hasSignedReading, page);
  const modeBand = renderModeBand(page.slug, "neutral", hasSignedReading, page);
  // The remaining arrangement types (spec v2.6 Part 6) don't have a
  // bespoke embedded section on this page the way established/contested/
  // timeline/connections do — but per Part 13 they're still meant to be
  // "reached through the subject page they belong to," not just by search
  // or citation. A compact links row is the honest minimum. Trimmed from
  // seven links to four: Statistics/FAQ/Ledger are regex-heuristic surfaces
  // over facts the extractor never actually tags as statistical/Q-shaped/
  // flow-shaped (each file says so directly), and Comparison has no query
  // behind it at all — it always renders its empty state, for every
  // subject, full stop. Keeping seven links to mostly-permanent emptiness
  // was exactly the "too much on this page" clutter — cut the three that
  // are reliably nothing rather than dress up the row with dead ends.
  // Definition/Who's-who/Bibliography/Mechanism all run real queries
  // against real extraction output; they can still be empty for a given
  // thin subject, but that's the record being thin, not the feature.
  const moreViewsBlock = `<section class="more-views">
  <div class="sec-k">More views of this file</div>
  <div class="mv-links">
    <a href="/d/${escapeAttr(page.slug)}">Definition</a>
    <a href="/w/${escapeAttr(page.slug)}">Who's-who</a>
    <a href="/b/${escapeAttr(page.slug)}">Bibliography</a>
    <a href="/m/${escapeAttr(page.slug)}">Mechanism</a>
  </div>
</section>`;

  // When all four content blocks are empty, the page still says what FILLS
  // each section, so the reader sees the SHAPE of the Record (Established,
  // Contested, Timeline, Connections) rather than landing on a near-blank
  // page. The Feels Like Brief: never look like a shell.
  const isEmpty =
    established.length === 0 &&
    contested.length === 0 &&
    events.length === 0 &&
    connections.length === 0;
  const shapeBlock = isEmpty
    ? `<section class="shape-block" aria-label="What this page will contain">
  <div class="sec-k">What this file will hold</div>
  <ul>
    <li><b>On the record</b> — documented facts about ${escapeHtml(subject.label)}, each backed by a word-for-word quote from a source.</li>
    <li><b>Disputed</b> — claims where the evidence is split or rebutted, shown as disputed, never quietly as fact.</li>
    <li><b>Timeline</b> — dated events involving this subject, in order.</li>
    <li><b>People</b> — the named people connected to it, and their role.</li>
    <li><b>Connections</b> — links to other files (ownership, employment, funding, membership).</li>
  </ul>
  <p>Nothing has been read into this file yet. Source documents are read into the record automatically; this page grows from that.</p>
</section>`
    : "";

  // Operator affordance: a Record is "thin" when there's almost nothing on
  // it. Logged-in operator sees an "Expand this Record" prompt that POSTs
  // to /op/records/:slug/expand — kicks off Brave Search + the same
  // extraction pipeline used on uploads (spec v2.5 Part 23). Without
  // BRAVE_SEARCH_API_KEY set as a Worker secret, the action no-ops and logs
  // an event saying so — the affordance is real even before the key lands.
  const isThin = established.length + events.length + contested.length < 5;
  // Reader-facing, not operator-only: a thin file looks identical to a
  // developed one in every list view unless something says otherwise. This
  // is that something — honest about how little is on file yet, using the
  // redaction-bar motif (the one sanctioned decorative device) to signal
  // "still filling in" rather than "broken" or "empty by mistake."
  // If this subject is on the watchlist, say so honestly with its REAL
  // last-checked time — not a fabricated "checks weekly" cadence. The
  // schema has no per-item schedule (coverage_beats has none); every
  // watched subject shares one sweep slot on a shared cooldown. Say
  // what's true.
  const watchForThin = isThin
    ? await one<{ last_swept_at: string | null }>(
        env.DB,
        "SELECT last_swept_at FROM coverage_beats WHERE user_id = ? AND label = ? LIMIT 1",
        [userId, subject.label],
      ).catch(() => null)
    : null;
  const thinNote = isThin
    ? `<div class="thin-note thin-card">
  <div class="thin-top">
    <span class="thin-badge"><span class="thin-badge-b"></span>DEVELOPING FILE</span>
    ${
      watchForThin
        ? `<span class="thin-cad">ON THE WATCHLIST <span class="sep">·</span> ${watchForThin.last_swept_at ? `LAST CHECKED ${escapeHtml(watchForThin.last_swept_at.slice(0, 10))}` : "NOT CHECKED YET"}</span>`
        : ""
    }
  </div>
  <p class="thin-body">This file has ${sourceCount.count} source${sourceCount.count === 1 ? "" : "s"} on record so far <span class="redact-bar" style="width:60px"></span> more may surface as the record grows.</p>
</div>`
    : "";
  const opAffordance =
    isOperator && isThin
      ? `<form method="POST" action="/op/records/${escapeAttr(page.slug)}/expand" class="op-aff" style="display:flex">
  <span class="op-aff-label">Operator</span>
  <button class="op-aff-btn op-aff-btn-action" type="submit">Expand this file →</button>
  <span class="op-aff-hint">not much on file yet — click to search the web for ${escapeHtml(subject.label)} and read new sources into the record</span>
</form>`
      : "";
  // Operator-directed drafting: pick a subject, optionally give it an
  // angle, get a reading — instead of waiting on the autonomous
  // corpus-settle ranking to decide this subject is worth one. Same
  // grounding + firewall + independent judge as the autonomous path (see
  // draftReadingForSubject in graph/lib/draft-reading.ts); the operator
  // still has to sign it before it's public. The MIN_QUOTES=4 estimate
  // below mirrors the server's own gate — it's a UI-side heads-up, not
  // the authority; the server re-checks for real.
  const READING_MIN_QUOTES_ESTIMATE = 4;
  const readingSignalCount = established.length + contested.length;
  const draftMsgBlock = draftMsg
    ? `<div class="draft-analysis-msg">${escapeHtml(draftMsg)}</div>`
    : "";
  let draftReadingBlock = "";
  if (isOperator && page.signed_status === "none") {
    draftReadingBlock =
      readingSignalCount >= READING_MIN_QUOTES_ESTIMATE
        ? `<div class="draft-analysis op-aff">
  <span class="op-aff-label">Operator</span>
  <form method="POST" action="/op/records/${escapeAttr(page.slug)}/draft-analysis" class="draft-analysis-form">
    <textarea name="angle" rows="2" placeholder="Optional — give it an angle. What should this analysis argue? Leave blank and it'll find its own thesis in the facts."></textarea>
    <button class="op-aff-btn op-aff-btn-action" type="submit">Draft an analysis →</button>
  </form>
  ${draftMsgBlock}
</div>`
        : `<div class="draft-analysis-note">No signed analysis yet — needs at least ${READING_MIN_QUOTES_ESTIMATE} established/disputed facts before one can be drafted (${readingSignalCount} on file so far).</div>`;
  } else if (isOperator && page.signed_status === "draft") {
    draftReadingBlock = `<div class="draft-analysis op-aff">
  <span class="op-aff-label">Operator</span>
  <a class="op-aff-btn op-aff-btn-action" href="/op/out/${escapeAttr(page.id)}/edit">A draft analysis is waiting — review &amp; sign →</a>
  ${draftMsgBlock}
</div>`;
  }
  // GEO/citability: a schema.org JSON-LD graph so AI engines can cite the
  // page and its blocks. The subject's schema type follows its kind.
  const jsonLd = buildSubjectJsonLd(subject, page, established, events);

  // Expanding banner (spec v2.6 Part 26). Renders when ?expanding=1 is on
  // the URL — the operator just clicked "Expand this Record". The banner
  // polls its own live-status endpoint client-side (status-banner.ts) and
  // updates in place — no page-level meta refresh needed or wanted; that
  // used to hard-reload the WHOLE page every 5s on top of the banner's own
  // update, which is exactly the janky double-refresh this replaced.
  const expandBanner = expanding ? renderExpandBanner(subject.label) : "";

  const body = `
<script type="application/ld+json">${jsonLd}</script>
<article class="subject-page">
  ${modeBand}
  ${expandBanner}
  ${opAffordance}
  ${draftReadingBlock}
  <header class="subject-head">
    ${renderFileStamp({
      label: subject.label,
      kindLabel: subjectKindLabel(subject.kind, subjectMeta.entity_type),
      desig: lede,
      factCount: established.length,
      disputedCount: contested.length,
      sourceCount: sourceCount.count,
      openedAt: page.created_at,
      updatedAt: page.updated_at,
      signedHref: hasSignedReading ? `/p/${escapeAttr(page.slug)}?mode=signed` : null,
    })}
    ${thinNote}
  </header>

  <div class="subject-grid">
    <div class="subject-main">
      ${shapeBlock}
      ${establishedBlockWithStandalone}
      ${corroboratedBlock}
      ${narrativeBlock}
      ${contestedBlockWithStandalone}
      ${selfContradictionsBlockWithProduce}
      ${timelineBlock}
      ${peopleBlock}
    </div>
    <aside class="subject-side">
      ${appearsInBlock}
      ${connectionsBlockWithStandalone}
      ${provenanceBlock}
      ${moreViewsBlock}
    </aside>
  </div>
</article>

<style>
  .subject-page { max-width: 920px; margin: 0 auto; padding: 28px 0 80px; }
  .subject-head { margin-bottom:32px; }
  .subject-grid { display:grid; grid-template-columns: 1fr 260px; gap:42px; }
  @media (max-width: 760px) { .subject-grid { grid-template-columns: 1fr; } }
  .sec-k { font-size:11px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin:30px 0 12px; display:flex; gap:14px; align-items:baseline; }
  .sec-k:first-child { margin-top:0; }
  .sec-standalone {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: .03em;
    text-transform: uppercase;
  }
  .sec-standalone:hover { text-decoration: underline; }
  .more-views { margin-top: 30px; }
  .mv-links { display: flex; flex-direction: column; gap: 2px; }
  .mv-links a {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: .02em;
    color: var(--ink-3);
    text-decoration: none;
    padding: 5px 0;
    border-top: 1px solid var(--rule);
  }
  .mv-links a:first-child { border-top: none; }
  .mv-links a:hover { color: var(--accent); }
  .qref { text-decoration: none; }
  .qref sup { color: var(--accent); font-size: 11px; font-weight: 600; padding: 0 2px; }
  .qref:hover sup { text-decoration: underline; }
  .subj-narrative-body {
    font-family: var(--serif);
    font-size: 16.5px; line-height: 1.65;
    color: var(--ink);
    max-width: 720px;
  }
  .subj-narrative-produce { margin-top: 16px; }
  .subj-narrative-body h2 {
    font-family: var(--serif);
    font-size: 15px; font-weight: 600;
    letter-spacing: .02em;
    color: var(--ink);
    margin: 26px 0 10px;
  }
  .subj-narrative-body h2:first-child { margin-top: 0; }
  .subj-narrative-body p { margin: 0 0 14px; }
  .subj-narrative-body .cite-n { color: var(--accent); text-decoration: none; font-size: 11px; }
  .subj-narrative-body .cite-n:hover { text-decoration: underline; }
  .disputed-explainer {
    font-family: var(--serif);
    font-size: 14.5px; line-height: 1.55;
    color: var(--ink-3);
    max-width: 640px;
    margin: -4px 0 18px;
  }
  /* Receipts, not a verdict — 2026-07-24. Neutral-gray card (var(--cont-bg)/
     --cont-bd are gray, not maroon; --contested is gray, not rose): a
     quote, who said it, and how well-supported it is on file. The card
     should read as "here's the evidence" — never as an accusation. */
  .contested-card {
    background: var(--cont-bg);
    border: 1px solid var(--cont-bd);
    border-radius: 9px;
    padding: 22px 24px;
    margin-bottom: 14px;
    position: relative;
  }
  .contested-stamp {
    font-family: var(--serif);
    font-size: 11px; letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--contested);
    font-weight: 700;
    margin-bottom: 12px;
  }
  .contested-quote {
    font-family: var(--serif);
    font-size: 18px; line-height: 1.45;
    color: var(--ink);
    font-style: italic;
    margin: 0 0 12px;
    padding: 0;
  }
  .contested-attribution {
    font-size: 13px; line-height: 1.55;
    color: var(--ink-2);
    margin-bottom: 6px;
    letter-spacing: .02em;
  }
  .contested-attribution b { color: var(--ink); font-weight: 600; }
  .contested-balance {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
    margin-bottom: 8px;
  }
  .contested-src {
    font-size: 12.5px;
    color: var(--accent);
    text-decoration: none;
  }
  .contested-src:hover { text-decoration: underline; }

  /* Fabric redesign Phase 4/6 — Corroborated reuses the .contested-card
     typography (quote/attribution/balance/src share the same shape) but
     with the --confirmed token instead of the deliberately neutral
     --contested gray: this tier earned a real signal, it isn't "evidence,
     no verdict" like the rest of Disputed. */
  .corroborated-card {
    background: var(--conf-bg);
    border: 1px solid var(--conf-bd);
    border-radius: 9px;
    padding: 22px 24px;
    margin-bottom: 14px;
    position: relative;
  }
  .corroborated-stamp {
    font-family: var(--serif);
    font-size: 11px; letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--confirmed);
    font-weight: 700;
    margin-bottom: 12px;
  }

  /* Timeline as a vertical rail with dots — court-record shape from the
     prototype. Each event row has a circle on the rail, mono date at
     the left, serif label at the right. */
  .tl-rail {
    position: relative;
    padding-left: 14px;
    margin-top: 4px;
  }
  .tl-rail::before {
    content: '';
    position: absolute;
    left: 6px; top: 8px; bottom: 8px;
    width: 2px;
    background: var(--rule);
  }
  .tl-item {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 18px;
    padding: 14px 0;
    border-top: 1px solid transparent;
    position: relative;
  }
  .tl-item::before {
    content: '';
    position: absolute;
    left: -14px; top: 22px;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--paper, #fff);
    border: 2px solid var(--contested);
  }
  .tl-item:first-child::before { background: var(--accent); border-color: var(--accent); }
  .tl-when {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink-3);
    letter-spacing: .03em;
    padding-top: 2px;
  }
  .tl-body {}
  .tl-label {
    font-family: var(--serif);
    font-size: 15.5px;
    line-height: 1.45;
    color: var(--ink);
  }
  .tl-src {
    display: inline-block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: .03em;
  }
  .tl-src:hover { text-decoration: underline; }
  @media (max-width: 560px) {
    .tl-item { grid-template-columns: 1fr; gap: 4px; }
    .tl-when { padding-top: 0; }
  }
  .conn-row { padding:11px 0; border-top:1px solid var(--rule); font-size:13.5px; color:var(--ink-2); }
  .conn-row a { color:var(--accent); text-decoration:none; }
  .conn-row .why { display:block; color:var(--ink-3); font-size:12.5px; margin-top:2px; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15));
    border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); margin-top:18px; }
  .op-aff { display:flex; align-items:center; gap:12px; margin-bottom:18px; padding:9px 14px;
    border:1px dashed var(--rule); border-radius:8px; background:rgba(0,0,0,.02); flex-wrap:wrap; }
  .op-aff-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-aff-btn { font-size:12.5px; padding:5px 12px; border-radius:6px; border:1px solid var(--rule);
    background:var(--surface); color:var(--ink); cursor:not-allowed; opacity:.6; }
  .op-aff-hint { font-size:12px; color:var(--ink-3); }
  .draft-analysis-form { display:flex; gap:10px; align-items:flex-start; flex:1 1 auto; min-width:220px; }
  .draft-analysis-form textarea { flex:1 1 auto; min-width:200px; font-family:inherit; font-size:12.5px;
    padding:6px 10px; border:1px solid var(--rule); border-radius:6px; background:var(--surface);
    color:var(--ink); resize:vertical; }
  .draft-analysis-note { font-size:12.5px; color:var(--ink-3); margin-bottom:18px; padding:9px 14px;
    border:1px dashed var(--rule); border-radius:8px; }
  .draft-analysis-msg { font-family:var(--mono); font-size:11.5px; color:var(--ink-3); width:100%; }
  .shape-block { padding:20px 22px; border:1px solid var(--rule); border-radius:9px;
    background:var(--panel-soft, rgba(0,0,0,.02)); margin-bottom:24px; }
  .shape-block .sec-k { margin-top:0; }
  .shape-block ul { list-style:none; padding:0; margin:10px 0 14px; }
  .shape-block li { font-size:14.5px; line-height:1.6; color:var(--ink-2); padding:7px 0;
    border-top:1px solid var(--rule); }
  .shape-block li:first-child { border-top:none; }
  .shape-block li b { color:var(--ink); font-weight:600; }
  .shape-block p { font-size:13.5px; color:var(--ink-3); font-style:italic; margin:0; }
</style>
`;

  return renderPage({
    title: subject.label,
    description:
      stripHtml(lede).slice(0, 200) ||
      `Reference page on ${subject.label} — sourced facts, contested claims, timeline.`,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// SIGNED MODE — the operator's reading, prose with anchored facts
// ===========================================================================
async function renderSigned(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  hasSignedReading: boolean,
  isOperator: boolean,
  videoMsg?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const bodyHtml = page.body_html || (page.body_md ? renderMarkdown(page.body_md) : "");
  const modeBand = renderModeBand(page.slug, "signed", hasSignedReading, page);
  const [pageClaims, signedConnections, hasHook] = userId
    ? await Promise.all([
        loadPageClaims(env, userId, page.id),
        loadConnections(env, userId, subject.node_id),
        loadHasHook(env, userId, page.id),
      ])
    : [[], [], false];
  const claimsBlock = renderClaimsBlock(pageClaims);
  const foundationBlock = renderFoundationBlock(pageClaims, signedConnections, page.slug);
  // Faces (spec v2.6 Part 8) — formats of this reading rendered as tabs.
  // Thread + card are TEMPLATE + QUERY, rendered live at view time from
  // the page's thesis + page_claims (no LLM, <100ms). Script + chapter
  // are LLM-seasoned and pre-rendered on signing into page_faces.
  // The signed page renderer pulls both: persisted faces from page_faces +
  // live faces from the faces/ renderers.
  const [persistedFaces, liveThread, liveCard, liveCarousel] = await Promise.all([
    loadFaces(env, page.id),
    (async () => {
      const { renderThreadFace } = await import("./faces/thread");
      return renderThreadFace(env.DB, page);
    })(),
    (async () => {
      const { renderCardFace } = await import("./faces/card");
      return renderCardFace(env.DB, { ...page, subject_node_id: subject.node_id });
    })(),
    (async () => {
      const { renderCarouselFace } = await import("./faces/carousel");
      return renderCarouselFace(env.DB, page);
    })(),
  ]);
  const facesBlock = renderFacesBlock(
    persistedFaces,
    page.id,
    isOperator,
    { thread: liveThread, card: liveCard, carousel: liveCarousel },
    page.slug,
  );

  // A real signature, not a chip strip. The "— signed by" line in serif
  // italic; the date in mono on a second line; the confidence + verified-
  // claims count as a small muted footer line. Reads like signing a
  // document, not labelling metadata.
  const signatureLine = page.signed_by
    ? `<div class="signature">— ${escapeHtml(page.signed_by)}</div>`
    : `<div class="signature">— signed</div>`;
  const signatureMeta: string[] = [];
  if (page.signed_at) signatureMeta.push(escapeHtml(formatLongDate(page.signed_at)));
  if (page.confidence) signatureMeta.push(`${escapeHtml(page.confidence)} confidence`);
  if (page.claims_verified)
    signatureMeta.push(
      `${page.claims_verified} claim${page.claims_verified === 1 ? "" : "s"} verified`,
    );

  // Operator affordance: turn this signed reading into a video essay via
  // the video Worker (packages/video/src/routes/from-reading.ts). Two
  // buttons, not a picker — short (45-75s vertical) and long (5-15min
  // landscape) are different enough in shape and cost that "produce one
  // and see" is the wrong default; the operator picks up front. Result
  // isn't published here — it lands in the video Worker's own review
  // queue for approval + render, same as the GDELT pipeline's segments.
  const videoMsgBlock = videoMsg ? `<div class="video-msg">${escapeHtml(videoMsg)}</div>` : "";
  const produceVideoBlock = isOperator
    ? `<div class="produce-video">
  <form method="POST" action="/op/records/${escapeAttr(page.slug)}/produce-video?format=short" style="display:inline">
    <button class="op-aff-btn" type="submit">Produce video essay (short) →</button>
  </form>
  <form method="POST" action="/op/records/${escapeAttr(page.slug)}/produce-video?format=long" style="display:inline">
    <button class="op-aff-btn" type="submit">Produce video essay (long) →</button>
  </form>
  ${videoMsgBlock}
</div>`
    : "";

  // The firewall, made visible IN the reading: any contested assertion this
  // subject carries MUST be shown, by rule, not by the writer's choice. This
  // is what makes a signed reading trustworthy — it cannot hide the facts
  // that complicate it.
  const contested = userId
    ? (await loadContestedAssertions(env, userId, subject.node_id)).filter(
        (a) => a.rank === "contested" || (a.evidence_balance ?? 0) < 1,
      )
    : [];
  // The complicating-facts box — the proudest box on the signed page.
  // This is the FIREWALL made visible in the reading itself: the system
  // forces the reader's eye onto the facts that complicate the thesis.
  // Heavier border, bigger header, block-quote treatment for each
  // complication. The reading cannot bury what doesn't fit.
  const complicateBox = contested.length
    ? `<aside class="complicate">
  <div class="complicate-stamp">What complicates this analysis</div>
  <div class="complicate-sub">Shown by rule, not by choice. The analysis must engage these facts; it cannot leave them out.</div>
  ${contested
    .slice(0, 4)
    .map(
      (a) => `<div class="complicate-item">
  <blockquote class="complicate-quote">"${escapeHtml(a.label)}"</blockquote>
  <div class="complicate-attribution">
    ${a.actor ? `Asserted by <b>${escapeHtml(a.actor)}</b>` : "Unattributed assertion"} · ${a.rank === "contested" ? "contested in the record" : "weakly supported"}${a.piece_slug ? ` · <a href="/library/${escapeAttr(a.piece_slug)}">source ↗</a>` : ""}
  </div>
</div>`,
    )
    .join("")}
</aside>`
    : "";

  // Operator affordances on a signed reading: Edit (open the existing
  // /op/out/:id/edit screen), Re-sign placeholder, Discard. The handler
  // routes are already mounted under /op/out — PR 1 surfaces them inline
  // on the public URL the operator landed on, instead of bouncing them
  // through a separate console.
  const isDraft = page.signed_status === "draft";
  const opSignedAff = isOperator
    ? `<div class="op-aff">
  <span class="op-aff-label">Operator</span>
  ${
    isDraft
      ? `<form method="POST" action="/op/out/${escapeAttr(page.id)}/sign" style="display:inline">
    <button class="op-aff-btn op-aff-btn-primary" type="submit">Sign &amp; publish</button>
  </form>`
      : ""
  }
  <a class="op-aff-btn op-aff-btn-action" href="/op/out/${escapeAttr(page.id)}/edit">Edit analysis</a>
  <form method="POST" action="/op/out/${escapeAttr(page.id)}/discard" style="display:inline" onsubmit="return confirm('Discard this analysis?');">
    <button class="op-aff-btn op-aff-btn-action" type="submit">Discard</button>
  </form>
</div>`
    : "";
  // The draft banner is the whole point: it's the only thing that tells the
  // operator "this isn't live yet, you're the only one who can see it, and
  // signing is the act that publishes it." Without it the page reads
  // identically to an already-published reading.
  const draftBanner = isDraft
    ? `<div class="draft-banner">
  <b>Draft — not published.</b> The system wrote this from your documents; nobody else can see it. Signing publishes it under your name exactly as it reads below. Editing lets you change the wording first. Discarding deletes it.
</div>`
    : "";

  const intentLabel = page.intent ? (INTENT_LABELS[page.intent] ?? page.intent) : "";
  const intentBadge = page.intent
    ? `<span class="intent-badge intent-${escapeAttr(page.intent)}">${escapeHtml(intentLabel)}</span>`
    : "";
  const hookProduceLink =
    isOperator && hasHook
      ? `<a class="face-produce" href="/studio/${escapeAttr(page.slug)}/hook">Produce a one-line hook →</a>`
      : "";

  const body = `
<article class="subject-page subject-page-signed">
  ${modeBand}
  ${draftBanner}
  ${opSignedAff}
  <header class="signed-head">
    <div class="kicker">${intentBadge} <span class="kicker-meta">Analysis · Signed</span></div>
    <h1>${escapeHtml(subject.label)}</h1>
    ${page.thesis ? `<blockquote class="thesis-block">"${escapeHtml(page.thesis)}"</blockquote>` : ""}
    <div class="signature-block">
      ${signatureLine}
      ${signatureMeta.length ? `<div class="signature-meta">${signatureMeta.join(" · ")}</div>` : ""}
    </div>
    ${hookProduceLink}
    ${produceVideoBlock}
  </header>
  <div class="prose signed-body">${bodyHtml}</div>
  ${complicateBox}
  ${claimsBlock}
  ${facesBlock}
  <div class="prov" style="margin-top:32px">
    This analysis was drafted and signed by hand. Every load-bearing fact links down to a word-for-word quote
    in a stored source document. Disputed material is shown as disputed; any claim without a named source is
    removed before publishing.
  </div>
  ${foundationBlock}
</article>

<style>
  .subject-page { max-width: 760px; margin: 0 auto; padding: 28px 0 80px; }
  .signed-head { margin-bottom: 40px; }
  .signed-head .kicker {
    font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 14px;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    font-weight: 600;
  }
  .kicker-meta { color: var(--ink-3); font-weight: 400; }
  .intent-badge {
    font-size: 11px; padding: 3px 11px; border-radius: 4px;
    font-weight: 600; letter-spacing: .04em;
  }
  .intent-investigation { background: rgba(77,156,111,.16); color: #4d9c6f; }
  .intent-argument { background: rgba(201,106,83,.16); color: #c96a53; }
  .intent-pattern { background: rgba(126,166,216,.16); color: #7ea6d8; }
  .intent-hypothesis { background: rgba(183,158,224,.16); color: #b79ee0; }
  .intent-assessment { background: rgba(209,171,92,.16); color: #d1ab5c; }
  .intent-critique { background: rgba(196,123,152,.16); color: #c47b98; }
  .intent-explanation { background: rgba(126,200,227,.16); color: #7ec8e3; }
  .signed-head h1 {
    font-family: var(--serif);
    font-size: 46px; line-height: 1.06; letter-spacing: -.022em;
    font-weight: 600; margin-bottom: 28px;
    color: var(--ink);
  }
  /* Thesis as a court ruling: serif italic, big, with a left rule. */
  .thesis-block {
    font-family: var(--serif);
    font-size: 26px; line-height: 1.4;
    color: var(--ink);
    font-style: italic;
    margin: 0 0 24px;
    padding: 4px 0 4px 22px;
    border-left: 3px solid var(--accent);
    max-width: 720px;
  }
  /* Signature as a signature — not a metadata strip. */
  .signature-block { margin-top: 18px; }
  .signature {
    font-family: var(--serif);
    font-size: 18px;
    color: var(--ink);
    font-style: italic;
    margin-bottom: 6px;
  }
  .signature-meta {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink-3);
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .signed-body { font-family: var(--serif); font-size: 18px; line-height: 1.65; color: var(--ink-2); }
  .signed-body p { margin-bottom: 20px; }
  .signed-body sup { color: var(--accent); font-size: 11px; }
  .signed-body .factref { background: var(--panel-2, rgba(0,0,0,.18)); border-bottom: 1px solid var(--accent); padding: 0 2px; cursor: pointer; }

  /* Complicating-facts box — the proudest box on the signed page.
     This is the firewall, made visible inside the reading itself. */
  .complicate {
    margin: 36px 0;
    padding: 26px 28px;
    border: 1px solid var(--cont-bd);
    border-radius: 11px;
    background: var(--cont-bg);
  }
  .complicate-stamp {
    font-family: var(--serif);
    font-size: 12.5px; letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--contested);
    font-weight: 700;
    margin-bottom: 8px;
  }
  .complicate-sub {
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--ink-3);
    margin-bottom: 18px;
    line-height: 1.5;
  }
  .complicate-item {
    padding: 14px 0;
    border-top: 1px solid var(--cont-bd);
  }
  .complicate-item:first-of-type { padding-top: 0; border-top: none; }
  .complicate-quote {
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.5;
    color: var(--ink);
    font-style: italic;
    margin: 0 0 8px;
    padding-left: 14px;
    border-left: 2px solid var(--contested);
  }
  .complicate-attribution {
    font-size: 13.5px;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .complicate-attribution b { color: var(--ink); }
  .complicate-attribution a { color: var(--accent); text-decoration: none; }
  @media (max-width: 720px) {
    .signed-head h1 { font-size: 34px; }
    .thesis-block { font-size: 21px; }
  }
  .complicate a { color:var(--accent); text-decoration:none; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); }
  .op-aff { display:flex; align-items:center; gap:12px; margin-bottom:18px; padding:9px 14px;
    border:1px dashed var(--rule); border-radius:8px; background:rgba(0,0,0,.02); flex-wrap:wrap; }
  .op-aff-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; }
  .op-aff-btn { font-size:12.5px; padding:5px 12px; border-radius:6px; border:1px solid var(--rule);
    background:var(--surface); color:var(--ink); text-decoration:none; cursor:pointer; }
  .op-aff-btn-action { cursor:pointer; opacity:1; }
  .op-aff-btn-primary { background:var(--ink); color:var(--paper); border-color:var(--ink); font-weight:600; }
  .produce-video { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .video-msg { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); width: 100%; }
  .draft-banner {
    margin-bottom: 18px; padding: 14px 16px;
    border: 1px solid var(--accent-bd);
    border-radius: 8px; background: var(--accent-bg, rgba(58,99,160,.08));
    font-size: 13.5px; line-height: 1.55; color: var(--ink-2);
  }
  .draft-banner b { color: var(--ink); }
</style>
`;

  return renderPage({
    title: `${subject.label} — signed analysis`,
    description: page.thesis?.slice(0, 200) ?? `Signed analysis on ${subject.label}.`,
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// THEME NEUTRAL MODE — the received-account view
// ===========================================================================
async function renderThemePageNeutral(
  env: PublicEnv,
  subject: SubjectRow,
  page: PageRow,
  theme: ThemeRow | null,
  hasSignedReading: boolean,
  _isOperator: boolean,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  if (!userId || !theme) {
    return renderPage({ title: subject.label, body: "", description: "" });
  }

  // The complicating evidence is the contradicting assertions the theme was
  // surfaced from. Read the evidence_quote_ids list and resolve each.
  const evidenceQuoteIds: string[] = parseJson(theme.evidence_quote_ids ?? "[]", []);
  let evidence: Array<{
    verbatim_text: string;
    piece_slug: string | null;
    piece_title: string | null;
    actor: string | null;
  }> = [];
  if (evidenceQuoteIds.length > 0) {
    const placeholders = evidenceQuoteIds.map(() => "?").join(",");
    evidence = await all<{
      verbatim_text: string;
      piece_slug: string | null;
      piece_title: string | null;
      actor: string | null;
    }>(
      env.DB,
      `SELECT q.verbatim_text,
              p.slug AS piece_slug, p.title AS piece_title,
              (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor
         FROM quotes q
         JOIN nodes n ON n.id = q.node_id
         LEFT JOIN assertions a ON a.node_id = n.id
         LEFT JOIN pieces p ON p.id = n.piece_id
        WHERE q.id IN (${placeholders}) AND q.user_id = ?
        LIMIT 12`,
      [...evidenceQuoteIds, userId],
    );
  }

  const modeBand = renderModeBand(page.slug, "neutral", hasSignedReading, page);
  const evidenceBlock = evidence.length
    ? `<div class="sec-k">What the documents show</div>
${evidence
  .map(
    (e) => `<div class="evidence-card">
  <blockquote>“${escapeHtml(e.verbatim_text.slice(0, 320))}${e.verbatim_text.length > 320 ? "…" : ""}”</blockquote>
  <div class="evidence-src">${e.actor ? `${escapeHtml(e.actor)} · ` : ""}${e.piece_title ? `<a href="/library/${escapeAttr(e.piece_slug ?? "")}">${escapeHtml(e.piece_title)}</a>` : "source unknown"}</div>
</div>`,
  )
  .join("")}`
    : "";

  const body = `
<article class="subject-page">
  ${modeBand}
  <header class="subject-head">
    <div class="kicker">The official story</div>
    <h1>${escapeHtml(subject.label)}</h1>
    <div class="received">
      <div class="received-k">What is commonly said</div>
      <p>${escapeHtml(theme.received_account)}</p>
    </div>
    <p class="convergence">Flagged because ${theme.convergence_count} separate source documents push back on this account.</p>
  </header>

  ${evidenceBlock}

  <div class="prov" style="margin-top:32px">
    This page is flagged automatically: when several separate documents contradict the same widely-held
    account, it is surfaced here with the contradicting evidence attached. ${hasSignedReading ? "" : "No signed analysis of this yet."}
  </div>
</article>

<style>
  .subject-page { max-width: 760px; margin: 0 auto; padding: 28px 0 80px; }
  .subject-head .kicker { font-size:11px; letter-spacing:.14em; color:var(--accent); text-transform:uppercase; margin-bottom:10px; }
  .subject-head h1 { font-family:var(--serif); font-size:36px; line-height:1.15; letter-spacing:-.02em; font-weight:600; margin-bottom:24px; }
  .received { background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule);
    padding:16px 20px; margin-bottom:18px; border-radius:9px; }
  .received-k { font-size:10.5px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin-bottom:6px; }
  .received p { font-family:var(--serif); font-size:20px; line-height:1.45; color:var(--ink); font-style:italic; }
  .convergence { font-size:13.5px; color:var(--ink-3); }
  .sec-k { font-size:11px; letter-spacing:.14em; color:var(--faint); text-transform:uppercase; margin:30px 0 14px; }
  .evidence-card { padding:14px 16px; border:1px solid var(--rule); border-radius:9px; margin-bottom:10px; }
  .evidence-card blockquote { font-family:var(--serif); font-size:16px; line-height:1.5; color:var(--ink-2); font-style:italic;
    border-left:2px solid var(--accent); padding-left:14px; margin-bottom:8px; }
  .evidence-src { font-size:12.5px; color:var(--faint); }
  .evidence-src a { color:var(--accent); text-decoration:none; }
  .prov { padding:14px 16px; background:var(--panel-2, rgba(0,0,0,.15)); border:1px solid var(--rule); border-radius:9px; font-size:12.5px; color:var(--ink-3); }
</style>
`;

  return renderPage({
    title: subject.label,
    description: theme.received_account.slice(0, 200),
    body,
    activeNav: "/topics",
    zone: "topics",
  });
}

// ===========================================================================
// Section loaders — small SQL functions, kept narrow
// ===========================================================================

// Established facts: neutral_fact nodes connected to this subject, with their
// supporting quote. The 'aboutness' edge family is the canonical "fact about X"
// link; we also accept neutral_facts directly attached to the subject's piece.
//
// Ranked by edge_degree (how many edges touch this fact node at all — the
// same cheap "how much does the corpus care about this" proxy autonomous-
// expand.ts uses for sweep priority), created_at as tiebreak. Was plain
// created_at DESC — whichever fact got extracted most recently, no
// relevance signal at all, so a trivia fact read five minutes ago could
// outrank one five documents corroborate. A subject with hundreds of
// documents behind it needs a real ranking here, not insertion order.
export async function loadEstablishedFacts(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<FactRow[]> {
  return all<FactRow>(
    env.DB,
    `SELECT n.id, n.label, n.kind, n.metadata,
            q.id AS quote_id, q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title,
            (SELECT COUNT(*) FROM edges e3 WHERE e3.src_node_id = n.id OR e3.dst_node_id = n.id)
              AS edge_degree
       FROM nodes n
       LEFT JOIN edges e ON (e.dst_node_id = ? AND e.src_node_id = n.id AND e.family = 'aboutness')
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ?
        AND n.kind = 'neutral_fact'
        AND (e.id IS NOT NULL OR EXISTS (
              SELECT 1 FROM edges e2 WHERE e2.src_node_id = ? AND e2.dst_node_id = n.id
            )
            OR n.label LIKE ?
            OR (SELECT label FROM nodes WHERE id = ?) LIKE '%' || substr(n.label, 1, 30) || '%')
      GROUP BY n.id
      ORDER BY edge_degree DESC, n.created_at DESC
      LIMIT 12`,
    [subjectId, userId, subjectId, `%${subjectId.slice(0, 8)}%`, subjectId],
  ).catch(async () => {
    // Fallback: grab the most recent neutral facts touching the subject's piece.
    return all<FactRow>(
      env.DB,
      `SELECT n.id, n.label, n.kind, n.metadata,
              q.id AS quote_id, q.verbatim_text AS quote_text,
              p.slug AS piece_slug, p.title AS piece_title
         FROM nodes n
         LEFT JOIN quotes q ON q.node_id = n.id
         LEFT JOIN pieces p ON p.id = n.piece_id
        WHERE n.user_id = ? AND n.kind = 'neutral_fact'
        ORDER BY n.created_at DESC LIMIT 8`,
      [userId],
    ).catch(() => []);
  });
}

async function loadContestedAssertions(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<AssertionRow[]> {
  return all<AssertionRow>(
    env.DB,
    `SELECT n.id AS node_id, n.label,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.stance, a.evidence_balance, a.rank,
            q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ? AND n.kind = 'assertion' AND a.rank != 'preferred'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      GROUP BY n.id
      ORDER BY (a.rank = 'contested') DESC, a.updated_at DESC
      LIMIT 8`,
    [userId, subjectId, subjectId],
  ).catch(() => []);
}

// Fabric redesign Phase 4 — assertions that graduated to rank='preferred'
// (surfacing.ts's runSurfacingL1: zero contradicting verified evidential
// edges AND independently corroborated by >=2 distinct source pieces).
// Rendered in its own section between Established and Disputed so a
// well-corroborated, uncontested claim stops living under a "Disputed"
// heading just because someone, somewhere, asserted it rather than the
// corpus stating it directly.
async function loadCorroboratedAssertions(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<AssertionRow[]> {
  return all<AssertionRow>(
    env.DB,
    `SELECT n.id AS node_id, n.label,
            (SELECT label FROM nodes WHERE id = a.asserted_by_node_id) AS actor,
            a.stance, a.evidence_balance, a.rank,
            q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title
       FROM nodes n
       JOIN assertions a ON a.node_id = n.id
       LEFT JOIN quotes q ON q.node_id = n.id
       LEFT JOIN pieces p ON p.id = n.piece_id
      WHERE n.user_id = ? AND n.kind = 'assertion' AND a.rank = 'preferred'
        AND (EXISTS (SELECT 1 FROM edges e WHERE e.src_node_id = n.id AND e.dst_node_id = ?)
             OR EXISTS (SELECT 1 FROM edges e WHERE e.dst_node_id = n.id AND e.src_node_id = ?))
      GROUP BY n.id
      ORDER BY a.evidence_balance DESC, a.updated_at DESC
      LIMIT 8`,
    [userId, subjectId, subjectId],
  ).catch(() => []);
}

interface SelfContradictionRow {
  id: string;
  tension_summary: string;
  quote_a_text: string;
  quote_a_id: string | null;
  piece_a_title: string | null;
  quote_b_text: string;
  quote_b_id: string | null;
  piece_b_title: string | null;
}

// Memetic content #3 (2026-07-24, graph/lib/self-contradictions.ts) —
// judge-verified pairs of this SUBJECT'S OWN assertions that genuinely
// conflict. Different from Contested (disputed by someone else): this is
// contradicted by their own record. Only judge_pass=1 rows are ever
// queried here — rejected candidates stay in the table (so the cron
// doesn't re-evaluate them) but never reach a public page.
async function loadSelfContradictions(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<SelfContradictionRow[]> {
  const { all } = await import("../../lib/d1");
  return all<SelfContradictionRow>(
    env.DB,
    `SELECT id, tension_summary, quote_a_text, quote_a_id, piece_a_title,
            quote_b_text, quote_b_id, piece_b_title
       FROM self_contradictions
      WHERE user_id = ? AND person_node_id = ? AND judge_pass = 1
      ORDER BY created_at DESC
      LIMIT 6`,
    [userId, subjectId],
  ).catch(() => []);
}

// Memetic content #5 (2026-07-25, graph/lib/register-shift.ts) — whether
// a judge-verified plain-language translation exists for any of this
// subject's own assertion quotes. A bare existence check (not the row
// itself) since the Studio produce flow re-queries and renders it fresh.
async function loadHasTranslation(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<boolean> {
  const { one } = await import("../../lib/d1");
  const row = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM register_shifts WHERE user_id = ? AND subject_node_id = ? AND source_kind = 'assertion' AND judge_pass = 1 LIMIT 1",
    [userId, subjectId],
  ).catch(() => null);
  return !!row;
}

// Memetic content #6 (2026-07-25) — whether this signed reading's thesis
// has a judge-verified one-line hook compression on file yet.
async function loadHasHook(env: PublicEnv, userId: string, pageId: string): Promise<boolean> {
  const { one } = await import("../../lib/d1");
  const row = await one<{ id: string }>(
    env.DB,
    "SELECT id FROM register_shifts WHERE user_id = ? AND source_node_id = ? AND source_kind = 'thesis' AND judge_pass = 1 LIMIT 1",
    [userId, pageId],
  ).catch(() => null);
  return !!row;
}

// loadTimelineEvents removed — the timeline section now calls the
// arrangement renderer's loadEvents directly (spec v2.6 Part 6).

// Both the People block and Connections block (and, on a person's own
// file, "Appears in N files") read from this one query — the typed edges
// touching the subject, joined out to the other node's kind, entity_type
// (the person/organization signal), and its own page slug if it has one.
async function loadConnections(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<ConnectionRow[]> {
  return all<ConnectionRow>(
    env.DB,
    `SELECT
       CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END AS other_node_id,
       (SELECT label FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_label,
       (SELECT kind FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_kind,
       (SELECT json_extract(metadata, '$.entity_type') FROM nodes WHERE id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END) AS other_entity_type,
       (SELECT slug FROM pages WHERE subject_node_id =
         CASE WHEN e.src_node_id = ? THEN e.dst_node_id ELSE e.src_node_id END LIMIT 1) AS other_page_slug,
       e.edge_type, e.family, e.weight
     FROM edges e
     WHERE e.user_id = ?
       AND (e.src_node_id = ? OR e.dst_node_id = ?)
       AND e.family IN ('relationship', 'aboutness')
     GROUP BY other_node_id
     ORDER BY e.weight DESC
     LIMIT 16`,
    [subjectId, subjectId, subjectId, subjectId, subjectId, userId, subjectId, subjectId],
  ).catch(() => []);
}

/** Plain-words role from an edge_type: mechanical, never invented — just
 *  the extraction-written edge label with underscores turned to spaces.
 *  "employed_by" -> "employed by", "director_of" -> "director of". */
function humanizeEdgeType(edgeType: string): string {
  return edgeType.replace(/_/g, " ").trim() || "connected to";
}

function isPersonConnection(c: ConnectionRow): boolean {
  return c.other_kind === "entity" && c.other_entity_type === "person";
}

/** The People block: named humans connected to a company/event/theme
 *  file, each with a plain-words role and a link to their own file when
 *  one exists (falls back to a slug guess, same as Connections). */
function renderPeopleBlock(rows: ConnectionRow[]): string {
  const people = rows.filter(isPersonConnection);
  if (people.length === 0) return "";
  const list = people
    .slice(0, 8)
    .map((p) => {
      const href = p.other_page_slug
        ? `/s/${escapeAttr(p.other_page_slug)}`
        : `/search?q=${escapeAttr(p.other_label)}`;
      return `<div class="conn-row"><a href="${href}">${escapeHtml(p.other_label)}</a><span class="why">${escapeHtml(humanizeEdgeType(p.edge_type))}</span></div>`;
    })
    .join("");
  return `<section id="people"><div class="sec-k">People</div>${list}</section>`;
}

/** On a PERSON's own file: the inverse of the People block — every other
 *  file this person is linked to, and their role there. This is the
 *  cross-file accumulation the design calls "the story": the person who
 *  keeps showing up across unrelated files. Only rows with their own page
 *  count (a file has to exist to "appear in" it). */
function renderAppearsInBlock(rows: ConnectionRow[]): string {
  const files = rows.filter((r) => r.other_page_slug);
  if (files.length === 0) return "";
  const list = files
    .slice(0, 10)
    .map(
      (f) =>
        `<div class="conn-row"><a href="/s/${escapeAttr(f.other_page_slug ?? "")}">${escapeHtml(f.other_label)}</a><span class="why">${escapeHtml(humanizeEdgeType(f.edge_type))}</span></div>`,
    )
    .join("");
  return `<section id="appears-in"><div class="sec-k">Appears in ${files.length} file${files.length === 1 ? "" : "s"}</div>${list}</section>`;
}

interface SourceStats {
  count: number;
  // Distinct pieces.byline values among those sources — for web-fetched
  // pieces this is the hostname (record-builder.ts sets it that way); for
  // manual uploads it's whatever the operator gave it, or blank (each
  // blank-byline piece counts as its own outlet rather than collapsing
  // together, so it never UNDERcounts diversity). A subject can look
  // "well-sourced" by raw count while really just being one site quoted
  // ten times — this is what tells the difference.
  distinctOutlets: number;
}

async function loadSourceCount(
  env: PublicEnv,
  userId: string,
  subjectId: string,
): Promise<SourceStats> {
  const row = await one<{ n: number; outlets: number }>(
    env.DB,
    `SELECT COUNT(DISTINCT p.id) AS n,
            COUNT(DISTINCT COALESCE(NULLIF(TRIM(p.byline), ''), p.id)) AS outlets
       FROM nodes
       JOIN pieces p ON p.id = nodes.piece_id
      WHERE nodes.user_id = ? AND nodes.piece_id IS NOT NULL
        AND (nodes.id = ? OR EXISTS (
          SELECT 1 FROM edges e
          WHERE (e.src_node_id = nodes.id AND e.dst_node_id = ?)
             OR (e.dst_node_id = nodes.id AND e.src_node_id = ?)))`,
    [userId, subjectId, subjectId, subjectId],
  ).catch(() => null);
  return { count: row?.n ?? 0, distinctOutlets: row?.outlets ?? 0 };
}

interface PageClaimRow {
  id: string;
  claim_text: string;
  kind: string;
  asserted_by: string | null;
  quote_text: string;
  piece_slug: string | null;
  piece_title: string | null;
}

/** The structured claims a signed analysis actually stands on —
 *  page_claims, each grounded to its verbatim quote and source. Written
 *  by the drafter (draft-reading.ts) but never previously read back on
 *  the public page: the signed prose rendered without ever showing its
 *  own receipts. This is what makes "every load-bearing claim resolves
 *  to a receipt" true on the analysis itself, not just on the file. */
async function loadPageClaims(
  env: PublicEnv,
  userId: string,
  pageId: string,
): Promise<PageClaimRow[]> {
  return all<PageClaimRow>(
    env.DB,
    `SELECT c.id, c.claim_text, c.kind, c.asserted_by,
            q.verbatim_text AS quote_text,
            p.slug AS piece_slug, p.title AS piece_title
       FROM page_claims c
       JOIN quotes q ON q.id = c.quote_id
       LEFT JOIN nodes src ON src.id = q.source_id
       LEFT JOIN pieces p ON p.id = src.piece_id
      WHERE c.page_id = ? AND c.user_id = ?
      ORDER BY c.sort_order ASC`,
    [pageId, userId],
  ).catch(() => []);
}

// Claims & receipts — reuses the exact .fact/.rcpt classes from the file
// page's "On the record" so a receipt opens identically everywhere. An
// assertion-kind claim ('X claimed Y') carries its attribution inline
// rather than being shown as plain fact — the firewall, honored here too.
function renderClaimsBlock(claims: PageClaimRow[]): string {
  if (claims.length === 0) return "";
  const rows = claims
    .map((c) => {
      const docLabel = c.piece_title ? c.piece_title.slice(0, 60) : "stored source";
      const attribution =
        c.kind === "assertion"
          ? `<p class="fact-text" style="margin-top:2px"><i>${c.asserted_by ? `Claimed by ${escapeHtml(c.asserted_by)}` : "Attributed claim"}</i></p>`
          : "";
      return `<div class="fact" id="claim-${escapeAttr(c.id)}">
  <div class="fact-line"><p class="fact-text">${escapeHtml(c.claim_text)}</p></div>
  ${attribution}
  <details class="rcpt">
  <summary><span class="rdoc">${escapeHtml(docLabel)}</span></summary>
  <div class="rcpt-body">
    <div class="rcpt-q">“${escapeHtml(c.quote_text.slice(0, 400))}${c.quote_text.length > 400 ? "…" : ""}”</div>
    <div class="rcpt-src"><span>SOURCE</span>${
      c.piece_slug
        ? `<a href="/library/${escapeAttr(c.piece_slug)}">${escapeHtml(docLabel)}</a>`
        : `<span>${escapeHtml(docLabel)}</span>`
    }<span class="sep">·</span><span>stored copy on file</span></div>
    <div class="rcpt-v">VERIFIED — a word-for-word match in the stored source</div>
  </div>
</details>
</div>`;
    })
    .join("");
  return `<section id="claims" class="signed-claims">
  <div class="sec-k">Claims &amp; receipts</div>
  ${rows}
</section>`;
}

// The foundation — every investigation ends here per the approved
// design: the files it stands on, and the sources behind them. Reuses
// the mockup's .fh/.fs/.conns/.conn-pill/.src-row structure exactly so
// it reads identically to the mockup's own foundation block.
function renderFoundationBlock(
  claims: PageClaimRow[],
  connections: ConnectionRow[],
  subjectSlug: string,
): string {
  const seenSources = new Map<string, { title: string }>();
  for (const c of claims) {
    if (c.piece_slug && !seenSources.has(c.piece_slug)) {
      seenSources.set(c.piece_slug, { title: c.piece_title ?? "stored source" });
    }
  }

  const filesRow = connections.length
    ? `<div class="fs"><span class="label">Files</span><div class="conns">${connections
        .slice(0, 8)
        .map((c) => {
          const href = c.other_page_slug
            ? `/s/${escapeAttr(c.other_page_slug)}`
            : `/search?q=${escapeAttr(c.other_label)}`;
          const rel = isPersonConnection(c) ? "person" : humanizeEdgeType(c.edge_type);
          return `<a class="conn-pill" href="${href}"><span class="rel">${escapeHtml(rel)}</span>${escapeHtml(c.other_label)}</a>`;
        })
        .join("")}</div></div>`
    : "";

  const sourcesRow =
    seenSources.size > 0
      ? `<div class="fs"><span class="label">Sources behind them</span>${[...seenSources.entries()]
          .map(
            ([slug, s]) =>
              `<div class="src-row"><a class="st" href="/library/${escapeAttr(slug)}">${escapeHtml(s.title)}</a></div>`,
          )
          .join("")}</div>`
      : `<div class="fs"><span class="label">Sources behind them</span><p style="font-family:var(--serif);color:var(--ink-3);font-size:14px">No structured claims are on file for this analysis yet.</p></div>`;

  return `<div class="foundation" id="foundation">
  <div class="fh"><span class="label">The foundation — what this analysis stands on</span><span class="coord">${claims.length} CLAIM${claims.length === 1 ? "" : "S"} · ${seenSources.size} SOURCE${seenSources.size === 1 ? "" : "S"}</span></div>
  ${filesRow}
  ${sourcesRow}
  <div class="fs"><a href="/p/${escapeAttr(subjectSlug)}" style="color:var(--accent-2)">↩ See the file this analysis stands on</a></div>
</div>`;
}

// ===========================================================================
// Block renderers
// ===========================================================================

function buildLede(_subject: SubjectRow, facts: FactRow[]): string {
  // Take up to two leading neutral facts and weave them into a lede sentence.
  // Each fact gets its quote receipt as a superscript link. When no facts
  // have been extracted yet, the lede is intentionally absent — the shape
  // block below tells the reader what will fill the page. (Cleaner than a
  // placeholder sentence pretending to be a lede.)
  if (facts.length === 0) return "";
  const top = facts.slice(0, 2);
  const joined = top
    .map(
      (f, i) =>
        `${escapeHtml(f.label)}${f.quote_id ? `<a class="qref" href="/q/${escapeAttr(f.quote_id)}" title="${escapeAttr(f.quote_text?.slice(0, 120) ?? "")}"><sup>${i + 1}</sup></a>` : ""}`,
    )
    .join(". ");
  return `${joined}.`;
}

// Each fact renders as a receipt chip (approved product design): the fact
// line, and a collapsed <details> that opens to the exact quote + source
// in place — no navigation away to read the receipt. "VERIFIED" states
// only what is mechanically true here (locateVerbatim: a word-for-word
// match against the stored source bytes) — it does NOT claim an
// independent judge pass, which established facts don't get (only
// signed-reading claims run the judge). Never overclaim the gauntlet.
function renderEstablishedBlock(facts: FactRow[]): string {
  if (facts.length === 0) return "";
  const rows = facts
    .map((f) => {
      const docLabel = f.piece_title ? f.piece_title.slice(0, 60) : "stored source";
      const receipt =
        f.quote_id && f.quote_text
          ? `<details class="rcpt">
  <summary><span class="rdoc">${escapeHtml(docLabel)}</span></summary>
  <div class="rcpt-body">
    <div class="rcpt-q">“${escapeHtml(f.quote_text.slice(0, 400))}${f.quote_text.length > 400 ? "…" : ""}”</div>
    <div class="rcpt-src"><span>SOURCE</span>${
      f.piece_slug
        ? `<a href="/library/${escapeAttr(f.piece_slug)}">${escapeHtml(docLabel)}</a>`
        : `<span>${escapeHtml(docLabel)}</span>`
    }<span class="sep">·</span><span>stored copy on file</span></div>
    <div class="rcpt-v">VERIFIED — a word-for-word match in the stored source</div>
  </div>
</details>`
          : "";
      return `<div class="fact" id="fact-${escapeAttr(f.id)}">
  <div class="fact-line"><p class="fact-text">${escapeHtml(f.label)}</p></div>
  ${receipt}
</div>`;
    })
    .join("");
  return `<section id="on-the-record" data-schema="ItemList"><div class="sec-k">On the record</div>${rows}</section>`;
}

function renderContestedBlock(rows: AssertionRow[], subjectLabel: string): string {
  if (rows.length === 0) return "";
  // Contested-as-evidence, not contested-as-verdict (2026-07-24: the color
  // used to be rose, this comment used to say "court evidence... readers
  // should immediately register this is contested" — that's a notch more
  // adversarial than the site's own stated intent, and matters more once
  // creator-profile pages start surfacing many of these at once for one
  // person). Now genuinely neutral-gray. Block-quote treatment on the
  // assertion text; attribution on its own line; a plain-language read on
  // how well-supported the claim is, not a score.
  //
  // The line under each card used to read the raw internal signal
  // ("Evidence balance +0.0 · contested in the record") — meaningful to
  // someone who knows the pipeline, opaque to everyone else. Reworded to
  // say what it actually means: is this well-supported, leaned-against, or
  // genuinely split, in plain words, not a score.
  const cards = rows
    .map((a) => {
      const balance = a.evidence_balance ?? 0;
      const balanceLine =
        a.rank === "contested"
          ? "Evidence is genuinely split on this one — real support and real pushback both on record."
          : balance > 0.5
            ? "The evidence on file mostly supports this, but it's still someone's claim, not a settled fact."
            : balance < -0.5
              ? "The evidence on file mostly runs against this claim."
              : "Not yet independently weighed — one source's claim, unconfirmed elsewhere.";
      const sourceLink = a.piece_title
        ? `<a class="contested-src" href="/library/${escapeAttr(a.piece_slug ?? "")}">${escapeHtml(a.piece_title.slice(0, 60))} ↗</a>`
        : "";
      // Stamp reflects THIS row's own rank, not the section as a whole —
      // 'preferred' rows never reach here (loadContestedAssertions excludes
      // them), so this is either genuinely 'contested' or merely 'normal'
      // (attributed, unconfirmed, not disputed by anyone) — "Reported" says
      // that honestly instead of implying every attributed claim was fought
      // over.
      const stamp = a.rank === "contested" ? "Disputed" : "Reported";
      return `<div class="contested-card">
  <div class="contested-stamp">${stamp}</div>
  <blockquote class="contested-quote">"${escapeHtml(a.label)}"</blockquote>
  <div class="contested-attribution">
    ${a.actor ? `Asserted by <b>${escapeHtml(a.actor)}</b>` : "Unattributed assertion"} · stance: ${escapeHtml(a.stance)}
  </div>
  <div class="contested-balance">${balanceLine}</div>
  ${sourceLink}
</div>`;
    })
    .join("");
  return `<section id="disputed" data-schema="Claim">
<div class="sec-k">Disputed — who says what, against what</div>
<p class="disputed-explainer">These are things people say about ${escapeHtml(subjectLabel)} that aren't settled fact — each one attributed to who's actually claiming it, so a claim never quietly passes as established just because it showed up in a document. Weigh it yourself.</p>
${cards}
</section>`;
}

// Fabric redesign Phase 4 — assertions the corpus has independently
// corroborated: no contradicting evidence on record, and backed by
// verified evidential edges from >=2 distinct source pieces (surfacing.ts's
// runSurfacingL1, rank='preferred'). Still an attributed claim, not a fact
// the corpus states directly (it stays out of Established) — but it's no
// longer honest to file it as "Disputed" next to claims nobody backs.
// Reuses the --confirmed token (Phase 6), same "citable, multiply-sourced,
// high confidence" semantic the rest of the site already gives that color.
function renderCorroboratedBlock(rows: AssertionRow[]): string {
  if (rows.length === 0) return "";
  const cards = rows
    .map((a) => {
      const sourceLink = a.piece_title
        ? `<a class="contested-src" href="/library/${escapeAttr(a.piece_slug ?? "")}">${escapeHtml(a.piece_title.slice(0, 60))} ↗</a>`
        : "";
      return `<div class="corroborated-card">
  <div class="corroborated-stamp">Corroborated</div>
  <blockquote class="contested-quote">"${escapeHtml(a.label)}"</blockquote>
  <div class="contested-attribution">
    ${a.actor ? `Asserted by <b>${escapeHtml(a.actor)}</b>` : "Unattributed assertion"} · stance: ${escapeHtml(a.stance)}
  </div>
  <div class="contested-balance">Independently backed by multiple separate sources, with no contradicting evidence on record.</div>
  ${sourceLink}
</div>`;
    })
    .join("");
  return `<section id="corroborated" data-schema="Claim">
<div class="sec-k">Corroborated</div>
<p class="disputed-explainer">Attributed claims — still someone's assertion, not a fact the corpus states directly — that multiple independent sources back and nothing on file contradicts.</p>
${cards}
</section>`;
}

// Memetic content #3 (2026-07-24) — this subject's own record contradicting
// itself, not "disputed by someone else" (that's the Contested block above).
// Same tone discipline as Contested: neutral gray, no stamp, two quotes and
// a plain one-line description of the tension, receipts for both — never a
// verdict on which one was "true." Nothing here that wasn't already
// independently judge-verified (graph/lib/self-contradictions.ts).
function renderSelfContradictionsBlock(rows: SelfContradictionRow[], subjectLabel: string): string {
  if (rows.length === 0) return "";
  const cards = rows
    .map((r) => {
      const srcA = r.piece_a_title
        ? `<a class="contested-src" href="/q/${escapeAttr(r.quote_a_id ?? "")}">${escapeHtml(r.piece_a_title.slice(0, 60))} ↗</a>`
        : "";
      const srcB = r.piece_b_title
        ? `<a class="contested-src" href="/q/${escapeAttr(r.quote_b_id ?? "")}">${escapeHtml(r.piece_b_title.slice(0, 60))} ↗</a>`
        : "";
      return `<div class="contested-card self-contradiction-card">
  <div class="contested-stamp">On record, both ways</div>
  <blockquote class="contested-quote">"${escapeHtml(r.quote_a_text)}"</blockquote>
  ${srcA ? `<div class="contested-attribution">${srcA}</div>` : ""}
  <blockquote class="contested-quote">"${escapeHtml(r.quote_b_text)}"</blockquote>
  ${srcB ? `<div class="contested-attribution">${srcB}</div>` : ""}
  <div class="contested-balance">${escapeHtml(r.tension_summary)}</div>
</div>`;
    })
    .join("");
  return `<section id="self-contradictions" data-schema="Claim">
<div class="sec-k">On record, both ways</div>
<p class="disputed-explainer">Two things ${escapeHtml(subjectLabel)} has said, in different places, that don't square with each other — verified against the stored source each time, with no claim about which one they meant. Weigh it yourself.</p>
${cards}
</section>`;
}

// The timeline section now uses the arrangement renderer directly (see
// renderNeutral above). The inline renderTimelineBlock helper that lived
// here is gone — its job moved to arrangements/timeline.ts, which is the
// canonical renderer used both standalone (/t/:slug) and embedded here.
// Spec v2.6 Part 6.

function renderConnectionsBlock(conns: ConnectionRow[]): string {
  // People are folded out into their own block — this is everything else
  // (organizations, statutes, other events/themes).
  const rest = conns.filter((c) => !isPersonConnection(c));
  if (rest.length === 0) return "";
  const rows = rest
    .map((c) => {
      const href = c.other_page_slug
        ? `/s/${escapeAttr(c.other_page_slug)}`
        : `/search?q=${escapeAttr(c.other_label)}`;
      return `<div class="conn-row"><a href="${href}">${escapeHtml(c.other_label)}</a><span class="why">${escapeHtml(humanizeEdgeType(c.edge_type))}</span></div>`;
    })
    .join("");
  return `<section id="connections" data-schema="OwnershipInfo"><div class="sec-k">Connections</div>${rows}</section>`;
}

function renderProvenance(sourceCount: SourceStats, hasSigned: boolean, page: PageRow): string {
  const lines: string[] = [];
  if (sourceCount.count > 0) {
    const base = `Built from ${sourceCount.count} source document${sourceCount.count === 1 ? "" : "s"} on file`;
    // Only worth saying when it's actually informative: a diversity count
    // equal to the raw count means every source already reads as its own
    // outlet, so there's nothing extra to learn from restating it.
    lines.push(
      sourceCount.distinctOutlets > 0 && sourceCount.distinctOutlets < sourceCount.count
        ? `${base}, from ${sourceCount.distinctOutlets} distinct outlet${sourceCount.distinctOutlets === 1 ? "" : "s"}.`
        : `${base}.`,
    );
  }
  if (hasSigned && page.signed_status !== "none") {
    lines.push("<b>A signed analysis of this subject is on file.</b>");
  } else {
    lines.push("No signed analysis of this subject yet.");
  }
  lines.push("Nobody wrote this page — it is built from the record, automatically.");
  return `<div id="on-file" class="prov">${lines.join("<br/>")}</div>`;
}

// The reveal, as a real toggle — not "?mode=signed dressed as prose." Both
// tabs are always real links (full page nav, not a client-side swap) so
// this stays SSR-simple and readable with no JS; the tab bar is just the
// same mode switch that already existed, given the visual weight of a
// choice instead of a quiet aside. A draft is only ever reachable here as
// the operator (subject-page.ts's hasSignedReading gate), so the tab
// label still has to say "draft," not "signed" — the one person
// reviewing it needs to be able to tell what they're looking at from the
// page itself.
function renderModeBand(
  slug: string,
  current: "neutral" | "signed",
  hasSigned: boolean,
  page: PageRow,
): string {
  if (!hasSigned) return "";
  const isDraft = page.signed_status === "draft";
  const neutralHref = `/p/${escapeAttr(slug)}`;
  const signedHref = `/p/${escapeAttr(slug)}?mode=signed`;
  const draftNote =
    isDraft && current === "signed"
      ? `<div class="reveal-draft-note">You are previewing an unpublished draft — not visible to public readers yet.</div>`
      : "";
  return `<div class="reveal-tabs" role="tablist" aria-label="Facts or analysis">
  <a class="reveal-tab${current === "neutral" ? " on" : ""}" href="${neutralHref}" role="tab" aria-selected="${current === "neutral"}">Facts</a>
  <a class="reveal-tab${current === "signed" ? " on" : ""}" href="${signedHref}" role="tab" aria-selected="${current === "signed"}">${isDraft ? "Analysis — draft" : "Analysis"}</a>
</div>
${draftNote}`;
}

// ===========================================================================
// helpers
// ===========================================================================

// schema.org JSON-LD for the subject page. The @type follows the subject
// kind; timeline events become a hasPart ItemList. Built defensively — only
// fields we actually have. This is the citability payoff (Princeton GEO):
// AI engines cite schema-tagged, sourced pages over general sources.
function buildSubjectJsonLd(
  subject: SubjectRow,
  page: PageRow,
  facts: FactRow[],
  events: EventRow[],
): string {
  const typeMap: Record<string, string> = {
    entity: "Thing",
    event: "Event",
    theme: "CreativeWork",
  };
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": typeMap[subject.kind] ?? "Thing",
    name: subject.label,
    url: `/s/${page.slug}`,
  };
  if (page.signed_at) graph.dateModified = page.signed_at.slice(0, 10);
  if (facts.length > 0) {
    graph.description = facts
      .slice(0, 3)
      .map((f) => f.label)
      .join(". ");
  }
  if (events.length > 0) {
    graph.subjectOf = events.slice(0, 12).map((e) => ({
      "@type": "Event",
      name: e.label,
      ...(e.event_date ? { startDate: e.event_date } : {}),
    }));
  }
  // Escape </script> to keep the JSON-LD from breaking out of its tag.
  return JSON.stringify(graph).replace(/<\/script/gi, "<\\/script");
}

// The file-cover stamp header (approved product design). Fewer numbers,
// plain words, provenance first — and every number is a real anchor link
// to the section it counts. No kill counts here; those live on /method
// and on the home depth stats, never on a file header.
function renderFileStamp(args: {
  label: string;
  kindLabel: string;
  desig: string;
  factCount: number;
  disputedCount: number;
  sourceCount: number;
  openedAt: string;
  updatedAt: string;
  signedHref: string | null;
}): string {
  const coordParts: string[] = [];
  if (args.sourceCount > 0) {
    coordParts.push(
      `<a class="jump" href="#on-file">${args.sourceCount} SOURCE${args.sourceCount === 1 ? "" : "S"}</a>`,
    );
  }
  coordParts.push(
    `<a class="jump" href="#on-the-record">${args.factCount} DOCUMENTED FACT${args.factCount === 1 ? "" : "S"}</a>`,
  );
  if (args.disputedCount > 0) {
    coordParts.push(`<a class="jump" href="#disputed">${args.disputedCount} DISPUTED</a>`);
  }
  coordParts.push(`OPENED ${escapeHtml(formatShortDate(args.openedAt))}`);
  coordParts.push(`UPDATED <span class="hi">${escapeHtml(formatShortDate(args.updatedAt))}</span>`);
  if (args.signedHref) {
    coordParts.push(
      `<a class="jump ac" href="${escapeAttr(args.signedHref)}">SIGNED ANALYSIS ON FILE</a>`,
    );
  }
  const coordLine = coordParts.join(` <span class="sep">·</span> `);

  return `<div class="stamp">
  <div class="stamp-top"><span class="fileno">FILE ON ${escapeHtml(args.label.toUpperCase())}</span><span class="kindchip">${escapeHtml(args.kindLabel)}</span></div>
  <div class="stamp-body">
    <h1>${escapeHtml(args.label)}</h1>
    ${args.desig ? `<p class="desig">${args.desig}</p>` : ""}
  </div>
  <div class="stamp-foot"><div class="coord">${coordLine}</div></div>
</div>`;
}

/** ISO timestamp -> "2026-07-22", the compact mono-coordinate date used in
 *  the stamp line. */
function formatShortDate(iso: string): string {
  return iso.slice(0, 10);
}

function subjectKindLabel(kind: string, entityType?: string): string {
  if (kind === "entity") {
    switch (entityType) {
      case "person":
        return "Person";
      case "organization":
      case "institution":
        return "Company";
      case "work":
        return "Work";
      default:
        return "Entity";
    }
  }
  switch (kind) {
    case "event":
      return "Event";
    case "theme":
      return "Theme";
    default:
      return "File";
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// Long-form date for the signature line — "11 June 2026" reads as a date
// on a signed document, not a sortable timestamp.
function formatLongDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthIdx = Number(mo) - 1;
  const month = months[monthIdx] ?? mo;
  return `${Number(d)} ${month} ${y}`;
}

// ===========================================================================
// FACES (spec v2.6 Part 8) — thread / script / card / chapter rendered into
// the signed reading. No generate buttons; Studio (Part 27) is a PRODUCE step,
// not a destination. Thread + card render live (template + query); script +
// chapter pre-render on signing (operator/routes.ts:/out/:id/sign queues them
// via waitUntil). Each persisted face is ready, rendering, queued, or failed —
// the renderer reflects state honestly.
// ===========================================================================

interface FaceRow {
  kind: string;
  body_html: string | null;
  body_md: string | null;
  status: string;
  error: string | null;
  updated_at: string;
}

async function loadFaces(env: PublicEnv, pageId: string): Promise<FaceRow[]> {
  return all<FaceRow>(
    env.DB,
    `SELECT kind, body_html, body_md, status, error, updated_at
       FROM page_faces WHERE page_id = ?
      ORDER BY CASE kind
                  WHEN 'thread' THEN 0 WHEN 'script' THEN 1
                  WHEN 'card' THEN 2 WHEN 'chapter' THEN 3 ELSE 9 END`,
    [pageId],
  ).catch(() => []);
}

const FACE_LABELS: Record<string, string> = {
  thread: "Thread",
  script: "Video script",
  card: "Card",
  carousel: "Carousel",
  chapter: "Chapter outline",
};

const FACE_HINTS: Record<string, string> = {
  thread: "Thesis + the four most cutting facts, one per post.",
  script: "Locked reasoning skeleton for a 3–4 minute video — structure, not voice.",
  card: "One shareable image: thesis on top, the most damning fact below, receipt in the corner.",
  carousel: "Six-slide swipe-through for Instagram / LinkedIn.",
  chapter: "The analysis's structure expanded for long-form treatment.",
};

function renderFacesBlock(
  faces: FaceRow[],
  pageId?: string,
  isOperator?: boolean,
  liveFaces: { thread?: string; card?: string; carousel?: string } = {},
  pageSlugForFaces?: string,
): string {
  // Faces always render when there's a thesis — thread + card + carousel
  // are template+query and have no DB state. Only script + chapter come
  // from page_faces. Always show every tab.
  // The first ready face is opened by default; the rest are headed but
  // collapsed (server-rendered, no-JS — just <details>).
  const orderedKinds = ["thread", "card", "carousel", "script", "chapter"];
  const LIVE_KINDS = new Set(["thread", "card", "carousel"]);
  const byKind = new Map<string, FaceRow>(faces.map((f) => [f.kind, f]));
  let firstReadyShown = false;
  const items = orderedKinds
    .map((kind) => {
      const label = FACE_LABELS[kind] ?? kind;
      const hint = FACE_HINTS[kind] ?? "";
      // Stage A Produce → link for the static formats (card, thread,
      // carousel). Operator-only; spec v2.6 Part 27. Points at the
      // slug-based Studio preview page, which has the download buttons.
      const produceLink =
        isOperator && pageId && LIVE_KINDS.has(kind)
          ? `<a class="face-produce" href="/studio/${escapeAttr(pageSlugForFaces ?? "")}/${kind}">Produce →</a>`
          : "";
      // Thread + card + carousel: rendered live; always ready.
      if (LIVE_KINDS.has(kind)) {
        const liveBody =
          kind === "thread"
            ? liveFaces.thread
            : kind === "card"
              ? liveFaces.card
              : liveFaces.carousel;
        const open = !firstReadyShown && !!liveBody;
        if (open) firstReadyShown = true;
        return `<details class="face" ${open ? "open" : ""}>
  <summary>
    <span class="face-label">${escapeHtml(label)}</span>
    <span class="face-chip face-ready">live</span>
    <span class="face-hint">${escapeHtml(hint)}</span>
    ${produceLink}
  </summary>
  <div class="face-body">${liveBody ?? ""}</div>
</details>`;
      }
      // Script + chapter: from page_faces.
      const f = byKind.get(kind);
      if (!f) {
        return `<details class="face">
  <summary>
    <span class="face-label">${escapeHtml(label)}</span>
    <span class="face-chip face-pending-chip">queued</span>
    <span class="face-hint">${escapeHtml(hint)}</span>
  </summary>
  <div class="face-pending">This format renders on the next sign. Re-sign the analysis to queue it.</div>
</details>`;
      }
      const open = !firstReadyShown && f.status === "ready";
      if (open) firstReadyShown = true;
      // The operator's per-face Retry affordance — surfaces when the face
      // failed or stayed queued/rendering past a fresh sign. Public readers
      // never see it (it's a POST against an /op/* action endpoint).
      const retryBtn =
        isOperator &&
        pageId &&
        (f.status === "failed" || f.status === "rendering" || f.status === "queued")
          ? `<form method="POST" action="/op/faces/${escapeAttr(pageId)}/${escapeAttr(kind)}/render" style="display:inline">
  <button class="face-retry" type="submit">Re-render</button>
</form>`
          : "";
      const inner =
        f.status === "ready"
          ? `<div class="face-body">${f.body_html ?? escapeHtml(f.body_md ?? "")}</div>`
          : f.status === "failed"
            ? `<div class="face-fail">Render failed${f.error ? `: ${escapeHtml(f.error)}` : ""}.${retryBtn ? "" : " Re-sign the analysis to retry."}${retryBtn}</div>`
            : `<div class="face-pending">Rendering — this face is being generated in the background. Reload in a moment.${retryBtn}</div>`;
      const statusChip =
        f.status === "ready"
          ? `<span class="face-chip face-ready">ready</span>`
          : f.status === "failed"
            ? `<span class="face-chip face-fail-chip">failed</span>`
            : `<span class="face-chip face-pending-chip">${escapeHtml(f.status)}</span>`;
      return `<details class="face" ${open ? "open" : ""}>
  <summary>
    <span class="face-label">${escapeHtml(label)}</span>
    ${statusChip}
    <span class="face-hint">${escapeHtml(hint)}</span>
  </summary>
  ${inner}
</details>`;
    })
    .join("");
  return `<section class="faces" aria-label="Formats of this analysis">
  <div class="faces-head">
    <div class="faces-k">Formats of this analysis</div>
    <div class="faces-sub">Selection, not new writing — the analysis carries every claim; these formats just re-arrange them.</div>
  </div>
  ${items}
</section>
<style>
  .faces { margin:36px 0 8px; padding:18px 20px; border:1px solid var(--rule);
    border-radius:11px; background:var(--panel-soft, rgba(0,0,0,.02)); }
  .faces-head { margin-bottom:12px; }
  .faces-k { font-size:11px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--ink-3); font-weight:600; margin-bottom:4px; }
  .faces-sub { font-size:12.5px; color:var(--ink-3); font-style:italic; }
  .face { border-top:1px solid var(--rule); padding:11px 0; }
  .face:first-of-type { border-top:none; }
  .face summary { cursor:pointer; display:flex; align-items:center; gap:10px;
    flex-wrap:wrap; list-style:none; user-select:none; }
  .face summary::-webkit-details-marker { display:none; }
  .face-label { font-family:var(--serif); font-size:16px; color:var(--ink); }
  .face-chip { font-size:9.5px; letter-spacing:.08em; padding:2px 7px; border-radius:3px;
    text-transform:uppercase; font-weight:600; }
  .face-ready { background:var(--confirmed-bg, #e7f0e6); color:var(--confirmed, #2f7d52); }
  .face-fail-chip { background:var(--correction-bg, #f6e4df); color:var(--correction, #b0402c); }
  .face-pending-chip { background:rgba(0,0,0,.06); color:var(--ink-3); }
  .face-hint { font-size:12px; color:var(--ink-3); margin-left:auto; flex:1; text-align:right; min-width:200px; }
  .face-body { margin-top:12px; font-size:14.5px; line-height:1.65; color:var(--ink-2); }
  .face-body p { margin-bottom:10px; }
  .face-body strong { color:var(--ink); }
  .face-fail { margin-top:10px; padding:9px 12px; border-radius:6px;
    background:var(--correction-bg, #f6e4df); color:var(--correction, #b0402c); font-size:13px; }
  .face-pending { margin-top:10px; padding:9px 12px; border-radius:6px;
    background:rgba(0,0,0,.04); color:var(--ink-3); font-size:13px; font-style:italic; }
  .face-retry { font-size:11.5px; padding:4px 11px; margin-left:9px; border-radius:5px;
    border:1px solid var(--rule); background:var(--surface); color:var(--ink); cursor:pointer; }
  .face-retry:hover { background:var(--accent-bg, #e8ecf3); }
  .face-produce { font-family:var(--mono); font-size:11px; padding:4px 9px; margin-left:9px;
    border-radius:5px; border:1px solid var(--ink); background:var(--ink); color:var(--paper, #faf6ef);
    text-decoration:none; letter-spacing:.04em; }
  .face-produce:hover { background:#1a1c20; }
  @media(max-width:680px) { .face-hint { text-align:left; min-width:0; flex-basis:100%; margin-left:0; } }
</style>`;
}

// ===========================================================================
// EXPAND BANNER — live narration of record-building on click (spec v2.6 Part 26)
// ===========================================================================

/** Render the live "expanding…" banner. Client-side polling now
 *  (status-banner.ts) — GET /op/research-status?q=...&kind=expand reads
 *  getExpandStatus() (record-builder.ts) live, no page reload involved.
 *  kind=expand tells the endpoint not to wait on a synthesis phase that
 *  plain expand (unlike "Research this") never runs. */
export function renderExpandBanner(subjectLabel: string): string {
  return renderLiveStatusBanner(
    `/op/research-status?q=${encodeURIComponent(subjectLabel)}&kind=expand`,
    `Expanding this Record — searching the web for ${subjectLabel}…`,
  );
}
