> **11 Oct 2026:** pages named Map, Compose and Essay were folded into Admin or replaced by the 28 published articles; references below are updated. Length rule: as long as the research warrants (no caps). Live examples: content/articles/*.md.

# The Essay Contract — research → essay, exactly

> **Naming (3 Oct 2026).** The public name for these pieces is **Articles** — nav, index ("Six articles so far"), the label above each title, URLs (`/articles/<slug>`), citations ("Cite this article"). "Essay" in this file is the internal word and means the same thing; file names (`Canopticon Essay *.dc.html`) keep it. "Article" keeps the academic register (journals publish research and review articles) without the opinion connotation of "essay"; the academic weight is carried by the page — thesis, receipts, what cuts against it, what would settle it, versions, citation line. "Video essay" (a source genre) and the document kind "Essay" (an uploaded document that is an essay) are unchanged.


This is the one document Claude Code builds the essay engine from. Where it conflicts with HANDOFF.md, this file wins. `the desk (Canopticon Admin.dc.html)` (route `/desk/engine`) draws this contract as a page of the site; when one changes, change the other.

The bar: an essay must survive a hostile reader who opens every receipt. Slop is anything a reader could have got from asking a model the question cold. The tests below are designed so that slop cannot pass them.

---


## The standard — read this first (3 Oct 2026)

**Purpose.** An article puts forward one idea from the research that a curious reader would not reach alone, and tests it honestly against the evidence. When anything below conflicts, the order is: **the idea → accuracy → clarity → form.**

1. **Idea first.** One sentence states the idea, and the dek carries it. The title names the piece's subject plainly enough that it could not be about something else ("Who will count an AI assistant's influence: advertising attribution after the agent", not "The Missing Oracle"); check that no word in it reads as a company, product or film name. A coined term is fine if the first paragraph says plainly what it means. Titles follow §6b, which replaced the old compressed-thesis rule on 10 Oct 2026.
2. **Evidence is findings and reasoning, quoted word for word.** Never a recommendation or the author's own decision echoed back as proof.
3. **Clarity means defining, not deleting.** Explain each concept where it first appears; say who does what. Keep the frame that makes the idea.
4. **Honesty means answering, not listing.** The strongest objection is answered where it bites. An article ends on what the idea means — not on a test. Name a test only when it is real and outside the project: a study the research says nobody has run, or a public event anyone could watch for. Never end on a project's own plan, its kill lines or thresholds — those are advice to the author, not a conclusion for a reader.
**Stranger's reading.** Before a title passes, write one line: "A reader who sees only this title will expect: …". If that expectation does not match the article, the title fails. The author of the article cannot judge this from memory of the article — write the line as if from outside. Borrowed phrases and metaphors ("the new normal", "the ground", "the oracle", "scaffolding") fail unless the title itself makes plain what they refer to.
**No record-speak in articles.** Sentences about Canopticon itself — "the record holds both open", "until a document answers them", "the read", "a pass" — never appear in an article. The article talks about the world.
**Machine phrasing to avoid.** In titles and headings especially: "X has no Y" / "no one can…" negations, "not X but Y", "the missing…", "the real…", "nobody sells…". Say what is true, positively, with a concrete subject ("ads will be paid for by influence once an AI company counts it").
5. **Form is flexible.** Headings say something. No fixed list of sections.

**Revising.** One article at a time, only on a problem the author names. The new version is written beside the original with a list of exactly what changed; the author compares and chooses. Nothing is overwritten.

Everything after this section — the title study, structure notes, article types, passage roles — is background guidance. It informs a draft; it does not gate one.

## 0. What exists before an essay

Every document has been read once. The read produced `derivations`: figures, dated events, findings, claims (with the document's own word for their standing), evidence links, questions, definitions, threads, predictions, recommendations, relations, terms, and — where the document argues something — one `thesis`. Every derivation carries a `quote_id` that resolves, by exact substring match, to a span of the stored text. Nothing else is available to the essay engine. It never reads the web and never reads a document that has not been read.

---

## 1. Pitches — where essays come from

A pitch is a row produced by a query over the record. No model produces pitches. Six queries, run nightly:

| kind | the query | the hook |
|---|---|---|
| `thesis-stated` | a document has a `thesis` derivation and no essay yet takes it up | the thesis span, verbatim |
| `just-read` | a document was read in the last 7 days | its first `finding` |
| `shared-across-projects` | a `term` appears in documents from two different projects, or a project and a standalone topic, and neither document cites the other | the two passages that name it |
| `same-measure-disagrees` | two `figure` derivations share a normalised label and differ in value | both figures, with each document's standing for its source |
| `source-leaned-on` | one outside source is cited by three or more documents | the three citing passages |
| `prediction-answered` | a `prediction` in document A is matched by an `event` or `finding` in a later document B | both spans |

**The bridge rule** (replaces the old "shared term"): for `shared-across-projects`, the term must be a *concept or work*, never a person or organisation, and the two documents must not cite each other. A shared name is a link on the page; only a shared idea across a distance is a pitch.

**Scores, computed, never asked of a model.** Every pitch carries four 0–2 marks:

- **Denial** — 2 if the hook span contains a "seems / actually", "not … but", "contrary to", "is not X, it is Y" construction, or the document names a misconception it corrects; 1 if the thesis is stated without naming what it denies; 0 otherwise.
- **Distance** — 2 if the documents are in different projects/topics; 1 if same topic, different documents; 0 if one document.
- **Grip** — 2 if a `prediction` or an unexplained `thread` is attached to the hook; 1 if a `question` is; 0 otherwise.
- **Proof** — the number of verified receipts available to the pitch, capped: 2 if ≥ 8, 1 if 3–7, 0 if fewer.

A pitch with **Proof 0 is never shown**. A pitch with Denial 2 and Proof ≤ 1 goes to the **shelf** ("strange, unresolved"), revisited when a new document adds receipts. Everything else appears on the desk under *What the record could say*, sorted by total. Dismiss → `ignores`, forever.

**Yours.** You may type a thesis in one sentence. It becomes a pitch of kind `operator-thesis` with Denial scored from your sentence, Distance and Proof computed from the documents you attach (or the record, if you attach none). Same gates apply — including Proof 0 never drafts.

---

## 1b. Coined here — the one page the record proposes

- **Detection.** The read emits a `coinage` derivation when a document proposes a name for a concept and marks it as new ("a suggested name", "a coinage, not established terminology", "no single name exists"). The span naming it and the span flagging it as new are both required.
- **A document's proposals are not the author's decisions.** Names and plans a research document suggests ("the Dampener", "build first: Cue Forge") are stored as `recommendation` derivations with standing *proposed by this document*. They appear on that document's page only. A project page shows only what the operator has written or confirmed about the project; it never lists a document's suggestions as the project's plan, features or roadmap, and the read never renames a project after one.
- **Phenomena only.** A coinage names something that happens (a pattern, a mechanism, a failure). Names for things to build — "Receipt Exchange", "Collision Desk", "Public Work Exchange", "Recommendation Ledger", "the Dampener" — are a document's proposals, not concepts, and stay on that document's page. A borrowed term (Swanson's "undiscovered public knowledge") is a term, not a coinage.
- **Desk.** A coinage is shown first, above pitches, as *Coined here: write the definition*. Dismiss → Ignore.
- **Page.** Claude drafts a one-paragraph definition from the grounding; it becomes a page only when you approve it (one click) or edit it. The page states how it was made: "Drafted with Claude, approved by Chris Telford, <date>", or "Written by Chris Telford" if you replaced it. The definition is the only non-receipted text on the page, so the check that matters is yours: is this the idea, and would you say it this way? The page (`/concepts/<slug>`) shows: your definition and the date first stated; the companion terms; where it came from (your observation, then the research); the existing pieces it joins, with receipts; why it's new (the document's own gap statements); how to tell it apart; what would test it (held open); every later use (essays, videos, documents) linked back.
- **Status.** "Proposed term" until an outside use is linked; then "in use". Never "established".
- **Markup.** `DefinedTerm` with `author`, `dateCreated`, `inDefinedTermSet` = Canopticon Concepts, `subjectOf` = the grounding document. Indexed; in the sitemap and llms.txt.
- **Essays.** Any essay using the term links its first use to the concept page; the concept page lists the essay under *Used since*.

## 1c. Two more page types, same rule (a person writes the paragraph)

- **Open problems** (`/open/<slug>`). Same approve-or-edit rule for the problem statement. When a document concludes that something wanted does not exist yet — a product, a dataset, a study — and says why. Page: the problem in your words; why it's unsolved (the document's obstacle, verbatim); who is closest; what would solve it; what to do meanwhile; status *open* until a later document reports it solved, then *solved* with that receipt. First example: whey that dissolves in hot black coffee ("You cannot buy a whey protein today that goes into hot black coffee at 20–30 g the way collagen does"). Others in the record: a network-wide click-to-sale lag dataset (The Engagement Layer); agent-signed decision provenance (Attribution Paradigm Shift).
- **Methods** (`/about#methods`, not separate pages yet). A named practice gets an entry only once the record shows it in use — a pitch or essay made with it. Net-casting is a report's name for what the desk already does (Swanson bridges, denial scores, a separate judge, a 24-hour hold), so it is described there, credited as a name the report proposed. Separate method pages only when there are three used methods.
- **Not page types:** people, organisations, every term, topics without a written note, products you are building (those live on their project page).

## 2. Grounding — what the drafter is given

When you press **Draft**, the engine assembles a grounding pack. It is a JSON object, never prose:

```
{
  "pitch": { kind, hook_quote, scores },
  "thesis_form": "what seems to be X is in reality Y",   // filled from the hook or your sentence
  "documents": [ { slug, title, kind, project, topic, standing_vocabulary } ],
  "receipts": [ { quote_id, text, document, section, kind, standing } ],   // every derivation attached to the pitch, max 60
  "cuts_against": [ receipts of kind claim/finding/evidence that contradict the thesis, plus every 'caveat' and 'not found' thread ],
  "settles_it": [ every prediction and kill-criterion derivation in the documents ],
  "outside_sources": [ { as_written, url_if_resolved, title_match: true|false } ],
  "banned_phrases": [ ... see §5 ],
  "author_voice": [ 3 paragraphs from the author's published essays, chosen by the operator once ]
}
```

`cuts_against` is filled by the record, not by the drafter: the documents' own caveats, "not found this pass", "treat as vendor claim", evidence marked `undercuts`, and any `same-measure-disagrees` pitch touching the same figures. If `cuts_against` is empty the draft still runs, but the essay says so in §4 ("Neither document argues against this. That is a weakness of the sources, not a strength of the claim.").

---

## 2b. What a passage is — only findings and reasoning carry an article (3 Oct 2026)

Every passage the read stores gets a role: **finding** (a fact about the world, with a source), **reasoning** (the document's own inference), **recommendation** (advice to the author) or **premise** (the author's own decision or assumption echoed back — "given that you send the newsletter yourself…"). The drafter may quote only findings and reasoning as evidence. Recommendations and premises may be mentioned, labelled for what they are ("the report advises…", "on the author's own plan…"), never used to support a claim, and never anchor a title. The quote audit fails an article that uses one as evidence.

Why: research written for a project argues with its author. A sentence that agrees with the author's plan reads like a finding and is not one; quoting it cites the author's decision back as proof. (Found 3 Oct: the newsletter-measurement article's title rested on such a sentence.)

Build briefs — research written for a project — are a document kind of their own. Their findings can be cited; their recommendations and premises cannot. See RESEARCH-PROMPT.md for how to commission research that keeps the four apart.

## 3. The draft call — one call, one model, fresh session

Claude, via the AI Gateway, one call per pitch, no conversation history. The system prompt is this file's §3–§5. The user turn is the grounding pack.

**Shape the draft must return** (JSON, then rendered):

```
{ "title", "dek", "thesis_line",
  "sections": [ { "heading", "paragraphs": [ { "text", "receipts": [quote_id...] } ] } ],   // 4–6 sections
  "cuts_against": { "heading": "What cuts against this", "paragraphs": [...] },
  "settles_it":  { "heading": "What would settle it",  "paragraphs": [...] },
  "sources": [ as_written... ],
  "unreceipted_sentences": [ sentence... ]   // the drafter's own; must be listed
}
```

**Rules the drafter follows:**

1. Every quotation is copied character-for-character from a receipt in the pack, wrapped in `<mark>` with its `quote_id`. Paraphrase is allowed but is not a quotation and gets no mark.
2. Every paragraph cites at least one receipt, except the opening and the close. The author's own sentences — explanation, definitions, the connections between pieces of evidence — are listed in `unreceipted_sentences` and rendered dotted; there is no per-section limit, but they carry no number the source does not give and no claim the source does not support.
2b. **Tables.** Where the source has a table of figures, the article may reproduce the rows it needs as a table. Each cell is copied verbatim and the table links to the passage; no cell is computed.
3. Numbers appear only as they appear in a receipt. No arithmetic on them, no rounding, no "roughly". This governs the author's own sentences and the dek, not only quoted spans, and it covers numbers spelled as words — "thirteen years" for the gap between two dated figures is arithmetic, and "fifteen years" for a period the source dates differently is rounding (both caught 10 Oct 2026). Say what the source says, or say it without a number. The check runs over every number word (one…ninety, hundred, thousand, dozen) in the author's prose and the dek, not a shortlist, and it tests the number's use rather than whether the word appears anywhere in the document — "three small jobs" is not supported by a source that says "all three levers". Fractional phrases count as numbers — "a fifth", "a third", "a century and a half", "one in five" — and so does silently changing a denominator (60% of mortgages is not a fifth of households).
4. The document's own word for a source's standing travels with the quote: if the document called it a vendor claim, the essay calls it a vendor claim. The same applies to a document's labels for its own passages — "established / emerging / speculation", "interpretation, not a finding", "a coinage, not established terminology" — which become the derivation's standing and are never upgraded.
5. §"What cuts against this" uses only `cuts_against` receipts. It must contain the strongest one, not the weakest. If the pack marks a counter as "decisive", the essay says the thesis may be wrong.
6. §"What would settle it" names at least one dated or checkable observation from `settles_it`, or says none exists and what would have to be written down.
7. The opening 40 words answer the question a reader would type. No throat-clearing, no "in this essay".
8. The author's voice pack is a register to match, never a source to quote.
9. Length follows the material (changed 11 Oct 2026). An article is as long as the research warrants, with as many sections as the argument needs (author, 11 Oct): no word or section caps in either direction. Most documents in the record are rich enough for long-form; a thin one makes a short piece. Length and sections are earned by the source, never padded, and never trimmed to fit a number. The extra length goes into depth on the one idea — context for each piece of evidence, the comparisons and history the source gives, the reasons the evidence is limited — never into a second topic. A thesis that needs a second topic is two articles. (The old 600–1,000-word cap was never intended by the author; it produced articles that read as a chain of quotes with one-line connectors.)
10. If the pack cannot support the thesis — fewer than 8 usable receipts, or `cuts_against` contains a decisive counter with no answer in the pack — the drafter returns `{ "refuse": true, "reason": ... }`. Refusal is a normal outcome and is shown on the desk as "not enough in the record yet".
11. **The thesis is the author's, not a source's.** Write `thesis_line` before choosing a single quotation, then search every document in the pack for it. If one document already states it, the essay is a summary of that document: refuse, or find the claim that only appears when two documents are read together. *Nobody Sells Proof* passes (no single document joins "no outcomes" to "no remedy"); *The Missing Oracle* v1 failed (it restated one brief's verdict).
12. **The argument is the subject; documents are witnesses.** A document, report or "pass" is the grammatical subject of at most one sentence per section. "The pass names…", "its verdict…", "the review is careful here…" turn an essay into a book report.
13. **Quotations must read as part of the sentence.** No capital letter mid-sentence, no stray punctuation either side of the mark, no quotation over ~40 words. If a passage only fits by bending the sentence around it, paraphrase it unmarked or choose another.
14. **The title** names the claim or the thing in five words or fewer, has no subtitle and no colon, and is not lifted from a source sentence. The dek carries no number that is not in a receipt.
15. **Read every document in the pack in full before drafting.** Quotations chosen by keyword search are the ones that matched the search, not the ones that carry the document.
16. **One essay per session.** A drafter that has just written another essay inherits its moves; start fresh.
17. **§cuts-against and §settles-it are required content, not a form.** Write them as argument. Do not open with a count ("Three things.") and do not reuse the previous essay's sentence shapes.

---

## 4. Verification — mechanical, after the draft, before you see it

Run in code, not by a model:

- **Receipt check.** Every `<mark>` span is located as an exact substring of its document's stored text. The comparison strips Markdown formatting characters — emphasis (`**`, `*`) and code backticks — and nothing else — never curly/straight quote normalisation, never whitespace collapsing. Those alter the characters of the quotation and hide real mismatches; typed smart quotes in a span that the source writes straight is a failure, not a formatting difference. (Caught 10 Oct 2026: four spans across two articles passed a lenient audit and would have failed §4.) A span that fails is **deleted along with its sentence**, and counted. If more than 2 sentences are deleted, the draft is discarded and re-run once with the failures named; if it fails again, it refuses.
- **Number check.** Every numeral in the draft appears in some receipt in the pack. Otherwise the sentence is deleted.
- **Quotation-mark check.** Nothing inside quotation marks is unmarked. Paraphrase in quotation marks is a hard fail.
- **Standing check.** A quote from a source the document flagged (vendor · unverified · rejected) is not presented as a finding.
- **Structure check.** Sections present as the argument needs; §cuts-against present and non-empty or carrying the "neither document argues against this" line; §settles-it present; sources present; opening ≤ 40 words to first receipt.
- **Slop check** (§5). Any hit deletes the sentence.
- **Unreceipted sentences.** Listed and rendered dotted; checked for numbers and unsupported claims like every other sentence.

The draft that reaches the draft room shows its verification line: *n quotations verified · m dropped · k sentences yours*. If m > 0, the dropped sentences are shown struck through in the margin, so you can see what the model tried to say and could not support.

---

## 5. The slop list — banned by string match

Deleted on sight, sentence and all. Extend it whenever you catch a new one.

**Openers:** "In today's", "In an era", "In a world where", "As we navigate", "It is important to note", "It goes without saying", "In this essay", "This piece explores", "Let's dive", "Delve", "Unpack".
**Connectives:** "Moreover", "Furthermore", "Additionally", "In conclusion", "Ultimately, ", "At the end of the day", "That being said", "It's worth noting".
**Puffery:** "game-changer", "revolutionary", "transformative", "landscape" (as metaphor), "ecosystem" (as metaphor), "tapestry", "testament to", "underscores the importance", "paradigm shift" (unless quoting), "cutting-edge", "robust", "seamless", "leverage" (verb), "navigate" (metaphor), "journey" (metaphor), "unlock", "empower".
**Hedges that say nothing:** "arguably", "it could be argued", "some might say", "in many ways", "to some extent", "a nuanced".
**Fake balance:** "on the one hand … on the other", "both sides", "there are pros and cons".
**Structural tells:** any sentence beginning "This" whose referent is the previous sentence; three-item lists in three consecutive sentences; a paragraph ending in a rhetorical question; em-dash count > 2 per paragraph; any section heading that is a question the section does not answer in its first sentence.
**House tells** (caught in the first six essays): "Three things.", "Not thin. None.", "is doing all the work", "is just the … again", "Read next to", "The pass draws the conclusion itself", "Its verdict:"; any section whose closing sentence is an aphorism with no receipt and no new claim.
**Model tells:** "As an AI", "I cannot", "It's important to remember", "Please note", any sentence about the essay itself.

The list is a floor. The real test is §6.

---

## 6. The hostile-reader test — what "quality" means here

Before publishing, you answer five questions on the desk. The essay cannot be published until each has an answer of at least one word.

1. **What did I learn that I could not have got by asking a model?** (If the answer is "nothing", the essay is slop with receipts. Kill it.)
2. **Which sentence would the most informed person in this field object to, and is the objection in §cuts-against?**
3. **Which receipt is doing the most work, and have I opened it?**
4. **Is the thesis still true if the weakest receipt is removed?**
5. **Would I say this to that person's face?**

Your answers are stored with the essay (private). The 24-hour quarantine starts when the draft lands; Publish unlocks after both the quarantine and the five answers. Override is one click and is logged.

---

## 6b. Titles — the thesis, compressed, with a receipt

A title is the article's claim in a few words, not its topic. It is held to the same standard as a quotation: it must be defensible from the record, and the page shows what it rests on.

**Form (replaced 10 Oct 2026).** The old rule — 2–7 words, no colon, the thesis compressed — was the cause of a house style that reads like a machine wrote it: an abstract subject performing a verb, pitched as an epigram ("A blackout writes nothing down", "AI ideas drift to the average") — and its successor rule still allowed a reversal clause, which produced a second round of the same fault ("Feed ranking: the system watches the video now, not just the clicks"). Both are retired. Every title came out the same shape, and the shape was the tell.

The title's job is to say what the piece is about and give a reason to read it. **The claim lives in the dek, where there is room for it.** So:

- **Name the real things.** Platforms, substances, places, programmes, periods — the nouns a reader can recognise cold ("YouTube, Instagram and TikTok", "Fred Hutch's HSV gene therapy", "Hamilton", "Austria, France and India"). A title that needs the reader to already know what "the system", "the video" or "feed ranking" refers to has named nothing. Pronouns and bare abstractions as the subject are a failure.
- **State the coverage, not a twist.** The research documents title themselves by listing what is inside — subject, then the specific contents. Do the same. A reversal clause ("…not just the clicks", "…, not measured", "the gains stay, the drive goes") is an epigram, not a title; it is the single most common failure here and is banned outright.
- **Borrow the shape of a good research title.** The documents in the record title themselves well — "The Neurobiology of Alcohol Blackouts: How Ethanol Silences the Brain's Memory-Writing Machinery" names the subject and then the mechanism. An article title does the same at a readable length: subject, colon, the specific contents. The shipped titles to measure against are "Fred Hutch's HSV gene therapy in 2026: mouse and guinea-pig results, no human trial, and the antivirals arriving first" and "Opioid deaths and overdose calls in Hamilton: why the two counts moved in opposite directions".
- **Length follows the subject, not a word count.** Six words or twenty, whichever names it. A colon is the normal joint between the subject and what the piece covers.
- **Plain beats clever.** If a title sounds like a line of copy, it is one. Nothing is gained by compressing an argument into an aphorism; the dek has room.
- **A question is allowed** when the piece answers it in its first screen ("Why people keep scrolling: habit, infinite feeds, and the evidence against the dopamine explanation").
- **No title is a claim on its own.** The claim belongs in the dek. A title may name a finding as part of its coverage ("…why the two counts moved in opposite directions"), but a standalone assertion — especially one built on a reversal — is the failure this rule exists to stop. This supersedes the earlier allowance for claim-titles.
- **Represent the whole document, not the half that makes the cleaner argument.** If the source proposes a design, a recommendation or a conditional verdict, the article reports it — even when another part of the same document argues against a weaker version of the idea. The paid-task-queue article first quoted the rejection of self-paid wages and left out the same document's recommendation of an earn-back subscription, which made the piece more conclusive than its source (11 Oct 2026).
- The dek carries the argument in at most two sentences, and carries no number that is not in a receipt.

**Checks, in order — a title that fails one is rewritten, not published:**
1. **Thesis first.** The article states its thesis in one sentence, anchored to at least two quoted passages (two documents unless the article is about one report).
2. **Entailment.** Every claim in the title follows from the thesis. Nothing in the title is stronger than the thesis.
3. **Anchor.** The title names one quoted passage it rests on. The rail shows it as "Title rests on" with the receipt, so a reader can check the title the way they check a quote.
4. **Scope words.** "Nobody", "never", "all", "the end of" need a quoted passage that states the absence, and the title keeps that passage's scope ("No marketplace…", not "Nobody…", if the source checked marketplaces).
5. **Overreach.** Ask: what is the strongest way this title is false? If the article's own "What cuts against this" section supports that answer, narrow the title until it doesn't.
6. **Cold reader.** Shown only the title, a fresh model states the claim it expects. It must match the thesis; then title plus dek must let it say what the article argues.
7. **Legibility.** No term a general reader would need defined. Field terms (allostasis, figure/ground) belong in the dek or body, not the title.
8. **Coined phrases.** Allowed when the prior-art check finds no earlier use and the article defines the phrase in its first section. A coined phrase that passes can become a concept on Ideas.

The draft call proposes three titles that pass checks 1–4 — in different registers (plain description, question, claim), never three variations of one shape; you pick, and checks 5–7 run on the pick before publish. An existing title that fails is revised as a new version, with the old title kept in the version history.

## 6c. Structure (replaced 4 Oct 2026)

The fixed five-part shape that stood here ("How strong the evidence is", "What this means", "What would prove this wrong") is withdrawn: it produced templated endings that told the reader to go and test the idea themselves. The standard at the top of this file governs. In short: open with the idea plainly, build it step by step with objections answered where they arise, and **end on what the idea explains or changes**. Open questions the research raises go to Ideas as open problems, not to an article's last section.

## 6d. Plain writing — clarity rules, not a bar for what deserves an article (3 Oct 2026)

Canopticon is research and development: an article is an essay in the old sense, an attempt at a real question, and it may end open. These rules are about being understood, not about what is allowed to be written.

1. **Literal first.** Every claim has a concrete subject (a company, a person, a court) and a concrete verb (sends, counts, pays, sees). A metaphor may follow the literal sentence as an illustration; it is never the claim, and never the title.
2. **Introduce the parties.** When the argument turns on who does what, name each party and its role in plain words before the claim ("the newsletter's writer sends the email; the marketplace sells the slot and reads the numbers").
3. **The question, not the shop talk.** Pull what the research found about the world, not the internal details of the project it was written for (a product's ledger, its kill lines). Project specifics may appear as one example, named as such.
4. **No record vocabulary.** Words about how Canopticon works — pass, read, derivation, receipt-as-noun in prose — stay out of article sentences. Field terms are allowed when defined in the sentence where they first appear.
5. **Every heading states its point — the last one too.** No generic section names ("What would prove this wrong", "What follows"): the closing heading names the actual test or event ("The shift starts when an AI company reports what persuaded its assistant"). The article speaks as the record, not as a persona.

**Article types.** The shared rules (claim in the first paragraph, headings that state something, objections answered, receipts, title checks) hold for all; the body shape follows the kind of question:
- **Argument** — a claim, its steps, objections in place (media theory; reframings).
- **Explainer** — a question, the short answer, what the evidence shows, what is uncertain, what to do (behaviour, health).
- **Investigation** — what happened, the evidence, who is responsible, what is unresolved (political and legal inquiries).
- **Analysis** — the problem, the options, which works and why, what it means for people building in the field (technical and venture research).

## 6e. Revising a published article — how not to destroy one (3 Oct 2026)

What happened: in one afternoon of "improvements", *The Missing Oracle* was given a second source, then a new structure, then a plain-language pass, and ended as an obvious piece about newsletter measurement — retired the same day. *The haggle comes back* was rewritten in place, and its original text was not kept. Each step followed a rule; no step checked whether the idea survived.

Rules:
1. **Draft beside, then replace.** A revision is drafted as a separate page for comparison. Once the author chooses, the chosen text becomes the only version: no version pages, no version rows, no superseded notices on the site.
2. **Name the idea first.** Before revising, write one sentence: what makes this article worth reading. It comes from the author or from the original's thesis. The revision is checked against it at the end; if the idea is weaker, the revision is dropped.
3. **Revise only on a complaint.** Rules in this contract govern new drafts. A published article changes only when the author names a specific problem, and the revision fixes that problem only.
4. **Plain means defined, not deleted.** A conceptual frame (McLuhan's medium, the oracle) is often the idea itself. Make it legible — say what it means in the sentence that introduces it — instead of replacing it with something literal and obvious.
5. **Side by side.** Every revision is shown next to the version it would replace. A draft carries one collapsed line at the top ("Draft v2 · Not live · compare with v1 · what changed"); the change list opens on click. Live articles carry nothing at the top — their version history is a row in the side rail.

Applied 3 Oct, headings only: every generic closing heading on the live articles was renamed to state its point; the sections' text was not changed. Snapshots of every article as of 3 Oct 2026 are in `versions/2026-10-03/`.

## 7. After publishing — what the record does with the essay

- The essay is a document. It is read like any other (its own derivations, its own receipts), filed under the project or topic of the pitch, `parent_piece_id` = the pitch's documents.
- Every quotation in the essay becomes a **Cited by** entry on its source document.
- Predictions the essay makes are held open; when a later document answers one, that is a `prediction-answered` pitch for the next essay.
- If a source document gets a new version and a quoted span no longer matches, the essay's receipt shows *no longer in the source* and the essay is flagged on the desk. Nothing is silently rewritten.
- The verification line, the five answers' existence (not their text), and the quarantine date are emitted in the essay's `.json` and as a line under the byline: *17 quotations verified · 1 sentence the author's · held 24 h*.

---

## 8. What the engine never does

- Never searches the web while drafting.
- Never quotes a document that has not been read.
- Never completes a tetrad, scores with a lens, or applies a methodology.
- Never proposes a thesis about a person or organisation.
- Never publishes. Only you publish.
- Never rewrites a published essay.
- Never grades its own draft. Verification is code; judgment is yours.

---

## Worked examples in this package

Three drafts show the shape the engine must produce: `any published article (e.g. Canopticon Essay Haggle.dc.html)` (Nobody Sells Proof · 11 receipts · 2 documents), `the desk (Canopticon Admin.dc.html)` (Price Without Discovery · 28 receipts · 3 documents · in the draft room), `Canopticon Essay Rightness.dc.html` (The Feeling of Rightness · 17 receipts · 2 documents). Every quotation in them is verbatim from files in `uploads/`. Run the checks in §4 against them first; they should pass with 0 dropped.
