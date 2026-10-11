# Follow page — research and recommendations (11 Oct 2026)

## Diagnosis of the current page
- The email form sits in a **sidebar**, the weakest placement for signups.
- The headline ("Follow") states the action, not what the reader gets.
- No **sender identity, contact address or withdraw-consent statement**, which Canadian anti-spam law (CASL) requires on the signup form itself.
- The email input relies on a placeholder/aria-label; there is no visible label.
- Feeds are described but not wired: no `<link rel="alternate">` autodiscovery in page heads, no per-topic feed URLs a reader or agent can actually fetch.
- The agents panel overclaims ("tools can cite it accurately") — llms.txt is not proven to change AI citation.

## Recommendations, by priority

### 1. Must fix (legal, Canada)
- On the form: name the sender (Canopticon / Chris Telford), a mailing address plus one contact (email or URL), what will be sent and how often, and "you can unsubscribe at any time".
- No pre-ticked consent box. Typing an email and pressing Subscribe counts as active opt-in.
- Double opt-in (confirm by email) and store consent records: timestamp, source page, exact consent wording. Keep 3 years after the subscriber leaves.

### 2. Design and conversion
- Move email to the **main column**, first thing on the page. Topics become an optional refinement below it, defaulting to Everything.
- Benefit headline + frequency: e.g. "New research, once a week" with one line on what arrives.
- Button says what you get ("Get the weekly email"), not "Subscribe".
- Show a **preview of this week's email** (the 3 latest pieces it would contain) — value before the ask.
- Visible label on the email field; clear inline error; success state that says "check your inbox to confirm" (already present).
- Social proof only once it is real (subscriber count); never invent it.
- Add the same one-field form **at the end of every article** — inline, in-context forms convert best. Keep the homepage strip.

### 3. Developer / machine-readable
- Feed autodiscovery in the `<head>` of every page: `<link rel="alternate" type="application/rss+xml" title="Canopticon — all" href="https://canopticon.com/feed.xml">`, plus a JSON Feed (`application/feed+json`), plus one titled alternate per topic on topic pages.
- Feeds: valid, full content (not teasers), correct dates, self link.
- WebSub: `rel="hub"` in each feed so readers like Feedly get push updates and agents can discover the subscription endpoint.
- llms.txt + llms-full.txt at the root; per-topic sections in llms.txt mirroring the topic list.
- Real, copyable per-topic feed URLs on the Follow page (replace the mock `?t=` string).

### 4. SEO / AEO / GEO — honest expectations
- llms.txt is cheap and useful for agents, but independent studies find it is **not** a ranking or citation factor and frontier-lab crawlers rarely fetch it. Describe it plainly; don't promise citations.
- What does help answer engines: the articles' existing citation metadata and JSON-LD, clean titles, and the full-text feeds above.
- Give the Follow page a real title and meta description ("Follow Canopticon — weekly research by email, RSS or JSON Feed").

## Sources consulted
NN/g homepage principles; newsletter-signup benchmark write-ups (Omnisend, Klipfolio, GetResponse, FormMaker, Campaign Monitor); CASL guidance (Mailchimp, Canadian advertising law, compliance guides); RSS Advisory Board autodiscovery spec; WHATWG feed autodiscovery; CSS-Tricks on web feeds; WebSub/Superfeedr docs; llms.txt adoption studies (SE Ranking via Limy, Digital Applied log study, Semrush). One source claimed a W3C llms.txt draft and a 23% citation lift; it could not be corroborated and conflicts with the log studies, so it is not relied on.

This is not legal advice — confirm the CASL wording with Canadian counsel before collecting real emails.
