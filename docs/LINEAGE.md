# Canopticon — version lineage

The clear trace of how this project evolved. Every era below was a real,
committed system; each was superseded by the next. **The current system is the
"Fabric" era (June 2026 onward).** Specs from earlier eras live in
`docs/archive/` and should not be designed against — they describe systems that
no longer exist. The single current vision spec is `canonical-spec-v2.6.md`;
the current built architecture is in the repo root `CLAUDE.md`.

Use this document to understand *why* the current shape exists and what each
earlier decision was reacting to.

---

## Era 0 — Chat-first CMS (early 2026, abandoned)

**The pitch:** a chat-first CMS for Canadian political intelligence. You talk to
it; it publishes articles.

**Stack:** Next.js 14, Tailwind, the Vercel AI SDK, PostgreSQL via Drizzle, on
Vercel + Supabase.

**Why it died:** over-engineered, and the chat-CMS frame never produced the
*reference-grade, citable* output the operator actually wanted. The recurring
project note — "SIMPLICITY above all; previous 4+ iterations failed due to
over-engineering" — dates from here.

*Artifacts:* the old project memory and the original `README` described this
era. They were stale for months and were finally corrected in June 2026.

---

## Era 1 — The "v1.0" forensic platform (Feb–May 2026)

**The pitch:** an operator declares **theses**; AI agents research and verify
supporting claims; a substrate tracks predictions, contradictions, and a
rolling Brier score over time. A public site exposes theses, the prediction
ledger, contradictions, and pattern findings.

**Stack:** a two-package split — `packages/web` (Next.js 15 on Cloudflare
Pages, operator UI + public site) and `packages/api` (Hono on Cloudflare
Workers). Supabase Postgres with RLS, ~18 migrations, ~37 tables. Anthropic
Claude with ~13 analytical roles, a cascade orchestrator, a cost gate, an SSE
feed. Entity resolution, a methodology canon, a skills system.

**Documents from this era (now in `docs/archive/`):**
`canopticon-api-v1.0`, `canopticon-schema-v1.0`, `canopticon-ui-spec-v1.0`,
`canopticon-public-site-spec-v1.0`, `canopticon-workflows-v1.0`,
`canopticon-entity-resolution-v1.0`, `canopticon-skills-v1.0`,
`canopticon-glossary`, `canopticon-methodology-canon`,
`canopticon-master-synthesis-v1.5.1`, `canopticon-build-handoff-v1.0`,
`canopticon-changelog`, and the `*-prototype-*.html` mockups.

**Why it changed:** two heavy packages, Postgres, and a thesis-declaration
frame were more machinery than one solo operator needed — and the operator's
real job kept being framed as *authoring* (declaring theses), which violated
the instinct that the system should do the work.

---

## Era 2 — The Worker pivot (June 3, 2026)

**The move:** collapse to a **single Cloudflare Worker**. Drop Next.js
entirely. The public site and the operator console both render as
server-rendered HTML strings from one Hono app, reading live from **D1**
(SQLite), with **R2** for documents and **Vectorize** for embeddings.

Landed across `pivot phase 1–5` (commits on June 3): Worker-rendered public
skeleton, public surfaces reading live from D1, the operator console in the
Worker, piece-publishing tools, the "lighthouse" (patterns/gaps), and a seed
corpus. **"drop Next.js"** is the headline.

**Why:** simplicity. One runtime, one language, one deploy. No client
framework, no JS required to read a page.

---

## Era 3 — The decoupled-ingest pivot + the composer misstep (June 7, 2026)

**The move:** separate **upload** from **extraction**. Upload became "bank the
document in the Vault" (hashed, content-deduped, idempotent); extraction became
a separate, manual step. (`Pivot Phase 1–3`, PRs #106–#110.)

**The misstep:** a manual **Brief composer** was built (PRs #107–#108) — a form
where the operator hand-wrote briefs with manual citation tuples. The operator
rejected it hard: *"the intention wasn't to give me more friction… briefs are
supposed to be almost automated."* This is the moment that crystallized the
prime directive in its current sharp form: **the operator approves, never
authors.**

---

## Era 4 — Canonical Spec v2.4 (June 9, 2026)

**The move:** the operator handed over **`canonical-spec-v2.4.md`** as the
single source of truth, and the build realigned to it. The composer was
deleted; "Briefs" was renamed "Outputs"; the **typed-graph schema** landed
(PR #111). The spec introduced: the typed data model (node-kinds, edge-families,
contested assertions), the **fact/interpretation firewall**, two output layers
(factual arrangements + interpretive intents), the **Surfacing Intelligence
Engine** (deterministic L1 + ambitious L2), a per-role **model strategy**
(roles not names; Llama 3.3 70B retired), and a public-site restructure.

`canonical-spec-v2.4.md` is **still the current vision spec.** The Fabric era
below is its implementation, with one refinement the spec didn't name (themes).

---

## Era 5 — Extraction made real (June 10, 2026)

**The move:** make extraction actually work end-to-end. Typed-graph extraction
+ the per-role router (PR #112); then a hard debugging run that fixed, in
order: a D1 write-volume timeout (batched writes), unbounded external calls
(timeouts everywhere + a `/v1/admin/health` model probe), a cost-ledger
idempotency crash, resumable per-chunk extraction, and — the real culprit — the
**extraction model**: Gemma 4 was a *reasoning* model that truncated its own
JSON, so bulk extraction moved to **Llama 4 Scout** (fast, non-reasoning), and
the adapter learned to read object-valued responses.

Also: **Feed folded into Library**, Chat removed from the rail, the v2.4 output
loop wired (proposer → graph-grounded build → firewall → publish). At the end
of this era, a real document extracted into a real typed graph and a real
public page published.

---

## Era 6 — The Fabric (June 11, 2026)

**The move:** the conceptual unification that resolved the operator's
long-standing "it doesn't feel right." Two products had been built as separate
stacks (a wiki and a list of "outputs"); they became **one fabric**:

- **The theme primitive** — a 7th node-kind. A theme is a *received account the
  corpus engages with* (what the documents push back against). It's the missing
  orientation primitive: without it the system had facts but nothing to argue
  with. Surfaced deterministically (3+ documents converging on contradicting
  the same proposition); the model only *names* it.
- **The unified subject page** — one renderer, two modes. Every subject (entity
  | event | theme) is a single page that is either the **neutral wiki** (facts
  with receipts, contested shown gray, timeline, connections, schema.org
  JSON-LD, stable block anchors) or the **signed reading** (the same facts
  re-sequenced under a thesis, with a mandatory "what complicates this" box).
  The investigation is no longer a separate object.
- **IN / OUT** — the console collapsed to two destinations (+ Studio). IN is
  drop + archive + extract; **OUT** is the single editorial stream where the
  system surfaces what it wrote and the operator reads and decides.
- **Auto-drafted signed readings** — when the corpus settles, the system drafts
  readings for the highest-tension subjects into `pages` as drafts; they're
  waiting in OUT. The operator signs. Grounded + firewalled exactly like the
  output pipeline (writer references stored quote ids; the server substitutes
  verbatim text; unattributed assertions are killed).
- **The receipt loop** — every document page shows "what it fed the fabric."

**Phases (June 11):** Phase 1 = theme primitive + unified pages + block anatomy
(PRs #129/#130). Phases 2–4 = the OUT stream + auto-drafted readings + the
public fabric face (PR #131), plus refresh-in-`waitUntil` and short-name
duplicate folding (PR #132).

---

## Era 7 — Spec v2.5 (transitional, never landed in the repo)

**Existence:** drafted in chat between operator and Claude over the course of
June 11. The operator pasted it into the working session but it never made it
to the repo as a binding document. Three things in v2.5 turned out to be
drift the operator hadn't intended to ship:

1. **OUT as a dashboard.** v2.5 Part 9 stated "the logged-in home = the
   stream" with dashboard-shaped content (briefing, draft cards, findings,
   threads, Ask-the-corpus). That carried the IN/OUT framing forward in
   spirit even after the labels were retired. The operator's actual
   direction was: the operator BROWSES the public site; the graph grows
   from what they do on it; there is no separate dashboard.
2. **Studio destination dies.** v2.5 Part 24 implied Studio should be
   removed entirely. The operator's actual direction was: Studio's role
   is shifting — from generation destination to production pipeline
   (recording, stitching, voice profile, final assembly).
3. **Faces as generation, not rendering.** v2.5 Part 24 treated faces as
   regenerated by the writer LLM on each sign. The operator's vision is
   that template + query faces (thread, meme, TikTok script, stat card)
   are pure renderings; only argumentative faces (video script, chapter
   outline) get one LLM seasoning. The site is a rendering system, not a
   generation system.

**Why v2.5 doesn't have a repo doc:** the drift only became visible during
the build session that followed. v2.6 is what the operator meant. v2.5's
useful additions (the seven intents, the trust gauntlet framing, the
faces-on-signing pre-render pattern, the one-site permission model) are
incorporated into v2.6.

---

## Era 8 — Spec v2.6 (June 11, 2026 — CURRENT)

**The move:** the rendering-system reframe. The graph is the truth; pages
are renderings; URLs are rendering identities; faces are reformatting. The
only places where generation legitimately happens are (a) extracting graph
data from raw documents and (b) writing the signed reading body itself.
Every face that can be a template + query IS a template + query. The site
renders, instantly; it doesn't generate, slowly.

**What changed structurally vs the v2.5 chat draft:**

- **OUT collapsed.** No separate operator home, no "stream" surface. The
  operator's affordances (briefing, draft cards, findings, threads) overlay
  on the SAME pages every reader sees. `/` is one page, two modes (anon vs
  operator), one URL.
- **Faces are renderings.** Template + query for thread/meme/TikTok/stat;
  one writer call on sign for video/chapter. Rendering thereafter from the
  persisted body_md. No regeneration at view time.
- **Studio reframed.** Production pipeline (record voice, stitch, match
  visuals, export) — not generation destination. Stage 1 (skeleton +
  compose) is scaffolding for it, not dead code.
- **Standalone arrangement URLs.** Each of the twelve arrangement types
  also becomes its own addressable page (`/t/:slug` for timeline, `/n/:slug`
  for network map, etc.) with its own JSON-LD. The subject page composes
  the SAME renderers; the arrangement pages are also citable standalone.
- **The trust gauntlet is now real on the drafter.** Earlier versions had
  the signed-reading drafter skipping the independent judge (storing
  judge_pass=1 hardcoded). v2.6 closes the gap: the same judge that backs
  buildBrief now runs on every draft-reading claim, parallelised, gating
  the persistence on judgePassed not just verifiedClaims.

**The build sequence (Part 18) reflects the rendering-system priorities:**
per-arrangement URLs first, then faces refactor, then Record-building
Phase 2, then the concurrent extraction stack, then Studio, then "Ask the
corpus" / search, then frontier-model + citation tracker.

**Stack at this era:** see `CLAUDE.md`. Cloudflare Workers + Hono + D1 + R2 +
Vectorize + Workers AI (per-role router); server-rendered HTML; deploy on merge
to `main`.

---

## What's deferred (not yet built)

- **Transforms** beyond Studio Stage-1 scripts (thread / meme / video assembly).
- **Surfacing Engine L2** is wired but lightly exercised.
- **Frontier-model wire-up** (Anthropic top tier via the router) — one line,
  near launch — plus result-caching.
- **The operator voice file** (`operator_voice`) exists in schema and the
  drafter uses it, but there's no UI to set it yet.
- **Citation tracker** logs AI-crawler hits; no reporting surface yet.

---

## How to read the archive

`docs/archive/` is **historical reference only.** If something there contradicts
`CLAUDE.md` or `canonical-spec-v2.4.md`, the archive is wrong (it describes a
dead era). Kept because the methodology canon, glossary, and entity-resolution
notes still contain useful thinking — but the *system* they describe is gone.
