# Since the prototype — what exists now

> For Claude Design, for the next version of Canopticon. Written 2026-10-15.
> Read it with `README.md` (the original Black Box spec). The prototype was
> built into the live site on 2026-10-11; everything below was added after,
> in code, without a design pass. **Nothing here is in the prototype**, so a
> redesign that starts from the prototype alone will drop it.
>
> The screenshots that come with this file (01–19) are the real site rendered
> with **sample data** — the drafts, reads and figures in them are seeded for
> testing, not the author's real record.

---

## 1. What did not change

The public pages are the prototype's, built faithfully: front, Library,
topics, document (`/p/<id>`), articles and papers, concepts, open problems,
Ideas, Investigations, Search, About, Follow, the feeds and the machine
twins. Same palette (paper, Geist, cobalt for interaction, brick for the
author's marks, green for verified), same 720px reading column, no
box-shadows. The additions below sit inside those pages.

---

## 2. What is new, surface by surface

### 2.1 Admin (`/admin`) — screenshots 01, 15

The prototype's Admin, plus:

- **Head links**: "Write and research with Claude" (→ the workspace),
  "Claude: connected / not connected" (→ `/admin/claude`), "Workbench —
  processing, leads, research" (the old console, not redesigned),
  "Download as .zip".
- **On every upload card** (waiting or published): a **Read it** button. Once
  a document has been read, the button becomes **Its read**, and the card's
  note gains a line: *Read 14 Oct · 9 kept · 2 dropped · on its page* (dropped
  in brick red). Personal (held) documents never get Read it.

### 2.2 Claude (`/admin/claude`) — screenshot 02

Whether Claude is connected and how, for the author only.

- A status block: connected through Cloudflare's AI Gateway (billed to
  Cloudflare) / with an Anthropic key (billed by Anthropic) / not connected.
- **Test the connection**: one small call, a fraction of a cent. The result
  is a block saying it works (model, reply, seconds) or what the provider
  answered (e.g. `401: invalid gateway token`).
- "What the site can see": four settings, each **set / not set** — never
  the value — with one line on what it is.
- The steps for each route.

### 2.3 The workspace (`/admin/write`) — screenshots 03–06, 16–17, 19

The idea: **work the way Claude Design works** — a chat with Claude on the
left, the real page on the right, changing as Claude writes. Three kinds of
draft share it.

**The list (03).** "New article" and "New research" buttons; rows of drafts,
newest first, each with a kind pill (Read, Research, or none for an article),
title, dek, date and cost so far.

**A draft (04–06).** Two panes:

- **Left — the chat.** Header: "Drafts" back link and the title. The log:
  the author's messages (cobalt tint), Claude's replies (tint), and one-line
  **activity** entries for what Claude did ("Read: <document>", "Searched the
  web: …", "Noted · Key figure: 65 °C", "… — dropped: not in the document word
  for word"). **Proposal cards** appear inline (see 2.5). Below: a "Flagged"
  chip when the author has clicked a paragraph on the right, attached-file
  chips, the message box, **Add files**, "$0.49 so far", **Send**.
- **Right — the page.** A bar: the check line ("2 quotations · 1 not word for
  word" in brick when any fail, green when all pass), "Download .md", and the
  draft's actions (below). A "Not ready to publish" disclosure listing why.
  A flash line after an action. Then the page itself in a frame, drawn by the
  public renderer, so it is exactly what will publish. Clicking a paragraph
  flags it into the chat.

The three kinds:

| | The right pane shows | The bar's actions |
|---|---|---|
| **Article** (04) | the article page as it will publish; a failing quotation is red | Publish · Update the live article · Take down · (Live · version N link) |
| **Research** (05) | the report as the document page it will become | "N pages read" · Save to Admin |
| **Read it** (06) | the read's **board** (2.4) | "The document" / "On the page" link · Show on the page · Take it off |

**On a phone (16, 17, 19)** the two panes are two tabs, **Chat** and **The
page** (or **What it found**), each the full height of the screen. The page
tab gets a cobalt dot when the page changed while the chat was showing.

### 2.4 The Read it board — screenshots 06, 07, 19

Pressing **Read it** opens a read: Claude reads the whole document once and
lays out what is in it as **cards** the author keeps or dismisses. What the
document's own structure already says (its Key Findings, Caveats and
question headings) is laid out first, with no model, and starts kept.

**Head**: kicker "READ IT", the document's title, the **receipt** — *Read in
full: 28,010 characters · 14 passages found word for word · 1 dropped ·
$0.71* (dropped always shown, in brick) — a note saying what is and is not
public, and "Keep all N proposed".

**Groups**, in this order, each with a count: Possible article · Its thesis ·
Key figure · Finding · Question it answers · Question it raises · Coined name
· Open problem · Prediction · Caveat · About the author.

**A card**: kind pill; role pill (Reasoning; *Advice to the author — not
evidence*; *The author's own decision — not evidence*); "From its own
structure" when no model was involved; "The document says: <its own word for
the standing>" when it gives one. Then the body, by kind:

- *Key figure*: **the figure** + what it measures · period · who gives it (or
  "source not named") · "the document says not to rely on it" when it does.
- *Question it answers*: the question, then the answer.
- *Coined name*: where it is named, and where the document says it is new.
- *Possible article*: the thesis line; "N verified findings or reasoning"
  (marked **thin** under 8); a disclosure "What carries it (N)" listing each
  supporting passage with its role, and "The strongest counter".
- everything else: the passage.

Every passage is a quote block with its section as a link to that spot in the
document. Actions: **Keep / Dismiss** while proposed; "Kept · Dismiss" once
kept; "Dismissed — it will not come back". A possible article also has
**Write this** (starts an article draft seeded with the thesis and its
passages) → then "Open the draft →". A kept coined name or open problem has
**Add to Ideas** — a small form where the *author* writes the name and the
paragraph and picks the topic.

### 2.5 Proposal cards (in the article chat)

While writing, Claude can propose a **concept**, an **open problem** or a
**key figure**, each grounded in a passage. The card: kind pill, "from
<document>", an editable title and paragraph, the grounding quote, **Add to
the record / Dismiss**. Once added: "Added: <link> (rewritten by you)".

### 2.6 The document page (`/p/<id>`) — screenshots 08–11, 14, 18

Additions to the prototype's document page:

- **After "Show on the page"** (the author's one approval per read):
  - **Key figures** shows the figures kept from the read (figure, what it
    measures, who gives it · when, "Section →"), in place of the figures the
    page picks by pattern.
  - A **✓ line** under them: *6 passages on this page are the document's own
    words, each checked against it and linked to where it is. Chosen by Chris
    Telford from a read by Claude, 14 Oct. What it finds ↓*
  - After the body: **What it finds** (its central claim; findings, each with
    the document's own standing word; "The document's own reasoning"),
    **Questions it answers** (question, answer), **What it leaves open**
    (not found · prediction "settled when …" · open problem · caveat). Each
    item is a quote with a "Section →" link. They also appear in the rail's
    "In this document" with a ✓ instead of a number.
- **Elsewhere in the record** (09), after those: a question this document
  leaves open that another answers ("Answered in <document>:" + the answer),
  and a figure another document gives for the same measure ("<document> gives
  **140%** for … Both are carried; neither is chosen."). Each shows **"shared
  terms: …"** — the words the match rests on — and the section opens with
  "Found by the words they share, not by a judgement that they agree."
- **Links inside the text** (10), the way a Wikipedia page works: a phrase
  that another document also discusses links to it (dotted cobalt underline;
  the hover title says "Also in: <document>"), and a concept's name links to
  its page (dotted brick underline). At most 12 per document, each phrase
  and each destination once, never in headings.
- **Shares sources with** (11), in the rail: other documents that cite the
  same web pages, each with "N pages cited by both", newest first.
- **Signed in** (14), in the rail: **Read it** with a line of explanation, or
  **Open its read** · "Read 14 Oct."

### 2.7 Concept pages — screenshot 12

**Where it appears**: every document that uses the concept's name, newest
first, above "More concepts".

### 2.8 Library, search, topics — screenshot 13

Figures and open questions kept from a shown read join the Library's **Key
figures** and **Questions**, search, and the topic pages, each linking to its
passage.

---

## 3. Rules a redesign must keep

These are why the record can be trusted. They live in code; a mockup will not
show them, so a design must not remove the surfaces that carry them.

1. **Every quote and every card is the document's own words, checked by
   code.** A passage that is not found word for word is dropped — and the
   count of dropped passages is **always shown** (brick red), never hidden.
2. **Nothing a read finds is public until the author presses "Show on the
   page"**, and "Take it off" undoes it. Never public, ever: possible
   articles, advice to the author, the author's own decisions, anything
   about the author personally, and held documents.
3. **Only findings and reasoning are evidence.** Advice and the author's own
   decisions are labelled as such wherever they appear.
4. **The document's own labels, never the machine's.** A figure's rating or a
   claim's standing is shown only in the document's own words, or not at all.
5. **A person writes the paragraph** of every concept and open problem.
6. **Links are found, never judged.** Every cross-document link says why it
   exists (a shared phrase, shared terms, shared sources). Counts are never a
   ranking; lists are newest first.
7. **Dismissed is forever**, and every other decision has an undo.
8. **No JavaScript needed to read.** Every public page is complete as
   server-rendered HTML; scripts only enhance (the workspace's live chat and
   phone tabs are the author's tools, not public pages).
9. **Say what is true**: cost per draft and per read is shown; "Not ready"
   lists real reasons; an empty section is left out, not faked.

---

## 4. What each new screen has to work with

**A read's receipt**: characters read, characters held, passages found word
for word, passages dropped, cost, date, model, status (reading · read · on
the page).

**A card**: kind; origin (from the structure / from the read); role (finding,
reasoning, advice, the author's decision); the passage and its section;
status (proposed · kept · dismissed); and by kind — figure, what it measures,
period, who gives it, the document's rating, rejected; question and answer;
the novelty passage of a coined name; when a prediction is settled; a possible
article's thesis, supporting passages with roles, counter, proof count.

**A draft**: kind (article · research · read); title, dek, topic, thesis; the
documents it is based on; cost so far; status (draft · published); live
version and address; the conversation.

**A link**: the phrase, the destination document's title and address, and
why (the shared phrase, the shared terms, or the number of shared sources).

---

## 5. New addresses

| Address | What |
|---|---|
| `/admin/claude` | Is Claude connected (2.2) |
| `/admin/write` | The workspace's list of drafts |
| `/admin/write/<id>` | A draft: chat + page |
| `/admin/write/<id>/preview` | The right pane by itself (article, report, or read board) |
| `/admin/write/<id>/article.md` | The draft as a file |
| `/op/read/<document>` | Read it (POST) |
| `/op/read/…`, `/op/write/…`, `/op/admin/…` | The actions behind every button (POST) |

---

## 6. What I would most like a redesign to solve

- **The workspace is a tool built from parts.** The chat, the bar, the board
  and the proposal cards each work, but they were never designed together.
  It should feel like one instrument — as calm as Claude Design itself.
- **The read board is long.** Thirty cards in eleven groups is a lot on one
  scroll. Filtering, collapsing kept cards, or a summary at the top may help.
- **The document page has grown.** Summary, key figures, the ✓ line, the
  body, three read sections, "Elsewhere", cite box, and a rail with contents,
  metadata, Read it, cited by and shares sources. It needs an order and a
  rhythm, and the in-text links need to be findable without being loud.
- **Admin cards** now carry a read line and up to five buttons.
- **On a phone**, the workspace works but was adapted, not designed.
- **Not redesigned at all**: the old console at `/admin/workbench`
  (processing, leads, the old research engine, the archive download). It is
  due to be retired; a redesign may leave it out.

---

## 7. Where things are (for whoever builds it)

`packages/api/src/site/` renders everything public and Admin's new pages;
`src/write/` is the workspace (Claude, the checks, drafts, reads);
`src/operator/routes/` holds the actions. `CLAUDE.md` at the repository root
is the engineering source of truth; `CHANGELOG.md` says what changed when;
`docs/read-it.md` is Read it's plan and rules.
