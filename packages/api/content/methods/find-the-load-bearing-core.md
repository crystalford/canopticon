---
slug: "find-the-load-bearing-core"
title: "Find the load-bearing core"
dek: "Mark every paragraph of a piece by the job it does, and find the paragraphs its argument cannot lose: how much of the piece carries the argument, where the repeats and previews gather, and the argument at its essential size."
theory: "the-load-bearing-core"
version: 1
date: "2026-11-28"
use_when: "Before rewriting or cutting a long piece, before making a summary, short or video from it, or when an outline feels like it misses the point."
input: "An essay, paper, report or script that argues or explains, with its paragraphs intact."
output: "A table of every paragraph and its job, totals by job and by section, the load share, the core in order as a skeleton, and what an existing outline misses."
steps:
  - step: "Number the paragraphs and count their words. Leave out the title, headings, references and captions."
  - step: "Write the piece's claim in one sentence before marking anything."
  - step: "Mark each paragraph with one main job: core, limit, elaboration, aside, restatement or frame."
  - step: "For each, ask: if this paragraph were deleted, would the claim lose a step, evidence it needs, or a limit the reader is owed? If yes, it is core or limit."
  - step: "Total the words by job and by section. The load share is core plus limit, over all words."
  - step: "Read the core alone, in order. If it does not hold together, a paragraph was marked wrongly or the piece is missing a step."
  - step: "Write the skeleton from the core: one move for each run of core paragraphs that does one thing. Compare it with the outline the headings give."
  - step: "Decide what each other paragraph is for, and which reader it serves."
---

This method turns the theory of [the load-bearing core](/theories/the-load-bearing-core) into a procedure. A person can follow the steps by hand in about an hour for a long paper. A language model can follow the instruction below in a few minutes, and its marking can then be checked paragraph by paragraph.

## What it rests on

- **The deletion test, applied to the argument.** Rhetorical Structure Theory splits a text into a central part and the parts that support it, and tests which is central by deleting it. This method moves the test from the clause to the paragraph and asks what the *argument* loses, so evidence a claim needs counts as core. See the theory's [prior work](/theories/the-load-bearing-core).
- **Readers agree on what is central.** Trained annotators agreed on central spans at kappa 0.86, and judges rating the importance of clauses agreed on 87% of them.
- **The central part is what lasts and what teaches.** Details were forgotten about four times faster than central ideas over three months, and summaries of the main points taught as well as or better than the full texts.
- **The rest serves particular readers.** Headings, previews and summaries help readers of complex texts, and rereading the main points at intervals helps memory, so each frame and repeat is judged by which reader it serves.

The studies, their numbers and what was read of each are on the [theory's page](/theories/the-load-bearing-core).

## Steps

1. **Number the paragraphs and count their words.** Leave out the title, headings, references and captions.
2. **Write the claim in one sentence first.** The marking is judged against it.
3. **Mark each paragraph with one main job.**
   - *Core:* states a claim, or gives evidence or reasoning a claim cannot stand without.
   - *Limit:* sets a claim's scope, states a limit, or answers an objection the reader is owed, the first time that answer is given.
   - *Elaboration:* background, a further example, a quotation that illustrates a point, detail about how something works.
   - *Aside:* true and interesting, but the argument does not use it.
   - *Restatement:* says again what an earlier paragraph said. Note which one.
   - *Frame:* an abstract, preview, roadmap, section summary, or a line introducing a quotation or list.
4. **Apply the deletion test.** If deleting the paragraph would cost the claim a step, evidence it needs, or a limit the reader is owed, it is core or limit.
5. **Total the words by job and by section.** The load share is core plus limit, over all words.
6. **Read the core alone, in order.** It should make the argument.
7. **Write the skeleton from the core** and compare it with the outline the headings give.
8. **Decide what each other paragraph is for.** Keep frames a complex piece needs, shorten a repeated answer to a pointer back, move asides to a note or cut them.

## The instruction

Paste this, followed by the piece, into a conversation with a language model, or download it as a skill below.

```text
Mark a piece of writing by the job each paragraph does, to find its load-bearing core: the paragraphs its argument cannot lose.

1. Number every paragraph of the body and count its words. Leave out the title, headings, references, captions and tables of contents.

2. Before marking, state the piece's claim in one sentence. If the piece has no single claim, say so, and mark against its main question instead.

3. Give each paragraph one main job:
   Core: states a claim, or gives evidence or reasoning that a claim cannot stand without.
   Limit: sets the scope of a claim, states a limit, or answers an objection the reader is owed. Only the first time that answer is given.
   Elaboration: background, a further example, a quotation that illustrates a point, or detail about how something works.
   Aside: something true and interesting that the argument does not use.
   Restatement: says again what an earlier paragraph already said. Name that paragraph.
   Frame: an abstract, preview, roadmap, section summary, or a line that introduces a quotation or a list.

4. Test every paragraph: if it were deleted, would the claim lose a step, a piece of evidence it needs, or a limit the reader is owed? If yes, it is Core or Limit. Evidence the claim needs is Core, even when it reads as supporting detail.

5. Report, in this order:
   a. The claim, in one sentence.
   b. A table with one row per paragraph: number, its first six words, word count, job, and for a restatement the paragraph it repeats.
   c. Totals by job, in words and as a share of all words. The load share is Core plus Limit.
   d. The same totals for each section, if the piece has sections.
   e. Where the restatements and frames gather.
   f. The core in order, as paragraph numbers, and the skeleton: one move for each run of core paragraphs that does one thing, written as "Role | what it says".
   g. If the piece already has an outline or skeleton, the core paragraphs it does not cover.
   h. The paragraphs you were least sure about, and the two jobs each could be.

6. Do not rewrite, shorten or judge the prose. Mark the main job only; where a paragraph clearly does two jobs, note the second.
```

## Worked example

[*Narcocrasis*](/papers/narcocrasis), a paper of 101 paragraphs and 5,716 words, marked by hand:

| Job | Words | Share |
| --- | --- | --- |
| Core | 1,936 | 34% |
| Limit | 484 | 8% |
| Elaboration | 1,515 | 27% |
| Aside | 217 | 4% |
| Restatement | 1,048 | 18% |
| Frame | 516 | 9% |

**Load share: 42%**, 37 paragraphs and 2,420 words. What the marking found:

- The thesis is stated four times: in the abstract, with the coined names, at the start of the third section, and in the conclusion.
- Eight of the ten replies to objections repeat a paragraph from the body almost one for one: 360 of that section's 482 words.
- The longest single paragraph, a 224-word table, carries no new claim.
- The paper's own central claim sits in one of its shortest sections, and the outline drawn from its sections missed six core paragraphs making four points.

For contrast, the essay [*Why you can't see your own addiction*](/articles/why-you-cant-see-your-own-addiction) argues the same idea in 818 words, with no abstract, roadmap, objections or restating conclusion, and has a load share of 88%.

## Where it fails

- **It needs a claim.** Narrative, description and lists have parts related in time or by topic, and often no part is more central than another.
- **Do not cut a complex piece to its core.** Frames and repeats help readers who skim or return, and readers of texts with complex structure. The core is what the piece rests on, and the finished piece is the writer's choice.
- **A paragraph often does two jobs.** The marking records the main one; the second is lost unless noted.
- **Markers differ.** A practised marker finds claims a piece implies but never states in one place; a less practised one, person or model, tends to mark topic sentences. Agreement at the level of the paragraph has not been measured. Check a model's marking against the deletion test before relying on it.
