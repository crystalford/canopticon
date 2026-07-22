// The method paper — the conceptual completeness of the instrument, as
// structured content. Rendered by pages/method.ts; mirrored for the
// record in docs/instruments/blindspot/method-paper.md.
//
// Bodies are HTML (no Markdown parser at runtime). Citations link into
// the /sources catalog by anchor. The stated parameters are interpolated
// from content/capitalization-factors.ts so the paper and the running
// model can never disagree. Honesty boxes — the firewall made legible —
// use <aside class="bs-honesty">.

import { CAPITALIZATION_FACTORS, INDEX_PARAMS } from "./capitalization-factors.ts";

export interface MethodSection {
  /** Stable id → the sticky TOC anchor + deep links. */
  id: string;
  /** Section number as shown ("1", "2", …) or null for the abstract. */
  num: string | null;
  title: string;
  /** Rendered HTML body. */
  bodyHtml: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function cite(id: string, label: string): string {
  return `<a href="/sources#${id}">${label}</a>`;
}

const factorRows = CAPITALIZATION_FACTORS.map(
  (f) =>
    `<tr><td>${f.assetClass}</td><td class="bs-num">×${f.factor}</td><td class="bs-num">${pct(f.impliedReturn)}</td><td>${f.sourceNote}</td></tr>`,
).join("");

export const METHOD_PAPER: MethodSection[] = [
  {
    id: "abstract",
    num: null,
    title: "Abstract",
    bodyHtml: `
<p>Canada measures the wealth of its richest households three different official ways. The direct household survey — the ${cite("sfs", "Survey of Financial Security")} — puts the top 1%'s share of net worth near <strong>13.7%</strong>. A Pareto correction of that survey's upper tail by the ${cite("pbo-hnw", "Parliamentary Budget Officer")} raises it to roughly <strong>24%</strong>. Statistics Canada's distributional accounts — the ${cite("dhea", "DHEA")}, benchmarked to the National Balance Sheet — put it near <strong>26.6%</strong>.</p>
<p>These are not rounding differences. They are the same country, the same year, measured three ways, disagreeing by nearly a factor of two at the very top. This instrument does not pick a winner. It makes the disagreement itself the subject, quantifies it as a single figure — the <strong>Invisibility Index</strong> — and decomposes that figure into the four channels through which top-tail wealth escapes measurement.</p>`,
  },
  {
    id: "proposition",
    num: "1",
    title: "The Proposition",
    bodyHtml: `
<p>The claim is narrow and falsifiable: <strong>the three official Canadian methods of estimating top-tail wealth disagree by an amount that grows as you move up the distribution, and the disagreement is largest precisely at the top, where policy attention is highest and data quality is lowest.</strong></p>
<p>It would be refuted if, in a given year, the three methods agreed at the top 1% to within their stated uncertainty — or if the spread narrowed rather than widened as you moved from the top quintile to the top 0.1%. The instrument tests this every time the sources are refreshed, and shows the spread rather than asserting it.</p>
<p>What the proposition does <em>not</em> claim: that any one method is correct. Each is internally coherent and measures a real thing. The instrument's subject is the space between them.</p>`,
  },
  {
    id: "mechanism",
    num: "2",
    title: "The Mechanism — why the three methods disagree structurally",
    bodyHtml: `
<p>The three methods disagree because they are built on three different foundations, each with a known blind spot at the top.</p>
<p><strong>The survey</strong> (${cite("sfs", "SFS")}) asks households directly. Its blind spot is participation: the wealthiest households are the least likely to respond, and a household worth hundreds of millions is unlikely to appear in the sample frame at all. Non-response and top-coding pull the estimate down hardest exactly where the wealth is most concentrated. See ${cite("sfs-technical", "the survey's own non-response documentation")}.</p>
<p><strong>The Pareto correction</strong> (${cite("pbo-hnw", "PBO")}) accepts the survey below the top and replaces its upper tail with a Pareto distribution fitted to the observed data plus external rich-list anchors. Its blind spot is the fit: the result is only as good as the assumed tail exponent and the anchor points, and it inherits whatever the survey got wrong below the splice.</p>
<p><strong>The capitalization method</strong> (${cite("dhea", "DHEA")}, grounded in ${cite("ksz-zwick", "the Saez–Zucman / KSZZ literature")}) works backwards from income: it takes the capital income a group reports — interest, dividends, business income — and multiplies by a capitalization factor to recover the underlying stock. Its blind spot is income itself: assets that generate little or no taxable income (unsold appreciated equity, closely-held business value, offshore holdings) are underweighted or invisible, while the assumed rates of return swing the answer materially.</p>
<p>Three foundations, three blind spots, one distribution. The gap between them is not noise — it is the shape of what each method cannot see.</p>`,
  },
  {
    id: "spread",
    num: "3",
    title: "The Spread",
    bodyHtml: `
<p>The first movement draws the three methods on one set of axes across every year we can source, and fills the zone between the highest and lowest method. That filled zone — "the zone official statistics cannot resolve" — is the headline visual. It is not a confidence interval; it is the disagreement between equally-official measurements.</p>
<p>The spread is computed as the difference, in each period, between the maximum and minimum reported top-1% share across the three methods. Where a method is missing for a year (the methods are published on different cadences), the chart shows only the methods that exist and never interpolates a method into a year it did not report.</p>
<aside class="bs-honesty">
  <span class="bs-honesty-tag">Honesty · the scope mismatch</span>
  The three methods do not all measure the same denominator. The survey and the Pareto correction estimate <strong>net worth</strong> (assets minus debts). The capitalization method, as published in the DHEA, most directly estimates the distribution of <strong>financial assets</strong>. These are different quantities, and comparing their top-shares is comparing two overlapping-but-distinct measures. The instrument flags this permanently on the chart and never averages across the two scopes. The spread is real; the scopes are not identical, and we say so wherever the number appears.
</aside>`,
  },
  {
    id: "index",
    num: "4",
    title: "The Invisibility Index",
    bodyHtml: `
<p>The second movement collapses the spread into one number. The <strong>Invisibility Index</strong> is the dollar value of the gap at the top: the wealth that the highest method sees and the lowest method does not, for the top 1%, in the most recent year all three methods can be aligned. It is reported in dollars and as a share of the top group's wealth.</p>
<p>The Index is then decomposed into four channels — a stated hypothesis about <em>where</em> the invisible wealth hides:</p>
<ul>
  <li><strong>Unrealized capital gains — ${pct(INDEX_PARAMS.unrealizedShare)}.</strong> Appreciation that was never sold, so it never became income, so income-based methods never saw it. ${cite("fox-liscow", "The buy–borrow–die literature")} argues this is the largest channel.</li>
  <li><strong>Private equity — ${pct(INDEX_PARAMS.privateEquityShare)}.</strong> Closely-held business value with no market price, systematically undervalued by income capitalization. The residual after the other three channels.</li>
  <li><strong>Offshore wealth — ${pct(INDEX_PARAMS.offshoreShare)}.</strong> Assets held through foreign structures that report no domestic income. Bounded by ${cite("ajz", "the offshore-wealth estimates of Alstadsæter, Johannesen and Zucman")}.</li>
  <li><strong>Survey non-response — ${pct(INDEX_PARAMS.nonresponseShare)}.</strong> The mechanical pull of the richest households declining to be surveyed.</li>
</ul>
<aside class="bs-honesty">
  <span class="bs-honesty-tag">Honesty · a CANOPTICON construction</span>
  The Invisibility Index is <strong>not an official statistic</strong>. The gap it measures is real and drawn entirely from official sources, but the <em>decomposition</em> into four channels is a CANOPTICON model with stated assumptions. The channel shares (${pct(INDEX_PARAMS.unrealizedShare)} / ${pct(INDEX_PARAMS.privateEquityShare)} / ${pct(INDEX_PARAMS.offshoreShare)} / ${pct(INDEX_PARAMS.nonresponseShare)}) are our working hypothesis grounded in the cited literature, not a measurement. They are tunable in one file and change nothing else. Read the total as measured; read the split as argued.
</aside>`,
  },
  {
    id: "recovery-ratio",
    num: "5",
    title: "The Recovery Ratio",
    bodyHtml: `
<p>Every capitalization estimate should be checkable against a known aggregate. The <strong>recovery ratio</strong> is the share of an independently-known wealth total that the method reproduces when its factors are applied to the income data. We publish it as the ratio of the Pareto-corrected top share to the capitalization top share — a legibility check on how far apart the two upper-tail methods sit.</p>
<p>A ratio near 1.0 means the two methods agree at the top; a ratio well below the target of <strong>${pct(INDEX_PARAMS.recoveryTarget)}</strong> means the capitalization method is recovering far more top wealth than the Pareto correction, and the period is flagged <em>unreliable</em> on the instrument rather than presented as settled. We would rather show a flagged number than a false precision.</p>`,
  },
  {
    id: "behavior",
    num: "6",
    title: "The Behavior Strip",
    bodyHtml: `
<p>The third movement is supporting evidence, not headline. Drawing on the ${cite("nbsa", "National Balance Sheet Accounts")}, it shows two series: the ratio of financial to non-financial assets on the household balance sheet, and debt-to-disposable-income. Together they sketch a circuit — a savings glut concentrated at the top financing indebted demand below it.</p>
<p>The strip is deliberately wide and short: it contextualizes the top-tail concentration without competing with it. The one annotation marks the 2020 pandemic spike, when the savings glut and the debt line moved sharply in opposite directions.</p>`,
  },
  {
    id: "where",
    num: "7",
    title: "Where You Stand",
    bodyHtml: `
<p>The fourth movement makes the distribution personal. Enter a net-worth figure and the instrument places it on the official Canadian distribution — and shows, in the same disagreement-zone colour from the first movement, the region where the official distribution stops being able to resolve differences. Past the top 1% threshold (around <strong>$7.4M</strong> in 2023, per ${cite("pbo-hnw", "the PBO")}), the placement is an extrapolation, and the instrument says so.</p>
<aside class="bs-honesty">
  <span class="bs-honesty-tag">Honesty · privacy + extrapolation</span>
  <strong>Nothing you enter leaves your browser.</strong> The calculation runs entirely client-side — no network request, no storage, no logging. And past the official top-1% threshold, the percentile you see is an extrapolation into the exact region this instrument exists to say is unresolved. It is shaded to make that unmistakable.
</aside>`,
  },
  {
    id: "limitations",
    num: "8",
    title: "Limitations",
    bodyHtml: `
<p>The honest edges of the instrument, collected:</p>
<ul>
  <li><strong>Scope mismatch.</strong> Net worth (survey, Pareto) and financial assets (capitalization) are not the same denominator; the spread partly reflects that.</li>
  <li><strong>Cadence mismatch.</strong> The three methods publish on different schedules; alignment years are sparse and the instrument never interpolates a method into a year it did not report.</li>
  <li><strong>The channel split is modelled, not measured.</strong> The total gap is sourced; the four-way decomposition is a stated hypothesis.</li>
  <li><strong>Capitalization factors are assumptions.</strong> The implied rates of return below swing the capitalization estimate; they are documented and tunable.</li>
</ul>
<table class="bs-factor-table">
  <thead><tr><th>Asset class</th><th class="bs-num">Factor</th><th class="bs-num">Implied return</th><th>Note</th></tr></thead>
  <tbody>${factorRows}</tbody>
</table>`,
  },
  {
    id: "unrealized-note",
    num: null,
    title: "Companion note — the unrealized-gains channel",
    bodyHtml: `
<aside class="bs-honesty" style="margin-top:0">
  <span class="bs-honesty-tag">Caveat first</span>
  Everything in this note is a CANOPTICON construction. The unrealized-gains channel is the single largest and the single least directly measured piece of the Invisibility Index. Treat it as the instrument's central argument, not its most solid number.
</aside>
<p>Why put the largest weight (${pct(INDEX_PARAMS.unrealizedShare)}) on unrealized gains? Because the failure is structural, not statistical. An asset that appreciates but is never sold generates no realized income. Income-based methods — including the capitalization method that produces the <em>highest</em> official estimate — capitalize income flows, so an asset producing no income contributes nothing to capitalize. The wealth is real, growing, and borrowable against, but invisible to the measurement.</p>
<p>${cite("fox-liscow", "The buy–borrow–die framing")} describes the mechanism: hold appreciating assets, borrow against them to fund consumption (a loan is not income), and pass them at death with a stepped-up basis. At no point does the gain become taxable income, and at no point does an income-based wealth estimate see it. This is why the channel gets the largest share and why it is flagged the loudest: it is where measurement and reality diverge most, and where the instrument's argument is strongest and least verifiable.</p>`,
  },
];
