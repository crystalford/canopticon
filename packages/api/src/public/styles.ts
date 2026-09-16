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
.tabular { font-variant-numeric: tabular-nums; }

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
.section-q {
  font-family: var(--sans); font-weight: 600; letter-spacing: -0.02em;
  line-height: 1.2; font-size: 22px; color: var(--ink); text-wrap: balance;
}

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
.wordmark-sub {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.02em;
  color: var(--ink-mute); font-weight: 400; white-space: nowrap;
  text-transform: uppercase;
}

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
.cite .cite-doc { font-family: var(--serif); font-weight: 500; color: var(--ink); }
.cite:hover .cite-doc { color: var(--accent-2); }
.cite .cite-org { font-family: var(--mono); font-size: 10px; color: var(--ink-mute); white-space: nowrap; }
.cite.solo { font-size: 12px; }

/* ---- Evidence trail (investigation "what this rests on") --------------- */
.trail-step {
  border: 1px solid var(--rule); border-left: 2px solid var(--accent);
  border-radius: 8px; padding: 16px 18px; background: var(--paper);
}
.trail-claim { font-family: var(--serif); font-size: 16.5px; line-height: 1.5; color: var(--ink); margin-bottom: 13px; }
.trail-rail { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.trail-leg { display: inline-flex; align-items: center; gap: 7px; }
.tl-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); }
.trail-arrow { font-family: var(--mono); color: var(--accent); font-size: 15px; }
.trail-ent { font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--accent-2); text-decoration: none; border-bottom: 1px solid var(--accent-bd); }
.trail-ent:hover { color: var(--accent); }

/* ---- Scope flag (human-readable) -------------------------------------- */
.sflag {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.03em;
  color: var(--ink-mute); padding: 2px 9px; border: 1px solid var(--rule);
  border-radius: 999px; background: var(--paper-2);
}

/* ---- Source index (the evidence, on /sources) ------------------------- */
.src-index { display: flex; flex-direction: column; gap: 0; border-top: 1px solid var(--rule); }
.src-entry {
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 28px;
  padding: 20px 2px; border-bottom: 1px solid var(--rule-soft); scroll-margin-top: 90px;
}
.src-entry:target { background: var(--accent-bg); border-radius: 8px; padding-left: 14px; padding-right: 14px; }
.src-head { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.src-kind { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--accent-2); }
.src-code { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); }
.src-title { font-family: var(--serif); font-size: 17px; line-height: 1.4; color: var(--ink); margin-bottom: 5px; }
.src-org { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.src-cited { display: flex; flex-direction: column; gap: 7px; padding-top: 2px; }
.sc-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); }
.sc-links { display: flex; flex-direction: column; gap: 5px; }
.sc-links a { font-family: var(--serif); font-size: 14.5px; color: var(--accent-2); text-decoration: none; line-height: 1.35; }
.sc-links a:hover { color: var(--accent); }
.src-cited.faint { color: var(--ink-faint); font-family: var(--serif); font-size: 13.5px; font-style: italic; }
@media (max-width: 720px) { .src-entry { grid-template-columns: 1fr; gap: 12px; } }

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
.chip .ic { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
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
.marker.lg { width: 30px; height: 30px; font-size: 12px; }
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
.btn.sm { padding: 5px 11px; font-size: 12.5px; }
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
.app-shell { min-height: 100vh; display: flex; flex-direction: column; position: relative; }

.top-strip {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--rule); padding: 6px 22px;
  font-family: var(--mono); font-size: 11px; color: var(--ink-mute);
  background: var(--paper); position: sticky; top: 0; z-index: 60;
}
.top-strip .ts-left, .top-strip .ts-right { display: flex; gap: 14px; align-items: center; }
.top-strip .dim { color: var(--ink-faint); }
.top-strip .lv { color: var(--ink); }
.mode-toggle { display: inline-flex; gap: 2px; background: var(--paper-2); padding: 2px; border-radius: var(--r-sm); }
.mode-toggle button {
  font-family: var(--sans); font-size: 11.5px; padding: 4px 11px; border-radius: 3px;
  color: var(--ink-mute); cursor: pointer; font-weight: 500; letter-spacing: -0.01em;
}
.mode-toggle button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.op-link { font-family: var(--mono); font-size: 10.5px; color: var(--ink-faint); transition: color .12s; }
.op-link:hover { color: var(--accent-2); }

/* ============================================================================
   PUBLIC NAV + FOOTER
   ============================================================================ */
.pub-nav {
  position: sticky; top: 28px; z-index: 55;
  display: flex; align-items: center; justify-content: space-between;
  padding: 15px 32px; border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(8px); gap: 24px;
}
.pub-nav-links {
  display: flex; gap: 26px; font-family: var(--sans); font-size: 13.5px;
  letter-spacing: -0.01em; color: var(--ink-mute); font-weight: 450;
}
.pub-nav-links a { cursor: pointer; transition: color .12s; }
.pub-nav-links a:hover, .pub-nav-links a.active { color: var(--ink); }
.pub-nav-search {
  display: flex; align-items: center; gap: 9px; font-family: var(--sans);
  font-size: 13px; color: var(--ink-mute); padding: 6px 13px 6px 11px;
  border: 1px solid var(--rule); border-radius: var(--r-sm); cursor: pointer;
  background: var(--surface); min-width: 180px; justify-content: space-between;
}
.pub-nav-search:hover { color: var(--ink); border-color: var(--ink-faint); }
.pub-nav-search kbd {
  font-family: var(--mono); font-size: 10px; color: var(--ink-faint);
  border: 1px solid var(--rule); border-radius: 3px; padding: 0 4px;
}

/* Trust strip — the firewall, made legible on every public page.
   Sits between the body and the footer. Plain language only; no jargon
   leaks like "the firewall" or "neutral_fact". The check-mark is a real
   character, not an icon, so it survives no-JS / no-CSS / RSS readers. */
.trust-strip {
  margin-top: 56px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
}
.trust-strip .trust-inner {
  max-width: 880px; margin: 0 auto; padding: 22px 32px;
}
.trust-strip .trust-line {
  display: flex; gap: 14px; align-items: flex-start;
}
.trust-strip .trust-mark {
  flex-shrink: 0;
  display: inline-flex; justify-content: center; align-items: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--confirmed-bg, #e7f0e6);
  color: var(--confirmed, #2f7d52);
  font-size: 15px; font-weight: 700;
  margin-top: 1px;
}
.trust-strip p {
  margin: 0;
  font-family: var(--serif);
  font-size: 14.5px; line-height: 1.6;
  color: var(--ink-2);
  max-width: 740px;
}
.trust-strip a {
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}
.trust-strip a:hover { text-decoration: underline; }

.pub-footer {
  border-top: 1px solid var(--rule); margin-top: 0;
  padding: 40px 32px; background: var(--paper-2);
}
.pub-footer .inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
.pub-footer-links { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 13px; color: var(--ink-mute); }
.pub-footer-links a { cursor: pointer; }
.pub-footer-links a:hover { color: var(--ink); }

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
.doc-grid { display: grid; grid-template-columns: minmax(0,1fr) 300px; gap: 56px; align-items: start; }
.doc-grid .rail { position: sticky; top: 96px; display: flex; flex-direction: column; gap: 22px; }
@media (max-width: 900px) { .doc-grid { grid-template-columns: 1fr; } .doc-grid .rail { position: static; } }

/* ============================================================================
   QUESTION-HEADED SECTION — the citable rhythm
   ============================================================================ */
.qsection { padding: 30px 0; border-top: 1px solid var(--rule-soft); }
.qsection:first-of-type { border-top: none; padding-top: 8px; }
.qsection > .qhead { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.qsection .answer {
  font-family: var(--serif); font-size: 18px; line-height: 1.58; color: var(--ink-2);
  max-width: var(--reading-width); text-wrap: pretty;
}
.qsection .answer .key { color: var(--ink); font-weight: 500; }
.qsection .detail {
  margin-top: 14px; font-family: var(--serif); font-size: 16px; line-height: 1.6;
  color: var(--ink-3); max-width: var(--reading-width);
}
.qsection .detail p { margin-bottom: 0.9em; }
.gap-note {
  display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono);
  font-size: 12px; color: var(--ink-mute); font-style: normal;
  padding: 9px 13px; border: 1px dashed var(--ink-faint); border-radius: var(--r-sm);
  background: transparent;
}
[data-gaps="loud"] .gap-note { color: var(--correction); border-color: var(--corr-bd); background: var(--corr-bg); }

/* ============================================================================
   KEY-FACTS BOX (answer capsule)
   ============================================================================ */
.keyfacts { background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.keyfacts .kf-head {
  padding: 11px 16px; border-bottom: 1px solid var(--rule); background: var(--paper-2);
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute);
}
.kf-row { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--rule-soft); font-size: 13.5px; }
.kf-row:last-child { border-bottom: none; }
.kf-row .k { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.04em; padding-top: 1px; }
.kf-row .v { color: var(--ink-2); line-height: 1.45; }
.kf-row .v a { color: var(--ink); border-bottom: 1px solid var(--accent-bd); }
.kf-row .v a:hover { color: var(--accent-2); }

/* ============================================================================
   COVERAGE BAND
   ============================================================================ */
.coverage { display: flex; flex-direction: column; gap: 10px; }
.coverage-bar { display: flex; gap: 3px; height: 7px; }
.coverage-seg { flex: 1; border-radius: 2px; background: var(--paper-3); }
.coverage-seg.done { background: var(--confirmed); }
.coverage-seg.partial { background: var(--accent); }
.coverage-seg.empty { background: var(--paper-3); border: 1px dashed var(--ink-faint); }
.coverage-meta { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }

/* ============================================================================
   CONNECTIONS (typed backlinks)
   ============================================================================ */
.conn-group { margin-bottom: 18px; }
.conn-group .ch {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 9px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute);
}
.conn-group.evidence .ch { color: var(--accent-2); }
.conn-item {
  display: block; padding: 11px 14px; border: 1px solid var(--rule); border-radius: var(--r);
  background: var(--surface); margin-bottom: 7px; cursor: pointer; transition: border-color .12s, background .12s;
}
.conn-item:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
.conn-group.evidence .conn-item { border-left: 2px solid var(--accent); }
.conn-item .ci-t { font-size: 13.5px; color: var(--ink); font-weight: 500; line-height: 1.35; margin-bottom: 3px; }
.conn-item .ci-m { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
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
.analysis .atext {
  font-family: var(--serif); font-size: 19px; line-height: 1.62; color: var(--ink-2);
  max-width: var(--reading-width); text-wrap: pretty;
}
.analysis .atext p { margin-bottom: 1.05em; }
.analysis .opinion-tag {
  display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono);
  font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-2);
  padding: 3px 9px; border: 1px solid var(--accent-bd); border-radius: 999px; background: var(--accent-bg);
}

/* ============================================================================
   ARGUMENT BLOCK (claim + reasons + verdict)
   ============================================================================ */
.argument { border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); }
.arg-claim { padding: 18px 22px; border-bottom: 1px solid var(--rule); font-family: var(--serif); font-size: 18px; line-height: 1.45; color: var(--ink); font-weight: 500; }
.arg-reasons { display: grid; grid-template-columns: 1fr 1fr; }
.arg-col { padding: 18px 22px; }
.arg-col.for { border-right: 1px solid var(--rule); }
.arg-col .col-h { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px; }
.arg-col.for .col-h { color: var(--confirmed); }
.arg-col.against .col-h { color: var(--correction); }
.arg-reason { font-size: 14px; line-height: 1.5; color: var(--ink-2); margin-bottom: 12px; padding-left: 14px; position: relative; }
.arg-reason:last-child { margin-bottom: 0; }
.arg-reason::before { content: ""; position: absolute; left: 0; top: 7px; width: 5px; height: 5px; border-radius: 50%; }
.arg-reason.fact::before { background: var(--confirmed); }
.arg-reason.judgment::before { background: var(--ink-faint); border: 1px solid var(--ink-mute); }
.arg-reason .rtag { font-family: var(--mono); font-size: 10px; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.04em; }
.arg-verdict { padding: 18px 22px; border-top: 1px solid var(--rule); background: var(--paper-2); }
.arg-verdict .vh { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-2); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.arg-verdict .vt { font-family: var(--serif); font-size: 17px; line-height: 1.5; color: var(--ink); }
@media (max-width: 680px) { .arg-reasons { grid-template-columns: 1fr; } .arg-col.for { border-right: none; border-bottom: 1px solid var(--rule); } }

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
.tbl .mono-id { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); }

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
.gauge { position: relative; height: 6px; background: var(--paper-3); border-radius: 999px; overflow: hidden; }
.gauge-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--ink); transition: width .5s cubic-bezier(.22,.61,.36,1); }
.conf-dots { display: inline-flex; gap: 3px; align-items: center; }
.conf-dots .d { width: 6px; height: 6px; border-radius: 50%; background: var(--paper-3); }
.conf-dots .d.on { background: var(--accent); }
.conf-dots .d.hi { background: var(--confirmed); }

/* ============================================================================
   OPERATOR SHELL
   ============================================================================ */
.op-shell { display: grid; grid-template-columns: 230px 1fr; min-height: calc(100vh - 27px); }
.op-side {
  border-right: 1px solid var(--rule); padding: 20px 14px; background: var(--paper);
  position: sticky; top: 27px; height: calc(100vh - 27px); overflow-y: auto;
  display: flex; flex-direction: column;
}
.op-brand { padding: 0 8px 16px; border-bottom: 1px solid var(--rule); margin-bottom: 14px; }
.op-nav { display: flex; flex-direction: column; gap: 1px; }
.op-nav .grp { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); padding: 14px 10px 6px; }
.op-nav button {
  display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left;
  padding: 8px 10px; font-size: 13.5px; letter-spacing: -0.01em; color: var(--ink-mute); cursor: pointer;
  border-radius: var(--r-sm); font-weight: 500; transition: background .1s, color .1s; gap: 8px;
}
.op-nav button:hover { color: var(--ink); background: var(--paper-2); }
.op-nav button.on { color: var(--ink); background: var(--paper-2); }
.op-nav button.on .lead-dot { background: var(--accent); }
.op-nav .count { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); font-variant-numeric: tabular-nums; }
.op-nav .lead-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.op-side-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--rule); font-family: var(--mono); font-size: 10.5px; color: var(--ink-faint); display: flex; flex-direction: column; gap: 5px; }

.op-main { display: flex; flex-direction: column; min-width: 0; }
.op-header {
  display: flex; align-items: center; justify-content: space-between; padding: 14px 28px;
  border-bottom: 1px solid var(--rule); background: var(--paper); position: sticky; top: 27px; z-index: 40; gap: 20px;
}
.op-header-title { font-family: var(--sans); font-weight: 600; font-size: 17px; letter-spacing: -0.025em; }
.op-header-coord { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.op-content { padding: 26px 28px 90px; flex: 1; min-width: 0; }

/* command bar */
.cmdbar {
  display: flex; align-items: center; gap: 10px; background: var(--surface);
  border: 1px solid var(--rule); border-radius: var(--r); padding: 9px 13px;
}
.cmdbar:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.cmdbar .prompt { font-family: var(--mono); color: var(--accent); font-size: 14px; }
.cmdbar input { flex: 1; background: none; border: none; outline: none; font-family: var(--sans); font-size: 14px; color: var(--ink); }
.cmdbar input::placeholder { color: var(--ink-faint); }

/* ============================================================================
   WORKBENCH — claim cards
   ============================================================================ */
.claimcard {
  border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface);
  padding: 15px 17px; position: relative; transition: border-color .12s;
}
.claimcard.draft { border-style: dashed; border-color: var(--ink-faint); background: transparent; }
.claimcard.draft .cc-body { opacity: 0.78; }
.claimcard.confirmed { border-left: 2px solid var(--confirmed); }
.claimcard.lowconf .cc-body { opacity: 0.6; }
.cc-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
.cc-body { font-family: var(--serif); font-size: 15.5px; line-height: 1.5; color: var(--ink); }
.cc-span { font-family: var(--serif); font-style: italic; color: var(--ink-3); border-left: 2px solid var(--rule); padding-left: 10px; margin-top: 9px; font-size: 14px; line-height: 1.45; }
.cc-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 11px; }
.cc-register { width: 3px; position: absolute; left: 0; top: 10px; bottom: 10px; border-radius: 2px; }
.cc-register.fact { background: var(--ink-faint); }
.cc-register.analysis { background: var(--accent); }

/* thread chips */
.thread { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--rule); background: var(--surface); cursor: pointer; transition: all .12s; color: var(--ink-2); }
.thread:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
.thread.suggested { border-style: dashed; color: var(--ink-mute); }
.thread .tn { font-family: var(--mono); font-size: 10.5px; color: var(--ink-faint); }

/* lead cards */
.lead-card { border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); padding: 16px 18px; transition: border-color .12s; }
.lead-card:hover { border-color: var(--accent-bd); }
.lead-card.project { border-left: 2px solid var(--accent); }

/* diff rows */
.diff-row { display: flex; align-items: flex-start; gap: 12px; padding: 13px 16px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); margin-bottom: 8px; }
.diff-row .dr-mark { font-family: var(--mono); font-size: 14px; width: 16px; text-align: center; flex-shrink: 0; padding-top: 1px; }
.diff-row.add .dr-mark { color: var(--confirmed); }
.diff-row.entity .dr-mark { color: var(--accent); }
.diff-row.touch .dr-mark { color: var(--ink-mute); }
.diff-row.merge { border-color: var(--accent-bd); background: var(--accent-bg); }

/* ============================================================================
   STUDIO segments
   ============================================================================ */
.segment { display: flex; gap: 14px; padding: 15px 0; border-bottom: 1px solid var(--rule-soft); align-items: flex-start; }
.seg-rec { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--rule); display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all .12s; background: var(--surface); }
.seg-rec:hover { border-color: var(--accent); }
.seg-rec .dot { width: 13px; height: 13px; border-radius: 50%; background: var(--correction); }
.seg-rec.done { border-color: var(--confirmed); }
.seg-rec.done .dot { background: var(--confirmed); border-radius: 2px; width: 11px; height: 11px; }
.waveform { display: flex; align-items: center; gap: 2px; height: 28px; }
.waveform span { width: 2px; background: var(--accent); border-radius: 1px; opacity: 0.55; }

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
.col { display: flex; flex-direction: column; gap: 12px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
@media (max-width: 760px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }
.muted { color: var(--ink-3); }
.faint { color: var(--ink-mute); }
.ac { color: var(--accent); }
.b { font-weight: 600; }
.italic { font-style: italic; }
.text-right { text-align: right; }
.divider { height: 1px; background: var(--rule); margin: 28px 0; border: none; }
.flex-1 { flex: 1; }
.nowrap { white-space: nowrap; }

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes fadeUp { from { transform: translateY(7px); } to { transform: translateY(0); } }
.fade-up { animation: fadeUp 0.34s cubic-bezier(.22,.61,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .fade-up { animation: none; } }

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
.pub-nav-links a.active { color: var(--ink); position: relative; }
.pub-nav-links a.active::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -19px; height: 2px; background: var(--zone-accent);
}

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
.card-feature { padding: 30px 34px; }
.card-feature .card-title { font-size: clamp(26px, 3.4vw, 38px); letter-spacing: -0.03em; line-height: 1.08; }
.card-feature .card-dek { font-size: 18px; max-width: 640px; }

/* ---- Breadcrumb (scope hierarchy) — reuses .scope ---------------------- */
.crumbs { margin-bottom: 18px; }

/* ---- Typed relationship module ----------------------------------------- */
.rel-module { display: flex; flex-direction: column; gap: 14px; }
.rel-group .rl { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 7px; }
.rel-links { display: flex; flex-direction: column; gap: 5px; }
.rel-links a { display: inline-flex; align-items: baseline; gap: 8px; font-size: 14px; color: var(--ink); width: fit-content; border-bottom: 1px solid transparent; }
.rel-links a:hover { color: var(--accent-2); border-bottom-color: var(--accent-bd); }
.rel-links a .rmeta { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); }

/* ---- "Referenced by" backlinks ----------------------------------------- */
.refby { display: flex; flex-direction: column; gap: 7px; }
.refby a {
  display: block; padding: 10px 13px; border: 1px solid var(--rule); border-radius: var(--r);
  background: var(--surface); transition: border-color .12s, background .12s;
}
.refby a:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
.refby .rb-type { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); }
.refby .rb-title { font-size: 13.5px; color: var(--ink); line-height: 1.35; margin-top: 3px; }
.refby.evidence a { border-left: 2px solid var(--accent); }

/* ---- Cast list ("Entities in this investigation") ---------------------- */
.cast { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.cast a { display: block; padding: 13px 15px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); transition: border-color .12s; }
.cast a:hover { border-color: var(--accent-bd); }
.cast .ct-name { font-family: var(--sans); font-weight: 600; font-size: 15px; color: var(--ink); letter-spacing: -0.01em; }
.cast .ct-role { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; line-height: 1.35; }
.cast .ct-kind { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-mute); margin-top: 7px; display: block; }

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
.latest-row { display: grid; grid-template-columns: 96px 130px 1fr auto; gap: 18px; align-items: baseline; padding: 15px 0; border-bottom: 1px solid var(--rule-soft); }
.latest-row .lr-date { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); }
.latest-row .lr-type { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); display: inline-flex; align-items: center; gap: 6px; }
.latest-row .lr-type::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--td, var(--ink-faint)); }
.latest-row .lr-title { font-family: var(--sans); font-weight: 500; font-size: 15.5px; color: var(--ink); letter-spacing: -0.01em; }
.latest-row a.lr-title:hover { color: var(--accent-2); }
.latest-row .lr-tag { font-family: var(--mono); font-size: 10.5px; color: var(--ink-faint); }
@media (max-width: 760px) { .latest-row { grid-template-columns: 1fr; gap: 4px; } }

/* ---- Topic hub --------------------------------------------------------- */
.hub-overview { font-family: var(--serif); font-size: 19px; line-height: 1.6; color: var(--ink-2); max-width: var(--reading-width); }

/* ---- Collection / dossier ---------------------------------------------- */
.coll-item { display: grid; grid-template-columns: 40px 1fr; gap: 18px; padding: 20px 0; border-bottom: 1px solid var(--rule-soft); }
.coll-item .ci-n { font-family: var(--mono); font-size: 13px; color: var(--ink-mute); padding-top: 2px; }
.coll-item .ci-type { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 6px; }
.coll-item .ci-title { font-family: var(--sans); font-weight: 600; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 6px; }
.coll-item a.ci-title:hover { color: var(--accent-2); }
.coll-item .ci-dek { font-family: var(--serif); font-size: 15px; line-height: 1.5; color: var(--ink-3); max-width: 640px; }

/* ---- Onward / see-also footer block on every page ---------------------- */
.onward { margin-top: 44px; padding-top: 26px; border-top: 1px solid var(--rule); }
.onward .ow-h { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 14px; }

/* ---- Integrity / edition banner ---------------------------------------- */
.banner { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-radius: var(--r); font-size: 13px; margin-bottom: 22px; }
.banner.edition { background: var(--paper-2); color: var(--ink-3); border: 1px solid var(--rule); }
.banner.integrity { background: var(--corr-bg); color: var(--correction); border: 1px solid var(--corr-bd); }

/* ---- Static-site footer extension -------------------------------------- */
.pub-footer .foot-cols { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 32px; }
@media (max-width: 760px) { .pub-footer .foot-cols { grid-template-columns: 1fr 1fr; } }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }

@media (max-width: 880px) {
  .op-shell { grid-template-columns: 1fr; }
  .op-side { position: fixed; bottom: 0; left: 0; right: 0; top: auto; height: auto; flex-direction: row; padding: 6px 4px; border-right: none; border-top: 1px solid var(--rule); z-index: 80; overflow-x: auto; }
  .op-brand, .op-side-foot, .op-nav .grp { display: none; }
  .op-nav { flex-direction: row; flex: 1; }
  .op-nav button { flex-direction: column; gap: 3px; padding: 6px 8px; font-size: 10.5px; min-width: 58px; align-items: center; }
  .op-content { padding: 16px 14px 96px; }
  .pub-nav { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
  .pub-nav-links { gap: 14px; font-size: 13px; flex-wrap: wrap; }
  .pub-nav-search { display: none; }
  .container { padding: 28px 16px 64px; }
  .doc-grid { gap: 32px; }
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
.cyc-num { font-family: var(--mono); font-size: 11px; letter-spacing: .08em; color: var(--accent); text-transform: uppercase; }
.cyc-title { font-family: var(--sans); font-weight: 600; letter-spacing: -.02em; font-size: 23px; margin: 6px 0 18px; color: var(--ink); }
.cyc-grid { display: flex; flex-direction: column; gap: 14px; }
.cyc-block { padding: 14px 16px; border-radius: var(--r); background: var(--surface); border: 1px solid var(--rule-soft); }
.cyc-block.did { background: var(--paper-2); }
.cyc-block.promo { background: var(--accent-bg); border-color: var(--accent-bd); }
.cyc-h { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 8px; }
.cyc-block.promo .cyc-h { color: var(--accent-2); }
.cyc-block p { font-family: var(--serif); font-size: 16px; line-height: 1.62; color: var(--ink-2); margin: 0; }
.cyc-contra { max-width: 880px; margin: 6px 0 4px; padding: 14px 18px; border-left: 3px solid var(--ink); background: var(--paper-3); border-radius: 0 6px 6px 0; font-family: var(--serif); font-size: 17px; font-style: italic; line-height: 1.5; color: var(--ink); }
.cc-label { display: block; font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 6px; font-style: normal; }

/* source trail — visible titled sources (the fix for bare codes) */
.srctrail { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.srcref { display: inline-flex; flex-direction: column; gap: 1px; text-decoration: none; background: var(--surface); border: 1px solid var(--rule); border-left: 2px solid var(--accent); border-radius: 4px; padding: 5px 9px; max-width: 280px; transition: border-color .12s; }
.srcref:hover { border-left-color: var(--ink); border-color: var(--accent-bd); }
.srcref-t { font-family: var(--sans); font-size: 12.5px; font-weight: 500; color: var(--ink); line-height: 1.25; }
.srcref-o { font-family: var(--mono); font-size: 10px; color: var(--ink-mute); letter-spacing: .02em; }

/* questions this record raises */
.qraise { max-width: 880px; margin: 8px 0 0; padding-left: 20px; }
.qraise li { font-family: var(--serif); font-size: 17px; line-height: 1.55; color: var(--ink-2); margin-bottom: 14px; }

/* source log (inline bibliography) */
.srclog { max-width: 880px; margin-top: 8px; border-top: 1px solid var(--rule); }
.srclog-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; padding: 11px 2px; border-bottom: 1px solid var(--rule-soft); scroll-margin-top: 90px; }
.srclog-row:target { background: var(--accent-bg); border-radius: 6px; padding-left: 10px; padding-right: 10px; }
.srclog-main { display: flex; flex-direction: column; gap: 2px; }
.srclog-title { font-family: var(--sans); font-size: 14.5px; font-weight: 500; color: var(--ink); line-height: 1.3; }
.srclog-meta { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.srclog-kind { font-family: var(--mono); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }

/* deposit note — how the record connects to the graph */
.dr-deposit { max-width: 880px; margin: 30px 0; padding: 16px 18px; border: 1px dashed var(--rule); border-radius: var(--r); background: var(--paper-2); }
.dr-deposit .dr-h { color: var(--ink-mute); }
.dr-deposit p { font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--ink-3); margin: 0; }
.dr-deposit a { color: var(--accent-2); border-bottom: 1px solid var(--accent-bd); }
.dr-deposit a:hover { color: var(--accent); }

/* ============================================================================
   PIECE KINDS — Essay (prose-first §5.8) + Research Report
   ============================================================================ */
/* The two kinds the publication is made of get the accent dot; everything
   else stays neutral. */
.t-essay, .t-research-report, .t-documented-record { --td: var(--accent); }

/* Essay — scaffolding recedes, prose leads */
.essay-wrap { max-width: 768px; }
.essay { font-family: var(--serif); }
.essay-sec { margin-bottom: 4px; }
.essay-h { font-family: var(--sans); font-weight: 600; font-size: 13px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-mute); margin: 38px 0 16px; }
.essay-sec:first-child .essay-h { margin-top: 4px; }
.essay p { font-family: var(--serif); font-size: 20px; line-height: 1.66; color: var(--ink-2); margin-bottom: 1.05em; text-wrap: pretty; }
.essay-sec:first-child p:first-of-type { font-size: 22px; line-height: 1.6; color: var(--ink); }

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
.rec-cov { margin-top: 13px; height: 4px; border-radius: 2px; background: var(--paper-3); overflow: hidden; }
.rec-cov span { display: block; height: 100%; background: var(--confirmed); border-radius: 2px; }
.latest-month { margin-bottom: 16px; }
.lm-h { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); padding: 16px 0 8px; border-bottom: 1px solid var(--rule); margin-bottom: 2px; }

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
.ra-seed { border: 1px solid var(--rule); border-left: 2px solid var(--accent); border-radius: var(--r); background: var(--surface); padding: 14px 15px; }
.ra-count { display: flex; align-items: baseline; gap: 9px; margin-bottom: 12px; padding-bottom: 11px; border-bottom: 1px solid var(--rule-soft); }
.ra-n { font-family: var(--sans); font-weight: 600; font-size: 28px; letter-spacing: -0.03em; color: var(--ink); line-height: 1; }
.ra-of { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); line-height: 1.35; }
.ra-list { display: flex; flex-direction: column; gap: 8px; }
.ra-list a { display: flex; gap: 9px; align-items: baseline; }
.ra-list a:hover .ra-rt { color: var(--accent-2); }
.ra-ct { font-family: var(--mono); font-size: 11px; color: var(--accent-2); flex-shrink: 0; min-width: 26px; }
.ra-rt { font-size: 12.5px; color: var(--ink-2); line-height: 1.35; }
.ra-more { padding-top: 4px; }

/* ---- recurring-actor leaderboard (library / pattern) -------------------- */
.ra-board { display: flex; flex-direction: column; gap: 7px; }
.ra-bar { display: grid; grid-template-columns: 180px 1fr 34px; gap: 12px; align-items: center; padding: 4px 0; }
.ra-bar:hover .rab-name { color: var(--accent-2); }
.rab-name { font-size: 13.5px; color: var(--ink); font-weight: 500; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rab-track { height: 8px; background: var(--paper-3); border-radius: 999px; overflow: hidden; }
.rab-fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.rab-n { font-family: var(--mono); font-size: 12.5px; color: var(--ink-mute); text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 600px) { .ra-bar { grid-template-columns: 120px 1fr 30px; } }

/* ---- library cards ------------------------------------------------------ */
.lib-card .lc-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 11px; }
.lc-ent { font-family: var(--mono); font-size: 10px; color: var(--ink-3); padding: 2px 7px; border: 1px solid var(--rule); border-radius: 4px; background: var(--paper-2); }
.lc-n { color: var(--accent-2); }
.dep-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dep-chip { display: inline-flex; align-items: baseline; gap: 6px; font-size: 13px; color: var(--ink); padding: 6px 12px; border: 1px solid var(--rule); border-radius: 999px; background: var(--surface); transition: all .12s; }
.dep-chip:hover { border-color: var(--accent-bd); background: var(--accent-bg); color: var(--accent-2); }
.inside-list { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.inside-list li { font-family: var(--serif); font-size: 14.5px; color: var(--ink-2); line-height: 1.4; padding-left: 14px; position: relative; }
.inside-list li::before { content: ""; position: absolute; left: 0; top: 9px; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: .55; }
@media (max-width: 680px) { .inside-list { grid-template-columns: 1fr; } }

/* ---- chain cards -------------------------------------------------------- */
.chain-card { border: 1px solid var(--rule); border-left: 2px solid var(--rule-bright); border-radius: var(--r-lg); background: var(--surface); padding: 20px 22px; }
.working { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); overflow: hidden; }
.working > summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; }
.working > summary::-webkit-details-marker { display: none; }
.working .wk-h { font-family: var(--sans); font-size: 13.5px; font-weight: 500; color: var(--ink); display: inline-flex; align-items: center; gap: 8px; }
.working .wk-h::before { content: "+"; font-family: var(--mono); color: var(--accent); }
.working[open] .wk-h::before { content: "\\2212"; }
.wk-body { padding: 4px 15px 14px; display: flex; flex-direction: column; gap: 7px; }
.wk-pass { display: grid; grid-template-columns: 92px 1fr auto; gap: 12px; align-items: center; padding: 9px 12px; border: 1px solid var(--rule); border-radius: var(--r-sm); background: var(--surface); }
.wk-pass:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
.wk-rel { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent-2); }
.wk-label { font-size: 13px; color: var(--ink); line-height: 1.3; }

/* ---- pattern cards / pages ---------------------------------------------- */
.pattern-feature { border-left: 3px solid var(--rule-bright); padding: 24px 26px; }
.cg-pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-mute); }
.cg-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-faint); display: inline-block; }
.cg-dot.high { background: var(--confirmed); } .cg-dot.medium { background: var(--accent); } .cg-dot.exploratory { background: var(--ink-mute); }
.cg-pill.high { color: var(--confirmed); border-color: var(--conf-bd); } .cg-pill.medium { color: var(--accent-2); border-color: var(--accent-bd); }
.conf-grade { display: inline-flex; align-items: center; gap: 9px; font-family: var(--mono); font-size: 11px; color: var(--ink-mute); padding: 5px 11px; border: 1px solid var(--rule); border-radius: 999px; }

/* ---- constituent documents (pattern page) ------------------------------- */
.con-docs { display: flex; flex-direction: column; gap: 6px; }
.con-docs a { display: grid; grid-template-columns: 130px 1fr auto; gap: 14px; align-items: baseline; padding: 11px 14px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); transition: border-color .12s, background .12s; }
.con-docs a:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
.cd-kind { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-mute); }
.cd-title { font-size: 14px; color: var(--ink); line-height: 1.35; }
.con-docs a:hover .cd-title { color: var(--accent-2); }
.cd-more { padding: 10px 14px; }
@media (max-width: 680px) { .con-docs a { grid-template-columns: 1fr; gap: 4px; } }

/* ---- contradiction surface ---------------------------------------------- */
.contra { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; }
.contra-q { padding: 15px 20px; border-bottom: 1px solid var(--rule); font-family: var(--sans); font-weight: 600; font-size: 17px; letter-spacing: -0.02em; color: var(--ink); }
.contra-grid { display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; }
.contra-side { padding: 18px 20px; }
.contra-side.a { border-right: 1px solid var(--rule); }
.contra-side .cs-label { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-2); margin-bottom: 9px; }
.contra-side p { font-family: var(--serif); font-size: 15.5px; line-height: 1.5; color: var(--ink-2); margin-bottom: 11px; }
.contra-vs { display: flex; align-items: center; justify-content: center; padding: 0 6px; font-family: var(--mono); font-size: 11px; color: var(--ink-faint); background: var(--paper-2); border-left: 1px solid var(--rule); border-right: 1px solid var(--rule); }
.contra-note { padding: 14px 20px; border-top: 1px solid var(--rule); background: var(--paper-2); }
.contra-note .cn-label { font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-mute); display: block; margin-bottom: 6px; }
.contra-note { font-family: var(--serif); font-size: 15px; line-height: 1.5; color: var(--ink-2); }
@media (max-width: 680px) { .contra-grid { grid-template-columns: 1fr; } .contra-side.a { border-right: none; border-bottom: 1px solid var(--rule); } .contra-vs { display: none; } }

/* ---- disconfirming evidence --------------------------------------------- */
.disconfirm { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.disconfirm li { font-family: var(--serif); font-size: 16px; line-height: 1.5; color: var(--ink-2); padding-left: 22px; position: relative; max-width: var(--reading-width); }
.disconfirm li::before { content: "\\2212"; position: absolute; left: 4px; top: 0; color: var(--correction); font-family: var(--mono); }

/* ---- evidence-gap matrix ------------------------------------------------ */
.gm-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: var(--r-lg); }
.gapmatrix { width: 100%; min-width: 720px; }
.gapmatrix th.gm-col { writing-mode: horizontal-tb; font-size: 10px; text-align: center; padding: 12px 8px; color: var(--ink-3); }
.gapmatrix th.gm-row { text-align: left; padding: 12px 14px; white-space: nowrap; }
.gapmatrix th.gm-row a { font-family: var(--sans); font-size: 13.5px; font-weight: 500; color: var(--ink); border-bottom: 1px solid transparent; }
.gapmatrix th.gm-row a:hover { color: var(--accent-2); border-bottom-color: var(--accent-bd); }
.gm-reports { display: block; font-family: var(--mono); font-size: 10px; color: var(--ink-mute); font-weight: 400; margin-top: 2px; }
.gapmatrix td.gm { text-align: center; border-left: 1px solid var(--rule-soft); }
.gapmatrix tr:hover td { background: var(--paper-2); }
.gm-dot { display: inline-block; width: 13px; height: 13px; border-radius: 4px; }
.gm.done .gm-dot { background: var(--confirmed); }
.gm.partial .gm-dot { background: var(--accent); opacity: .55; }
.gm.empty { color: var(--ink-faint); font-family: var(--mono); }
.gm-gapn { text-align: right; padding-right: 14px; }
.gm-gaptag { font-family: var(--mono); font-size: 10px; color: var(--correction); padding: 2px 8px; border: 1px solid var(--corr-bd); border-radius: 999px; background: var(--corr-bg); white-space: nowrap; }
.gm-legend { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 16px; font-family: var(--mono); font-size: 11px; color: var(--ink-mute); align-items: center; }
.gm-legend span { display: inline-flex; align-items: center; gap: 7px; }
.gm-dot.done-d { background: var(--confirmed); } .gm-dot.partial-d { background: var(--accent); opacity:.55; }
.gm-empty-d { color: var(--ink-faint); }
.gaplead { display: block; padding: 14px 16px; border: 1px solid var(--rule); border-left: 2px solid var(--correction); border-radius: var(--r); background: var(--surface); }
.gaplead:hover { border-color: var(--accent-bd); }
.gl-name { font-family: var(--sans); font-weight: 600; font-size: 16px; color: var(--ink); margin-bottom: 4px; }

/* ---- timeline table ----------------------------------------------------- */
.tl-table td { font-size: 14px; }
.tl-table .tl-ents { display: block; margin-top: 4px; font-family: var(--mono); font-size: 11px; }
.tl-table .tl-ents a { color: var(--accent-2); }
.tl-table .tl-ents a:hover { color: var(--accent); }

/* ---- full report body (rendered from stored Markdown) ------------------- */
.md-body { max-width: var(--reading-width); font-family: var(--serif); font-size: 18px; line-height: 1.62; color: var(--ink-2); }
.md-body p { margin-bottom: 1.05em; text-wrap: pretty; }
.md-body > h2:first-child, .md-body > h3:first-child { margin-top: 0; }
.md-body h2 { font-family: var(--sans); font-weight: 600; font-size: 24px; letter-spacing: -0.02em; line-height: 1.2; margin: 1.5em 0 0.5em; color: var(--ink); text-wrap: balance; }
.md-body h3 { font-family: var(--sans); font-weight: 600; font-size: 19px; letter-spacing: -0.01em; margin: 1.3em 0 0.4em; color: var(--ink); }
.md-body h4 { font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-mute); margin: 1.3em 0 0.5em; }
.md-body ul { margin: 0 0 1.05em; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; }
.md-body li { line-height: 1.55; text-wrap: pretty; }
.md-body blockquote { border-left: 2px solid var(--accent-bd); padding: 2px 0 2px 18px; margin: 0 0 1.05em; color: var(--ink-3); font-style: italic; }
.md-body hr { border: none; border-top: 1px solid var(--rule); margin: 2em 0; }
.md-body code { font-family: var(--mono); font-size: 0.85em; background: var(--paper-2); padding: 1px 5px; border-radius: 3px; color: var(--ink); }
.md-body strong { color: var(--ink); font-weight: 600; }
.md-body em { font-style: italic; }
.md-body .tbl { margin: 1.3em 0; max-width: 100%; font-family: var(--sans); }
.md-body .tbl td { font-size: 13.5px; font-family: var(--sans); }

/* ---- topic-hub gap rows (the lighthouse, in context) -------------------- */
.gaprow { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 11px 14px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); flex-wrap: wrap; }
.gr-name { font-family: var(--sans); font-weight: 500; font-size: 14.5px; color: var(--ink); border-bottom: 1px solid transparent; }
.gr-name:hover { color: var(--accent-2); border-bottom-color: var(--accent-bd); }
.gr-open { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.gr-tag { font-family: var(--mono); font-size: 10px; color: var(--correction); padding: 2px 8px; border: 1px solid var(--corr-bd); border-radius: 999px; background: var(--corr-bg); white-space: nowrap; }

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
.wordmark-sub {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em;
  color: var(--ink-mute); text-transform: uppercase; font-weight: 400;
}
@media (max-width: 480px) { .wordmark-sub { display: none; } }
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
@media (prefers-reduced-motion: reduce) { #app.in { animation: none; } .redact span { animation: none !important; color: inherit !important; background: transparent !important; } .redact-bar::after { animation: none !important; } }

.sec { margin-top: 46px; }
.sec-h {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  border-bottom: 1px solid var(--rule); padding-bottom: 9px; margin-bottom: 18px;
}
.sec-h .label { color: var(--ink-3); }
.sec-h .coord { font-size: 10.5px; }

/* ---- redaction bar motif (one motif, used sparingly) ---- */
.redact span {
  background: var(--ink-2); color: transparent; border-radius: 2px;
  animation: unredact .24s ease-out both;
}
@keyframes unredact {
  0% { background: var(--ink-2); color: transparent; box-shadow: none; }
  70% { background: var(--ink-2); color: transparent; box-shadow: 0 0 16px 2px var(--accent); }
  100% { background: transparent; color: inherit; box-shadow: none; }
}
.redact span:nth-child(1) { animation-delay: .45s; }
.redact span:nth-child(2) { animation-delay: .85s; }
.redact span:nth-child(3) { animation-delay: 1.25s; }
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
.hero .openfile { margin: 14px 0 10px; }
.hero h1 {
  font-size: clamp(36px, 7vw, 62px); letter-spacing: -0.035em; line-height: 1.02;
  text-wrap: balance;
}
.hero .thesis {
  font-family: var(--serif); font-size: clamp(16.5px, 2.4vw, 19px); line-height: 1.55;
  color: var(--ink-2); max-width: 620px; margin: 16px 0 14px; text-wrap: pretty;
}
.hero-cta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
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
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); border-radius: var(--r-lg);
  overflow: hidden; margin-top: 38px;
  box-shadow: 0 24px 48px -28px rgba(0,0,0,.7);
}
@media (max-width: 640px) { .depth { grid-template-columns: 1fr 1fr; } }
.depth .cell { background: var(--surface); padding: 16px 18px 14px; }
.depth .n {
  font-family: var(--mono); font-size: clamp(24px, 3.4vw, 32px); font-weight: 500;
  color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1;
}
.depth .cell.killed .n { color: var(--correction); }
.depth .k { margin-top: 5px; }

/* ---- file rows (the cabinet, not cards) ---- */
.file-list { border-top: 1px solid var(--rule); }
.file-row {
  display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 6px 26px; padding: 15px 4px; border-bottom: 1px solid var(--rule);
  align-items: baseline; transition: background .12s;
}
.file-row:hover { background: var(--paper-2); }
@media (max-width: 660px) { .file-row { grid-template-columns: 1fr; } }
.file-row .fname { font-size: 15.5px; font-weight: 550; letter-spacing: -0.015em; color: var(--ink); line-height: 1.3; }
.file-row .fname .kind {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; color: var(--ink-mute);
  border: 1px solid var(--rule); border-radius: 3px; padding: 1px 6px; margin-left: 9px;
  vertical-align: 2px; text-transform: uppercase;
}
.file-row .fcoord { margin-top: 3px; }
.file-row .grew { font-size: 12.5px; color: var(--ink-3); line-height: 1.45; }
.file-row .grew .plus { font-family: var(--mono); color: var(--confirmed); }
.file-row .grew .fed { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); display: block; margin-top: 2px; }
.teaser-more {
  display: block; margin-top: 10px; padding: 8px 2px;
  font-family: var(--mono); font-size: 11.5px; color: var(--accent-2);
}
.teaser-more:hover { color: var(--accent); }
.file-row.thin, .cardlink.thin { opacity: .6; transition: opacity .12s; }
.file-row.thin:hover, .cardlink.thin:hover { opacity: 1; }
.file-row .fname .chip.draft, .card-type .chip.draft { margin-left: 8px; vertical-align: middle; }

/* ---- evidence rows ---- */
.ev-row {
  display: grid; grid-template-columns: minmax(0,1.45fr) minmax(0,1fr); gap: 6px 26px;
  padding: 14px 4px; border-bottom: 1px solid var(--rule); transition: background .12s;
}
.ev-row:hover { background: var(--paper-2); }
@media (max-width: 660px) { .ev-row { grid-template-columns: 1fr; } }
.ev-row .et { font-family: var(--serif); font-size: 15.5px; color: var(--ink); line-height: 1.4; }
.ev-row .eo { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); margin-top: 3px; }
.ev-row .efed { font-size: 12.5px; color: var(--ink-3); line-height: 1.5; }
.ev-row .efed .n { font-family: var(--mono); color: var(--accent-2); }

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
.stamp-body .aka { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); margin-top: 8px; }
.stamp-body .desig { font-family: var(--serif); font-size: 16.5px; line-height: 1.55; color: var(--ink-2); margin-top: 13px; max-width: 640px; text-wrap: pretty; }
.stamp-foot { padding: 11px 18px; border-top: 1px solid var(--rule); background: var(--paper-2); }

/* ---- facts + receipts ---- */
.fact { padding: 13px 2px 12px; border-bottom: 1px solid var(--rule); }
.fact-line { display: flex; align-items: baseline; gap: 14px; justify-content: space-between; }
.fact-text { font-size: 14.5px; line-height: 1.55; color: var(--ink-2); max-width: var(--measure); }
.fact-text b { color: var(--ink); font-weight: 550; }
.fact-id { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); flex-shrink: 0; }
.more-note { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); padding: 12px 2px 0; }

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
details.rcpt > summary .rloc { font-family: var(--mono); font-size: 9.5px; color: var(--ink-mute); white-space: nowrap; }
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
.contested-block {
  border: 1px solid var(--cont-bd); border-left: 3px solid var(--contested);
  border-radius: var(--r); background: var(--cont-bg); padding: 4px 18px 8px; margin-top: 4px;
}
.contested-block .cb-note { font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em; color: var(--contested); padding: 11px 0 2px; text-transform: uppercase; }
.assert { padding: 13px 0; border-bottom: 1px solid var(--cont-bd); }
.assert:last-child { border-bottom: none; }
.assert-who { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; margin-bottom: 6px; }
.assert-who .who { font-size: 13px; font-weight: 550; color: var(--ink); }
.assert-who a.who { border-bottom: 1px solid var(--cont-bd); }
.assert-who a.who:hover { color: var(--contested); }
.assert-who .stance {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--contested); border: 1px solid var(--cont-bd); border-radius: 3px; padding: 1px 6px;
}
.assert-claim { font-family: var(--serif); font-style: italic; font-size: 15px; line-height: 1.55; color: var(--ink-2); max-width: var(--measure); }
.assert-vs { font-size: 12px; color: var(--ink-3); margin-top: 6px; max-width: var(--measure); }
.assert-vs .vs { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; color: var(--ink-mute); text-transform: uppercase; margin-right: 6px; }

/* ---- timeline ---- */
.tl { border-left: 1px solid var(--rule-bright); margin-left: 5px; padding-left: 0; }
.tl-item { position: relative; padding: 0 0 18px 24px; }
.tl-item:last-child { padding-bottom: 4px; }
.tl-item::before {
  content: ""; position: absolute; left: -4px; top: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: var(--paper-3); border: 1px solid var(--rule-bright);
}
.tl-item.key::before { background: var(--accent); border-color: var(--accent); }
.tl-d { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); font-variant-numeric: tabular-nums; }
.tl-t { font-size: 14px; line-height: 1.5; color: var(--ink-2); margin-top: 2px; max-width: var(--measure); }
.tl-t b { color: var(--ink); font-weight: 550; }

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
.conn-pill.contra .rel::after { color: var(--contested); }

/* ---- on file (sources) ---- */
.src-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px 20px; padding: 12px 2px; border-bottom: 1px solid var(--rule); flex-wrap: wrap; }
.src-row .st { font-family: var(--serif); font-size: 15px; color: var(--ink); line-height: 1.4; }
.src-row a.st { border-bottom: 1px solid var(--accent-bd); }
.src-row a.st:hover { color: var(--accent-2); }
.src-row .sm { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); }

/* ---- people rows ---- */
.person-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px 20px; padding: 13px 2px; border-bottom: 1px solid var(--rule); flex-wrap: wrap; transition: background .12s; }
.person-row:hover { background: var(--paper-2); }
.person-row .pn { font-size: 15px; font-weight: 550; color: var(--ink); }
.person-row .prole { display: block; font-size: 13px; color: var(--ink-3); margin-top: 2px; max-width: 520px; line-height: 1.45; }
.person-row .pm { font-family: var(--mono); font-size: 10.5px; color: var(--ink-mute); white-space: nowrap; }
.person-row .pm .go { color: var(--accent); }

/* ---- the seam + the reading ---- */
details.seam-file { margin-top: 50px; }
details.seam-file > summary { list-style: none; cursor: pointer; }
details.seam-file > summary::-webkit-details-marker { display: none; }
.seam {
  display: flex; align-items: center; gap: 16px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-mute);
}
.seam::before, .seam::after { content: ""; flex: 1; height: 1px; background: var(--rule-bright); }
.seam .open-tag { color: var(--accent-2); border: 1px solid var(--accent-bd); background: var(--accent-bg); border-radius: 3px; padding: 2px 9px; letter-spacing: 0.08em; }
details.seam-file > summary:hover .open-tag { color: var(--ink); border-color: var(--accent); }
details.seam-file[open] .open-tag .when-closed { display: none; }
details.seam-file:not([open]) .open-tag .when-open { display: none; }
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
.reading h2.rthesis { font-family: var(--serif); font-weight: 500; font-size: clamp(20px, 3.4vw, 26px); line-height: 1.3; letter-spacing: -0.01em; margin-bottom: 16px; max-width: var(--measure); text-wrap: balance; }
.rtext { font-family: var(--serif); font-size: 17px; line-height: 1.66; color: var(--ink-2); max-width: var(--measure); }
.rtext p { margin-bottom: 1.05em; text-wrap: pretty; }
.rtext p:last-child { margin-bottom: 0; }

/* inline claim chip (in signed prose) */
.cc {
  display: inline-flex; align-items: baseline; gap: 5px; vertical-align: baseline;
  font-family: var(--sans); font-size: 0.72em; font-style: normal; font-weight: 500;
  color: var(--accent-2); background: var(--accent-bg); border: 1px solid var(--accent-bd);
  border-radius: 4px; padding: 1px 7px 2px; white-space: nowrap; transition: all .12s;
  position: relative; top: -1px;
}
.cc:hover { color: var(--ink); border-color: var(--accent); }
.cc .n { font-family: var(--mono); font-size: 0.86em; color: var(--accent); }

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
.killed .kt { font-family: var(--serif); font-size: 14.5px; font-style: italic; color: var(--ink-mute); text-decoration: line-through; text-decoration-color: var(--correction); line-height: 1.55; }
.killed .km { font-family: var(--mono); font-size: 10px; letter-spacing: 0.05em; color: var(--correction); margin-top: 7px; text-transform: uppercase; }

/* ---- investigation ---- */
.inv-head { padding: 10px 0 4px; }
.inv-head h1 { font-size: clamp(32px, 6vw, 54px); letter-spacing: -0.035em; line-height: 1.04; text-wrap: balance; }
.inv-dek { font-family: var(--serif); font-size: clamp(16.5px, 2.4vw, 19px); line-height: 1.55; color: var(--ink-2); max-width: 620px; margin-top: 16px; text-wrap: pretty; }
.inv-body { margin-top: 34px; }
.inv-body .rtext { font-size: 17.5px; }
.inv-body h3 { font-family: var(--mono); font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent-2); font-weight: 500; margin: 30px 0 14px; }
.foundation { margin-top: 48px; border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; box-shadow: 0 24px 48px -28px rgba(0,0,0,.7); }
.foundation .fh { padding: 11px 18px; border-bottom: 1px solid var(--rule); background: var(--paper-2); display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.foundation .fs { padding: 16px 18px; border-bottom: 1px solid var(--rule); }
.foundation .fs:last-child { border-bottom: none; }
.foundation .fs .label { display: block; margin-bottom: 11px; }

.inv-row { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); gap: 6px 26px; padding: 17px 4px; border-bottom: 1px solid var(--rule); transition: background .12s; }
.inv-row:hover { background: var(--paper-2); }
@media (max-width: 660px) { .inv-row { grid-template-columns: 1fr; } }
.inv-row .it { font-size: 17px; font-weight: 550; letter-spacing: -0.015em; color: var(--ink); line-height: 1.3; }
.inv-row .idek { font-family: var(--serif); font-size: 14px; color: var(--ink-3); margin-top: 5px; line-height: 1.5; max-width: 520px; }
.inv-row .status-draft { font-family: var(--mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-mute); border: 1px dashed var(--ink-faint); border-radius: 3px; padding: 2px 7px; }

/* ---- doc page ---- */
.doc-head { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); padding: 20px 18px; }
.doc-head .dk { display: flex; gap: 9px; align-items: baseline; flex-wrap: wrap; margin-bottom: 10px; }
.doc-head h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(21px, 3.6vw, 29px); line-height: 1.25; letter-spacing: -0.01em; text-wrap: balance; }
.doc-head .dcoord { margin-top: 13px; }
.fed-item { display: flex; gap: 12px; align-items: baseline; padding: 11px 2px; border-bottom: 1px solid var(--rule); }
.fed-item .fk { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; flex-shrink: 0; width: 74px; color: var(--confirmed); padding-top: 2px; }
.fed-item.assert .fk { color: var(--contested); }
.fed-item.doss .fk { color: var(--accent-2); }
.fed-item .fv { font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
.fed-item .fv a { color: var(--ink); border-bottom: 1px solid var(--accent-bd); }
.fed-item .fv a:hover { color: var(--accent-2); }

/* ---- search ---- */
.searchbar {
  display: flex; align-items: center; gap: 12px; border: 1px solid var(--rule);
  border-radius: var(--r); background: var(--surface); padding: 14px 18px; margin-top: 18px;
}
.searchbar:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.searchbar .pr { font-family: var(--mono); color: var(--accent); font-size: 16px; }
.searchbar input { flex: 1; background: none; border: none; outline: none; font-size: 16.5px; min-width: 0; }
.searchbar input::placeholder { color: var(--ink-faint); }
.res-group { margin-top: 30px; }
.res-fact { padding: 12px 2px; border-bottom: 1px solid var(--rule); }
.res-none { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); padding: 26px 2px; }

/* ---- method ---- */
.chain { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; box-shadow: 0 24px 48px -28px rgba(0,0,0,.7); }
.chain-step { display: flex; gap: 15px; padding: 15px 18px; border-bottom: 1px solid var(--rule); }
.chain-step:last-child { border-bottom: none; }
.chain-step .cn {
  font-family: var(--mono); font-size: 11px; color: var(--accent); flex-shrink: 0;
  width: 26px; height: 26px; border: 1px solid var(--accent-bd); border-radius: 5px;
  display: inline-flex; align-items: center; justify-content: center; background: var(--accent-bg);
}
.chain-step .ct b { display: block; font-size: 14px; color: var(--ink); font-weight: 550; margin-bottom: 3px; }
.chain-step .ct { font-size: 13.5px; color: var(--ink-3); line-height: 1.55; max-width: 600px; }
.method-quote {
  font-family: var(--serif); font-size: 17px; line-height: 1.62; color: var(--ink-2);
  border-left: 2px solid var(--accent); padding-left: 16px; max-width: var(--measure); text-wrap: pretty;
}

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
.fiction { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); margin-top: 10px; letter-spacing: 0.03em; }

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
.rgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(248px, 1fr)); gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.rcard {
  display: flex; flex-direction: column; gap: 9px; background: var(--paper-2);
  padding: 20px 21px 17px; text-decoration: none; transition: background .12s;
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
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--rule);
  border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; margin: 0 0 48px;
}
.state-cell { background: var(--paper-2); padding: 17px 19px; }
.state-n { font-family: var(--sans); font-weight: 700; font-size: 27px; line-height: 1; color: var(--ink); letter-spacing: -0.02em; }
.state-k {
  margin-top: 7px; font-family: var(--mono); font-size: 8.5px; font-weight: 500;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute);
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
.finding-quote {
  margin: 11px 0 0; padding-left: 13px; border-left: 2px solid var(--rule-bright);
  font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--ink-3);
  text-wrap: pretty;
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
.row-q { grid-template-columns: 1fr; }
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
.fig-list { margin-top: 26px; }
.fig-row { margin-bottom: 18px; }
.fig-prov { margin-top: 7px; font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.fig-prov a { color: var(--ink-2); text-decoration: none; }
.fig-prov a:hover { color: var(--accent); }
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
.std { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--rule);
  border: 1px solid var(--rule); border-radius: var(--r-lg); overflow: hidden; }
.std-card { background: var(--paper-2); padding: 19px 21px; }
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
