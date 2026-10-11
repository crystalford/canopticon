# Homepage — research and spec (11 Oct 2026)

## What the sources say
- **Say what the site is, at a glance.** NN/g: a homepage must communicate in one glance where users are, what the site does and what they can do there; use a plain tagline, not a welcome. Canopticon's only statement of purpose was a visually hidden h1.
- **Show specific examples, not category signposts.** NN/g 3.2: curated samples of real content beat generic links to section pages.
- **One clear priority; avoid visual competition.** NN/g 4.2: if everything is emphasised, nothing stands out.
- **Topics are how people navigate a content-rich research site.** Our World in Data's redesign kept "Browse by topic" and search as the most-used routes, added a full topic list, and labelled content kinds (articles, topic pages, charts) rather than giving each kind its own region.
- **Avoid "one thing after another" with no way to skim by topic.** Gwern's design post-mortems name this as the failure of chronological/unstructured listing; the gwern.net index is organised by topic.
- **Consistency across pieces.** The Works in Progress design review faults issues where every piece has its own type and borders — nothing anchors them to each other.

## Diagnosis of the old homepage
Organised by content type (articles, papers, concepts, open problems, research) — five parallel lists, each a different container, so it read as a stack of unrelated sections. No visible purpose statement. Several competing calls to action.

## Spec
1. **Purpose line** — a visible one-sentence description, the subjects covered, search, and the content kinds as plain links with counts.
2. **Latest** — the newest article large, the next two beside it. Recency, with specific examples.
3. **Browse by topic** — the main body: one group per topic, each showing its three best pieces of any kind (article, paper, concept, research) with a kind label, and a link to the whole topic. Smaller topics listed in one line underneath.
4. **What the research turned up** — named concepts and open questions side by side, four each.
5. **Trust strip and footer.**

Buttons: no solid black fills. Text links carry descriptive labels (no "learn more", no trailing arrows).
