// Design system CSS, lifted from the PROBE design build (~74KB).
// Embedded as a template literal so the Worker bundles it without any
// loader plugin. Served at /styles.css with immutable caching; the
// stylesHash() value drives cache-busting on the <link>.

export const STYLES_CSS = `/* ============================================================================
   CANOPTICON — "The Standing Record"
   A design system built to be quoted.

   Three voices:
     · Geist        — the instrument. UI, labels, the unsigned FACTS.
     · Newsreader   — the author. Long-form prose + the signed ANALYSIS.
     · Geist Mono   — the coordinates. Source IDs, confidence, scope, time.

   Two grounds:
     · Public   — warm paper. An archival record meant to be cited.
     · Operator — dark instrument with an amber glow.

   One accent: amber. Used like a highlighter on a document — sparingly.
   ============================================================================ */

:root {
  /* ---- Ground · dark ---------------------------------------------------
     The warm-paper --pub-* set that used to sit here was deleted: it was
     defined for "legacy embeds that reference it directly", and nothing in
     the repo referenced any of it. A dead palette that looks live is how a
     reader of this file ends up designing against the wrong colours. */
  --op-paper:     #0e1013;
  --op-paper-2:   #14171a;
  /* The hover ground. There wasn't one — every list row and card changed
     only its border on hover, which is why nothing on the site felt like it
     responded to the pointer. */
  --op-paper-hover:#191d20;
  --op-paper-3:   #212229;
  --op-paper-4:   #2d2e37;
  --op-surface:   #131419;
  --op-ink:       #eceef2;
  --op-ink-2:     #ccced6;
  /* Lightened one step from #93959f/#666873 — the originals failed WCAG AA
     (~3.6-3.9:1) for body-copy weight against --op-paper. Same relative
     offset between the two preserved; hierarchy (mute quieter than -3,
     both quieter than -2) is unchanged, they just both now clear 4.5:1. */
  --op-ink-3:     #a5a8b3;
  --op-ink-mute:  #787b86;
  --op-ink-faint: #484a54;
  --op-rule:      #23272b;
  --op-rule-bright:#2e3439;
  /* One accent, and it is red. It was a muted ink-blue, alongside five
     per-zone accents (teal, pink, green, crimson, another blue) that each
     claimed a section of the site — six accents is no accent. */
  --op-accent:    #e0433c;
  --op-accent-2:  #ef6a63;     /* hover / brighter state */
  --op-accent-bg: rgba(224,67,60,0.10);
  --op-accent-bd: #7a2c26;

  /* ---- Semantics (register + confidence) — shared --------------------- */
  --confirmed:    #2f7d52;     /* citable, multiply-sourced, high confidence */
  --confirmed-bg: #e7f0e6;
  --confirmed-bd: #bcd6bd;
  /* Neutral gray, not rose — 2026-07-24. The card copy already reads as
     evidence, not verdict ("weigh it yourself"); the color shouldn't
     say something the words don't. Matches the op-ink-3/op-ink-mute
     weight class so it reads as a marker without reading as a warning. */
  --contested:    #9a9da8;     /* partial / both-sides / advisory — neutral gray */
  --correction:   #b0402c;     /* withdrawn / wrong / low confidence */
  --correction-bg:#f6e4df;
  --correction-bd:#e2bdb2;
  --confirmed-bg-d:#11251a;
  --confirmed-bd-d:#234d34;
  --correction-bg-d:#2a120c;
  --correction-bd-d:#5a261b;
  /* Proposal layer (fabric redesign Phase 7) — muted violet, the same
     desaturation class as confirmed/contested/correction above. Doesn't
     map to any existing semantic (not a confidence signal, not a dispute
     signal) — a genuinely new register: prescriptive, not descriptive. */
  --propose:      #8577b3;
  --propose-bg:   #ece8f5;
  --propose-bd:   #cdc2e0;
  --propose-bg-d: #211a2e;
  --propose-bd-d: #453564;

  /* ---- Type ----------------------------------------------------------- */
  --sans:  'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  /* Newsreader stays. The design handoff dropped the serif and set everything
     in one grotesque; this publication is long-form and a serif reading
     measure is worth more here than typographic uniformity. */
  --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --mono:  'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  /* ---- Geometry ------------------------------------------------------- */
  --r-sm: 4px;
  --r:    7px;
  --r-lg: 11px;
  --shadow-sm: 0 1px 2px rgba(28,24,19,0.05);
  --shadow:    0 2px 5px rgba(28,24,19,0.06), 0 1px 2px rgba(28,24,19,0.04);
  --shadow-lg: 0 12px 40px rgba(28,24,19,0.13);

  /* ---- Tweakable ------------------------------------------------------ */
  --reading-width: 680px;
  --measure: 64ch;

  /* ---- Active (public default) ----------------------------------------
     THE RECORD: the dark instrument IS the public face. The operator
     tokens are promoted to the ground for everyone — one register, one
     brand. (The old warm-paper --pub-* set stays defined above for the
     few legacy embeds that reference it directly.) */
  color-scheme: dark;
  --paper: var(--op-paper);
  --paper-2: var(--op-paper-2);
  --paper-hover: var(--op-paper-hover);
  --paper-3: var(--op-paper-3);
  --surface: var(--op-surface);
  --ink: var(--op-ink);
  --ink-2: var(--op-ink-2);
  --ink-3: var(--op-ink-3);
  --ink-mute: var(--op-ink-mute);
  --ink-faint: var(--op-ink-faint);
  --rule: var(--op-rule);
  --rule-soft: var(--op-rule);
  --rule-bright: var(--op-rule-bright);
  --accent: var(--op-accent);
  --accent-2: var(--op-accent-2);
  --accent-bg: var(--op-accent-bg);
  --accent-bd: var(--op-accent-bd);
  --conf-bg: var(--confirmed-bg-d);
  --conf-bd: var(--confirmed-bd-d);
  --corr-bg: var(--correction-bg-d);
  --corr-bd: var(--correction-bd-d);
  /* Disputed (contested) surfaces — neutral gray, not maroon, matching
     --contested above. Reuses the existing surface/rule-bright tones
     rather than a bespoke warning hue. */
  --cont-bg: var(--op-paper-3);
  --cont-bd: var(--op-rule-bright);
  --prop-bg: var(--propose-bg-d);
  --prop-bd: var(--propose-bd-d);
}

/* data-mode="operator" now inherits the same dark ground — one register.
   The selector is kept (harmless) so operator screens need no markup
   change; it simply re-binds identical values. */
[data-mode="operator"] {
  --paper: var(--op-paper);
  --rule-soft: var(--op-rule);
}

/* ============================================================================
   RESET
   ============================================================================ */
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
html, body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.55;
  font-feature-settings: "ss01", "cv01";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
  transition: background 0.3s ease, color 0.3s ease;
}
button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; padding: 0; }
a { color: inherit; text-decoration: none; }
img, svg { display: block; max-width: 100%; }
input, select, textarea { font: inherit; color: inherit; }
::selection { background: var(--accent-bg); color: var(--accent-2); }

/* ============================================================================
   TYPE UTILITIES
   ============================================================================ */
.mono { font-family: var(--mono); font-feature-settings: "ss01","zero","tnum"; }
.serif { font-family: var(--serif); }


.coord {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0;
  color: var(--ink-mute); font-variant-numeric: tabular-nums;
  display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.coord .sep { color: var(--ink-faint); }
.coord .hi { color: var(--ink); }
.coord .ac { color: var(--accent); }

.label {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-mute);
}
.kicker {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--ink-mute);
  display: inline-flex; align-items: center; gap: 10px;
}
.kicker .live {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
}

h1, h2, h3, h4 { font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.display {
  font-family: var(--sans); font-weight: 600; letter-spacing: -0.035em;
  line-height: 1.02; font-size: clamp(34px, 5vw, 56px); text-wrap: balance;
}
.title { font-family: var(--sans); font-weight: 600; letter-spacing: -0.025em; line-height: 1.12; }


/* The authored / reading voice */
.prose {
  font-family: var(--serif); font-size: 19px; line-height: 1.6;
  color: var(--ink-2); font-weight: 400; max-width: var(--reading-width);
}
.prose p { margin-bottom: 1.1em; text-wrap: pretty; }
.prose p:last-child { margin-bottom: 0; }
.lead {
  font-family: var(--serif); font-size: 18px; line-height: 1.58;
  color: var(--ink-2); text-wrap: pretty;
}

/* ---- the reading column, for everything inside a document body ----------
   Until now .prose styled exactly one element: p. Everything else a real
   research document carries — headings, lists, quotes, tables, code — fell
   through to browser defaults, on a dark ground, at the wrong font. That is
   the whole of the copy-paste look.

   It is not only cosmetic. Retrieval is passage-level: a section that runs
   past roughly 300 words with no visible subheading makes a model hunt for
   the passage inside a wall of text, and that measurably lowers the odds of
   being cited. Structure here IS retrieval structure. */

.prose > :first-child { margin-top: 0; }
.prose > :last-child  { margin-bottom: 0; }

/* Headings step down in size but hold the sans voice, so a document's
   skeleton is legible at a glance and at a scroll. */
.prose h2, .prose h3, .prose h4 {
  font-family: var(--sans); font-weight: 600; letter-spacing: -0.02em;
  line-height: 1.22; color: var(--ink); text-wrap: balance;
}
.prose h2 { font-size: 24px; margin: 2em 0 0.65em; }
.prose h3 { font-size: 19px; margin: 1.8em 0 0.55em; }
.prose h4 {
  font-size: 14px; margin: 1.6em 0 0.5em; font-family: var(--mono);
  font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--ink-3);
}
.prose h2 + h3 { margin-top: 1.1em; }

/* Every heading is a citation target. The marker is quiet until hover so it
   is available without littering the reading column with punctuation. */
.prose :is(h2, h3, h4) .anchor-link { color: inherit; text-decoration: none; }
.prose :is(h2, h3, h4) .anchor-link:hover { color: var(--accent); }
.prose :is(h2, h3, h4) .anchor-link::after {
  content: "#"; margin-left: 0.4em; color: var(--ink-faint);
  font-family: var(--mono); font-size: 0.7em; opacity: 0;
  transition: opacity 0.12s ease;
}
.prose :is(h2, h3, h4):hover .anchor-link::after { opacity: 1; }

.prose ul, .prose ol { margin: 0 0 1.1em; padding-left: 1.4em; }
.prose li { margin-bottom: 0.4em; text-wrap: pretty; }
.prose li:last-child { margin-bottom: 0; }
.prose li > ul, .prose li > ol { margin: 0.4em 0 0; }
.prose ul { list-style: none; padding-left: 1.1em; }
.prose ul > li { position: relative; }
.prose ul > li::before {
  content: ""; position: absolute; left: -1.1em; top: 0.62em;
  width: 4px; height: 4px; border-radius: 50%; background: var(--ink-faint);
}
/* Not decoration: on a Sources block these markers ARE the citation numbers
   that [1] in the body points at, so they have to be readable. */
.prose ol > li::marker { color: var(--ink-3); font-family: var(--mono); font-size: 0.85em; }

/* A quotation is the one place a document speaks in another voice, so it
   gets the accent rule rather than a grey slab. */
.prose blockquote {
  margin: 1.5em 0; padding: 0.15em 0 0.15em 1.15em;
  border-left: 2px solid var(--accent); color: var(--ink-2);
  font-style: italic;
}
.prose blockquote p { margin-bottom: 0.7em; }
.prose blockquote p:last-child { margin-bottom: 0; }

/* Tables were unsupported entirely and rendered as rows of pipe characters
   in a paragraph. Mono digits so columns line up; the wrapper scrolls a wide
   table instead of pushing the page sideways on a phone. */
.table-wrap { margin: 1.6em 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.prose table { border-collapse: collapse; width: 100%; font-family: var(--sans); font-size: 14.5px; }
.prose thead th {
  text-align: left; font-weight: 600; color: var(--ink-3);
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.05em;
  text-transform: uppercase; white-space: nowrap;
  padding: 0 14px 9px 0; border-bottom: 1px solid var(--rule-bright);
}
.prose tbody td {
  padding: 9px 14px 9px 0; border-bottom: 1px solid var(--rule);
  color: var(--ink-2); vertical-align: top;
}
.prose tbody tr:last-child td { border-bottom: none; }
.prose td:last-child, .prose th:last-child { padding-right: 0; }
/* Numeric columns are the reason to use tabular figures at all. */
.prose td[style*="right"], .prose td[style*="center"] { font-variant-numeric: tabular-nums; }

.prose code {
  font-family: var(--mono); font-size: 0.86em; color: var(--ink);
  background: var(--paper-2); border: 1px solid var(--rule);
  border-radius: 4px; padding: 0.1em 0.35em;
}
.prose pre {
  margin: 1.4em 0; padding: 14px 16px; overflow-x: auto;
  background: var(--paper-2); border: 1px solid var(--rule);
  border-radius: var(--r);
}
.prose pre code { background: none; border: none; padding: 0; font-size: 13px; line-height: 1.55; }

.prose hr { margin: 2.2em 0; border: none; border-top: 1px solid var(--rule); }

.prose a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; }
.prose a:hover { border-bottom-color: var(--accent); }

/* ---- the inline receipt --------------------------------------------------
   A verified passage, linked in the sentence it came from rather than in a
   block at the foot of the page. Retrieval is passage-level: a claim in one
   chunk with its proof in another gets lifted WITHOUT the proof, which is the
   one thing this publication exists to prevent.

   It deliberately does NOT look like an ordinary link. A link says go
   elsewhere; this says this has been checked, and you can see the check. So:
   the reading colour is kept, the underline is a hairline dotted rule, and a
   small mark follows. Only on hover does it take the accent and admit to
   being clickable.

   Restraint is the whole design here. Highlighted inline links do not
   measurably slow reading or hurt comprehension, but the distraction effect
   scales with DENSITY — so only findings are linked, a handful per document,
   never every entity. That last part is the wiki failure mode. */
.prose a.receipt {
  color: inherit;
  /* Rendered at --ink-faint the dotted rule was invisible on the dark ground,
     which left the check mark floating with nothing under it. --ink-3 reads
     as a deliberate mark without competing with the text. */
  text-decoration: underline dotted var(--ink-3);
  text-underline-offset: 3.5px;
  text-decoration-thickness: 1px;
  scroll-margin-top: 80px;
}
.prose a.receipt::after {
  content: "✓";
  margin-left: 0.18em;
  font-family: var(--sans);
  font-size: 0.6em;
  vertical-align: 0.45em;
  color: var(--accent);
  letter-spacing: 0;
}
.prose a.receipt:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.prose a.receipt:hover::after { color: var(--accent); }
/* Arriving from the findings block: flash the passage so the eye lands on it
   rather than merely scrolling near it. */
.prose a.receipt:target {
  background: var(--accent-wash, rgba(224,67,60,0.10));
  border-bottom-color: var(--accent);
  border-radius: 2px;
  box-shadow: 0 0 0 3px var(--accent-wash, rgba(224,67,60,0.10));
}

.finding-links { display: flex; gap: 16px; align-items: center; margin-top: 9px; }
.finding-context {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-mute); text-decoration: none;
}
.finding-context:hover { color: var(--accent); }
.finding-links .finding-receipt { margin-top: 0; }

@media (max-width: 720px) {
  .prose { font-size: 17.5px; }
  .prose h2 { font-size: 21px; }
  .prose h3 { font-size: 18px; }
  /* The marker has no hover on touch, so show it rather than hide it. */
  .prose :is(h2, h3, h4) .anchor-link::after { opacity: 0; }
}

/* ============================================================================
   WORDMARK
   ============================================================================ */
/* Plain lowercase wordmark, no mark and no tagline. The dot-and-subtitle
   lockup read as two competing pieces of chrome before the nav even began. */
.wordmark {
  font-family: var(--sans); font-weight: 600; font-size: 17px;
  letter-spacing: -0.02em; color: var(--ink); text-transform: lowercase;
}
.wordmark .dot { color: var(--accent); }


/* ============================================================================
   CARDS / SURFACES
   ============================================================================ */
.card {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--r-lg); padding: 22px 24px;
}
.card.soft { background: var(--paper-2); border-color: transparent; }
.card.flat { background: transparent; }
.card.compact { padding: 16px 18px; }
.card.accent { border-color: var(--accent-bd); background: var(--accent-bg); }

/* ============================================================================
   SOURCE CITATION — first-class furniture
   ============================================================================ */
.cite {
  display: inline-flex; align-items: baseline; gap: 7px;
  font-size: 12px; color: var(--ink-2); cursor: pointer; padding: 4px 11px 5px;
  background: var(--paper-2); border: 1px solid var(--rule);
  border-radius: 5px; vertical-align: baseline; max-width: 100%;
  transition: all 0.12s; line-height: 1.35; text-decoration: none;
}
.cite::before { content: ""; align-self: center; flex: none; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
.cite:hover { background: var(--accent-bg); border-color: var(--accent-bd); }





/* ---- Evidence trail (investigation "what this rests on") --------------- */




.tl-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); }




/* ---- Scope flag (human-readable) -------------------------------------- */


/* ---- Source index (the evidence, on /sources) ------------------------- */
















/* an inline number marker for footnoted sources */
.cite-n {
  font-family: var(--mono); font-size: 10px; font-weight: 600;
  color: var(--accent); vertical-align: super; line-height: 0;
  padding: 0 1px; cursor: pointer;
}

/* ============================================================================
   CHIPS / TAGS
   ============================================================================ */
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.01em;
  padding: 2px 8px; border: 1px solid var(--rule); border-radius: 4px;
  color: var(--ink-3); background: var(--surface);
  font-variant-numeric: tabular-nums; font-weight: 500; white-space: nowrap;
}

.chip.confirmed { color: var(--confirmed); border-color: var(--conf-bd); background: var(--conf-bg); }
.chip.draft { color: var(--ink-mute); border-style: dashed; border-color: var(--ink-faint); background: transparent; }
.chip.contested { color: var(--contested); border-color: var(--accent-bd); background: var(--accent-bg); }
.chip.correction { color: var(--correction); border-color: var(--corr-bd); background: var(--corr-bg); }
.chip.accent { color: var(--accent-2); border-color: var(--accent-bd); background: var(--accent-bg); }
.chip.solid { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.chip.kind { text-transform: uppercase; letter-spacing: 0.06em; font-size: 9.5px; color: var(--ink-mute); }

/* ============================================================================
   MARKER (numeric)
   ============================================================================ */
.marker {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--paper-2); color: var(--ink-mute); font-family: var(--mono);
  font-weight: 500; font-size: 11px; width: 22px; height: 22px;
  border-radius: 5px; font-variant-numeric: tabular-nums; border: 1px solid var(--rule);
  flex-shrink: 0;
}

.marker.accent { background: var(--accent); color: #fff; border-color: var(--accent); }

/* ============================================================================
   BUTTONS
   ============================================================================ */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  font-family: var(--sans); font-size: 13.5px; font-weight: 500; letter-spacing: -0.01em;
  padding: 8px 15px; border: 1px solid var(--rule); border-radius: var(--r-sm);
  color: var(--ink); background: var(--surface); cursor: pointer;
  transition: background .12s, color .12s, border-color .12s; white-space: nowrap;
}
.btn:hover { background: var(--paper-2); border-color: var(--ink-faint); }
.btn.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.btn.primary:hover { background: var(--ink-2); }
.btn.accent { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn.accent:hover { background: var(--accent-2); border-color: var(--accent-2); }
.btn.ghost { border-color: transparent; background: transparent; color: var(--ink-3); }
.btn.ghost:hover { background: var(--paper-2); color: var(--ink); }

.btn.full { width: 100%; }
.btn.on { background: var(--paper-2); border-color: var(--ink-faint); color: var(--ink); }

/* ============================================================================
   LINKS (inline prose)
   ============================================================================ */
.link {
  color: var(--ink); border-bottom: 1px solid var(--accent-bd);
  transition: border-color .12s, color .12s;
}
.link:hover { border-bottom-color: var(--accent); color: var(--accent-2); }

/* ============================================================================
   APP SHELL + TOP STRIP
   ============================================================================ */












/* ============================================================================
   PUBLIC NAV + FOOTER
   ============================================================================ */








/* Trust strip — the firewall, made legible on every public page.
   Sits between the body and the footer. Plain language only; no jargon
   leaks like "the firewall" or "neutral_fact". The check-mark is a real
   character, not an icon, so it survives no-JS / no-CSS / RSS readers. */














/* ============================================================================
   SCOPE PATH (breadcrumb)
   ============================================================================ */
.scope {
  display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute);
}
.scope a { cursor: pointer; transition: color .12s; }
.scope a:hover { color: var(--accent); }
.scope .arr { color: var(--ink-faint); }
.scope .cur { color: var(--ink); }

/* ============================================================================
   CONTAINERS / LAYOUT
   ============================================================================ */
.container { max-width: 1100px; margin: 0 auto; padding: 44px 32px 80px; }
.container.reading { max-width: 920px; }




/* ============================================================================
   QUESTION-HEADED SECTION — the citable rhythm
   ============================================================================ */










/* ============================================================================
   KEY-FACTS BOX (answer capsule)
   ============================================================================ */









/* ============================================================================
   COVERAGE BAND
   ============================================================================ */
.coverage { display: flex; flex-direction: column; gap: 10px; }







/* ============================================================================
   CONNECTIONS (typed backlinks)
   ============================================================================ */








.conn-inline { display: flex; flex-wrap: wrap; gap: 6px; }
.conn-pill {
  font-size: 12.5px; padding: 4px 10px; border: 1px solid var(--rule); border-radius: 999px;
  color: var(--ink-2); cursor: pointer; background: var(--surface); transition: all .12s;
}
.conn-pill:hover { border-color: var(--accent-bd); color: var(--accent-2); background: var(--accent-bg); }
.conn-pill .rel { color: var(--ink-mute); font-family: var(--mono); font-size: 10.5px; }

/* ============================================================================
   THE SEAM — facts → signed analysis
   ============================================================================ */
.seam {
  display: flex; align-items: center; gap: 16px; margin: 16px 0 4px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-mute);
}
.seam::before, .seam::after { content: ""; flex: 1; height: 1px; background: var(--rule); }

.analysis {
  position: relative; padding: 30px 0 8px;
}
/* subtle */
.analysis[data-seam="subtle"] { }
/* clear: byline + tinted left edge */
.analysis[data-seam="clear"] { padding-left: 22px; border-left: 2px solid var(--accent-bd); }
/* strong: full inset panel on a different ground. Used to carry a
   [data-mode="public"] override to a hardcoded light hex — a leftover
   from before the --pub-*/--op-* unification above (one register, one
   brand); this component was never actually used on a public page until
   the fabric redesign's signed-analysis panel (Phase 6), which is what
   surfaced the stale override. Removed — --paper-2 alone is correct in
   every mode now. */
.analysis[data-seam="strong"] {
  background: var(--paper-2); border: 1px solid var(--rule); border-radius: var(--r-lg);
  padding: 32px 34px; margin-top: 12px;
}
.analysis .byline {
  display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute);
}
.analysis .byline .sig { font-family: var(--serif); font-style: italic; font-size: 16px; color: var(--ink); }


.analysis .opinion-tag {
  display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono);
  font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-2);
  padding: 3px 9px; border: 1px solid var(--accent-bd); border-radius: 999px; background: var(--accent-bg);
}

/* ============================================================================
   ARGUMENT BLOCK (claim + reasons + verdict)
   ============================================================================ */
.argument { border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); }


















/* ============================================================================
   TABLES
   ============================================================================ */
.tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; font-variant-numeric: tabular-nums; }
.tbl th {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--ink-mute); font-weight: 500; text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--rule);
}
.tbl td { padding: 12px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; line-height: 1.45; color: var(--ink-2); }
.tbl tr:hover td { background: var(--paper-2); }
.tbl td.num, .tbl th.num { text-align: right; font-family: var(--mono); }


/* ============================================================================
   FORM CONTROLS
   ============================================================================ */
.input, .select, .textarea {
  width: 100%; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-sm);
  padding: 10px 13px; font-family: var(--sans); font-size: 14px; color: var(--ink); outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.input:focus, .select:focus, .textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.input.mono { font-family: var(--mono); font-size: 13px; }
.textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
.input.big { font-size: 18px; padding: 15px 18px; }

/* ============================================================================
   GAUGE / CONFIDENCE
   ============================================================================ */


.conf-dots { display: inline-flex; gap: 3px; align-items: center; }
.conf-dots .d { width: 6px; height: 6px; border-radius: 50%; background: var(--paper-3); }
.conf-dots .d.on { background: var(--accent); }
.conf-dots .d.hi { background: var(--confirmed); }

/* ============================================================================
   OPERATOR SHELL
   ============================================================================ */



















/* command bar */






/* ============================================================================
   WORKBENCH — claim cards
   ============================================================================ */













/* thread chips */
.thread { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--rule); background: var(--surface); cursor: pointer; transition: all .12s; color: var(--ink-2); }
.thread:hover { border-color: var(--accent-bd); background: var(--accent-bg); }



/* lead cards */




/* diff rows */







/* ============================================================================
   STUDIO segments
   ============================================================================ */
.segment { display: flex; gap: 14px; padding: 15px 0; border-bottom: 1px solid var(--rule-soft); align-items: flex-start; }








/* ============================================================================
   PAGE HEAD
   ============================================================================ */
.page-head { padding-bottom: 26px; border-bottom: 1px solid var(--rule); margin-bottom: 36px; }
.page-head h1 { font-family: var(--sans); font-weight: 600; font-size: clamp(34px, 5vw, 56px); letter-spacing: -0.04em; line-height: 1.04; text-wrap: balance; }
.page-head .ph-sub { font-family: var(--serif); font-size: 19px; color: var(--ink-3); margin-top: 16px; max-width: 760px; line-height: 1.5; text-wrap: pretty; }

/* ============================================================================
   MISC UTILITIES
   ============================================================================ */
.row { display: flex; align-items: center; gap: 12px; }
.row.between { justify-content: space-between; }
.row.wrap { flex-wrap: wrap; }





.muted { color: var(--ink-3); }
.faint { color: var(--ink-mute); }
.ac { color: var(--accent); }
.b { font-weight: 600; }
.italic { font-style: italic; }



.nowrap { white-space: nowrap; }

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes fadeUp { from { transform: translateY(7px); } to { transform: translateY(0); } }



::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--ink-faint); }

/* ============================================================================
   v3.1 — DISCOVERY LAYER + CONNECTIVE FABRIC
   ============================================================================ */

/* ---- Zone identity (a label + one accent token per neighbourhood) ------ */
/* --zone-accent used to resolve to one of five per-section hues. They are
   gone: the publication is two kinds of thing, not five zones, and a site
   that changes its accent colour per section has no accent colour. The
   variable itself stays — it's referenced throughout — and now always
   resolves to the one accent. */
:root {
  --zone-accent: var(--accent);
}
.zone-label {
  display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono);
  font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--zone-accent);
}
.zone-label::before { content: ""; width: 7px; height: 7px; border-radius: 2px; background: var(--zone-accent); }

/* ---- Primary nav: active state keyed to zone --------------------------- */



/* ---- Cards (type-labeled discovery unit) ------------------------------- */
.cardlink {
  display: block; border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface);
  padding: 18px 20px; transition: border-color .14s, transform .14s; height: 100%;
}
.cardlink:hover { border-color: var(--accent-bd); }
.card-type {
  display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 11px;
}
/* The type dot. Every kind used to set its own hue via --td; with one accent
   there is nothing left for six colours to distinguish, and the label beside
   the dot already says what the thing is. The dot is now a neutral marker,
   and --td survives only as the override hook for anything that genuinely
   needs to stand out. */
.card-type::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--td, var(--ink-faint)); }
.card-title { font-family: var(--sans); font-weight: 600; font-size: 19px; letter-spacing: -0.02em; line-height: 1.18; color: var(--ink); margin-bottom: 7px; }
.cardlink:hover .card-title { color: var(--accent-2); }
.card-dek { font-family: var(--serif); font-size: 14.5px; line-height: 1.5; color: var(--ink-3); margin-bottom: 12px; text-wrap: pretty; }
.card-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }




/* ---- Breadcrumb (scope hierarchy) — reuses .scope ---------------------- */
.crumbs { margin-bottom: 18px; }

/* ---- Typed relationship module ----------------------------------------- */







/* ---- "Referenced by" backlinks ----------------------------------------- */







/* ---- Cast list ("Entities in this investigation") ---------------------- */







/* ---- Progressive disclosure (all depth in HTML; CSS-only expand) ------- */
details.more { margin-top: 12px; }
details.more > summary {
  cursor: pointer; list-style: none; font-family: var(--mono); font-size: 12px; letter-spacing: 0.02em;
  color: var(--accent-2); display: inline-flex; align-items: center; gap: 7px; padding: 5px 0;
}
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::before { content: "+"; font-size: 14px; width: 14px; display: inline-block; text-align: center; }
details.more[open] > summary::before { content: "\\2212"; }
details.more[open] > summary { margin-bottom: 12px; }
details.more > summary:hover { color: var(--accent); }

/* ---- Reading-list / row helpers ---------------------------------------- */
.cards-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.cards-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cards-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 820px) { .cards-2, .cards-3 { grid-template-columns: 1fr; } }

/* ---- Latest feed ------------------------------------------------------- */









/* ---- Topic hub --------------------------------------------------------- */


/* ---- Collection / dossier ---------------------------------------------- */







/* ---- Onward / see-also footer block on every page ---------------------- */
.onward { margin-top: 44px; padding-top: 26px; border-top: 1px solid var(--rule); }
.onward .ow-h { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 14px; }

/* ---- Integrity / edition banner ---------------------------------------- */
.banner { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-radius: var(--r); font-size: 13px; margin-bottom: 22px; }

.banner.integrity { background: var(--corr-bg); color: var(--correction); border: 1px solid var(--corr-bd); }

/* ---- Static-site footer extension -------------------------------------- */


:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }

@media (max-width: 880px) {
  
  
  
  
  
  
  
  
  
  .container { padding: 28px 16px 64px; }
  
}

/* ============================================================================
   DOCUMENTED RECORD — the hardened forensic template (Piece kind)
   ============================================================================ */

/* "What this is / is not" framing box */
.dr-frame { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 880px; margin: 26px 0 40px; }
@media (max-width: 640px) { .dr-frame { grid-template-columns: 1fr; } }
.dr-is, .dr-isnot { padding: 16px 18px; border-radius: var(--r); }
.dr-is { background: var(--conf-bg); border: 1px solid var(--conf-bd); }
.dr-isnot { background: var(--paper-2); border: 1px solid var(--rule); }
.dr-is .dr-h { color: var(--confirmed); }
.dr-h { font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px; color: var(--ink-mute); }
.dr-is ul, .dr-isnot ul { margin: 0; padding-left: 18px; }
.dr-is li, .dr-isnot li { font-family: var(--serif); font-size: 15px; line-height: 1.5; margin-bottom: 7px; color: var(--ink-2); }
.dr-is li:last-child, .dr-isnot li:last-child { margin-bottom: 0; }

/* repeating evidentiary cycles */
.cycle { max-width: 880px; margin: 0 0 14px; padding: 24px 0 4px; border-top: 1px solid var(--rule); }










.cc-label { display: block; font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 6px; font-style: normal; }

/* source trail — visible titled sources (the fix for bare codes) */






/* questions this record raises */



/* source log (inline bibliography) */
.srclog { max-width: 880px; margin-top: 8px; border-top: 1px solid var(--rule); }
.srclog-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; padding: 11px 2px; border-bottom: 1px solid var(--rule-soft); scroll-margin-top: 90px; }
.srclog-row:target { background: var(--accent-bg); border-radius: 6px; padding-left: 10px; padding-right: 10px; }
.srclog-main { display: flex; flex-direction: column; gap: 2px; }
.srclog-title { font-family: var(--sans); font-size: 14.5px; font-weight: 500; color: var(--ink); line-height: 1.3; }
.srclog-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.srclog-kind { font-family: var(--mono); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }

/* deposit note — how the record connects to the graph */






/* ============================================================================
   PIECE KINDS — Essay (prose-first §5.8) + Research Report
   ============================================================================ */
/* The two kinds the publication is made of get the accent dot; everything
   else stays neutral. */
.t-essay, .t-research-report, .t-documented-record { --td: var(--accent); }

/* Essay — scaffolding recedes, prose leads */

.essay { font-family: var(--serif); }



.essay p { font-family: var(--serif); font-size: 20px; line-height: 1.66; color: var(--ink-2); margin-bottom: 1.05em; text-wrap: pretty; }


/* Research report — TL;DR → key findings → caveats */
.rr-tldr { max-width: 880px; background: var(--paper-2); border: 1px solid var(--rule); border-radius: var(--r-lg); padding: 20px 24px; margin: 6px 0 6px; }
.rr-h { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-2); margin-bottom: 12px; }
.rr-tldr ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 11px; }
.rr-tldr li { font-family: var(--serif); font-size: 16.5px; line-height: 1.5; color: var(--ink-2); }
.rr-finding { display: grid; grid-template-columns: 44px 1fr; gap: 16px; max-width: 880px; padding: 20px 0; border-bottom: 1px solid var(--rule-soft); }
.rr-fn { font-family: var(--mono); font-size: 13px; color: var(--accent); font-variant-numeric: tabular-nums; padding-top: 4px; }
.rr-fh { font-family: var(--sans); font-weight: 600; font-size: 18px; letter-spacing: -0.01em; line-height: 1.3; color: var(--ink); margin-bottom: 9px; }
.rr-ft { font-family: var(--serif); font-size: 16px; line-height: 1.6; color: var(--ink-2); }
.rr-caveats { max-width: 880px; margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 12px; }
.rr-caveats li { font-family: var(--serif); font-size: 15.5px; line-height: 1.55; color: var(--ink-3); }

/* shared piece provenance note */
.piece-note { max-width: 880px; margin: 34px 0 0; padding: 16px 18px; border: 1px dashed var(--rule); border-radius: var(--r); background: var(--paper-2); }
.piece-note .dr-h { color: var(--ink-mute); display: block; margin-bottom: 8px; }
.piece-note p { font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--ink-3); margin: 0; }
.piece-note a { color: var(--accent-2); border-bottom: 1px solid var(--accent-bd); }

/* ============================================================================
   BROWSE SURFACES — facets, coverage bars, latest grouping
   ============================================================================ */
.facetbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.facet { font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--ink-3); padding: 6px 13px; border: 1px solid var(--rule); border-radius: 999px; background: var(--surface); display: inline-flex; gap: 7px; align-items: center; cursor: pointer; transition: all 0.12s; }
.facet span { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }
.facet:hover { border-color: var(--accent-bd); color: var(--ink); }
.facet.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.facet.on span { color: var(--paper-3); }





/* ============================================================================
   v3.4 — THE LIGHTHOUSE (corpus library · patterns · gap map · timeline)
   ============================================================================ */
/* The violet/green zone accents for patterns and library are gone with the
   rest of the per-zone palette. (The nav rule that lived here keyed off a
   "patterns.html" href — a static filename this server-rendered site has
   never served.) */

/* The .dl-bar download strip is gone — replaced by the sticky .docrail in
   the v3 block at the end of this sheet. Nothing renders these classes. */

/* ---- recurring-actor seed (entity rail) --------------------------------- */











/* ---- recurring-actor leaderboard (library / pattern) -------------------- */









/* ---- library cards ------------------------------------------------------ */











/* ---- chain cards -------------------------------------------------------- */

.working { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); overflow: hidden; }
.working > summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; }
.working > summary::-webkit-details-marker { display: none; }









/* ---- pattern cards / pages ---------------------------------------------- */


.cg-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-faint); display: inline-block; }
.cg-dot.high { background: var(--confirmed); } .cg-dot.medium { background: var(--accent); } 
 


/* ---- constituent documents (pattern page) ------------------------------- */









/* ---- contradiction surface ---------------------------------------------- */













/* ---- disconfirming evidence --------------------------------------------- */




/* ---- evidence-gap matrix ------------------------------------------------ */












.gm.empty { color: var(--ink-faint); font-family: var(--mono); }




 





/* ---- timeline table ----------------------------------------------------- */





/* ---- full report body (rendered from stored Markdown) ------------------- */
















/* ---- topic-hub gap rows (the lighthouse, in context) -------------------- */






/* ============================================================================
   THE RECORD — component layer (from the approved product mockup,
   design/the-record-mockup.html). The shared vocabulary every Record
   surface builds from: the file stamp, coord jump-links, file rows,
   receipt chips (details.rcpt), the Disputed block, People rows,
   the Analysis seam (details.seam-file), the redaction motif.
   Later rules deliberately override earlier same-named classes —
   these are the approved versions.
   ============================================================================ */
/* ---- type utilities ---- */
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.coord {
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute);
  font-variant-numeric: tabular-nums; line-height: 1.7;
  display: flex; align-items: baseline; gap: 4px 9px; flex-wrap: wrap;
}
.coord .sep { color: var(--ink-faint); }
.coord .hi { color: var(--ink-2); }
.coord .ac { color: var(--accent); }
.coord .warn { color: var(--correction); }
.coord a.jump { color: var(--ink-2); border-bottom: 1px solid var(--rule-bright); transition: color .12s, border-color .12s; }
.coord a.jump:hover { color: var(--accent-2); border-bottom-color: var(--accent); }
.coord a.jump.ac { color: var(--accent); }
.sec-h, .fact, details.seam-file, .foundation { scroll-margin-top: 70px; }
.label {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.09em;
  text-transform: uppercase; color: var(--ink-mute);
}
.kicker {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--ink-mute);
  display: inline-flex; align-items: center; gap: 10px;
}
.kicker .live {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
  box-shadow: 0 0 6px 1px rgba(93,139,198,.6);
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }

h1, h2, h3 { font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.serif { font-family: var(--serif); }

/* ---- nav ---- */
.nav {
  position: sticky; top: 0; z-index: 60;
  border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--paper) 86%, transparent);
  backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
  position: relative;
}
.nav::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-bd), transparent);
  opacity: .6;
}
.nav-inner {
  max-width: 1060px; margin: 0 auto; padding: 13px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
}
.wordmark {
  font-weight: 600; font-size: 17px; letter-spacing: -0.02em; white-space: nowrap;
  text-transform: lowercase;
}
.wordmark .dot { color: var(--accent); text-shadow: 0 0 7px rgba(93,139,198,.6); }


.nav-links {
  display: flex; align-items: center; gap: 4px 20px;
  font-size: 13.5px; letter-spacing: -0.01em; color: var(--ink-mute); font-weight: 500;
}
.nav-links a { padding: 3px 0; border-bottom: 1px solid transparent; transition: color .12s; }
.nav-links a:hover { color: var(--ink); }
.nav-links a.active { color: var(--ink); border-bottom-color: var(--accent); }
.nav-search {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; color: var(--ink-mute);
  border: 1px solid var(--rule); border-radius: var(--r-sm);
  padding: 5px 11px; background: var(--surface); transition: all .12s;
}

/* ---- op-topbar: a separate tier ABOVE the public nav, never inside it.
   Distinguishing "what a reader sees" from "what the operator can also
   do" was the whole point of splitting this out. Not .op-strip — that
   name is already investigations.ts's per-page bulk-extract card. ---- */
.op-topbar { background: var(--paper-3); border-bottom: 1px solid var(--rule); }
.op-topbar-inner {
  max-width: 1060px; margin: 0 auto; padding: 6px 20px;
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .02em; color: var(--ink-mute);
}
.op-topbar-inner a { color: var(--ink-mute); transition: color .12s; }
.op-topbar-inner a:hover { color: var(--accent-2); }
.op-topbar-tag { color: var(--accent-2); letter-spacing: .1em; text-transform: uppercase; }
.op-topbar-status { display: inline-flex; align-items: center; gap: 6px; }
.op-topbar-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint); }
.op-topbar-status.live .op-topbar-dot { background: var(--confirmed); }
.op-topbar-right { margin-left: auto; display: flex; gap: 16px; }

/* ---- mobile nav: checkbox-hack toggle, no client JS ---- */
.nav-toggle { position: absolute; opacity: 0; pointer-events: none; }
.nav-burger { display: none; }
@media (max-width: 680px) {
  .nav-inner { position: relative; }
  .nav-burger {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border: 1px solid var(--rule); border-radius: var(--r-sm);
    background: var(--surface); cursor: pointer; flex-shrink: 0; position: relative;
  }
  .nav-burger span, .nav-burger span::before, .nav-burger span::after {
    content: ""; position: absolute; left: 8px; right: 8px; height: 1.5px; background: var(--ink-2);
  }
  .nav-burger span { top: 15px; }
  .nav-burger span::before { top: -5px; }
  .nav-burger span::after { top: 5px; }
  .nav-toggle:focus-visible ~ .nav-burger { outline: 2px solid var(--accent); outline-offset: 2px; }
  .nav-links {
    display: none; flex-direction: column; align-items: flex-start; gap: 2px;
    position: absolute; top: calc(100% + 1px); left: 0; right: 0;
    padding: 8px 20px 16px; background: var(--paper); border-bottom: 1px solid var(--rule);
    z-index: 61;
  }
  .nav-links a { padding: 9px 4px; width: 100%; }
  .nav-links .nav-search { margin-top: 4px; width: 100%; justify-content: space-between; }
  .nav-toggle:checked ~ .nav-links { display: flex; }
}
.nav-search:hover { color: var(--ink-2); border-color: var(--rule-bright); }
.nav-search .q { color: var(--accent); }

/* ---- shell ---- */
/* main sets the page gutter but NOT a width. It used to cap at 1060px, which
   sat inside every .container (1100px) and clamped before that container's
   own max-width could ever apply — so .container.docpage's 1260px was
   unreachable and the document page's reading column came out at 596px
   instead of ~836px. Width belongs to the container that knows what kind of
   page it is. */
main { margin: 0 auto; padding: 34px 20px 70px; }
#app.in { animation: fadeUp .3s cubic-bezier(.22,.61,.36,1) both; }
@keyframes fadeUp { from { opacity: .35; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { #app.in { animation: none; }  .redact-bar::after { animation: none !important; } }

.sec { margin-top: 46px; }
.sec-h {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  border-bottom: 1px solid var(--rule); padding-bottom: 9px; margin-bottom: 18px;
}
.sec-h .label { color: var(--ink-3); }
.sec-h .coord { font-size: 10.5px; }

/* ---- redaction bar motif (one motif, used sparingly) ---- */

@keyframes unredact {
  0% { background: var(--ink-2); color: transparent; box-shadow: none; }
  70% { background: var(--ink-2); color: transparent; box-shadow: 0 0 16px 2px var(--accent); }
  100% { background: transparent; color: inherit; box-shadow: none; }
}



.redact-bar {
  display: inline-block; height: 0.85em; border-radius: 2px;
  background: var(--paper-3); vertical-align: baseline;
  position: relative; overflow: hidden;
}
.redact-bar::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent);
  animation: barsweep 2.4s ease-in-out infinite;
}
@keyframes barsweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

/* ---- home ---- */
.hero { padding: 26px 0 8px; }

.hero h1 {
  font-size: clamp(36px, 7vw, 62px); letter-spacing: -0.035em; line-height: 1.02;
  text-wrap: balance;
}
.hero .thesis {
  font-family: var(--serif); font-size: clamp(16.5px, 2.4vw, 19px); line-height: 1.55;
  color: var(--ink-2); max-width: 620px; margin: 16px 0 14px; text-wrap: pretty;
}

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 500; letter-spacing: -0.01em;
  padding: 9px 16px; border: 1px solid var(--rule); border-radius: var(--r-sm);
  background: var(--surface); transition: all .12s; white-space: nowrap;
}
.btn:hover { background: var(--paper-2); border-color: var(--rule-bright); }
.btn.primary { background: var(--accent-bg); border-color: var(--accent-bd); color: var(--accent-2); box-shadow: 0 10px 26px -14px rgba(93,139,198,.55); }
.btn.primary:hover { border-color: var(--accent); color: var(--ink); }
.btn .arr { font-family: var(--mono); color: var(--accent); }

.depth {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg);
  overflow: hidden; margin-top: 38px;
  box-shadow: 0 24px 48px -28px rgba(0,0,0,.7);
}
@media (max-width: 640px) { .depth { grid-template-columns: 1fr 1fr; } }
.depth .cell { background: var(--surface); padding: 16px 18px 14px;
  box-shadow: inset -1px 0 0 var(--rule), inset 0 -1px 0 var(--rule); }
.depth .n {
  font-family: var(--mono); font-size: clamp(24px, 3.4vw, 32px); font-weight: 500;
  color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1;
}
.depth .cell.killed .n { color: var(--correction); }
.depth .k { margin-top: 5px; }

/* ---- file rows (the cabinet, not cards) ---- */

.file-row {
  display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 6px 26px; padding: 15px 4px; border-bottom: 1px solid var(--rule);
  align-items: baseline; transition: background .12s;
}
.file-row:hover { background: var(--paper-2); }
@media (max-width: 660px) { .file-row { grid-template-columns: 1fr; } }



.file-row .grew { font-size: 12.5px; color: var(--ink-3); line-height: 1.45; }
.file-row .grew .plus { font-family: var(--mono); color: var(--confirmed); }
.file-row .grew .fed { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); display: block; margin-top: 2px; }


.file-row.thin, .cardlink.thin { opacity: .6; transition: opacity .12s; }
.file-row.thin:hover, .cardlink.thin:hover { opacity: 1; }
.file-row .fname .chip.draft, .card-type .chip.draft { margin-left: 8px; vertical-align: middle; }

/* ---- evidence rows ---- */








/* ---- dossier stamp ---- */
.stamp { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; box-shadow: 0 24px 52px -28px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.02); position: relative; }
.stamp-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 18px; border-bottom: 1px solid var(--rule); background: var(--paper-2);
}
.stamp-top .fileno { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; color: var(--ink-mute); }
.stamp-top .kindchip {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent-2); border: 1px solid var(--accent-bd); background: var(--accent-bg);
  border-radius: 3px; padding: 2px 8px;
}
.stamp-body { padding: 22px 18px 20px; }
.stamp-body h1 { font-size: clamp(27px, 5vw, 42px); letter-spacing: -0.03em; line-height: 1.05; text-wrap: balance; }

.stamp-body .desig { font-family: var(--serif); font-size: 16.5px; line-height: 1.55; color: var(--ink-2); margin-top: 13px; max-width: 640px; text-wrap: pretty; }
.stamp-foot { padding: 11px 18px; border-top: 1px solid var(--rule); background: var(--paper-2); }

/* ---- facts + receipts ---- */
.fact { padding: 13px 2px 12px; border-bottom: 1px solid var(--rule); }
.fact-line { display: flex; align-items: baseline; gap: 14px; justify-content: space-between; }
.fact-text { font-size: 14.5px; line-height: 1.55; color: var(--ink-2); max-width: var(--measure); }
.fact-text b { color: var(--ink); font-weight: 550; }



details.rcpt { margin-top: 8px; }
details.rcpt > summary {
  list-style: none; display: inline-flex; align-items: baseline; gap: 7px;
  font-size: 11.5px; color: var(--ink-3); cursor: pointer; padding: 3px 10px 4px;
  background: var(--paper-2); border: 1px solid var(--rule); border-radius: 5px;
  transition: all .12s; line-height: 1.35; max-width: 100%;
}
details.rcpt > summary::-webkit-details-marker { display: none; }
details.rcpt > summary::before {
  content: ""; align-self: center; flex: none; width: 4px; height: 4px;
  border-radius: 50%; background: var(--accent);
}
details.rcpt > summary:hover { background: var(--accent-bg); border-color: var(--accent-bd); color: var(--ink-2); }
details.rcpt > summary .rdoc { font-family: var(--serif); font-weight: 500; color: var(--ink-2); }

details.rcpt[open] > summary { border-color: var(--accent-bd); background: var(--accent-bg); color: var(--accent-2); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.rcpt-body {
  border: 1px solid var(--accent-bd); border-radius: 0 5px 5px 5px;
  background: var(--surface); padding: 14px 16px; max-width: var(--measure);
}
.rcpt-q {
  font-family: var(--serif); font-style: italic; font-size: 15px; line-height: 1.6;
  color: var(--ink); border-left: 2px solid var(--accent); padding-left: 13px;
}
.rcpt-src { margin-top: 11px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); }
.rcpt-src a { color: var(--accent-2); border-bottom: 1px solid var(--accent-bd); }
.rcpt-src a:hover { color: var(--ink); border-bottom-color: var(--accent); }
.rcpt-v { margin-top: 8px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.04em; color: var(--confirmed); }
.rcpt-v::before { content: "✓ "; }

/* ---- contested layer ---- */


.assert { padding: 13px 0; border-bottom: 1px solid var(--cont-bd); }
.assert:last-child { border-bottom: none; }









/* ---- timeline ---- */
.tl { border-left: 1px solid var(--rule-bright); margin-left: 5px; padding-left: 0; }
.tl-item { position: relative; padding: 0 0 18px 24px; }
.tl-item:last-child { padding-bottom: 4px; }
.tl-item::before {
  content: ""; position: absolute; left: -4px; top: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: var(--paper-3); border: 1px solid var(--rule-bright);
}
.tl-item.key::before { background: var(--accent); border-color: var(--accent); }




/* ---- connections ---- */
.conns { display: flex; flex-wrap: wrap; gap: 8px; }
.conn-pill {
  display: inline-flex; align-items: baseline; gap: 8px;
  font-size: 13px; padding: 6px 13px; border: 1px solid var(--rule); border-radius: 999px;
  color: var(--ink-2); background: var(--surface); transition: all .12s; line-height: 1.3;
}
.conn-pill:hover { border-color: var(--accent-bd); color: var(--accent-2); background: var(--accent-bg); }
.conn-pill .rel { color: var(--ink-mute); font-family: var(--mono); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
.conn-pill .rel::after { content: " →"; color: var(--accent); }


/* ---- on file (sources) ---- */
.src-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px 20px; padding: 12px 2px; border-bottom: 1px solid var(--rule); flex-wrap: wrap; }
.src-row .st { font-family: var(--serif); font-size: 15px; color: var(--ink); line-height: 1.4; }
.src-row a.st { border-bottom: 1px solid var(--accent-bd); }
.src-row a.st:hover { color: var(--accent-2); }


/* ---- people rows ---- */







/* ---- the seam + the reading ---- */



.seam {
  display: flex; align-items: center; gap: 16px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-mute);
}
.seam::before, .seam::after { content: ""; flex: 1; height: 1px; background: var(--rule-bright); }




.reading {
  /* The left edge was a 2px accent stripe. It read as a tasteful detail in
     muted blue and reads as a long red bar down the page in the new accent —
     the loudest thing on a page whose job is to be read. */
  margin-top: 26px; border: 1px solid var(--rule); border-left: 2px solid var(--rule-bright);
  border-radius: var(--r-lg); background: var(--paper-2); padding: 26px 22px 24px;
  box-shadow: 0 24px 52px -28px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.02);
}
@media (min-width: 700px) { .reading { padding: 32px 34px 30px; } }
.reading .byline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.reading .byline .sig { font-family: var(--serif); font-style: italic; font-size: 17px; color: var(--ink); }
.reading .intent {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--accent-2); border: 1px solid var(--accent-bd); border-radius: 999px; padding: 2px 9px; background: var(--accent-bg);
}





/* inline claim chip (in signed prose) */




/* complicating box */
.complicates {
  margin-top: 26px; border: 1px solid var(--corr-bd); border-radius: var(--r);
  background: var(--corr-bg); padding: 16px 18px; max-width: var(--measure);
}
.complicates .ch { font-family: var(--mono); font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--correction); margin-bottom: 11px; }
.complicates li { font-size: 13.5px; line-height: 1.55; color: var(--ink-2); margin: 0 0 9px 16px; }
.complicates li:last-child { margin-bottom: 0; }
.complicates li::marker { color: var(--correction); }

/* killed claim */
.killed {
  border: 1px dashed var(--corr-bd); border-radius: var(--r); padding: 13px 16px;
  max-width: var(--measure); background: transparent;
}



/* ---- investigation ---- */






.foundation { margin-top: 48px; border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; box-shadow: 0 24px 48px -28px rgba(0,0,0,.7); }
.foundation .fh { padding: 11px 18px; border-bottom: 1px solid var(--rule); background: var(--paper-2); display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.foundation .fs { padding: 16px 18px; border-bottom: 1px solid var(--rule); }
.foundation .fs:last-child { border-bottom: none; }
.foundation .fs .label { display: block; margin-bottom: 11px; }

.inv-row { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); gap: 6px 26px; padding: 17px 4px; border-bottom: 1px solid var(--rule); transition: background .12s; }
.inv-row:hover { background: var(--paper-2); }
@media (max-width: 660px) { .inv-row { grid-template-columns: 1fr; } }
.inv-row .it { font-size: 17px; font-weight: 550; letter-spacing: -0.015em; color: var(--ink); line-height: 1.3; }



/* ---- doc page ---- */












/* ---- search ---- */









/* ---- method ---- */
.chain { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; box-shadow: 0 24px 48px -28px rgba(0,0,0,.7); }







/* ---- where this leads ---- */
.leads { margin-top: 52px; border-top: 1px solid var(--rule-bright); padding-top: 14px; }
.leads .label { display: block; margin-bottom: 13px; }
.leads .conns { }

/* ---- trust strip + footer ---- */
.trust { border-top: 1px solid var(--rule); background: var(--surface); }
.trust-inner { max-width: 1060px; margin: 0 auto; padding: 20px; display: flex; gap: 13px; align-items: flex-start; }
.trust-mark {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; margin-top: 1px;
  background: var(--conf-bg); color: var(--confirmed); border: 1px solid var(--conf-bd);
  display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
}
.trust p { font-family: var(--serif); font-size: 13.5px; line-height: 1.6; color: var(--ink-3); max-width: 700px; }
.trust a { color: var(--accent-2); white-space: nowrap; }
.trust a:hover { text-decoration: underline; }
.foot { border-top: 1px solid var(--rule); background: var(--paper-2); }
.foot-inner { max-width: 1060px; margin: 0 auto; padding: 26px 20px 34px; display: flex; justify-content: space-between; gap: 16px 40px; flex-wrap: wrap; }
.foot .coord { font-size: 10.5px; }
.foot-links { display: flex; gap: 6px 22px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-mute); }
.foot-links a:hover { color: var(--ink); }


/* misc */
.thin-note {
  border: 1px dashed var(--ink-faint); border-radius: var(--r); padding: 13px 16px;
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute); line-height: 1.7; max-width: var(--measure);
  margin-top: 16px;
}
.thin-note .redact-bar { margin: 0 3px; }

/* ---- thin-file card: "still developing," not "broken" ---- */
.thin-card {
  border-style: solid; padding: 15px 18px 14px; position: relative; overflow: hidden;
}
.thin-card::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(115deg, transparent, transparent 26px, rgba(93,139,198,.03) 26px, rgba(93,139,198,.03) 27px);
}
.thin-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; position: relative; }
.thin-badge { display: inline-flex; align-items: center; gap: 7px; color: var(--accent-2); letter-spacing: .08em; }
.thin-badge-b {
  width: 14px; height: 8px; border-radius: 2px; overflow: hidden; position: relative; background: var(--paper-3);
}
.thin-badge-b::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(93,139,198,.4), transparent);
  animation: barsweep 2.2s ease-in-out infinite;
}
.thin-cad { color: var(--ink-mute); }
.thin-body { position: relative; margin: 0; }

/* ---- the reveal: a real tab bar, not a link dressed as prose ---- */
.reveal-tabs {
  display: flex; border: 1px solid var(--rule); border-radius: var(--r-lg);
  overflow: hidden; margin-bottom: 22px;
  box-shadow: 0 24px 48px -28px rgba(0,0,0,.7);
}
.reveal-tab {
  flex: 1; padding: 13px 18px; text-align: center;
  font-family: var(--mono); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-mute); background: var(--paper-2); position: relative;
  transition: color .15s, background .15s;
}
.reveal-tab + .reveal-tab { border-left: 1px solid var(--rule); }
.reveal-tab:hover { color: var(--ink-2); }
.reveal-tab.on { color: var(--ink); background: var(--surface); }
.reveal-tab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--accent); }
.reveal-draft-note {
  margin: -14px 0 22px; padding: 10px 16px; border-radius: var(--r);
  border: 1px solid var(--corr-bd); background: var(--corr-bg); color: var(--correction);
  font-family: var(--mono); font-size: 12px;
}
a.plain { border-bottom: 1px solid var(--accent-bd); color: var(--ink-2); }
a.plain:hover { color: var(--accent-2); }

/* ============================================================================
   PRINT — investigations and files are meant to be citable forensic
   documents; a reader saving one to PDF should get the argument and its
   receipts, not the chrome around them.
   ============================================================================ */
@media print {
  body { background: #fff; color: #111; }
  .nav, .pub-footer, .foot, .rail, .rail-kbd, .top-strip, .mode-toggle,
  .op-aff, .expand-banner, form, button, .btn, .cmdk-scrim,
  .onward, .more-views { display: none !important; }
  a { color: inherit; text-decoration: underline; }
  .container, .subject-grid, .analysis, .prose, .md-body { max-width: 100% !important; }
  .stamp, .foundation, .depth, .chain { box-shadow: none !important; border: 1px solid #999; }
  .subject-grid { display: block !important; }
  .subject-side { margin-top: 24px; }
}

/* ============================================================================
   v3 — THE PUBLICATION
   The component vocabulary the essays/research/about surfaces are built from.
   Named classes rather than per-renderer inline styles, so the pages share
   one set of decisions instead of drifting into near-identical variants.
   ============================================================================ */

/* ---- page head ---------------------------------------------------------- */
.phead { max-width: 760px; margin: 0 0 44px; }
.eyebrow {
  font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 14px;
}
.phead h1 {
  font-family: var(--sans); font-weight: 700; font-size: clamp(30px, 4vw, 40px);
  line-height: 1.06; letter-spacing: -0.03em; color: var(--ink); margin: 0;
}
.phead-dek {
  margin: 16px 0 0; font-family: var(--serif); font-size: 17.5px; line-height: 1.55;
  color: var(--ink-3); text-wrap: pretty;
}
.sec { max-width: 760px; margin: 0 0 40px; }
.sec h2 {
  font-family: var(--sans); font-weight: 600; font-size: 21px; letter-spacing: -0.015em;
  color: var(--ink); margin: 0 0 14px;
}
.sec h3 { font-family: var(--sans); font-weight: 600; font-size: 15px; color: var(--ink); margin: 0 0 7px; }
.sec p { font-family: var(--serif); font-size: 16.5px; line-height: 1.65; color: var(--ink-2); margin: 0 0 14px; }
.sec p.lead { color: var(--ink); }
.sec code { font-family: var(--mono); font-size: 13px; color: var(--ink-2); }
.sec a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-bd); }
.sec a:hover { color: var(--accent-2); border-bottom-color: var(--accent-2); }
pre.convention {
  margin: 0 0 14px; padding: 16px 18px; background: var(--paper-2); border: 1px solid var(--rule);
  border-radius: var(--r); font-family: var(--mono); font-size: 12.5px; line-height: 1.6;
  color: var(--ink-2); white-space: pre-wrap; overflow-x: auto;
}

/* ---- dense list rows (essays index) ------------------------------------
   date | title + dek | read time. A table in behaviour, links in markup —
   each row is one <a>, so the whole row is the hit area. */
.tbl { border-top: 1px solid var(--rule); max-width: 880px; }
.row {
  display: grid; grid-template-columns: 110px minmax(0,1fr) 76px; gap: 20px;
  align-items: baseline; padding: 17px 12px; border-bottom: 1px solid var(--rule);
  text-decoration: none; transition: background .12s;
}
.row:hover { background: var(--paper-hover); }
.row-date, .row-meta {
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute); white-space: nowrap;
}
.row-meta { text-align: right; }
.row-title {
  font-family: var(--sans); font-weight: 600; font-size: 17px; letter-spacing: -0.015em;
  line-height: 1.25; color: var(--ink); transition: color .12s;
}
.row:hover .row-title { color: var(--accent); }
.row-dek {
  font-family: var(--serif); font-size: 14.5px; line-height: 1.45; color: var(--ink-3);
  margin-top: 4px; text-wrap: pretty;
}
@media (max-width: 760px) {
  .row { grid-template-columns: 1fr; gap: 5px; padding: 15px 4px; }
  .row-meta { display: none; }
}

/* ---- research card grid ------------------------------------------------- */
/* HAIRLINES BELONG TO THE CARD, NOT TO THE CONTAINER.
   These grids drew dividers with a 1px gap over a container painted the rule
   colour, so the gaps themselves were the lines. Neat while every cell is
   covered — and the moment the last row is short, the uncovered cells show
   that rule colour at full size, which is the grey slab that appeared under
   /research. Worst on .rgrid, whose item count is data-driven and whose
   columns are auto-fit, so the final row is almost never full.
   Each card now paints its own right and bottom hairline inside its own box
   and the container carries the CARD colour, so an empty cell has nothing
   left to leak. Clipping still trims the trailing edges onto the border.
   NO BACKTICKS IN THIS FILE'S COMMENTS: it is one big template literal, a
   backtick ends it, and then biome --write reformats the CSS as TypeScript
   and silently eats braces. That is how .docrail lost its mobile rule. */
.rgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(248px, 1fr)); gap: 0;
  background: var(--paper-2); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.rcard {
  display: flex; flex-direction: column; gap: 9px; background: var(--paper-2);
  padding: 20px 21px 17px; text-decoration: none; transition: background .12s;
  box-shadow: inset -1px 0 0 var(--rule), inset 0 -1px 0 var(--rule);
}
.rcard:hover { background: var(--paper-hover); }
.rcard-badge {
  font-family: var(--mono); font-size: 9.5px; font-weight: 500; letter-spacing: 0.15em;
  text-transform: uppercase; color: var(--ink-mute);
}
.rcard-title {
  font-family: var(--sans); font-weight: 600; font-size: 16.5px; line-height: 1.22;
  letter-spacing: -0.015em; color: var(--ink); transition: color .12s;
}
.rcard:hover .rcard-title { color: var(--accent); }
.rcard-note { font-family: var(--serif); font-size: 14px; line-height: 1.45; color: var(--ink-3); text-wrap: pretty; }
.rcard-meta {
  margin-top: auto; padding-top: 10px; display: flex; gap: 12px;
  font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute);
}

/* ---- state strip (homepage) --------------------------------------------
   1px gaps over the rule colour, so the dividers ARE the grid gap. */
.state {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: var(--paper-2);
  border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; margin: 0 0 48px;
}



@media (max-width: 760px) { .state { grid-template-columns: repeat(2, 1fr); } }

/* ---- document layout: content + sticky rail ----------------------------
   The page container widens when it carries a rail: .container.reading is
   920px, which is a good measure for one column and too narrow once 300px
   of it is a sidebar — the prose ends up at ~570px and reads cramped. */
/* The document page: reading card + a rail BESIDE it, not inside it. */
.container.docpage { max-width: 1260px; }
.docgrid { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 40px; align-items: start; }
.docgrid > .reading { margin-top: 0; }
.docrail {
  position: sticky; top: 26px; margin-top: 26px;
  border: 1px solid var(--rule); border-radius: var(--r-lg);
  background: var(--paper-2); padding: 6px 18px 18px;
}
.docrail-row {
  display: flex; justify-content: space-between; gap: 12px; padding: 11px 0;
  border-bottom: 1px solid var(--rule); font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.04em;
}
.docrail-row:last-of-type { border-bottom: none; }
.docrail-row dt { color: var(--ink-mute); text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em; }
.docrail-row dd { margin: 0; color: var(--ink-2); text-align: right; }
.docrail-actions { display: flex; flex-direction: column; gap: 9px; margin-top: 16px; }
/* The primary action carries the accent. A page whose whole point is being
   taken away and cited should not make "take it away" the quietest thing on
   it — both buttons were neutral grey before. */
.docrail-btn {
  display: block; text-align: center; padding: 11px 14px; border: 1px solid var(--rule-bright);
  border-radius: var(--r-sm); font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-2); text-decoration: none;
  transition: border-color .12s, color .12s, background .12s;
}
.docrail-btn:hover { border-color: var(--ink-3); color: var(--ink); background: var(--paper-hover); }
.docrail-btn.primary { border-color: var(--accent-bd); background: var(--accent-bg); color: var(--accent); }
.docrail-btn.primary:hover { border-color: var(--accent); background: rgba(224,67,60,0.16); color: var(--accent-2); }
/* A grid track sized 1fr is minmax(auto, 1fr), so a child wider than the
   viewport EXPANDS THE TRACK instead of scrolling inside it — and every other
   item in the grid stretches with it. That is how promoting a wide table to
   the top of a document pushed the sidebar to 427px inside a 390px phone.
   min-width:0 lets the track shrink and hands the overflow back to
   .table-wrap, which is built to scroll it. */
.docgrid > * { min-width: 0; }
.table-wrap { max-width: 100%; }

@media (max-width: 1000px) {
  .docgrid { grid-template-columns: 1fr; gap: 26px; }
  .docrail { position: static; margin-top: 0; }
}

/* ---- the answer-first block --------------------------------------------
   Also the speakable target in the page's structured data, so it is the one
   passage that has to stand alone. */
.tldr {
  border-left: 2px solid var(--accent); background: var(--accent-bg);
  padding: 16px 20px; margin: 0 0 30px; border-radius: 0 var(--r-sm) var(--r-sm) 0;
}
.tldr-k {
  font-family: var(--mono); font-size: 9.5px; font-weight: 500; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 9px;
}
.tldr p { font-family: var(--serif); font-size: 16.5px; line-height: 1.6; color: var(--ink); margin: 0; text-wrap: pretty; }

/* ---- table of contents -------------------------------------------------- */
.toc { border: 1px solid var(--rule); border-radius: var(--r); padding: 17px 20px; margin: 0 0 34px; background: var(--paper-2); }
.toc-k {
  font-family: var(--mono); font-size: 9.5px; font-weight: 500; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--ink-mute); margin-bottom: 11px;
}
.toc ol { margin: 0; padding-left: 20px; }
.toc li { margin: 0 0 7px; }
.toc a { font-family: var(--sans); font-size: 14.5px; line-height: 1.35; color: var(--ink-2); text-decoration: none; }
.toc a:hover { color: var(--accent); }

/* ---- atom review (operator's library view) -------------------------------
   Proposed findings and questions have no public URL. This is the only place
   they can be seen, so the gate's verdict is shown per question rather than
   left implicit: "held" means the page would be too thin to exist. */
/* The model picker sits inline with the run button. Plain text input, not a
   select: Cloudflare's catalog churns faster than this file does, so a fixed
   list would go stale into a menu of models that no longer exist. */
.atom-form { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.atom-model {
  font-family: var(--mono); font-size: 11px; color: var(--ink); background: var(--paper);
  border: 1px solid var(--rule-bright); border-radius: var(--r-sm); padding: 6px 9px;
  min-width: 0; width: 220px; max-width: 100%;
}
.atom-model::placeholder { color: var(--ink-mute); }
.atom-model:focus { outline: 1px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

.atoms { margin-top: 9px; }
.atom-head { font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.atom-run, .atom-pub {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 4px 10px; border-radius: var(--r-sm); cursor: pointer;
  border: 1px solid var(--rule-bright); background: none; color: var(--ink-2);
}
.atom-run:hover { border-color: var(--ink-3); color: var(--ink); }
.atom-pub { border-color: var(--accent-bd); background: var(--accent-bg); color: var(--accent); }
.atom-pub:hover { border-color: var(--accent); }
.atom-list { list-style: none; margin: 9px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.atom-list li { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; font-size: 12.5px; }
.atom-q { color: var(--ink-2); }

/* ---- the ingestion receipt ----------------------------------------------
   What the system did with a document, in the row of the document it is
   about. The coverage line comes first and is styled to be READ rather than
   skimmed past: a receipt that leads with how many spans were verified, while
   staying quiet about the 75KB nobody looked at, implies a completeness the
   system does not have. */
.rcpt { margin-top: 8px; font-family: var(--mono); font-size: 11px; line-height: 1.55; }
.rcpt-line { color: var(--ink-mute); }
.rcpt-counts { color: var(--ink-3); margin-top: 2px; }
.rcpt-counts b { color: var(--ink-2); font-weight: 600; }
/* The gap is the honest part, so it is the part that carries colour. */
.rcpt-gap { color: var(--accent-2, var(--ink-3)); }
.rcpt-full { color: var(--ink-mute); }
/* Not-extracted is a prompt to act, so it reads as a state rather than as an
   absence of one. */
.rcpt-none { color: var(--ink-3); font-style: italic; }

/* ---- the working-title suggestion ---------------------------------------
   A proposal, styled as one. It sits under a title that is already live and
   already published, so it must not read as an error state — the document is
   fine, its name is just the name of a research session. */
.rn { margin-top: 8px; padding-left: 10px; border-left: 2px solid var(--rule-bright); }
.rn-k {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--ink-mute);
}
.rn-note { font-family: var(--sans); font-size: 11.5px; color: var(--ink-3); margin: 2px 0 6px; }
.rn-form { margin: 0 0 4px; }
.rn-pick {
  display: block; width: 100%; text-align: left; cursor: pointer;
  font-family: var(--serif); font-size: 14px; line-height: 1.35;
  padding: 6px 10px; border: 1px solid var(--rule); border-radius: 5px;
  background: transparent; color: var(--ink-2);
}
.rn-pick:hover { border-color: var(--accent); color: var(--ink); }

/* ---- structure first -----------------------------------------------------
   A research document opening on paragraph one is a wall of text. These three
   blocks put what the document already wrote about itself above the document
   itself. Nothing here is composed by the site, and the labels say so. */

/* The document's own summary, moved to the top. */
.doc-lead {
  margin: 0 0 28px; padding: 18px 20px;
  border: 1px solid var(--rule); border-left: 2px solid var(--accent);
  border-radius: 0 var(--r) var(--r) 0; background: var(--paper-2);
}
.doc-lead-k {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-3);
}
.doc-lead-note {
  font-family: var(--sans); font-size: 12px; color: var(--ink-mute);
  margin: 4px 0 14px;
}
.doc-lead .prose { font-size: 15px; }

/* What the document says it could NOT establish. On a publication whose whole
   argument is provenance this is the most valuable block on the page, so it
   reads as a statement rather than as a warning. */
.doc-gaps {
  margin: 0 0 28px; padding: 16px 20px;
  border: 1px dashed var(--rule-bright); border-radius: var(--r);
}
.doc-gaps-k {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px;
}
.doc-gaps .prose { font-size: 15px; color: var(--ink-3); }

/* The contents rail. */
.doc-toc { margin: 0 0 32px; padding-bottom: 20px; border-bottom: 1px solid var(--rule); }
.doc-toc-k {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-mute); margin-bottom: 10px;
}
.doc-toc ol { margin: 0; padding-left: 1.3em; }
.doc-toc li { margin-bottom: 5px; font-family: var(--sans); font-size: 14px; }
.doc-toc li::marker { color: var(--ink-faint); font-family: var(--mono); font-size: 0.8em; }
.doc-toc a { color: var(--ink-2); text-decoration: none; }
.doc-toc a:hover { color: var(--accent); }

/* ---- topic sections ------------------------------------------------------
   Sections inside an index a reader already asked for. NOT pages: /answers
   and /numbers were both derived index pages and both were removed for
   competing with the documents they indexed. */
.topic-sec { margin: 0 0 44px; }
.topic-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 16px; margin: 0 0 16px; padding-bottom: 9px;
  border-bottom: 1px solid var(--rule);
}
.topic-head h2 {
  margin: 0; font-family: var(--sans); font-weight: 600; font-size: 17px;
  letter-spacing: -0.01em; color: var(--ink);
}
.topic-n {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-mute); white-space: nowrap;
}

/* The operator's own nav entry. Marked with the accent dot so it reads as
   "yours" rather than as a fourth public section — a reader never sees it. */
.nav a.nav-op { color: var(--ink-2); }
.nav a.nav-op::before {
  content: ""; display: inline-block; width: 5px; height: 5px;
  border-radius: 50%; background: var(--accent); margin-right: 6px;
  vertical-align: middle;
}
.nav a.nav-op:hover { color: var(--accent); }

/* ---- leads ---------------------------------------------------------------
   Where the corpus is strange. Each is a query result, not a judgement — the
   system points, it does not narrate. Ordered by recency, which is a list
   order and never a ranking. */
.lead-list { list-style: none; margin: 8px 0 0; padding: 0; }
.lead {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline;
  padding: 5px 0 5px 10px; border-left: 2px solid var(--rule-bright);
  margin-bottom: 4px;
}

.lead-k {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-mute); white-space: nowrap;
}
.lead-sum { font-family: var(--sans); font-size: 12.5px; color: var(--ink-2); }
.lead-other, .lead-receipt {
  font-family: var(--mono); font-size: 10px; color: var(--ink-mute); text-decoration: none;
}
.lead-other:hover, .lead-receipt:hover { color: var(--accent); }
/* Following a lead is the act that grows the corpus, so the affordance reads
   as an invitation rather than as another piece of metadata. */
.lead-dig-form { display: inline; margin: 0; }
.lead-dig {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; cursor: pointer; padding: 3px 9px;
  border: 1px solid var(--rule-bright); border-radius: 4px;
  background: transparent; color: var(--ink-3);
}
.lead-dig:hover { border-color: var(--accent); color: var(--accent); }
.atom-meta { font-family: var(--mono); font-size: 10px; color: var(--ink-mute); white-space: nowrap; }
.atom-live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--confirmed); }
.atom-blocked { font-family: var(--mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); cursor: help; }

/* ---- essay lint (operator's library view) -------------------------------- */
.lint { margin-top: 6px; }
.lint > summary {
  cursor: pointer; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.05em;
  color: var(--accent); list-style: none;
}
.lint > summary::-webkit-details-marker { display: none; }
.lint > summary::before { content: "▸ "; }
.lint[open] > summary::before { content: "▾ "; }
.lint ul { margin: 7px 0 0; padding-left: 18px; }
.lint li { font-size: 12.5px; line-height: 1.45; color: var(--ink-3); margin-bottom: 5px; }

/* ---- findings ------------------------------------------------------------
   A figure, what it measures, when, who reported it, and the sentence it came
   from. The figure leads because that is the part a reader scans for and the
   part a retriever lifts; the quote sits under it as the receipt. */
.findings { margin: 44px 0 0; border-top: 1px solid var(--rule); padding-top: 26px; }
.findings h2 {
  font-family: var(--sans); font-weight: 600; font-size: 20px; letter-spacing: -0.015em;
  color: var(--ink); margin: 0 0 6px;
}
.finding-list { list-style: none; margin: 20px 0 0; padding: 0; display: grid; gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.finding { background: var(--paper-2); padding: 17px 19px; }
.finding-head { display: flex; align-items: baseline; gap: 11px; flex-wrap: wrap; }
.finding-figure {
  font-family: var(--sans); font-weight: 700; font-size: 21px; letter-spacing: -0.02em;
  color: var(--accent); line-height: 1.1;
}
.finding-measures { font-family: var(--sans); font-size: 14.5px; color: var(--ink); }
.finding-meta {
  margin-top: 5px; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--ink-mute);
}

.finding-receipt {
  display: inline-block; margin-top: 9px; font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); text-decoration: none;
}
.finding-receipt:hover { color: var(--accent); }

/* ---- answer pages --------------------------------------------------------
   The question is the H1 and the answer is the first thing under it, because
   retrieval is passage-level and that passage should be complete on its own. */
.container.reading.answer { max-width: 820px; }

.ev { margin: 0 0 22px; padding: 0; }
.ev blockquote {
  margin: 0; padding: 14px 18px; background: var(--paper-2);
  border: 1px solid var(--rule); border-left: 2px solid var(--accent-bd);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-family: var(--serif); font-size: 16.5px; line-height: 1.6; color: var(--ink-2);
  text-wrap: pretty;
}
.ev figcaption {
  margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--ink-mute);
  display: flex; gap: 9px; align-items: center; flex-wrap: wrap;
}
.ev figcaption a { color: var(--ink-3); text-decoration: none; }
.ev figcaption a:hover { color: var(--accent); }
.ev-receipt { color: var(--ink-mute) !important; }

/* ---- the provenance note -------------------------------------------------
   Was .unreviewed, styled in the correction palette because it was a warning:
   "no operator has read this". It is not a warning any more. It names who is
   responsible and how the quotes are checked, which is a credential, so it
   reads as a quiet note rather than an alarm above the headline.

   Still a block rather than a chip, because it has to survive being the first
   thing an answer engine lifts off the page along with the H1. */
.provenance {
  display: block; margin: 0 0 20px; padding: 10px 14px;
  border: 1px solid var(--rule); border-left: 2px solid var(--accent);
  border-radius: var(--r-sm); background: var(--paper-2);
  font-family: var(--mono); font-size: 11.5px; line-height: 1.55;
  letter-spacing: 0.02em; color: var(--ink-2);
}
.provenance a { color: var(--accent); text-decoration: none; white-space: nowrap; }
/* The update date is a ranking input, not a footnote — give it the accent so a
   reader (and the eye scanning a SERP snippet) registers that this is current. */
.updated { color: var(--accent); }

/* ---- the lead passage ----------------------------------------------------
   The document's own words, selected rather than composed, sitting before the
   body so it is the first prose on the page — which is what a passage-level
   retriever reaches for. Quoted styling on purpose: it IS a quote, and it
   carries a receipt. */
.lede { border-left: 2px solid var(--accent); }
.lede p { margin: 0 0 8px; }
.atom-lede {
  display: flex; gap: 12px; align-items: flex-start; justify-content: space-between;
  margin: 0 0 10px; padding: 9px 12px; background: var(--paper-2);
  border: 1px solid var(--rule); border-radius: var(--r-sm);
}
.atom-lede-text {
  font-family: var(--serif); font-size: 13px; line-height: 1.5; color: var(--ink-2);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.atom-lede-act { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
@media (max-width: 620px) { .atom-lede { flex-direction: column; } }

/* ---- /figures ------------------------------------------------------------
   Reuses the .finding vocabulary from the document page rather than inventing
   a second one — it is the same object, shown in a different place. The extra
   row is provenance: which document it came from, and the receipt. */






/* ---- a contested question ------------------------------------------------
   The page nothing else on the internet publishes: two sources in the same
   corpus contradicting each other, both quoted verbatim, both with live
   receipts, and no pretence the matter is settled. Marked, not hidden. */
/* ---- the research queue --------------------------------------------------
   Operator-only. Nothing in it has a public URL — these are the questions the
   corpus raised and cannot answer, each shown with the SIZE of its gap, which
   is what turns a topic into a research prompt. */
.op-queue {
  margin: 0 0 30px; padding: 16px 18px; border: 1px solid var(--rule);
  border-left: 2px solid var(--accent); border-radius: var(--r-sm);
  background: var(--paper-2);
}
.op-queue-head {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--ink-2); margin-bottom: 4px;
}
.op-queue-note {
  display: block; text-transform: none; letter-spacing: 0; margin-top: 4px;
  font-size: 10.5px; color: var(--ink-mute);
}
.op-queue-list { list-style: none; margin: 12px 0 0; padding: 0; }
.op-queue-list li {
  display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap;
  padding: 8px 0; border-top: 1px solid var(--rule);
}

.atom-contested {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--contested); margin-left: 6px;
}

.provenance a:hover { text-decoration: underline; }

/* ---- essay body --------------------------------------------------------- */
.essay-body section { margin: 0 0 30px; scroll-margin-top: 24px; }
.essay-body h2 {
  font-family: var(--sans); font-weight: 600; font-size: 22px; letter-spacing: -0.02em;
  line-height: 1.24; color: var(--ink); margin: 0 0 12px;
}
.essay-body h2 .anchor-link { color: inherit; text-decoration: none; }
.essay-body h2 .anchor-link:hover { color: var(--accent); }
/* The § appears on hover only — every heading is its own URL, and the answer
   in a Q&A structured-data entry links to exactly this anchor. */
.essay-body h2 .anchor-link::after {
  content: " §"; color: var(--accent); opacity: 0; transition: opacity .12s;
}
.essay-body h2:hover .anchor-link::after { opacity: 1; }
.essay-body p {
  font-family: var(--serif); font-size: 17px; line-height: 1.68; color: var(--ink-2);
  margin: 0 0 14px; text-wrap: pretty;
}
/* The opening paragraph of each section is the answer to its heading. */
.essay-body p.lead { color: var(--ink); }
.essay-body sup a { color: var(--accent); text-decoration: none; padding: 0 1px; }
.essay-body a { color: var(--accent); }
.essay-body code { font-family: var(--mono); font-size: 13.5px; color: var(--ink-2); }
.essay-sources { border-top: 1px solid var(--rule); padding-top: 22px; }
.essay-sources ol { margin: 0; padding-left: 22px; }
.essay-sources li {
  font-family: var(--sans); font-size: 14px; line-height: 1.5; color: var(--ink-3);
  margin: 0 0 8px; scroll-margin-top: 24px;
}
.essay-sources li:target { color: var(--ink); }

/* ---- citation box ------------------------------------------------------
   Named .citebox, not .cite — .cite is already an inline citation chip
   (a flex row with a dot ::before, defined near the top of this sheet). */
.citebox { border: 1px solid var(--rule); border-radius: var(--r); padding: 16px 19px; margin: 34px 0 0; }
.citebox-k {
  font-family: var(--mono); font-size: 9.5px; font-weight: 500; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--ink-mute); margin-bottom: 10px;
}
.citebox pre {
  margin: 0 0 12px; padding: 11px 13px; background: var(--paper); border: 1px solid var(--rule);
  border-radius: var(--r-sm); font-family: var(--mono); font-size: 11.5px; line-height: 1.5;
  color: var(--ink-2); white-space: pre-wrap; word-break: break-word; overflow-x: auto;
}
.citebox pre:last-child { margin-bottom: 0; }

/* ---- standards grid (about) --------------------------------------------- */
.std { display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: var(--paper-2);
  border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.std-card { background: var(--paper-2); padding: 19px 21px;
  box-shadow: inset -1px 0 0 var(--rule), inset 0 -1px 0 var(--rule); }
.std-card h3 { margin: 0 0 7px; }
.std-card p { font-family: var(--serif); font-size: 14.5px; line-height: 1.5; color: var(--ink-3); margin: 0; }
@media (max-width: 860px) { .std { grid-template-columns: 1fr; } }

/* ---- newsletter --------------------------------------------------------- */
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.sub-form { display: flex; gap: 8px; margin-top: 12px; max-width: 420px; }
.sub-form input {
  flex: 1; min-width: 0; padding: 10px 13px; background: var(--paper); color: var(--ink);
  border: 1px solid var(--rule-bright); border-radius: var(--r-sm); font-family: var(--sans); font-size: 14px;
}
.sub-form input::placeholder { color: var(--ink-mute); }
.sub-form input:focus { outline: 1px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.sub-form button {
  padding: 10px 17px; border: 1px solid var(--accent); background: var(--accent); color: #fff;
  border-radius: var(--r-sm); font-family: var(--mono); font-size: 11px; letter-spacing: 0.07em;
  text-transform: uppercase; cursor: pointer; white-space: nowrap;
}
.sub-form button:hover { background: var(--accent-2); border-color: var(--accent-2); }
@media (max-width: 520px) { .sub-form { flex-direction: column; } }

`;

// Cheap deterministic hash of the CSS for cache-busting. djb2.
export function stylesHash(): string {
  let h = 5381;
  for (let i = 0; i < STYLES_CSS.length; i++) {
    h = ((h << 5) + h + STYLES_CSS.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
