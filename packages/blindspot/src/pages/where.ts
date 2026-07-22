// The Where You Stand page — the only page on the instrument that runs
// client-side JavaScript. A single inline <script>: no fetch, no
// localStorage, no network of any kind. The net-worth figure never
// leaves the browser.
//
// The client re-implements placeOnPercentile + axisX so the marker lands
// with the identical math the server uses (data/percentile.ts,
// charts/percentile.ts). The anchors + axis geometry are interpolated in
// from those modules so the two can't drift.

import { AXIS, percentileAxisSvg } from "../charts/percentile.ts";
import { OFFICIAL_ANCHORS } from "../data/percentile.ts";
import { renderShell } from "./shell.ts";

const WHERE_CSS = `
.bs-where-page { max-width: 940px; margin: 0 auto; padding: clamp(40px,6vw,72px) clamp(18px,5vw,48px); }
.bs-where-head { max-width: var(--reading); margin-bottom: 30px; }
.bs-where-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(32px,5vw,48px); letter-spacing: -0.025em; line-height: 1.03; margin: 14px 0 16px; }
.bs-where-lead { font-family: var(--serif); font-size: 18px; line-height: 1.5; color: var(--ink-3); max-width: 52ch; }
.bs-calc { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 8px 0 28px; }
.bs-calc label { font-family: var(--mono); font-size: 12px; color: var(--ink-3); width: 100%; }
.bs-calc-input { font-family: var(--mono); font-size: 18px; padding: 12px 14px; border: 1px solid var(--rule); border-radius: var(--r); background: var(--surface); color: var(--ink); width: 260px; max-width: 100%; }
.bs-calc-input:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
.bs-calc-go { font-family: var(--mono); font-size: 14px; font-weight: 500; color: #fff; background: var(--accent-2); border: 0; padding: 13px 22px; border-radius: var(--r); cursor: pointer; }
.bs-calc-go:hover { background: var(--ink); }
.bs-where-result { font-family: var(--serif); font-size: 20px; line-height: 1.45; color: var(--ink); min-height: 1.4em; max-width: 60ch; }
.bs-where-result .amt { font-weight: 600; }
.bs-where-result .place { color: var(--accent-2); font-weight: 600; }
.bs-where-note { font-family: var(--serif); font-style: italic; font-size: 15px; color: var(--ink-3); margin-top: 10px; max-width: 60ch; min-height: 1em; }
.bs-where-svg { margin: 26px 0 6px; }
.bs-privacy { font-family: var(--mono); font-size: 11.5px; color: var(--ink-mute); margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--rule-soft); }
`;

export function renderWherePage(isOperator: boolean): string {
  const anchors = JSON.stringify(OFFICIAL_ANCHORS);

  // The single inline script. No backticks, no `${}` in client code — the
  // interpolations below are TS-side, evaluated once at render time.
  const script = `<script>
(function(){
  var ANCHORS = ${anchors};
  var X0=${AXIS.X0}, X1=${AXIS.X1}, LOG_MIN=${AXIS.LOG_MIN}, LOG_MAX=${AXIS.LOG_MAX};
  function log10(x){ return Math.log(x)/Math.LN10; }
  function axisX(cad){ var t=(log10(cad)-LOG_MIN)/(LOG_MAX-LOG_MIN); t=Math.max(0,Math.min(1,t)); return X0+t*(X1-X0); }
  function place(nw){
    var A=ANCHORS, first=A[0], last=A[A.length-1];
    if(nw<=first.thresholdCad) return { p: first.percentile*Math.max(0, nw/first.thresholdCad), ex:false };
    for(var i=0;i<A.length-1;i++){
      var lo=A[i], hi=A[i+1];
      if(nw>=lo.thresholdCad && nw<=hi.thresholdCad){
        var t=(Math.log(nw)-Math.log(lo.thresholdCad))/(Math.log(hi.thresholdCad)-Math.log(lo.thresholdCad));
        return { p: lo.percentile+t*(hi.percentile-lo.percentile), ex:false };
      }
    }
    var alpha=1.5, remaining=1-last.percentile, aboveShare=Math.pow(last.thresholdCad/nw, alpha);
    return { p: Math.min(0.999999, 1-remaining*aboveShare), ex:true };
  }
  function ord(n){ var j=n%10,k=n%100; if(j===1&&k!==11)return 'st'; if(j===2&&k!==12)return 'nd'; if(j===3&&k!==13)return 'rd'; return 'th'; }
  function label(o){ if(o.p>=0.99){ var top=(1-o.p)*100; return 'top '+(top<0.1?top.toFixed(3):top.toFixed(2))+'%'; } var nth=Math.round(o.p*100); return nth+ord(nth)+' percentile'; }
  function money(n){ if(n>=1e9)return '$'+(n/1e9).toFixed(1)+'B'; if(n>=1e6)return '$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3)return '$'+Math.round(n/1e3)+'k'; return '$'+Math.round(n); }
  var input=document.getElementById('bs-nw-input');
  var go=document.getElementById('bs-nw-go');
  var result=document.getElementById('bs-where-result');
  var note=document.getElementById('bs-where-note');
  var marker=document.getElementById('bs-marker');
  var mline=document.getElementById('bs-marker-line');
  var mdot=document.getElementById('bs-marker-dot');
  var mlabel=document.getElementById('bs-marker-label');
  function run(){
    var raw=(input.value||'').replace(/[^0-9.]/g,'');
    var nw=parseFloat(raw);
    if(!isFinite(nw)||nw<=0){ result.textContent='Enter a net-worth figure above.'; note.textContent=''; marker.setAttribute('opacity','0'); return; }
    var o=place(nw); var lab=label(o); var x=axisX(nw);
    mline.setAttribute('x1',x); mline.setAttribute('x2',x); mdot.setAttribute('cx',x);
    mlabel.setAttribute('x',x); mlabel.textContent=money(nw);
    var col=o.ex?'#3a63a0':'#2c4d7e'; mdot.setAttribute('fill',col); mline.setAttribute('stroke',col);
    marker.setAttribute('opacity','1');
    result.innerHTML='A net worth of <span class="amt">'+money(nw)+'</span> places you in the <span class="place">'+lab+'</span> of Canadian households.';
    note.textContent=o.ex?'This is past the official top-1% threshold — an extrapolation into the zone the official distribution cannot resolve. Read it as a direction, not a precise rank.':'';
  }
  go.addEventListener('click', run);
  input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); run(); } });
})();
</script>`;

  const body = `
<div class="bs-where-page">
  <header class="bs-where-head">
    <div class="bs-label">Where you stand</div>
    <h1 class="bs-where-h1">Place a net-worth figure against the official distribution</h1>
    <p class="bs-where-lead">Enter a number. It stays in your browser — the instrument places it on the official Canadian net-worth distribution, and shows where that distribution stops being able to see.</p>
  </header>

  <div class="bs-calc">
    <label for="bs-nw-input">Net worth (CAD)</label>
    <input id="bs-nw-input" class="bs-calc-input" type="text" inputmode="numeric" placeholder="e.g. 1,200,000" autocomplete="off" />
    <button id="bs-nw-go" class="bs-calc-go" type="button">Place it</button>
  </div>

  <p id="bs-where-result" class="bs-where-result">Enter a net-worth figure above.</p>
  <p id="bs-where-note" class="bs-where-note"></p>

  <figure class="bs-figure">${percentileAxisSvg()}
    <figcaption class="bs-figcaption">A log-scale net-worth axis. The shaded region past the official top-1% threshold is the same disagreement zone from the first movement — beyond it, the official distribution is an extrapolation.</figcaption>
  </figure>

  <p class="bs-privacy">This calculation does not leave your browser. No network request is made, nothing is stored, nothing is logged. We record nothing.</p>
</div>
${script}`;

  return renderShell({
    title: "Where you stand",
    description:
      "Place any net-worth figure against the official Canadian wealth distribution — and see where that distribution stops being able to see. The calculation never leaves your browser.",
    activeNav: "/where",
    isOperator,
    canonical: "https://blindspot.canopticon.com/where",
    extraCss: WHERE_CSS,
    body,
  });
}
