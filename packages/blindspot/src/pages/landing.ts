// The instrument landing — composes the hero + the four movements from
// live D1 data. Each movement degrades to its "no data yet" slot when
// its query is empty, so the page reads finished before the first
// refresh and paints numbers after it.

import {
  getBehaviorSeries,
  getLastFetchedBySource,
  getLatestIndex,
  getLatestThreshold,
  getSpreadSeries,
} from "../data/queries.ts";
import type { Env } from "../env.ts";
import { renderBehaviorMovement } from "./movements/behavior.ts";
import { renderIndexHero } from "./movements/index-hero.ts";
import { renderSpreadMovement } from "./movements/spread.ts";
import { renderWhereTeaser } from "./movements/where-teaser.ts";
import { renderShell } from "./shell.ts";

const LANDING_CSS = `
.bs-hero { padding: clamp(48px,8vw,96px) clamp(18px,5vw,48px) clamp(30px,5vw,48px); max-width: 1120px; margin: 0 auto; }
.bs-hero-h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(44px,9vw,92px); letter-spacing: -0.035em; line-height: 0.98; margin: 14px 0 22px; }
.bs-hero-dek { font-family: var(--serif); font-size: clamp(18px,2.4vw,22px); line-height: 1.5; color: var(--ink-3); max-width: 42ch; }
.bs-hero-meta { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 26px; }
.bs-hero-link { font-family: var(--mono); font-size: 13px; }

.bs-movement { max-width: 1120px; margin: 0 auto; padding: clamp(28px,5vw,52px) clamp(18px,5vw,48px); border-top: 1px solid var(--rule); }
.bs-movement-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 18px; }
.bs-movement-num { font-family: var(--mono); font-size: 13px; color: var(--accent); font-weight: 500; }
.bs-movement-h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px,4vw,38px); letter-spacing: -0.02em; line-height: 1.08; }
.bs-movement-dek { font-family: var(--serif); font-size: 16.5px; line-height: 1.5; color: var(--ink-3); max-width: 60ch; margin-bottom: 24px; }

.bs-index-hero { text-align: center; padding: 8px 0 28px; }
.bs-index-number { font-family: var(--serif); font-weight: 500; font-size: clamp(56px,11vw,96px); letter-spacing: -0.03em; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.bs-index-caption { font-family: var(--serif); font-size: 17px; line-height: 1.45; color: var(--ink-3); max-width: 540px; margin: 16px auto 0; }
.bs-index-recovery { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); margin-top: 12px; }
.bs-decomp { max-width: 760px; margin: 0 auto 30px; }
.bs-decomp svg { height: 56px; }
.bs-channels { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.bs-channel-card { background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg); padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.bs-channel-kicker { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-2); }
.bs-channel-h3 { font-family: var(--sans); font-weight: 600; font-size: 16px; letter-spacing: -0.01em; color: var(--ink); }
.bs-channel-blurb { font-family: var(--serif); font-size: 14px; line-height: 1.45; color: var(--ink-3); flex: 1; }

.bs-where-teaser { max-width: 1120px; margin: 0 auto; padding: clamp(36px,5vw,56px) clamp(18px,5vw,48px); }
.bs-where-card { background: var(--accent-bg); border: 1px solid var(--accent-bd); border-radius: var(--r-lg); padding: clamp(28px,5vw,48px); text-align: center; }
.bs-where-card h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px,4vw,36px); letter-spacing: -0.02em; margin-bottom: 12px; }
.bs-where-card p { font-family: var(--serif); font-size: 17px; color: var(--ink-3); max-width: 52ch; margin: 0 auto 22px; }
.bs-where-cta { display: inline-block; font-family: var(--mono); font-size: 13px; font-weight: 500; color: #fff; background: var(--accent-2); padding: 12px 22px; border-radius: var(--r); }
.bs-where-cta:hover { background: var(--ink); text-decoration: none; }

@media (max-width: 860px) { .bs-channels { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .bs-channels { grid-template-columns: 1fr; } }
`;

export async function renderLandingPage(env: Env, isOperator: boolean): Promise<string> {
  const [spread, index, behavior, threshold, lastFetched] = await Promise.all([
    getSpreadSeries(env).catch(() => []),
    getLatestIndex(env).catch(() => null),
    getBehaviorSeries(env).catch(() => []),
    getLatestThreshold(env).catch(() => null),
    getLastFetchedBySource(env).catch((): Record<string, string> => ({})),
  ]);

  const body = `
<section class="bs-hero">
  <div class="bs-label">Instrument · Canadian top-tail wealth</div>
  <h1 class="bs-hero-h1">The Blind Spot</h1>
  <p class="bs-hero-dek">Canada measures the wealth of its richest households three different official ways — and they disagree most precisely where it matters most: at the very top. This instrument makes the disagreement itself the subject, and quantifies it as one number.</p>
  <div class="bs-hero-meta">
    <a class="bs-hero-link" href="/method">Read the method →</a>
    <a class="bs-hero-link" href="/sources">See the sources →</a>
  </div>
</section>
${renderSpreadMovement(spread, lastFetched)}
${renderIndexHero(index)}
${renderBehaviorMovement(behavior)}
${renderWhereTeaser(threshold)}
`;

  return renderShell({
    title: "The Blind Spot",
    description:
      "Canada's three official methods of measuring top-tail wealth disagree most at the very top. The Blind Spot renders the disagreement as the subject and quantifies it as the Invisibility Index.",
    activeNav: "/",
    isOperator,
    canonical: "https://blindspot.canopticon.com/",
    extraCss: LANDING_CSS,
    body,
  });
}
