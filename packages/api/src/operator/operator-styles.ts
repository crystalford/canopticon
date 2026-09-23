// Operator console stylesheet.
//
// ONE PRODUCT, NOT TWO. This was lifted verbatim from a separate design bundle
// and kept its own everything: its own grounds, its own ink, its own rules,
// its own type, and — most visibly — its own accent, a cool blue, against a
// publication whose stated design is "dark ground, one red accent (#e0433c)".
// Signing in teleported you into a different product, which is exactly the
// seam behind "make it feel like a seamless product".
//
// The fix is deliberately the smallest one that actually closes it. Every
// token NAME below is unchanged, so the thousand lines of operator CSS under
// them keep working untouched; only the VALUES now resolve to the
// publication's palette, and the public vocabulary is aliased alongside so a
// component can be written once and rendered on either surface.
//
// The public tokens are also the better ones on their merits: --ink-3 and
// --ink-mute were explicitly lightened to clear WCAG AA against this ground,
// which the values they replace did not.
//
// Used by operator/layout.ts as inline CSS. Cached via stylesHash() (the
// content is static; the hash is a build-time fingerprint for cache busting
// if/when we ever serve it as a separate stylesheet).

export const OPERATOR_CSS = String.raw`
:root {
  /* grounds — the publication's own, under the operator's names */
  --bg:        #0e1013;
  --panel:     #14171a;
  --raised:    #191d20;
  --raised-2:  #212229;
  --surface:   #131419;
  /* ink */
  --ink:       #eceef2;
  --ink-2:     #ccced6;
  --ink-3:     #a5a8b3;
  --mute:      #787b86;
  --faint:     #484a54;
  --ghost:     #33343c;
  /* rules */
  --rule:      #23272b;
  --rule-2:    #2e3439;
  --rule-bright:#2e3439;
  /* the one accent — cool blue, matching the public site's --op-accent.
     Named --amber for historical reasons (lifted from an older warm-amber
     design bundle); the brand decision that survived is "the dark
     instrument becomes everyone's ground... amber reads warm, the brand
     is cold" (canopticon-renovation.md), so the VALUE is blue even though
     every call site below still reads var(--amber). Same pattern as
     --serif being aliased to the sans stack a few lines up. */
  /* THE BRAND ACCENT, at last. Every call site below still reads var(--amber);
     only the value changed, from the lifted bundle's blue to the red the rest
     of the site has used since the redesign. */
  --amber:     #e0433c;
  --amber-hi:  #ef6a63;
  --amber-bg:  rgba(224,67,60,0.10);
  --amber-bg-2:rgba(224,67,60,0.16);
  --amber-bd:  rgba(224,67,60,0.34);
  /* finding type hues — quiet, used only on badges/edges */
  --c-pattern: #74aef0;  --c-pattern-bg: rgba(116,174,240,0.12);  --c-pattern-bd: rgba(116,174,240,0.28);
  --c-contra:  #d97b6e;  --c-contra-bg:  rgba(217,123,110,0.12);  --c-contra-bd:  rgba(217,123,110,0.30);
  --c-thesis:  #5fc6a2;  --c-thesis-bg:  rgba(95,198,162,0.12);   --c-thesis-bd:  rgba(95,198,162,0.28);
  --c-connect: #a99cea;  --c-connect-bg: rgba(169,156,234,0.12);  --c-connect-bd: rgba(169,156,234,0.28);
  --c-gap:     #6a6c77;  --c-gap-bg:     rgba(120,122,134,0.06);
  /* type — the publication's three faces. --serif is a real serif again:
     the operator reads the same prose the public does, and setting it in the
     sans stack was a workaround for a bundle that had no serif in it. */
  --sans:  'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --mono:  'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
  --rail-w: 168px;

  /* ---- the public vocabulary, aliased --------------------------------
     So a component can be written once against one set of names and render
     on either surface. Everything the publication's stylesheet exposes that
     a shared component might reasonably ask for. */
  --paper:       var(--bg);
  --paper-2:     var(--panel);
  --paper-hover: var(--raised);
  --paper-3:     var(--raised-2);
  --ink-mute:    var(--mute);
  --ink-faint:   var(--faint);
  --rule-soft:   var(--rule);
  --accent:      var(--amber);
  --accent-2:    var(--amber-hi);
  --accent-bg:   var(--amber-bg);
  --accent-bd:   var(--amber-bd);
  --confirmed:   #2f7d52;
  --correction:  #b0402c;
  --r-sm: 4px;
  --r:    7px;
  --r-lg: 11px;
  --shell: 1180px;
  --gutter: 32px;
  --measure: 64ch;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
/* Make [hidden] always win against any later display: rule. The browser's
   default [hidden]{display:none} loses to any author display: declaration on
   the same selector — caught us once with .dz-uploading flashing on every
   page load. */
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  background: var(--bg); color: var(--ink); font-family: var(--sans);
  font-size: 14px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility; overflow: hidden;
  font-feature-settings: "ss01","cv01";
}
button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; padding: 0; }
a { color: inherit; text-decoration: none; }
input, textarea { font: inherit; color: inherit; }
/* SVG icons are sized explicitly (width/height attrs); this is a defensive
   floor so a stray icon in an unconstrained flex/grid cell can never balloon. */
svg { flex-shrink: 0; max-width: 100%; }
::selection { background: var(--amber-bg-2); color: var(--amber-hi); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--rule-2); border-radius: 10px; border: 3px solid var(--surface); }
::-webkit-scrollbar-thumb:hover { background: var(--rule-bright); }

.mono { font-family: var(--mono); font-feature-settings: "tnum","zero"; }
.serif { font-family: var(--serif); }

/* ---- splash while React mounts ---- */
#root:empty::after {
  content: "canopticon."; position: fixed; inset: 0; display: flex;
  align-items: center; justify-content: center; font-family: var(--sans);
  font-weight: 600; font-size: 22px; letter-spacing: -0.04em; color: var(--ink-3);
}

/* ========================================================================
   APP SHELL
   ======================================================================== */
.app { display: flex; height: 100vh; width: 100vw; }

/* ---- nav rail ---- */
.rail {
  width: var(--rail-w); flex-shrink: 0; background: var(--panel);
  border-right: 1px solid var(--rule); display: flex; flex-direction: column;
  padding: 16px 12px 12px;
}
.rail-logo {
  font-family: var(--sans); font-weight: 600; font-size: 16px; letter-spacing: -0.04em;
  color: var(--ink); padding: 4px 10px 18px; display: flex; align-items: baseline; gap: 1px;
}
.rail-logo .dot { color: var(--amber); }
.rail-nav { display: flex; flex-direction: column; gap: 2px; }
.rail-status {
  display: flex; align-items: center; gap: 9px; padding: 8px 10px;
  color: var(--ink-3); font-size: 12px; font-family: var(--mono);
  letter-spacing: .04em; text-transform: uppercase;
}
.rail-status-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--amber);
  box-shadow: 0 0 0 3px var(--amber-bg); animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
}
.rail-item {
  display: flex; align-items: center; gap: 11px; padding: 8px 10px;
  border-radius: 7px; color: var(--ink-3); font-size: 13.5px; font-weight: 500;
  position: relative; transition: background .14s, color .14s; text-align: left; width: 100%;
}
.rail-item svg { width: 16px; height: 16px; flex-shrink: 0; opacity: .85; }
.rail-item .lbl { flex: 1; }
.rail-item:hover { background: var(--raised); color: var(--ink-2); }
.rail-item.active { background: var(--amber-bg); color: var(--amber-hi); }
.rail-item.active svg { opacity: 1; color: var(--amber); }
.rail-item .nub {
  width: 6px; height: 6px; border-radius: 50%; background: var(--amber);
  box-shadow: 0 0 0 3px var(--amber-bg); animation: pulse 1.8s ease-in-out infinite;
}
.rail-kbd {
  margin: 16px 4px 0; padding: 9px 11px; border: 1px solid var(--rule-2); border-radius: 8px;
  display: flex; align-items: center; gap: 9px; color: var(--mute); font-size: 12px;
  transition: border-color .14s, color .14s; width: calc(100% - 8px);
}
.rail-kbd:hover { border-color: var(--rule-bright); color: var(--ink-3); }
.rail-kbd svg { width: 13px; height: 13px; }
.rail-kbd .keys { margin-left: auto; display: flex; gap: 3px; }
.kkey {
  font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); background: var(--raised);
  border: 1px solid var(--rule-2); border-radius: 4px; padding: 1px 5px; line-height: 1.4;
}
.rail-foot { margin-top: auto; padding: 12px 4px 2px; border-top: 1px solid var(--rule); }
.rail-foot-item {
  display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px;
  font-size: 12px; color: var(--mute); transition: color .14s, background .14s; width: 100%;
}
.rail-foot-item:hover { color: var(--ink-3); background: var(--raised); }
.rail-foot-item.link { color: var(--c-pattern); }
.rail-foot-item svg { width: 14px; height: 14px; flex-shrink: 0; }

/* ---- stage ---- */
.stage { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.topbar {
  height: 52px; flex-shrink: 0; border-bottom: 1px solid var(--rule);
  display: flex; align-items: center; gap: 14px; padding: 0 22px; background: var(--bg);
}
.topbar h1 { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
.topbar .sub { font-size: 12px; color: var(--mute); }
.topbar .spacer { flex: 1; }
.surface { flex: 1; overflow-y: auto; overflow-x: hidden; }
.wrap { max-width: 760px; margin: 0 auto; padding: 26px 26px 80px; }
.wrap.wide { max-width: 920px; }

/* ---- generic bits ---- */
.eyebrow {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--mute);
}
.coord { font-family: var(--mono); font-size: 11.5px; color: var(--mute); font-feature-settings: "tnum"; }

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes risein { from { transform: translateY(7px); } to { transform: none; } }
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes chippop { from { transform: scale(.88); } to { transform: none; } }
@keyframes flagout { to { opacity: 0; transform: translateX(10px); height: 0; margin: 0; padding: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes barfill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes glowpulse { 0%,100% { box-shadow: 0 0 0 0 var(--amber-bg); } 50% { box-shadow: 0 0 0 6px rgba(224,154,58,0.05); } }

/* ========================================================================
   FEED
   ======================================================================== */
.dropzone {
  /* MUST be block: <label> is display:inline by default, and an inline box
     wrapping the block dz-* children paints its background/border as broken
     fragments at each line box — that was the stray "blocks" artifact. */
  display: block;
  border: 1px solid var(--rule-2); border-radius: 12px; padding: 46px 30px;
  text-align: center; cursor: pointer; transition: border-color .16s, background .16s;
  background: var(--panel);
}
.dropzone:hover { border-color: var(--amber-bd); background: var(--amber-bg); }
.dropzone.over { border-color: var(--amber); background: var(--amber-bg-2); }
.dz-ico {
  width: 46px; height: 46px; margin: 0 auto 16px; border-radius: 50%;
  border: 1px solid var(--rule-bright); display: flex; align-items: center; justify-content: center;
  color: var(--amber); transition: transform .2s;
}
.dropzone:hover .dz-ico, .dropzone.over .dz-ico { transform: translateY(-2px); border-color: var(--amber-bd); }
.dz-ico svg { width: 20px; height: 20px; }
.dz-1 { font-size: 16px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; margin-bottom: 5px; }
.dz-2 { font-size: 12.5px; color: var(--ink-3); }
.dz-3 { font-size: 11.5px; color: var(--mute); margin-top: 12px; max-width: 360px; margin-left: auto; margin-right: auto; line-height: 1.55; }

.tray-label { font-size: 11px; color: var(--mute); margin: 22px 2px 9px; display: flex; align-items: center; gap: 8px; }
.tray-label::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
.tray { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tray-card {
  border: 1px solid var(--rule-2); border-radius: 9px; padding: 11px 13px; text-align: left;
  display: flex; flex-direction: column; gap: 4px; transition: border-color .14s, background .14s, transform .12s;
  background: var(--panel);
}
.tray-card:hover { border-color: var(--amber-bd); background: var(--raised); transform: translateY(-1px); }
.tray-card:disabled { opacity: .4; cursor: default; transform: none; }
.tray-card .tc-top { display: flex; align-items: center; gap: 8px; }
.tray-card .tc-name { font-family: var(--mono); font-size: 12px; color: var(--ink-2); font-weight: 500; }
.tray-card .tc-size { font-family: var(--mono); font-size: 10.5px; color: var(--faint); margin-left: auto; }
.tray-card .tc-blurb { font-size: 11.5px; color: var(--mute); line-height: 1.45; }
.tc-doticon { width: 13px; height: 13px; color: var(--ink-3); flex-shrink: 0; }

/* ---- digestion theater ---- */
.digest {
  border: 1px solid var(--amber-bd); border-radius: 12px; overflow: hidden;
  background: var(--panel); animation: risein .3s ease; margin-bottom: 4px;
}
.digest-head {
  padding: 13px 16px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid var(--rule);
}
.digest-head .spin {
  width: 15px; height: 15px; border: 2px solid var(--rule-bright); border-top-color: var(--amber);
  border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
}
.digest-head .done-check { width: 16px; height: 16px; color: var(--c-thesis); flex-shrink: 0; }
.digest-head .dh-name { font-family: var(--mono); font-size: 13px; color: var(--ink); font-weight: 500; }
.digest-head .dh-status { margin-left: auto; font-size: 11.5px; color: var(--amber); font-family: var(--mono); }
.digest-head .dh-status.ok { color: var(--c-thesis); }
.digest-bar { height: 2px; background: var(--rule); position: relative; overflow: hidden; }
.digest-bar i { position: absolute; inset: 0; display: block; width: 100%; height: 100%; background: linear-gradient(90deg, var(--amber), var(--amber-hi)); transform-origin: left; }
.digest-steps { padding: 6px 16px 8px; }
.dstep { display: flex; align-items: center; gap: 11px; padding: 7px 0; font-size: 12.5px; color: var(--faint); transition: color .25s; }
.dstep.run { color: var(--ink-2); }
.dstep.done { color: var(--ink-3); }
.dstep .di {
  width: 15px; height: 15px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.dstep .di .ring { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--ghost); }
.dstep.run .di .ring { border-color: var(--amber); border-top-color: transparent; animation: spin .7s linear infinite; }
.dstep.done .di svg { width: 14px; height: 14px; color: var(--c-thesis); }
.dstep .dlabel { font-family: var(--mono); font-size: 11.5px; flex: 1; }
.dstep .dresult { font-size: 11.5px; color: var(--ink-3); font-family: var(--mono); }
.dchips { display: flex; flex-wrap: wrap; gap: 5px; padding: 2px 16px 14px; }
.echip {
  font-family: var(--mono); font-size: 11px; padding: 3px 9px; border-radius: 5px;
  background: var(--raised); border: 1px solid var(--rule-2); color: var(--ink-3);
  display: inline-flex; align-items: center; gap: 6px; animation: chippop .26s ease both;
}
.echip.new { border-color: var(--amber-bd); color: var(--amber-hi); background: var(--amber-bg); }
.echip .nt { font-size: 8.5px; letter-spacing: .04em; opacity: .8; }

/* ---- conflict flag (the one safety rail) ---- */
.flag {
  display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-radius: 10px;
  border: 1px solid var(--c-contra-bd); background: var(--c-contra-bg); margin-top: 14px;
  animation: risein .3s ease;
}
.flag.dismissing { animation: flagout .35s ease forwards; }
.okflag {
  display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-radius: 10px;
  border: 1px solid var(--c-thesis-bd); background: var(--c-thesis-bg); margin-top: 14px;
}
.okflag .ftext { flex: 1; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.okflag .ftext b { color: var(--c-thesis); font-weight: 600; }

/* dropzone "uploading" state (shown immediately on file select).
   :not([hidden]) is load-bearing — without it, this rule's display:flex
   beats the user-agent [hidden]{display:none} and the banner shows on
   every page load even though the element has the hidden attribute. */
.dz-uploading:not([hidden]) {
  display: flex; align-items: center; gap: 12px; padding: 24px 28px; border-radius: 12px;
  border: 1px solid var(--amber-bd); background: var(--amber-bg);
}
.dz-uploading .dz-up-text { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
.dz-uploading .dz-up-text b { color: var(--amber-hi); font-weight: 600; }
.dz-spinner {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--rule-bright); border-top-color: var(--amber);
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* live processing panel (one row per in-flight document) */
.proc-card { border: 1px solid var(--rule-2); border-radius: 10px; background: var(--panel); overflow: hidden; }
.proc-head {
  display: flex; align-items: center; gap: 9px; padding: 11px 14px;
  border-bottom: 1px solid var(--rule); background: var(--surface);
}
.proc-h-title { font-size: 12.5px; color: var(--ink-2); }
.proc-h-title b { color: var(--amber-hi); font-weight: 600; }
.proc-h-sub { margin-left: auto; font-size: 10.5px; color: var(--faint); letter-spacing: .04em; }
.proc-list { padding: 4px 0; }
.proc-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; border-bottom: 1px solid var(--rule); font-size: 12.5px;
}
.proc-row:last-child { border-bottom: none; }
.proc-row-done .proc-spinner { border: 2px solid var(--c-thesis); border-top-color: transparent; animation: none; }
.proc-spinner {
  width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--rule-bright); border-top-color: var(--amber);
  animation: spin 0.9s linear infinite;
}
.proc-spinner.done {
  border-color: var(--c-thesis); border-top-color: var(--c-thesis); animation: none;
}
.proc-spinner.failed { border-color: var(--c-contra); border-top-color: var(--c-contra); animation: none; }
.proc-name { flex: 1; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.proc-name a { color: var(--c-pattern); }
.proc-name a:hover { color: var(--amber-hi); }
.proc-step { font-size: 10.5px; color: var(--mute); text-transform: lowercase; min-width: 110px; text-align: right; }
.proc-claims { font-size: 10.5px; color: var(--c-thesis); }
.flag .fdot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-contra); flex-shrink: 0; box-shadow: 0 0 0 4px var(--c-contra-bg); }
.flag .ftext { flex: 1; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.flag .ftext b { color: var(--ink); font-weight: 600; }
.flag .faction {
  font-size: 12px; color: var(--c-contra); padding: 4px 11px; border-radius: 6px;
  border: 1px solid var(--c-contra-bd); transition: background .14s; white-space: nowrap;
}
.flag .faction:hover { background: var(--c-contra-bg); }

/* ---- activity log ---- */
.log-head { display: flex; align-items: center; gap: 10px; margin: 26px 2px 11px; }
.log-head .eyebrow { display: flex; align-items: center; gap: 8px; }
.log-head .livedot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-thesis); animation: pulse 1.8s ease infinite; }
.log-head .undo-hint { margin-left: auto; font-size: 11px; color: var(--faint); }
.log { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--panel); }
.log-row {
  display: flex; align-items: baseline; gap: 13px; padding: 11px 15px; border-bottom: 1px solid var(--rule);
  position: relative; transition: background .14s;
}
.log-row:last-child { border-bottom: none; }
.log-row:hover { background: var(--raised); }
.log-row.fresh { animation: risein .4s ease; }
.log-row .lago { font-family: var(--mono); font-size: 11px; color: var(--faint); min-width: 26px; flex-shrink: 0; }
.log-row .ltext { flex: 1; font-size: 12.5px; color: var(--ink-3); line-height: 1.5; }
.log-row .ltext b { color: var(--ink-2); font-weight: 500; }
.log-tag {
  font-family: var(--mono); font-size: 10px; padding: 2px 7px; border-radius: 4px; white-space: nowrap;
  flex-shrink: 0; letter-spacing: .02em;
}
.lt-ingest { background: var(--amber-bg); color: var(--amber-hi); }
.lt-synth { background: var(--c-thesis-bg); color: var(--c-thesis); }
.lt-chain { background: var(--c-pattern-bg); color: var(--c-pattern); }
.lt-promote, .lt-published { background: var(--c-connect-bg); color: var(--c-connect); }
.lt-error { background: var(--c-contra-bg); color: var(--c-contra); }
.log-undo {
  font-size: 11px; color: var(--mute); opacity: 0; transition: opacity .14s; flex-shrink: 0;
  font-family: var(--mono);
}
.log-row:hover .log-undo { opacity: 1; }
.log-undo:hover { color: var(--ink-2); }

/* ---- toast (finding surfaced) ---- */
.toast-wrap { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 60; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.toast {
  display: flex; align-items: center; gap: 12px; padding: 11px 14px 11px 15px; border-radius: 10px;
  background: var(--raised-2); border: 1px solid var(--rule-bright); box-shadow: 0 12px 40px rgba(0,0,0,.5);
  animation: risein .3s ease; max-width: 460px;
}
.toast .tdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.toast .ttext { font-size: 12.5px; color: var(--ink-2); }
.toast .ttext b { color: var(--ink); font-weight: 600; }
.toast .tgo { font-size: 12px; color: var(--amber); font-weight: 500; padding: 3px 10px; border-radius: 6px; border: 1px solid var(--amber-bd); white-space: nowrap; }
.toast .tgo:hover { background: var(--amber-bg); }

/* ========================================================================
   SYNTHESIS
   ======================================================================== */
.lens {
  display: flex; border: 1px solid var(--rule-2); border-radius: 8px; overflow: hidden; padding: 2px; gap: 2px; background: var(--panel);
}
.lens button, .lens a { display: inline-block; padding: 4px 13px; font-size: 12.5px; color: var(--mute); border-radius: 6px; transition: background .14s, color .14s; font-weight: 500; }
.lens button.on, .lens a.on { background: var(--raised-2); color: var(--ink); }
.lens button:not(.on):hover, .lens a:not(.on):hover { color: var(--ink-3); }

.filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.fchip {
  font-size: 11.5px; padding: 4px 11px; border-radius: 20px; border: 1px solid var(--rule-2);
  color: var(--ink-3); transition: border-color .14s, color .14s, background .14s; display: inline-flex; align-items: center; gap: 7px;
}
.fchip:hover { border-color: var(--rule-bright); color: var(--ink-2); }
.fchip.on { background: var(--raised-2); border-color: var(--rule-bright); color: var(--ink); }
.fchip .fcdot { width: 6px; height: 6px; border-radius: 50%; }
.fchip .fccount { font-family: var(--mono); font-size: 10px; color: var(--faint); }

.cards { display: flex; flex-direction: column; gap: 11px; }
.card {
  border: 1px solid var(--rule); border-radius: 11px; overflow: hidden; background: var(--panel);
  position: relative; transition: border-color .16s, transform .2s, opacity .3s;
}
.card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--edge, transparent); }
.card.t-pattern { --edge: var(--c-pattern); }
.card.t-contradiction { --edge: var(--c-contra); }
.card.t-thesis { --edge: var(--c-thesis); }
.card.t-connection { --edge: var(--c-connect); }
.card:hover { border-color: var(--rule-bright); }
.card.fresh { animation: risein .45s ease; }
.card.fresh::after {
  content: "new"; position: absolute; top: 12px; right: 14px; font-family: var(--mono);
  font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber);
  background: var(--amber-bg); padding: 2px 7px; border-radius: 4px; animation: fadein 1s ease;
}
.card.waved { opacity: 0; transform: translateX(14px) scale(.98); pointer-events: none; }
.card.promoted { border-color: var(--amber-bd); }

.card-head { display: flex; align-items: center; gap: 9px; padding: 11px 16px 0; }
.badge {
  font-family: var(--mono); font-size: 9.5px; font-weight: 600; letter-spacing: .07em;
  padding: 3px 8px; border-radius: 4px; text-transform: uppercase;
}
.b-pattern { background: var(--c-pattern-bg); color: var(--c-pattern); border: 1px solid var(--c-pattern-bd); }
.b-contradiction { background: var(--c-contra-bg); color: var(--c-contra); border: 1px solid var(--c-contra-bd); }
.b-thesis { background: var(--c-thesis-bg); color: var(--c-thesis); border: 1px solid var(--c-thesis-bd); }
.b-connection { background: var(--c-connect-bg); color: var(--c-connect); border: 1px solid var(--c-connect-bd); }
.b-gap { background: var(--c-gap-bg); color: var(--c-gap); border: 1px dashed var(--rule-bright); }
.card-meta { font-size: 11.5px; color: var(--mute); }
.card-count { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--mute); }
.card-body { padding: 9px 16px 14px; }
.card-title {
  font-family: var(--serif); font-size: 18px; line-height: 1.32; color: var(--ink); font-weight: 500;
  letter-spacing: -0.005em; margin-bottom: 7px; text-wrap: pretty;
}
.card-desc { font-size: 13px; color: var(--ink-3); line-height: 1.55; margin-bottom: 11px; text-wrap: pretty; }
.card-rests { font-family: var(--mono); font-size: 11px; color: var(--mute); margin-bottom: 13px; line-height: 1.7; }
.card-rests .rk { color: var(--faint); }
.card-rests .rd { color: var(--ink-3); }

.verbs { display: flex; align-items: center; gap: 7px; }
.verb {
  font-size: 12.5px; padding: 5px 13px; border-radius: 7px; border: 1px solid var(--rule-2);
  color: var(--ink-3); transition: all .14s; display: inline-flex; align-items: center; gap: 6px;
}
.verb svg { width: 13px; height: 13px; }
.verb:hover { border-color: var(--rule-bright); color: var(--ink-2); background: var(--raised); }
.verb.watched { color: var(--ink-2); border-color: var(--rule-bright); background: var(--raised); }
.verb.nudged { color: var(--c-pattern); border-color: var(--c-pattern-bd); background: var(--c-pattern-bg); }
.verb-promote {
  border: 1px solid var(--amber-bd); color: var(--amber-hi); background: var(--amber-bg);
}
.verb-promote:hover { background: var(--amber-bg-2); }
.verb-promote.done { background: var(--amber); color: #fff; border-color: var(--amber); }
.verb-wave { margin-left: auto; color: var(--faint); border-color: transparent; padding: 5px 9px; }
.verb-wave:hover { color: var(--ink-3); border-color: var(--rule-2); background: transparent; }

.card-gap {
  display: flex; align-items: center; gap: 13px; padding: 13px 16px; border: 1px dashed var(--rule-bright);
  border-radius: 11px; background: var(--c-gap-bg); transition: opacity .3s, transform .2s;
}
.card-gap.waved { opacity: 0; transform: translateX(14px); pointer-events: none; }
.card-gap .gtext { flex: 1; font-size: 13px; color: var(--ink-3); line-height: 1.45; text-wrap: pretty; }

/* corpus lens */
.corpus { display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--panel); }
.corpus-group-h { padding: 9px 15px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); background: var(--surface); border-bottom: 1px solid var(--rule); display: flex; gap: 9px; align-items: center; }
.corpus-group-h .cgcount { color: var(--faint); }
.crow { display: flex; align-items: center; gap: 12px; padding: 10px 15px; border-bottom: 1px solid var(--rule); transition: background .14s; }
.crow:hover { background: var(--raised); }
.crow:last-child { border-bottom: none; }
.crow .cstatus { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.cstatus.published { background: var(--c-thesis); }
.cstatus.working { background: var(--amber); }
.crow .cname { font-family: var(--mono); font-size: 12.5px; color: var(--ink-2); flex: 1; }
.crow .cchain { font-size: 11px; color: var(--mute); font-family: var(--mono); }
.crow .cclaims { font-family: var(--mono); font-size: 11px; color: var(--mute); min-width: 64px; text-align: right; }
.crow .cstat-lbl { font-size: 10.5px; font-family: var(--mono); letter-spacing: .04em; text-transform: uppercase; min-width: 96px; }
.cstat-lbl.published { color: var(--c-thesis); }
.cstat-lbl.working { color: var(--amber); }
.corpus-chain-h {
  padding: 7px 15px 7px 22px; font-family: var(--mono); font-size: 10.5px;
  color: var(--mute); background: var(--surface); border-bottom: 1px solid var(--rule);
  display: flex; gap: 8px; align-items: center;
}
.corpus-chain-h .cch-arrow { color: var(--faint); }
.corpus-chain-h .cch-name { color: var(--ink-3); font-weight: 500; }
.corpus-chain-h .cch-count { margin-left: auto; color: var(--faint); }
.crow.indented { padding-left: 30px; }

/* ========================================================================
   STUDIO
   ======================================================================== */
.studio-setup {
  border: 1px solid var(--rule); border-radius: 12px; background: var(--surface);
  margin-bottom: 22px; overflow: hidden;
}
.studio-setup.locked { opacity: .92; }
.setup-head { padding: 13px 18px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid var(--rule); background: var(--panel); }
.setup-head .sh-ico { width: 15px; height: 15px; color: var(--mute); }
.setup-head .sh-title { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.setup-head .sh-sub { font-size: 11.5px; color: var(--mute); }
.setup-head .lockbadge { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10.5px; padding: 3px 9px; border-radius: 5px; background: var(--c-thesis-bg); color: var(--c-thesis); border: 1px solid var(--c-thesis-bd); }
.setup-head .lockbadge svg { width: 11px; height: 11px; }
.setup-toggle { margin-left: auto; font-size: 11.5px; color: var(--mute); font-family: var(--mono); }
.setup-toggle:hover { color: var(--ink-3); }

.setup-grid { display: grid; grid-template-columns: 0.85fr 1.15fr; }
.setup-single { display: block; }
.setup-col { padding: 16px 18px; }
.setup-col + .setup-col { border-left: 1px solid var(--rule); }
.setup-col h4 { font-size: 11.5px; font-weight: 500; color: var(--ink-3); margin-bottom: 11px; }
.setup-col h4 .num { color: var(--mute); font-family: var(--mono); margin-right: 7px; }
.ex-drop { border: 1px dashed var(--rule-bright); border-radius: 8px; padding: 13px; text-align: center; font-size: 11.5px; color: var(--mute); margin-bottom: 9px; transition: border-color .14s; }
.ex-drop:hover { border-color: var(--amber-bd); color: var(--ink-3); }
.ex-list { display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--rule-2); border-radius: 8px; overflow: hidden; }
.ex-item { display: flex; align-items: center; gap: 9px; padding: 7px 11px; border-bottom: 1px solid var(--rule); }
.ex-item:last-child { border-bottom: none; }
.ex-item .exdot { width: 5px; height: 5px; border-radius: 50%; background: var(--amber); flex-shrink: 0; }
.ex-item .exname { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); flex: 1; }
.ex-item .exkind { font-size: 10px; color: var(--faint); font-family: var(--mono); }

.skel { background: var(--bg); border: 1px solid var(--rule-2); border-radius: 8px; padding: 6px; margin-bottom: 11px; }
.skel-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border-radius: 6px; transition: background .14s; }
.skel-row:hover { background: var(--raised); }
.skel-row .sn { font-family: var(--mono); font-size: 12px; color: var(--amber); min-width: 16px; padding-top: 1px; }
.skel-row .stext { font-size: 13.5px; color: var(--ink-2); flex: 1; font-family: var(--serif); line-height: 1.4; }
.skel-row .stext[contenteditable] { outline: none; border-radius: 4px; }
.skel-row .stext[contenteditable]:focus { background: var(--raised-2); box-shadow: inset 0 0 0 1px var(--amber-bd); padding: 0 4px; margin: 0 -4px; }
.skel-never { display: flex; align-items: flex-start; gap: 9px; padding: 9px 10px 4px; }
.skel-never .nx { color: var(--c-contra); font-size: 12px; font-family: var(--mono); }
.skel-never .nlist { font-size: 12px; color: var(--mute); font-family: var(--sans); }
.setup-actions { display: flex; gap: 8px; }
.btn {
  font-size: 12.5px; padding: 7px 15px; border-radius: 8px; font-weight: 500; transition: all .14s;
  display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--rule-2); color: var(--ink-3);
}
.btn:hover { border-color: var(--rule-bright); color: var(--ink-2); background: var(--raised); }
.btn svg { width: 13px; height: 13px; }
.btn-danger { background: var(--c-contra-bg); border-color: var(--c-contra-bd); color: var(--c-contra); }
.btn-danger:hover { background: var(--c-contra-bg); border-color: var(--c-contra); color: var(--c-contra); }
.btn-danger:disabled { opacity: .4; cursor: not-allowed; }
.btn-danger-ghost { border-color: var(--rule-2); color: var(--mute); }
.btn-danger-ghost:hover { border-color: var(--c-contra-bd); color: var(--c-contra); }
.btn-amber { background: var(--amber-bg); border-color: var(--amber-bd); color: var(--amber-hi); flex: 1; justify-content: center; }
.btn-amber:hover { background: var(--amber-bg-2); border-color: var(--amber); color: var(--amber-hi); }
.btn-amber.solid { background: var(--amber); color: #fff; border-color: var(--amber); }
.btn-amber.solid:hover { background: var(--amber-hi); color: #fff; }

/* generate */
.gen-grid { display: grid; grid-template-columns: 1fr; gap: 18px; margin-bottom: 20px; }
.gen-field h4 { font-size: 11.5px; color: var(--ink-3); margin-bottom: 9px; font-weight: 500; }
.src-select { position: relative; }
.src-btn {
  width: 100%; display: flex; align-items: center; gap: 11px; padding: 11px 14px; border: 1px solid var(--rule-2);
  border-radius: 9px; background: var(--panel); transition: border-color .14s; text-align: left;
}
.src-btn:hover { border-color: var(--rule-bright); }
.src-btn .sb-badge { font-family: var(--mono); font-size: 9px; padding: 2px 7px; border-radius: 4px; letter-spacing: .06em; text-transform: uppercase; }
.src-btn .sb-title { font-family: var(--serif); font-size: 14px; color: var(--ink); flex: 1; }
.src-btn .sb-chev { color: var(--mute); width: 14px; height: 14px; transition: transform .16s; }
.src-btn.open .sb-chev { transform: rotate(180deg); }
.src-menu { position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 20; background: var(--raised-2); border: 1px solid var(--rule-bright); border-radius: 10px; padding: 5px; box-shadow: 0 16px 50px rgba(0,0,0,.55); animation: fadein .12s; max-height: 280px; overflow-y: auto; }
.src-opt { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 7px; transition: background .12s; width: 100%; text-align: left; }
.src-opt:hover { background: var(--panel); }
.src-opt .so-badge { font-family: var(--mono); font-size: 8.5px; padding: 2px 6px; border-radius: 4px; letter-spacing: .05em; text-transform: uppercase; flex-shrink: 0; }
.src-opt .so-title { font-family: var(--serif); font-size: 13px; color: var(--ink-2); line-height: 1.3; }
.src-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--mute); }

.medium-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.mpill {
  display: flex; flex-direction: column; gap: 2px; padding: 8px 13px; border-radius: 9px; border: 1px solid var(--rule-2);
  transition: all .14s; text-align: left; min-width: 0;
}
.mpill:hover { border-color: var(--rule-bright); background: var(--raised); }
.mpill.on { border-color: var(--amber-bd); background: var(--amber-bg); }
.mpill .mp-l { font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
.mpill.on .mp-l { color: var(--amber-hi); }
.mpill .mp-h { font-size: 10px; color: var(--mute); font-family: var(--mono); }

.gen-go { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.gen-go .applied { font-size: 11.5px; color: var(--mute); display: inline-flex; align-items: center; gap: 7px; }
.gen-go .applied svg { width: 12px; height: 12px; color: var(--c-thesis); }

.output {
  border: 1px solid var(--rule); border-left: 2px solid var(--amber); border-radius: 10px;
  background: var(--surface); padding: 16px 18px; margin-bottom: 13px; animation: risein .3s ease;
}
.output-meta { font-family: var(--mono); font-size: 10.5px; color: var(--mute); margin-bottom: 13px; display: flex; align-items: center; gap: 9px; letter-spacing: .03em; }
.output-meta .om-medium { color: var(--amber); }
.beat { display: flex; gap: 13px; padding: 7px 0; animation: risein .4s ease both; }
.beat .bnum { font-family: var(--mono); font-size: 10px; color: var(--amber); padding-top: 6px; min-width: 14px; opacity: .8; }
.beat .btext { font-family: var(--serif); font-size: 15.5px; line-height: 1.6; color: var(--ink-2); text-wrap: pretty; flex: 1; }
.beat:first-child .btext { color: var(--ink); font-weight: 500; }
.gen-loading { display: flex; align-items: center; gap: 11px; padding: 8px 0; color: var(--mute); font-size: 12.5px; }
.gen-loading .spin { width: 14px; height: 14px; border: 2px solid var(--rule-bright); border-top-color: var(--amber); border-radius: 50%; animation: spin .7s linear infinite; }
.gen-loading .gl-step { font-family: var(--mono); font-size: 11.5px; }

.out-actions { display: flex; align-items: center; gap: 8px; }
.btn-ghost { font-size: 12px; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--rule-2); color: var(--ink-3); transition: all .14s; display: inline-flex; align-items: center; gap: 6px; }
.btn-ghost:hover { border-color: var(--rule-bright); color: var(--ink-2); background: var(--raised); }
.btn-ghost svg { width: 12px; height: 12px; }
.btn-audio { margin-left: auto; color: var(--mute); }
.btn-use { background: var(--amber); color: #fff; border: 1px solid var(--amber); font-weight: 500; }
.btn-use:hover { background: var(--amber-hi); color: #fff; }

.studio-empty { text-align: center; padding: 50px 20px; color: var(--mute); }
.studio-empty .se-ico { width: 38px; height: 38px; margin: 0 auto 14px; color: var(--faint); }
.studio-empty .se-1 { font-size: 14px; color: var(--ink-3); margin-bottom: 5px; }
.studio-empty .se-2 { font-size: 12px; color: var(--mute); }
.studio-empty .se-link {
  display: inline-block; font-size: 12px; color: var(--c-pattern); margin-top: 12px;
  cursor: pointer; font-family: var(--mono); transition: color .14s;
  background: none; border: none; padding: 0;
}
.studio-empty .se-link:hover { color: var(--amber); }
.skel-extract-note {
  font-size: 10.5px; color: var(--mute); margin-top: 7px; font-family: var(--mono);
  line-height: 1.5;
}
.tray-note {
  font-family: var(--mono); font-size: 10.5px; color: var(--faint);
  margin: 7px 2px 0; line-height: 1.55;
}

/* ========================================================================
   COMMAND PALETTE
   ======================================================================== */
.cmdk-scrim { position: fixed; inset: 0; background: rgba(6,7,9,.62); backdrop-filter: blur(2px); z-index: 80; display: flex; align-items: flex-start; justify-content: center; padding-top: 14vh; animation: fadein .12s; }
.cmdk { width: 560px; max-width: 92vw; background: var(--raised-2); border: 1px solid var(--rule-bright); border-radius: 14px; box-shadow: 0 30px 80px rgba(0,0,0,.6); overflow: hidden; animation: risein .16s ease; }
.cmdk-input { display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--rule); }
.cmdk-input svg { width: 16px; height: 16px; color: var(--mute); }
.cmdk-input input { flex: 1; background: none; border: none; outline: none; font-size: 15px; color: var(--ink); }
.cmdk-input input::placeholder { color: var(--mute); }
.cmdk-list { padding: 6px; max-height: 320px; overflow-y: auto; }
.cmdk-sec { font-family: var(--mono); font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--mute); padding: 9px 11px 5px; }
.cmdk-row { display: flex; align-items: center; gap: 12px; padding: 9px 11px; border-radius: 8px; transition: background .1s; width: 100%; text-align: left; }
.cmdk-row.sel, .cmdk-row:hover { background: var(--panel); }
.cmdk-row .cr-ico { width: 15px; height: 15px; color: var(--ink-3); flex-shrink: 0; }
.cmdk-row.sel .cr-ico { color: var(--amber); }
.cmdk-row .cr-label { font-size: 13.5px; color: var(--ink-2); flex: 1; }
.cmdk-row .cr-hint { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }

/* ========================================================================
   PRODUCTION
   ======================================================================== */
.prod-stages { display: flex; align-items: center; gap: 6px; margin-bottom: 22px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); }
.prod-stage-btn { display: flex; align-items: center; gap: 7px; padding: 5px 12px 5px 0; font-size: 12.5px; font-weight: 500; color: var(--mute); transition: color .14s; }
.prod-stage-btn .ps-num { font-family: var(--mono); font-size: 10px; background: var(--raised); border: 1px solid var(--rule-2); border-radius: 4px; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; }
.prod-stage-btn.active { color: var(--ink-2); }
.prod-stage-btn.active .ps-num { background: var(--amber-bg); border-color: var(--amber-bd); color: var(--amber); }
.prod-stage-btn.done { color: var(--c-thesis); cursor: pointer; }
.prod-stage-btn.done .ps-num { background: var(--c-thesis-bg); border-color: var(--c-thesis-bd); color: var(--c-thesis); }
.prod-stage-sep { color: var(--faint); font-size: 11px; }
.prod-script-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--rule); border-radius: 9px; background: var(--panel); margin-bottom: 22px; }
.psh-medium { font-family: var(--mono); font-size: 9.5px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: .06em; background: var(--amber-bg); color: var(--amber-hi); border: 1px solid var(--amber-bd); flex-shrink: 0; }
.psh-title { font-family: var(--serif); font-size: 13px; color: var(--ink-2); flex: 1; }
.psh-beats { font-family: var(--mono); font-size: 11px; color: var(--mute); flex-shrink: 0; }
.audio-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--rule); margin-bottom: 16px; }
.audio-tab { padding: 8px 16px; font-size: 12.5px; font-weight: 500; color: var(--mute); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .14s; }
.audio-tab.on { color: var(--amber-hi); border-bottom-color: var(--amber); }
.audio-tab:hover:not(.on) { color: var(--ink-3); }
.beat-rec-card { border: 1px solid var(--rule); border-radius: 11px; background: var(--panel); margin-bottom: 9px; overflow: hidden; transition: border-color .16s; }
.beat-rec-card.done { border-color: var(--c-thesis-bd); }
.beat-rec-card.active { border-color: var(--amber-bd); }
.brc-head { display: flex; align-items: center; gap: 11px; padding: 11px 15px 0; }
.brc-num { font-family: var(--mono); font-size: 10px; color: var(--amber); }
.brc-status { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--mute); display: inline-flex; align-items: center; gap: 5px; }
.brc-status.ok { color: var(--c-thesis); }
.brc-status.rec { color: var(--c-contra); }
.brc-recbar { height: 2px; background: var(--rule); }
.brc-recbar-fill { height: 100%; background: var(--c-contra); transition: width .1s linear; }
.brc-text { font-family: var(--serif); font-size: 14.5px; color: var(--ink-2); line-height: 1.5; padding: 8px 15px 11px; text-wrap: pretty; }
.brc-controls { display: flex; align-items: center; gap: 10px; padding: 0 15px 12px; }
.brc-rec-btn { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 7px; font-size: 12.5px; font-weight: 500; border: 1px solid var(--rule-2); color: var(--ink-3); transition: all .14s; }
.brc-rec-btn:hover { border-color: var(--amber-bd); color: var(--amber-hi); background: var(--amber-bg); }
.brc-rec-btn.recording { border-color: var(--c-contra-bd); color: var(--c-contra); background: var(--c-contra-bg); }
.rec-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.brc-rec-btn.recording .rec-dot { animation: pulse 1s ease-in-out infinite; }
.brc-wave { display: flex; align-items: center; gap: 1.5px; height: 28px; flex: 1; }
.brc-wave span { display: inline-block; width: 3px; border-radius: 2px; background: var(--c-thesis); }
.brc-re { font-size: 11px; color: var(--mute); font-family: var(--mono); transition: color .14s; }
.brc-re:hover { color: var(--ink-3); }
.prod-progress { font-family: var(--mono); font-size: 11.5px; color: var(--mute); margin: 12px 0 14px; display: flex; align-items: center; gap: 10px; }
.prod-progress .pp-done { color: var(--c-thesis); }
.voice-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.voice-card { border: 1px solid var(--rule-2); border-radius: 9px; padding: 12px 14px; text-align: left; transition: all .14s; }
.voice-card:hover { border-color: var(--rule-bright); }
.voice-card.on { border-color: var(--amber-bd); background: var(--amber-bg); }
.vc-name { font-size: 13px; font-weight: 500; color: var(--ink-2); margin-bottom: 3px; }
.voice-card.on .vc-name { color: var(--amber-hi); }
.vc-desc { font-size: 10.5px; color: var(--mute); font-family: var(--mono); }
.ai-voice-note { font-family: var(--mono); font-size: 10.5px; color: var(--faint); margin-bottom: 12px; }
.ai-gen-status { display: flex; align-items: center; gap: 8px; padding: 12px 0; font-family: var(--mono); font-size: 11.5px; color: var(--mute); }
.prod-spin { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--rule-bright); border-top-color: var(--amber); animation: spin .7s linear infinite; flex-shrink: 0; }
.clip-grid { display: flex; flex-direction: column; gap: 9px; margin-bottom: 20px; }
.clip-card { border: 1px solid var(--rule); border-radius: 11px; background: var(--panel); overflow: hidden; }
.clip-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--rule); }
.ch-num { font-family: var(--mono); font-size: 10px; color: var(--amber); flex-shrink: 0; }
.ch-text { font-size: 12.5px; color: var(--ink-3); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clip-mode-toggle { display: flex; gap: 3px; flex-shrink: 0; }
.clip-mode-btn { font-family: var(--mono); font-size: 10px; padding: 3px 9px; border-radius: 5px; border: 1px solid var(--rule-2); color: var(--mute); transition: all .12s; }
.clip-mode-btn:hover { border-color: var(--rule-bright); color: var(--ink-3); }
.clip-mode-btn.on { background: var(--raised-2); border-color: var(--rule-bright); color: var(--ink); }
.clip-body { display: flex; min-height: 94px; }
.clip-thumb { width: 128px; flex-shrink: 0; background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; border-right: 1px solid var(--rule); padding: 10px; position: relative; }
.clip-thumb.gen-thumb { background: linear-gradient(135deg, rgba(95,198,162,0.04), rgba(169,156,234,0.08)); }
.ct-tag { position: absolute; top: 7px; left: 7px; font-family: var(--mono); font-size: 8.5px; padding: 2px 6px; border-radius: 3px; letter-spacing: .04em; }
.ct-tag.pexels { background: var(--c-pattern-bg); color: var(--c-pattern); border: 1px solid var(--c-pattern-bd); }
.ct-tag.kling { background: rgba(95,198,162,0.1); color: var(--c-thesis); border: 1px solid var(--c-thesis-bd); }
.ct-query { font-family: var(--mono); font-size: 9.5px; color: var(--mute); text-align: center; line-height: 1.4; }
.clip-info { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ci-query { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); }
.ci-sub { font-size: 11px; color: var(--mute); }
.ci-cost { font-family: var(--mono); font-size: 11.5px; color: var(--amber-hi); }
.ci-stack { font-family: var(--mono); font-size: 10px; color: var(--faint); }
.ci-actions { margin-top: auto; display: flex; align-items: center; gap: 7px; }
.export-panel { border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); padding: 20px; margin-bottom: 14px; }
.export-meta { margin-bottom: 16px; }
.em-title { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.em-sub { font-family: var(--mono); font-size: 11px; color: var(--mute); }
.export-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.export-card { border: 1px solid var(--rule-2); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; transition: border-color .14s; }
.export-card:hover { border-color: var(--rule-bright); }
.ec-title { font-size: 14px; font-weight: 500; color: var(--ink); }
.ec-sub { font-family: var(--mono); font-size: 10.5px; color: var(--mute); }
.export-note { font-family: var(--mono); font-size: 10.5px; color: var(--faint); line-height: 1.7; }

/* Studio → Production back bar */
.prod-back-bar { display: flex; align-items: center; gap: 10px; padding: 11px 0 18px; border-bottom: 1px solid var(--rule); margin-bottom: 0; }
.pbb-btn { font-family: var(--mono); font-size: 12px; color: var(--c-pattern); transition: color .14s; }
.pbb-btn:hover { color: var(--amber); }
.pbb-sep { color: var(--faint); }
.pbb-info { font-family: var(--mono); font-size: 11.5px; color: var(--mute); }

/* ---- Studio composer ---- */
.composer { border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); margin-bottom: 26px; overflow: hidden; }
.composer-head { display: flex; align-items: center; gap: 11px; padding: 13px 16px; width: 100%; text-align: left; transition: background .14s; }
.composer-head:hover { background: var(--raised); }
.ch-ico { width: 15px; height: 15px; color: var(--amber); flex-shrink: 0; }
.ch-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.ch-sub { font-family: var(--mono); font-size: 11px; color: var(--mute); }
.composer-body { padding: 4px 16px 16px; border-top: 1px solid var(--rule); }
.composer-empty { padding: 22px 16px; border-top: 1px solid var(--rule); }
.ce-1 { font-size: 13px; color: var(--ink-3); margin-bottom: 4px; }
.ce-2 { font-size: 12px; color: var(--mute); margin-bottom: 8px; }
.composer-body .gen-grid { margin-top: 14px; }

/* ---- Projects shelf ---- */
.projects-head { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; padding-bottom: 11px; border-bottom: 1px solid var(--rule); }
.ph-title { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.ph-count { font-family: var(--mono); font-size: 10px; color: var(--mute); }
.ph-sub { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
.projects-empty { font-family: var(--mono); font-size: 12px; color: var(--mute); padding: 26px 18px; border: 1px dashed var(--rule-bright); border-radius: 10px; text-align: center; }
.project-list { display: flex; flex-direction: column; gap: 9px; }
.project-card { display: flex; align-items: center; gap: 14px; padding: 13px 15px; border: 1px solid var(--rule); border-radius: 11px; background: var(--panel); transition: border-color .14s; }
.project-card:hover { border-color: var(--rule-bright); }
.project-card.fresh { animation: risein .4s ease; border-color: var(--amber-bd); }
.pc-medium { font-family: var(--mono); font-size: 9.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 4px 9px; border-radius: 5px; background: var(--amber-bg); color: var(--amber-hi); border: 1px solid var(--amber-bd); flex-shrink: 0; min-width: 84px; text-align: center; }
.pc-body { flex: 1; min-width: 0; }
.pc-title { font-family: var(--serif); font-size: 14.5px; color: var(--ink-2); line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.pc-progress { display: flex; align-items: center; gap: 0; margin: 8px 0 6px; }
.pcp-step { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.pcp-dot { width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid var(--ghost); display: flex; align-items: center; justify-content: center; color: var(--bg); flex-shrink: 0; }
.pcp-step.done .pcp-dot { background: var(--c-thesis); border-color: var(--c-thesis); }
.pcp-label { font-family: var(--mono); font-size: 10px; color: var(--faint); }
.pcp-step.done .pcp-label { color: var(--ink-3); }
.pcp-line { width: 22px; height: 1.5px; background: var(--ghost); margin: 0 7px; flex-shrink: 0; }
.pcp-line.done { background: var(--c-thesis); }
.pc-meta { font-family: var(--mono); font-size: 10.5px; color: var(--mute); }
.pc-open { font-family: var(--mono); font-size: 11.5px; color: var(--amber-hi); padding: 6px 13px; border-radius: 7px; border: 1px solid var(--amber-bd); background: var(--amber-bg); transition: background .14s; flex-shrink: 0; }
.pc-open:hover { background: var(--amber-bg-2); }
.pc-del { font-size: 12px; color: var(--faint); padding: 3px 5px; flex-shrink: 0; transition: color .14s; }
.pc-del:hover { color: var(--c-contra); }

/* ---- Project workspace ---- */
.ws-head { display: flex; align-items: center; gap: 11px; padding-bottom: 14px; margin-bottom: 0; border-bottom: 1px solid var(--rule); }
.ws-back { font-family: var(--mono); font-size: 12px; color: var(--c-pattern); transition: color .14s; flex-shrink: 0; }
.ws-back:hover { color: var(--amber); }
.ws-medium { font-family: var(--mono); font-size: 9.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 5px; background: var(--amber-bg); color: var(--amber-hi); border: 1px solid var(--amber-bd); flex-shrink: 0; }
.ws-title { font-family: var(--serif); font-size: 14px; color: var(--ink-2); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ws-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--rule); margin-bottom: 20px; }
.ws-tab { display: flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 12.5px; font-weight: 500; color: var(--mute); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .14s; }
.ws-tab.on { color: var(--ink); border-bottom-color: var(--amber); }
.ws-tab:hover:not(.on) { color: var(--ink-3); }
.wst-dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--ghost); display: flex; align-items: center; justify-content: center; color: var(--bg); }
.ws-tab.done .wst-dot { background: var(--c-thesis); border-color: var(--c-thesis); }
.ws-tab.on:not(.done) .wst-dot { border-color: var(--amber); }
.ws-script { border: 1px solid var(--rule); border-left: 2px solid var(--amber); border-radius: 10px; background: var(--surface); padding: 14px 18px; margin-bottom: 16px; }
.ws-actions { display: flex; align-items: center; gap: 9px; }
.ws-gate { font-family: var(--mono); font-size: 11.5px; color: var(--mute); padding: 12px 14px; border: 1px dashed var(--rule-bright); border-radius: 9px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ---- Export: render + files ---- */
.ws-export-intro { font-size: 12.5px; color: var(--ink-3); line-height: 1.55; margin-bottom: 16px; }
.render-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
.render-card { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--rule); border-radius: 10px; background: var(--panel); }
.render-body { flex: 1; min-width: 0; }
.render-title { font-size: 13px; font-weight: 500; color: var(--ink); }
.render-sub { font-family: var(--mono); font-size: 10px; color: var(--mute); margin-top: 3px; }
.files-head { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 11px; }
.fh-count { font-family: var(--mono); font-size: 10px; color: var(--mute); }
.files-empty { font-family: var(--mono); font-size: 11.5px; color: var(--mute); padding: 22px; border: 1px dashed var(--rule-bright); border-radius: 9px; text-align: center; margin-bottom: 14px; }
.files-list { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--panel); margin-bottom: 14px; }
.file-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--rule); transition: background .14s; }
.file-row:last-child { border-bottom: none; }
.file-row:hover { background: var(--raised); }
.file-kind { font-family: var(--mono); font-size: 9px; font-weight: 600; letter-spacing: .06em; padding: 3px 7px; border-radius: 4px; flex-shrink: 0; }
.file-kind.audio { background: var(--amber-bg); color: var(--amber-hi); border: 1px solid var(--amber-bd); }
.file-kind.video { background: var(--c-pattern-bg); color: var(--c-pattern); border: 1px solid var(--c-pattern-bd); }
.file-name { font-family: var(--mono); font-size: 12px; color: var(--ink-2); flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.file-spec { font-family: var(--mono); font-size: 10.5px; color: var(--mute); }
.file-dur { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); min-width: 38px; text-align: right; }
.file-when { font-family: var(--mono); font-size: 10px; color: var(--faint); min-width: 56px; text-align: right; }
.prod-empty { text-align: center; padding: 50px 20px; }
.prod-empty .pe-ico { width: 38px; height: 38px; margin: 0 auto 14px; color: var(--faint); }
.prod-empty .pe-1 { font-size: 14px; color: var(--ink-3); margin-bottom: 5px; }
.prod-empty .pe-2 { font-size: 12px; color: var(--mute); }
.prod-empty .pe-2 b { color: var(--ink-3); font-weight: 500; }

/* ========================================================================
   CHAT
   ======================================================================== */
.chat-wrap { display: flex; flex-direction: column; min-height: 100%; }
.chat-stream { flex: 1; padding: 22px 26px 20px; display: flex; flex-direction: column; gap: 16px; max-width: 760px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.chat-date { font-family: var(--mono); font-size: 10px; color: var(--faint); text-align: center; letter-spacing: .08em; text-transform: uppercase; padding: 6px 0; }
.chat-msg { display: flex; flex-direction: column; }
.chat-msg.user { align-items: flex-end; }
.chat-msg.system { align-items: flex-start; }
.chat-q { background: var(--amber-bg); border: 1px solid var(--amber-bd); border-radius: 11px 11px 3px 11px; padding: 10px 15px; font-size: 13.5px; color: var(--amber-hi); max-width: 74%; line-height: 1.5; }
.chat-r { max-width: 90%; }
.chat-r-text { font-size: 13.5px; color: var(--ink-2); line-height: 1.65; margin-bottom: 8px; text-wrap: pretty; }
.chat-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.chat-chip { font-family: var(--mono); font-size: 10.5px; padding: 3px 10px; border-radius: 5px; display: inline-flex; align-items: center; gap: 6px; }
.chat-chip.ch-pattern { background: var(--c-pattern-bg); color: var(--c-pattern); border: 1px solid var(--c-pattern-bd); }
.chat-chip.ch-contradiction { background: var(--c-contra-bg); color: var(--c-contra); border: 1px solid var(--c-contra-bd); }
.chat-chip.ch-thesis { background: var(--c-thesis-bg); color: var(--c-thesis); border: 1px solid var(--c-thesis-bd); }
.chat-chip.ch-connection { background: var(--c-connect-bg); color: var(--c-connect); border: 1px solid var(--c-connect-bd); }
.chat-chip.ch-gap { background: var(--c-gap-bg); color: var(--c-gap); border: 1px solid var(--rule-bright); }
.cc-label { color: var(--mute); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.cc-val { }
.chat-r-t { font-family: var(--mono); font-size: 10px; color: var(--faint); margin-top: 3px; }
.chat-loading { display: flex; align-items: center; gap: 5px; padding: 10px 0; }
.chat-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--mute); animation: pulse 1.2s ease-in-out infinite; }
.chat-dot:nth-child(2) { animation-delay: .22s; }
.chat-dot:nth-child(3) { animation-delay: .44s; }
.chat-input-bar { background: var(--bg); padding: 12px 26px 16px; display: flex; align-items: center; gap: 11px; max-width: 760px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.chat-foot { position: sticky; bottom: 0; background: var(--bg); border-top: 1px solid var(--rule); }
.chat-suggest { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 26px 0; max-width: 760px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.chat-sg { font-size: 11.5px; padding: 5px 11px; border-radius: 16px; border: 1px solid var(--rule-2); color: var(--ink-3); transition: all .14s; }
.chat-sg:hover { border-color: var(--amber-bd); color: var(--amber-hi); background: var(--amber-bg); }
.chat-sg:disabled { opacity: .4; cursor: default; }
.cib-prompt { font-family: var(--mono); font-size: 18px; color: var(--amber); flex-shrink: 0; line-height: 1; }
.cib-input { flex: 1; background: none; border: none; outline: none; font-size: 13.5px; color: var(--ink); }
.cib-input::placeholder { color: var(--mute); font-size: 12.5px; }
.cib-send { color: var(--amber); transition: opacity .14s; flex-shrink: 0; }
.cib-send:disabled { opacity: .25; cursor: not-allowed; }
.cib-send svg { width: 18px; height: 18px; }

/* ========================================================================
   LIBRARY
   ======================================================================== */
.lib-stats { display: flex; align-items: center; gap: 0; padding: 4px 0 20px; border-bottom: 1px solid var(--rule); margin-bottom: 20px; }
.lib-stat { display: flex; flex-direction: column; align-items: center; padding: 0 22px; }
.lib-stat:first-child { padding-left: 0; }
.ls-n { font-size: 22px; font-weight: 600; color: var(--ink); letter-spacing: -0.03em; font-feature-settings: "tnum"; }
.ls-l { font-family: var(--mono); font-size: 9.5px; color: var(--mute); letter-spacing: .05em; text-transform: uppercase; margin-top: 3px; }
.lib-sep { width: 1px; height: 34px; background: var(--rule); }
.lib-search { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--rule-2); border-radius: 9px; padding: 9px 14px; transition: border-color .14s; }
.lib-search svg { width: 15px; height: 15px; color: var(--mute); flex-shrink: 0; }
.lib-search:focus-within { border-color: var(--amber-bd); }
.lib-search-input { flex: 1; background: none; border: none; outline: none; font-size: 13.5px; color: var(--ink); }
.lib-search-input::placeholder { color: var(--mute); }
.lib-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.lib-fchip { font-size: 11.5px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--rule-2); color: var(--ink-3); transition: all .14s; }
.lib-fchip:hover { border-color: var(--rule-bright); color: var(--ink-2); }
.lib-fchip.on { background: var(--raised-2); border-color: var(--rule-bright); color: var(--ink); }
.lib-list { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--panel); }
.lib-chain-hd { display: flex; align-items: center; gap: 9px; padding: 9px 14px; font-family: var(--mono); font-size: 10.5px; color: var(--mute); background: var(--surface); border-bottom: 1px solid var(--rule); }
.lch-arrow { color: var(--faint); }
.lch-name { color: var(--ink-3); font-weight: 500; }
.lch-count { color: var(--faint); }
.lch-claims { margin-left: auto; color: var(--faint); }
.lib-doc { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-bottom: 1px solid var(--rule); transition: background .14s; cursor: pointer; }
.lib-doc:last-of-type { border-bottom: none; }
.lib-doc:hover { background: var(--raised); }
.lib-doc.open { background: var(--raised); }
.lib-detail { border-bottom: 1px solid var(--rule); padding: 12px 14px 14px 33px; background: var(--surface); animation: risein .2s ease; }
.ldd-blurb { font-size: 12.5px; color: var(--ink-3); line-height: 1.55; margin-bottom: 10px; text-wrap: pretty; }
.ldd-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 10px; }
.ldd-item { display: flex; align-items: baseline; gap: 6px; font-family: var(--mono); font-size: 11px; }
.ldi-k { color: var(--faint); text-transform: uppercase; letter-spacing: .06em; font-size: 9.5px; }
.ldd-entities { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.ldd-actions { display: flex; gap: 8px; margin-top: 4px; }
.lib-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.lib-dot.published { background: var(--c-thesis); }
.lib-dot.working { background: var(--amber); }
.lib-doc-name { font-family: var(--mono); font-size: 12.5px; color: var(--ink-2); flex: 1; }
.lib-doc-kind { font-size: 11px; color: var(--mute); min-width: 100px; }
.lib-doc-status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; min-width: 110px; }
.lib-doc-status.published { color: var(--c-thesis); }
.lib-doc-status.working { color: var(--amber); }
.lib-doc-claims { font-family: var(--mono); font-size: 11px; color: var(--mute); min-width: 64px; text-align: right; }
.lib-doc-date { font-family: var(--mono); font-size: 10.5px; color: var(--faint); min-width: 80px; text-align: right; }
.lib-doc-arrow { font-size: 11px; color: var(--c-pattern); flex-shrink: 0; }
/* extraction-status pill (next to publication-status) — honest about whether
   a Vaulted doc has been digested yet */
.lib-doc-extract-pill { font-size: 9.5px; padding: 2px 7px; border-radius: 999px; letter-spacing: .04em; text-transform: uppercase; flex-shrink: 0; min-width: 92px; text-align: center; }
.lib-doc-extract-pill.stored { background: var(--rule); color: var(--ink-3); }
.lib-doc-extract-pill.extracting { background: var(--amber-bg); color: var(--amber-hi); }
.lib-doc-extract-pill.extracted { background: var(--c-thesis-bg); color: var(--c-thesis); }
.lib-doc-extract-pill.failed { background: var(--c-contra-bg); color: var(--c-contra); }
.lib-doc-extract { padding: 4px 11px; font-size: 11px; flex-shrink: 0; }
.lib-doc-extract-done { color: var(--c-thesis); width: 28px; text-align: center; flex-shrink: 0; }
.lib-doc-check { display: inline-flex; align-items: center; padding: 0 2px; flex-shrink: 0; }
.lib-doc-check input { width: 14px; height: 14px; accent-color: var(--amber); cursor: pointer; }
.lib-doc-name { color: inherit; text-decoration: none; }
.lib-doc-name:hover { color: var(--amber-hi); }
.lib-empty { font-family: var(--mono); font-size: 12px; color: var(--mute); padding: 32px; text-align: center; }
.lib-bulk-bar { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 14px; border: 1px solid var(--rule-2); border-radius: 9px; background: var(--panel); }
.lib-bulk-all { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-3); cursor: pointer; }
.lib-bulk-all input { accent-color: var(--amber); }
.lib-bulk-count { font-family: var(--mono); font-size: 11px; color: var(--mute); }
.lib-bulk-bar .btn-danger { margin-left: auto; }
.crow .crow-arrow { font-size: 11px; color: var(--c-pattern); margin-left: 4px; flex-shrink: 0; }

/* ---- library document detail ---- */
.libdoc-head { margin-bottom: 8px; }
.libdoc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
.libdoc-kind { font-size: 10.5px; color: var(--mute); }
.libdoc-title { font-family: var(--serif); font-size: 26px; font-weight: 500; letter-spacing: -.01em; color: var(--ink); line-height: 1.2; }
.libdoc-sub { font-family: var(--serif); font-size: 16px; color: var(--ink-3); margin-top: 6px; }
.libdoc-section { margin: 26px 0; }
.libdoc-section-h { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--faint); padding-bottom: 8px; border-bottom: 1px solid var(--rule); margin-bottom: 12px; }
.libdoc-sib { display: flex; align-items: center; gap: 8px; padding: 7px 0; font-family: var(--mono); font-size: 12.5px; color: var(--c-pattern); }
.libdoc-sib:hover { color: var(--amber-hi); }
.libdoc-claim { display: flex; align-items: baseline; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--rule); font-size: 13.5px; line-height: 1.5; }
.libdoc-claim:last-child { border-bottom: none; }
.libdoc-claim-tag { font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--amber); min-width: 78px; flex-shrink: 0; }
.libdoc-claim-text { flex: 1; color: var(--ink-2); }
.libdoc-claim-vs { font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--mute); flex-shrink: 0; }
.libdoc-body { max-width: 760px; font-family: var(--serif); font-size: 15.5px; line-height: 1.66; color: var(--ink-2); }
.libdoc-body h1, .libdoc-body h2, .libdoc-body h3 { font-family: var(--sans); color: var(--ink); letter-spacing: -.01em; margin: 22px 0 10px; line-height: 1.25; }
.libdoc-body h1 { font-size: 21px; }
.libdoc-body h2 { font-size: 18px; }
.libdoc-body h3 { font-size: 15px; }
.libdoc-body p { margin: 0 0 14px; }
.libdoc-body ul, .libdoc-body ol { margin: 0 0 14px; padding-left: 22px; }
.libdoc-body li { margin: 0 0 6px; }
.libdoc-body a { color: var(--c-pattern); text-decoration: underline; text-underline-offset: 2px; }
.libdoc-body blockquote { border-left: 2px solid var(--rule-bright); padding-left: 14px; color: var(--ink-3); margin: 0 0 14px; }
.libdoc-body code { font-family: var(--mono); font-size: 13px; background: var(--raised); padding: 1px 5px; border-radius: 4px; }

/* ========================================================================
   BRIEFS
   ======================================================================== */
.briefs-sh { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.bsh-title { font-size: 12px; font-weight: 600; color: var(--ink-2); letter-spacing: -.01em; }
.bsh-count { font-family: var(--mono); font-size: 10px; color: var(--mute); }
.bsh-sub { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
.briefs-queue { display: flex; flex-direction: column; gap: 11px; }
.briefs-empty { font-family: var(--mono); font-size: 12px; color: var(--mute); padding: 28px 18px; border: 1px dashed var(--rule-bright); border-radius: 10px; text-align: center; }
.brief-proposal { border: 1px solid var(--rule); border-radius: 11px; background: var(--panel); padding: 15px 16px; transition: border-color .14s; }
.brief-proposal.building { border-color: var(--amber-bd); }
.brief-proposal.review { border-color: var(--c-thesis-bd); }
.bp-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.bp-type-badge { font-family: var(--mono); font-size: 9.5px; font-weight: 600; letter-spacing: .07em; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; border: 1px solid; flex-shrink: 0; }
.bp-title { font-family: var(--serif); font-size: 16px; color: var(--ink); flex: 1; line-height: 1.3; }
.bp-cite { font-family: var(--mono); font-size: 10px; color: var(--mute); flex-shrink: 0; white-space: nowrap; }
.bp-why { font-size: 12.5px; color: var(--ink-3); line-height: 1.55; margin-bottom: 12px; text-wrap: pretty; }
.bp-actions { display: flex; align-items: center; gap: 9px; }
.bp-pipeline { border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
.bp-step { display: flex; align-items: flex-start; gap: 11px; padding: 10px 14px; border-bottom: 1px solid var(--rule); font-size: 12px; color: var(--faint); background: var(--panel); transition: color .2s, background .2s; }
.bp-step:last-child { border-bottom: none; }
.bp-step.run { color: var(--ink-2); background: var(--surface); }
.bp-step.done { color: var(--ink-3); }
.bps-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.bps-icon svg { width: 12px; height: 12px; }
.bp-step.done .bps-icon { color: var(--c-thesis); }
.bps-ring { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--ghost); display: inline-block; }
.bps-body { flex: 1; }
.bps-label { font-family: var(--mono); font-size: 11.5px; }
.bps-sub { font-size: 11px; color: var(--mute); margin-top: 3px; }
.bps-ok { font-family: var(--mono); font-size: 10px; color: var(--c-thesis); display: inline-block; margin-left: 8px; }
.bps-bar { height: 2px; background: var(--rule); border-radius: 2px; overflow: hidden; max-width: 200px; margin-top: 8px; }
.bps-fill { height: 100%; background: var(--amber); transition: width .08s linear; }
.bp-draft { border: 1px solid var(--c-thesis-bd); border-radius: 9px; overflow: hidden; margin-top: 12px; }
.bp-draft-bar { display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: var(--c-thesis-bg); font-family: var(--mono); font-size: 11px; color: var(--c-thesis); border-bottom: 1px solid var(--c-thesis-bd); }
.bdb-counts { margin-left: auto; }
.bdb-killed { color: var(--c-contra); }
.bp-draft-title { font-family: var(--serif); font-size: 17px; color: var(--ink); font-weight: 500; padding: 12px 14px 6px; line-height: 1.3; }
.bp-claims { padding: 0 14px 10px; display: flex; flex-direction: column; }
.bp-claim { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--rule); }
.bp-claim:last-child { border-bottom: none; }
.bp-claim.killed { opacity: .5; }
.bpc-dot { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; margin-top: 1px; }
.bp-claim:not(.killed) .bpc-dot { background: var(--c-thesis-bg); color: var(--c-thesis); border: 1px solid var(--c-thesis-bd); }
.bp-claim.killed .bpc-dot { background: var(--c-contra-bg); color: var(--c-contra); border: 1px solid var(--c-contra-bd); }
.bpc-body { flex: 1; }
.bpc-text { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
.bp-claim.killed .bpc-text { text-decoration: line-through; color: var(--mute); }
.bpc-src { font-family: var(--mono); font-size: 10px; color: var(--mute); margin-top: 3px; }
.bpc-kill { font-family: var(--mono); font-size: 10px; color: var(--c-contra); margin-top: 3px; }
.bp-draft-actions { display: flex; align-items: center; gap: 9px; padding: 12px 14px; background: var(--surface); border-top: 1px solid var(--rule); }
.briefs-arc { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--panel); }
.briefs-arc-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--rule); transition: background .14s; }
.briefs-arc-row:last-child { border-bottom: none; }
.briefs-arc-row:hover { background: var(--raised); }
.bar-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.bar-title { font-family: var(--serif); font-size: 14px; color: var(--ink-2); flex: 1; }
.bar-type { font-family: var(--mono); font-size: 10px; color: var(--mute); }
.bar-when { font-family: var(--mono); font-size: 10px; color: var(--faint); }

/* Finding card: single verb */
.verb-studio { background: var(--amber-bg); border-color: var(--amber-bd) !important; color: var(--amber-hi) !important; }
.verb-studio:hover { background: var(--amber-bg-2) !important; }
.verb-studio.done { background: var(--amber) !important; color: #fff !important; border-color: var(--amber) !important; }

/* responsive */
@media (max-width: 820px) {
  /* The topbar is a fixed 52px tall, and its h1 is whatever the screen is
     called. On a research run that is the operator's whole question, which
     wrapped to three lines inside a bar with room for one and printed itself
     over the page beneath. The full question is the page's own H1 six pixels
     lower, so the bar truncates instead of fighting for it. */
  .topbar { padding: 0 14px; gap: 10px; }
  .topbar h1 {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
  }
  .topbar .sub { display: none; }
  .rail { width: 60px; }
  .rail-logo .word, .rail-item .lbl, .rail-kbd, .rail-foot-item .fl { display: none; }
  .rail-item { justify-content: center; }
  .setup-grid { grid-template-columns: 1fr; }
  .setup-col + .setup-col { border-left: none; border-top: 1px solid var(--rule); }
}


/* ---- THE RESEARCH WORKSPACE ----------------------------------------------
   One live surface for one investigation. Built entirely from the tokens the
   rest of the site already uses — one shell, one panel, one accent — because
   an operator tool that invents its own vocabulary is how the stylesheet grew
   six design systems in the first place. -------------------------------- */
.rw { max-width: var(--shell); margin: 0 auto; padding: 8px var(--gutter) 60px; }
.rw-head { padding-bottom: 22px; border-bottom: 1px solid var(--rule); margin-bottom: 26px; }
.rw-kicker {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 12px;
}
.rw-q {
  font-family: var(--serif); font-size: 31px; line-height: 1.2; font-weight: 500;
  color: var(--ink); margin: 0 0 10px; max-width: 800px; text-wrap: pretty;
}
.rw-angle {
  font-family: var(--serif); font-size: 15.5px; line-height: 1.55; color: var(--ink-3);
  margin: 0 0 16px; max-width: 700px;
}
.rw-state { display: flex; align-items: center; gap: 10px; }
.rw-headline { font-family: var(--mono); font-size: 12px; color: var(--ink-2); }
.rw-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--ink-mute); }
.rw-dot-run { background: var(--accent); animation: rw-pulse 1.4s ease-in-out infinite; }
.rw-dot-rest { background: var(--confirmed); }
.rw-dot-warn { background: var(--correction); }
@keyframes rw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

.rw-grid { display: grid; grid-template-columns: minmax(0,1fr) 288px; gap: 36px; align-items: start; }
.rw-grid > * { min-width: 0; }
.rw-main { display: flex; flex-direction: column; gap: 26px; }

.rw-panel { border: 1px solid var(--rule); border-radius: var(--r); background: var(--paper-2); }
.rw-panel-h {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 18px; border-bottom: 1px solid var(--rule);
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--ink-3);
}
.rw-count { color: var(--ink-2); font-variant-numeric: tabular-nums; }

/* ---- the plan ---- */
.rw-plan { list-style: none; margin: 0; padding: 6px 0; }
.rw-step {
  display: grid; grid-template-columns: 26px minmax(0,1fr) auto; align-items: baseline;
  gap: 10px; padding: 9px 18px; font-family: var(--sans); font-size: 14px;
  color: var(--ink-3); line-height: 1.45;
}
.rw-step-q { text-wrap: pretty; }
.rw-mark {
  width: 13px; height: 13px; border-radius: 50%; border: 1px solid var(--rule-bright);
  align-self: center; position: relative;
}
.rw-step-done { color: var(--ink-2); }
.rw-step-done .rw-mark { border-color: var(--confirmed); background: var(--confirmed); }
.rw-step-done .rw-mark::after {
  content: ""; position: absolute; left: 3.5px; top: 1px; width: 3px; height: 6px;
  border: solid var(--paper); border-width: 0 1.5px 1.5px 0; transform: rotate(42deg);
}
.rw-step-running { color: var(--ink); }
.rw-step-running .rw-mark {
  border-color: var(--accent); animation: rw-pulse 1.4s ease-in-out infinite;
}
.rw-tag {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--ink-mute); white-space: nowrap;
}

/* ---- sources ---- */
.rw-sources { list-style: none; margin: 0; padding: 4px 0; }
.rw-src { padding: 10px 18px; border-bottom: 1px solid var(--rule-soft); }
.rw-src:last-child { border-bottom: none; }
.rw-src a {
  display: block; font-family: var(--sans); font-size: 14px; line-height: 1.4;
  color: var(--ink-2); text-decoration: none;
}
.rw-src a:hover { color: var(--accent); }
.rw-src-meta {
  display: block; margin-top: 3px; font-family: var(--mono); font-size: 10.5px;
  color: var(--ink-mute);
}
.rw-src-fetching { opacity: .55; }
.rw-src-duplicate { opacity: .7; }
.rw-empty {
  padding: 18px; font-family: var(--serif); font-size: 14px; color: var(--ink-mute);
}

/* ---- the side rail ---- */
.rw-side { position: sticky; top: 26px; display: flex; flex-direction: column; gap: 20px; }
.rw-metrics {
  margin: 0; border: 1px solid var(--rule); border-radius: var(--r);
  background: var(--paper-2); overflow: hidden;
}
.rw-metric {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 13px 18px; border-bottom: 1px solid var(--rule);
}
.rw-metric:last-child { border-bottom: none; }
.rw-metric dt {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-mute);
}
.rw-metric-writer dd { font-size: 13px; font-weight: 500; font-family: var(--mono); color: var(--ink-2); }
.rw-metric dd {
  margin: 0; font-family: var(--sans); font-size: 21px; font-weight: 600;
  color: var(--ink); font-variant-numeric: tabular-nums;
}
.rw-btn {
  display: block; width: 100%; text-align: center; padding: 12px 16px;
  border-radius: var(--r-sm); font-family: var(--mono); font-size: 10.5px;
  letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  border: 1px solid var(--rule-bright); background: transparent; color: var(--ink-2);
  text-decoration: none; transition: border-color .12s, color .12s, background .12s;
}
.rw-btn-primary { border-color: var(--accent-bd); background: var(--accent-bg); color: var(--accent); }
.rw-btn-primary:hover { border-color: var(--accent); color: var(--accent-2); }
.rw-working { font-family: var(--mono); font-size: 11px; color: var(--ink-mute); }
.rw-note {
  font-family: var(--serif); font-size: 13px; line-height: 1.55; color: var(--ink-mute);
  margin: 0;
}

@media (max-width: 900px) {
  .rw-grid { grid-template-columns: 1fr; gap: 24px; }
  .rw-side { position: static; }
}
@media (max-width: 620px) {
  /* The tag costs more than it says here: it took a third of the row and
     forced the operator's own question to wrap five times beside it. Which
     line is theirs is obvious anyway — it is the one at the top, and it is
     the page's H1 directly above. */
  .rw-tag { display: none; }
  .rw-step { grid-template-columns: 22px minmax(0,1fr); gap: 8px; padding: 9px 14px; }
  .rw-src { padding: 10px 14px; }
  .rw-panel-h { padding: 12px 14px; }
}

`;

// Deterministic content fingerprint — used so the cache-busting query string
// on the inlined-CSS reference (none yet; reserved for the future) updates
// whenever the stylesheet changes.
export function operatorStylesHash(): string {
  let h = 0;
  for (let i = 0; i < OPERATOR_CSS.length; i++) {
    h = (h * 31 + OPERATOR_CSS.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
