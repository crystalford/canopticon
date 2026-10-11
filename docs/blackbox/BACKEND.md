# Backend handoff — subscriptions, feeds, WebSub (11 Oct 2026)

For Claude Code. The front end is built; these pieces need a server. Research behind the choices: FOLLOW-RESEARCH.md.

## What already exists (static, generated from Library DATA)
- `feed.xml` (RSS 2.0) and `feed.json` (JSON Feed 1.1): 120 items (articles, papers, research), newest first.
- `feeds/<topic-slug>.xml` and `.json`: one pair per topic (13 topics). Slug rule: lowercase, `&` → `and`, non-alphanumerics → `-`.
- Both carry a self link and a WebSub hub (`https://pubsubhubbub.appspot.com/`): `<atom:link rel="hub">` in RSS, `hubs` in JSON Feed.
- `llms.txt` at the root: H1, summary blockquote, feed URLs, one H2 per topic listing every document with a one-line description.
- Every page's `<head>` has autodiscovery: `<link rel="alternate" type="application/rss+xml" href="feed.xml">` and the JSON Feed equivalent.
- Item URLs: articles use `https://canopticon.com/articles/<slug>` (slug from each article's "Cite this" line); everything else uses `https://canopticon.com/` + the page file name as a placeholder. Map these to the real routes.

## To build
1. **Feed generation at publish time.** Regenerate `feed.*`, `feeds/*` and `llms.txt` from the content store whenever something is published. Use **full content** in feed items (`content:encoded` / `content_html`), not just the dek — feeds currently carry the summary only. Add `llms-full.txt` (all article text concatenated as Markdown).
2. **Combined topic feed.** The Follow page shows `canopticon.com/feed.xml?t=a,b` for multi-topic picks. Serve that as a filtered feed (or switch the page to an OPML download).
3. **WebSub publish ping.** After each regeneration, POST `hub.mode=publish` and `hub.url=<feed url>` to the hub for `feed.xml`, `feed.json` and every changed topic feed. Also send `Link: <hub>; rel="hub"` and `Link: <feed>; rel="self"` HTTP headers on feed responses.
4. **Email signup endpoint.** Forms on the homepage, every article and Follow submit an email (Follow also sends the topic picks). Requirements:
   - Double opt-in: send a confirmation email; nothing else is sent until it's clicked.
   - Store a consent record per subscriber: timestamp, IP, source page/form, topics, and the exact consent wording shown. Keep it 3 years after unsubscribe (CASL).
   - One-click unsubscribe in every email (List-Unsubscribe header too). Process within 10 business days (do it immediately).
   - Weekly digest job: only send if something new was published in the subscriber's topics that week.
   - Sender identification in every email: Canopticon / Chris Telford, mailing address, contact URL.
   - SPF, DKIM and DMARC on the sending domain.
5. **Fill the placeholder.** The Follow form shows `[mailing address]` — CASL requires a mailing address plus one contact method on the consent request. Have Canadian counsel confirm the final consent wording.
6. **Pages currently using the mock flow:** `Canopticon Follow.dc.html` (form state is local only), homepage strip and the "Get the next one by email" block on every article (both GET to Follow with `?email=`, which pre-fills the field).
