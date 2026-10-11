// /follow — the weekly email, topic picks, and feeds for readers who would
// rather not give an address. docs/blackbox/README.md §Follow,
// docs/blackbox/BACKEND.md. Email first; topics optional (the consent sentence
// names them); a preview of what this week's email would carry; then the feed
// and the agent panels.
//
// The form is a plain POST and works without script. /site.js keeps the
// consent sentence and the combined-feed address in step with the boxes as
// they are ticked; the server computes the same sentence from what was
// submitted and stores THAT as the consent wording (CASL).

import { libraryItems } from "../content/store";
import { listedArticles, writingFor } from "../data";
import { esc, pill, shell } from "../layout";
import { kindColours, shortDate, topicColours, topicSlug } from "../theme";

/** The prototype's order (pages/Canopticon Follow.dc.html); a topic it did
 *  not know about follows, biggest first. */
const ORDER = [
  "McLuhan & media theory",
  "Attribution & credit",
  "AI-directed development",
  "Prices & markets",
  "Attention & feeds",
  "Health & self-care",
  "ADHD & attention",
  "Canadian economy & policy",
  "Housing",
  "Drugs & public health",
  "Habits & maintenance",
  "Canadian media",
  "Economics",
];

/** Topics a reader can follow: those with at least one article, as on the
 *  prototype, each with its article and research counts. */
export function followTopics(): Array<{
  name: string;
  slug: string;
  articles: number;
  research: number;
}> {
  const map = new Map<string, { articles: number; research: number }>();
  for (const r of libraryItems()) {
    if (r.shelf === "investigation" || !r.topic || r.topic === "Other") continue;
    const e = map.get(r.topic) ?? { articles: 0, research: 0 };
    if (r.kind === "Article") e.articles++;
    else if (r.kind === "Research") e.research++;
    map.set(r.topic, e);
  }
  const rank = (n: string) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length);
  return [...map]
    .filter(([, c]) => c.articles > 0)
    .map(([name, c]) => ({ name, slug: topicSlug(name), ...c }))
    .sort(
      (a, b) => rank(a.name) - rank(b.name) || b.articles + b.research - (a.articles + a.research),
    );
}

/** The prototype's wording: "anything on the site", one topic by name, or
 *  "N topics". */
export function pickedPhrase(picks: string[]): string {
  if (!picks.length) return "anything on the site";
  if (picks.length === 1) return picks[0] ?? "";
  return `${picks.length} topics`;
}

export function consentWording(picks: string[]): string {
  return `By subscribing you agree to receive Canopticon's weekly email from Chris Telford, covering ${pickedPhrase(picks)}. You'll confirm by email first, and you can unsubscribe at any time with one click. Contact: canopticon.com`;
}

/** The combined feed's address for these picks, as the prototype builds it. */
export function feedAddress(picks: string[]): string {
  if (!picks.length) return "canopticon.com/feed.xml";
  if (picks.length === 1) return `canopticon.com/feeds/${topicSlug(picks[0] ?? "")}.xml`;
  return `canopticon.com/feed.xml?t=${picks.map(topicSlug).join(",")}`;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function renderFollow(
  opts: {
    email?: string | undefined;
    topics?: string[];
    sent?: string | undefined;
    error?: string | undefined;
    signedIn?: boolean;
  } = {},
): string {
  const topics = followTopics();
  const picks = (opts.topics ?? []).filter((t) => topics.some((x) => x.name === t));
  const sentTo = opts.sent;

  const form = sentTo
    ? `<div class="f-sent"><span>Check ${esc(sentTo)} and click the link to confirm. Nothing is sent until you do.</span><a href="/follow" class="f-change">Change</a></div>`
    : `${opts.error ? `<p class="f-error">${esc(opts.error)}</p>` : ""}<label for="follow-email" class="f-label">Email address</label><div class="form-row"><input id="follow-email" class="field f-field" type="email" name="email" required autocomplete="email" placeholder="you@example.com" value="${esc(opts.email ?? "")}" /><button type="submit" class="btn f-btn">Get the weekly email</button></div><p class="f-consent" data-consent>${esc(consentWording(picks))}</p>`;

  const latest = listedArticles().slice(0, 3).map(writingFor);
  const preview = `<div class="f-preview">${latest
    .map(
      (w, i) =>
        `<a href="${esc(w.route)}"${i ? ' class="b"' : ""}><span class="f-pv"><span class="pills">${pill(w.kind, kindColours(w.kind), "pill lg")}${pill(w.topic, topicColours(w.topic), "pill lg")}</span><span class="f-pt">${esc(w.title)}</span></span><span class="f-pd">${esc(shortDate(w.date))}</span></a>`,
    )
    .join("")}</div>`;

  const box = (fill: string) =>
    // The tick is drawn by CSS from the input's own :checked state (and, for a
    // topic, from Everything's), so the box tells the truth without script.
    `<span aria-hidden="true" class="f-box" style="--fill:${fill}"></span>`;
  const totals = {
    articles: libraryItems().filter((r) => r.kind === "Article").length,
    research: libraryItems().filter((r) => r.kind === "Research" && r.shelf !== "investigation")
      .length,
  };

  const everything = `<label class="f-topic"><input type="checkbox" name="everything" value="1"${picks.length ? "" : " checked"} data-everything />${box("#2f55c4")}<span class="f-tb"><span class="tpill" style="background:var(--tint);color:var(--ink);padding:3px 11px">Everything</span><span class="f-ts">Every new article and research document — ${count(totals.articles, "article", "articles")} and ${count(totals.research, "research document", "research documents")} so far.</span></span><a href="/feed.xml" class="f-rss">RSS</a></label>`;
  const topicRows = topics
    .map((t) => {
      const on = picks.includes(t.name);
      const [bg, fg] = topicColours(t.name);
      const sub = `${count(t.articles, "article", "articles")} · ${t.research} research`;
      return `<label class="f-topic"><input type="checkbox" name="topic" value="${esc(t.name)}"${on ? " checked" : ""} data-topic="${esc(t.slug)}" />${box(fg)}<span class="f-tb"><span class="tpill" style="background:${bg};color:${fg};padding:3px 11px">${esc(t.name)}</span><span class="f-ts">${esc(sub)}</span></span><a href="/feeds/${esc(t.slug)}.xml" class="f-rss">RSS</a></label>`;
    })
    .join("");

  const feedUrl = feedAddress(picks);

  const col = `<div class="f-col"><h1 class="h-topic" style="margin:0">New research, once a week</h1><p class="f-lede">One email a week, sent only when something new is published: the latest articles and research documents in the topics you choose. Free.</p><form method="post" action="/follow" class="f-form" data-follow-form>${form}<h2 class="f-h2">What this week's email would include</h2>${preview}<h2 class="f-h2">Choose topics <span>· optional</span></h2><p class="f-sub">Leave it on Everything, or narrow the email to the subjects you care about.</p><div class="f-topics">${everything}<div class="f-or">Or choose topics</div>${topicRows}</div></form></div>`;

  const rail = `<aside class="f-rail"><div class="card f-card"><h2>Prefer a feed reader?</h2><p>Your choices as one RSS feed. Each topic also has its own.</p><div class="cite-row" style="padding:8px 8px 8px 12px;align-items:center"><code class="cite-t f-code" data-cite-text data-feed-url>${esc(feedUrl)}</code><button type="button" class="btn sm" data-copy-cite><span>Copy</span></button></div></div><div class="card f-card"><h2>For AI tools and agents</h2><p>llms.txt lists every document in plain text so AI tools and agents can find it. Each article also carries standard citation metadata.</p><div class="pills"><a href="/llms.txt" class="tpill" style="background:#e4ecf7;color:#1f4e8c;font-size:13px;padding:3px 11px">llms.txt</a><a href="/about#m-machines" class="tpill" style="background:var(--tint);color:var(--ink);font-size:13px;padding:3px 11px">How it works</a></div></div></aside>`;

  return shell({
    title: "Follow",
    description:
      "One email a week, sent only when something new is published — or follow by RSS, one feed or one per topic.",
    path: "/follow",
    signedIn: opts.signedIn ?? false,
    body: `<div class="f-wrap">${col}${rail}</div>`,
  });
}
