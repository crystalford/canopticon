# Read it — the plan

> Status: **steps 1–2 built** (2026-10-14): shape, Read it, the cards, Keep /
> Dismiss / ignore-forever, the receipt. Next: the document page after "Show
> on the page", "Write this", Admin badges, links. Originally a plan (2026-10-14). Written after a research pass over
> the Black Box handoff (ESSAY-CONTRACT, `canopticon-record.schema.json`, the
> Admin / Document Evidence / project prototypes, the content JSON), the
> product docs (`the-record.md`, HANDOFF, CHANGELOG) and the old pipeline's
> code. Decisions still open are marked **Decide**.

## What it is

A button. On any of the author's documents — a waiting or published upload in
Admin, or a document page when signed in — **Read it** has Claude read that one
document, whole, once, and lay out what is in it as cards the author keeps or
dismisses. It runs only when pressed (rule 4). It replaces the old pipeline
(`graph/lib/processing.ts`), whose output no page of the new site shows.

The handoff already defines this step precisely: the schema says it "governs
the read". Contract §0: "Every document has been read once. The read produced
`derivations`… Every derivation carries a `quote_id` that resolves, by exact
substring match." What the handoff never built is the read itself, or any page
that shows per-document cards — the Admin prototype's "Reading… / Reading the
whole file once" is a 1.8-second animation over a regex.

## Rules it keeps (from the handoff, with sources)

1. **Whole, once, in one call.** "Each document is read once, whole, in one
   call… No chunks, no passes." The receipt records `chars_read == char_count`.
   The largest report in the record is ~125k characters (~31k tokens); all fit.
2. **Every card is anchored to a verbatim span, checked in code**, and the span
   stored is the document's own text (as `locateVerbatim` does), never the
   model's string. Spans that fail are dropped **and counted on the card strip**
   ("3 proposed spans did not match the text and were dropped" — always shown).
3. **The document's own words, never a grade.** `standing`, `source_type` and a
   figure's rating are the document's labels ("vendor claim", "interpretation,
   not a finding", "established / emerging / speculation") or empty. Never
   upgraded, never assigned by the machine. A figure the document says not to
   rely on is kept and marked rejected.
4. **Every passage has a role** (contract §2b): *finding* (a fact about the
   world, with a source), *reasoning* (the document's own inference),
   *recommendation* (advice to the author), *premise* (the author's own decision
   echoed back — "Given your decision…"). **Only findings and reasoning may be
   used as evidence.** Recommendations and premises are labelled and never feed
   an article's argument. Build briefs: findings citable, the rest not.
5. **Shape before model.** What the file's structure gives — TL;DR, Key
   Findings, Caveats, Sources and `[n]` markers, question-shaped headings — is
   taken without a model (`origin: shape`), shown at once and free.
6. **Never across documents as judgement.** "Nothing is graded, reconciled or
   summarised across documents." Links between documents are queries over what
   the reads found, not the model's opinion that two documents agree.
7. **Never** a thesis about a person or organisation; never the author's "why";
   never a page (a person adds it); dismiss is forever.
8. **Counts are never a ranking.** Lists are recent-first. Three documents
   "agreeing" may be one upstream page echoing (CLAUDE.md).
9. **Say what was read.** Each read leaves a receipt: when, model, characters
   read of characters held, spans verified, spans dropped, cost, duration.

## What it produces (the cards)

Each card shows the kind, the verbatim span with its section, the role, the
document's own label, and two actions: **Keep** / **Dismiss**.

| Card | Fields | Becomes |
|---|---|---|
| **Key figure** | figure as written · what it measures · period · attributed to · the document's rating · rejected? | the document page's Key figures (replacing today's regex) |
| **Finding / claim** | the span · role · standing (document's word) | the material articles quote |
| **Question answered** | the question · the answer span | "Questions this document answers" on the page |
| **Question raised, unanswered** | the question · the gap span ("I found no study…") | the author's research worklist; can become an open problem |
| **Coined name** | the naming span **and** the span flagging it new (both required) · phenomenon only, never a thing to build | a proposed concept (prior-art check pending; a person writes the definition) |
| **Open problem** | the obstacle, verbatim · who is closest · what would solve it · what to do meanwhile (each a span, if the document says) | a proposed open problem (a person writes the statement) |
| **Thesis** | the sentence where the document states its own central claim, verbatim — only if it does | the document's thesis line |
| **Prediction** | the span · resolves when | an open prediction, later "answered by" another document |
| **Caveat** | the span | "what cuts against" any article built on it |
| **Held?** | — | if the document is about the author, propose keeping it held / evidence-only |

Nothing here is published by the read. Keeping a card stores it; **Decide (A)**
covers how kept cards reach the public document page.

## Possible articles

The contract says "No model produces pitches" — a pitch is a query over the
record, scored in code (Denial, Distance, Grip, Proof; Proof 0 never shown;
Denial 2 with Proof ≤ 1 goes to "the shelf"). You asked for Claude to propose
articles and theses. The two fit if Claude proposes and **code gates**:

- A pitch is a thesis line plus its grounding pack: the hook span, supporting
  spans (findings and reasoning only), the strongest counter from Caveats, and
  where in the document it draws from (Key Findings *and* Details — the 29
  articles quote both almost equally: 427 vs 429 of 1,244 quotes).
- **Proof is computed**: the number of verified finding/reasoning spans it
  rests on. Proof 0 is never shown; fewer than 8 is marked thin (contract §3
  rule 10).
- **Rule 11, checked**: if the thesis line is stated in the document itself,
  it is a summary, not an article — refused.
- Never about a person or organisation; never one line from each of five
  fields (that is the withdrawn *The change you stop seeing*).
- **Write this** starts an article draft in the workspace, seeded with the
  pack; the author still writes the "why".

**Decide (B):** Claude-proposed pitches under these gates (recommended), or
only the contract's code queries (closer to the letter, fewer and later, since
the queries need many documents read first).

## Links to the rest of the record

Queries over the reads, never model claims (contract, schema "Links"):
- **Same source** — two documents cite the same URL in their Sources.
- **Same measure** — two documents give a figure for the same thing ("Two
  figures for one measure… both carried", as the project prototype shows).
- **Shared concept or work** — a coined name or named work in both, under
  different topics, where neither cites the other (the bridge rule; never a
  person or organisation).
- **Answered by** — a question raised in one, answered in another.

These grow as more documents are read; with one read they are empty, and the
card says so.

## Where it shows

- **Admin**: a "Read it" button on every upload card; after a read, the card
  says "Read · 12 figures · 9 findings · 3 dropped".
- **The workspace**: a read is a draft of kind `read` (not "reading" — that word
  already means the author's own passage notes). The chat stays open: "which
  figures does the Canadian data rest on?" works after the read.
- **The document page** (signed in): "Read it" and the receipt; once kept and
  shown (Decide A), the Document Evidence layout from the prototype: key figures
  with source and year, key findings, claims with their standing, questions
  answered, open threads and caveats, terms, and the strip "✓ n quotes checked".

## Storage (one migration)

- `reads` — the receipt per document read (model, chars, verified, dropped,
  cost, duration, status).
- `derivations` — one row per kept card: document id, kind, role, the verbatim
  span and where it sits, the document's labels, the structured fields
  (figure, measures, period, attributed_to…), status (kept / shown /
  dismissed).
- `ignores` — dismissed forever, so a re-read never proposes it again.

The old tables (`nodes`, `quotes`, `aeo_findings`…) are kept, unread (CLAUDE.md:
legacy tables are never dropped).

## Cost

The median report is ~31k characters (~8k tokens); the largest ~125k. A read is
one model pass plus the cards: roughly **$0.40–0.80 a report**, ~$1.50 for the
largest; reading all 123 stored reports once would be roughly **$50–100**.
Estimates until the first reads are measured; every read records its own cost.

## Build order

1. **Shape (no model).** TL;DR, Key Findings, Caveats, Sources, question
   headings and `[n]` taken from structure; the receipt; the tables. Free, and
   useful on its own.
2. **Read it.** The button, the `read` draft, one full read with the card
   tools, the verbatim check that stores the document's span and counts drops,
   Keep / Dismiss / ignore-forever.
3. **The document page** shows what was kept (Decide A).
4. **Possible articles** with computed Proof and "Write this" (Decide B).
5. **Links** as queries over the reads.
6. **Retire** the old pipeline (stop queuing it on Publish), the old research
   engine and the workbench's research and leads pages; keep their tables.

## Decided (2026-10-14, by the author)

- **(A)** One "Show on the page" per read: cards are kept or dismissed, then
  one approval puts what was kept on the document's public page.
- **(B)** Claude proposes possible articles; code gates them (computed Proof,
  rule 11, never about a person or organisation). "Write this" starts the
  article.
- **(C)** Read on press, one document at a time. No "Read all".
