# Canopticon

> **If you are an AI reading this to understand the project: this file is the
> source of truth. The primary product is CANOPTICON STUDIO — an editorial
> film generator for essays. Everything else in this monorepo is a separate,
> compartmentalized system that is maintained but not grown.**
>
> **Studio's only design authority is `docs/studio/CANOPTICON_FILM_ENGINE.md`.
> `docs/studio/archive/` describes an engine that was DELETED and binds
> nothing — do not design against it, however confident it sounds.**

- **Studio** (primary): studio.canopticon.com · **Record**: canopticon.com
- **Twitter**: @canoptics · **GitHub**: crystalford/canopticon

> **`studio.canopticon.com` is attached and serving.** The custom domain was
> added in the Cloudflare dashboard by hand and is DONE — this file used to
> carry it as an outstanding one-time setup step, which then read as an open
> blocker to every session that opened it. It stays out of `wrangler.toml`
> because the deploy token lacks Workers Routes Edit on the zone and
> declaring a route there would fail the deploy; that is a fact about the
> config file, not a task.

---

# THE PRIMARY PRODUCT — Canopticon Studio

**Essay in, film out.** You paste an essay, choose a voice and three dials, and
get a film. One visual language: `TYPOGRAPHIC_EDITORIAL` — **monochrome
generative editorial collage**. Experimental documentary, kinetic typography,
punk/zine cut-and-paste, photocopy, newspaper, propaganda, title sequence.

**It is not** an AI video generator, a prompt-to-video wrapper, a template
engine, or an auto-generated After Effects kinetic-typography preset. The goal
is *typography behaving as a living visual material inside an editorial
composition* — text as the raw material of the film, not text animated over a
background.

```
ESSAY
  ↓  EDITOR            what matters, what turns, which phrases earn the screen
  ↓                    (one LLM call, verified, frozen; rules editor as fallback)
  ↓  NARRATION         spans → TTS → ASR → word-level alignment
  ↓  SPINE             the authoritative clock, measured from the voice
  ↓  CUT               beats, visual intent, seeds          ── FilmCut ──▶
  ↓  COMPOSITOR        one composition that behaviours mutate    (browser)
  ↓  RENDERER          monochrome; degradation at threshold time (browser)
FILM
```

The Worker decides **what happens and when**. The browser decides **what it
looks like** — every placement decision needs `ctx.measureText`, which does not
exist on a Worker, and one engine guessing what the other will draw is how this
system previously ended up with two that disagreed about 57 of 88 scenes.

## Authority

`docs/studio/CANOPTICON_FILM_ENGINE.md` — the only design authority.

`docs/studio/archive/` holds the documents for the **deleted** primitive engine.
Three of them used to be listed here as "authority order, highest first", which
meant a fresh session could faithfully rebuild the 130-primitive engine from
documents it had been told to obey, days after it was removed. They bind
nothing. Read them for the failures they record, not for direction.

## Standing rules — non-negotiable

1. **AI output is an input artifact, never a function.** The editorial reading
   and the narration are generated once, verified, hashed, frozen and committed.
   Nothing calls a model at render time.
2. **A promoted phrase is the essay's own text**, verified as a literal
   substring at its own offset before the record is stored. A model that
   paraphrases there is writing ad copy onto somebody's essay. This is the
   same firewall the Record keeps around quotes.
3. **Timing is measured, never assumed.** The visual edit answers to real audio.
   Where a measurement was impossible the spine says so rather than pretending.
4. **No `Math.random()`.** Every seed is derived on the Worker and travels to
   the browser as a number; the browser never hashes a string into a seed. Two
   copies of that step drifting apart changes every frame of every film with no
   error to notice.
5. **Determinism is claimed honestly.** Same essay + seed + settings = the same
   film. The browser export muxes real voice but cannot be frame-exact, and says
   which it was.
6. **The operator controls the inputs and the seed.** The system is not asked to
   negotiate a shot. Steering belongs in language later, never in a panel of
   enum dropdowns.
7. **Degrade, flag, continue.** One span that will not synthesise must not
   silence the film, and must not be invisible either.
8. **Readability is protected.** Illegibility is an explicit editorial decision,
   never an accident of a downstream effect. The old engine's worst failure was
   selecting the right phrase and then destroying it three stages later.
9. **The creative primitive is a BEHAVIOR, not an object.** No `primitiveId`,
   no `constructionId`, no noun→picture mapping anywhere in the production path.
   `tests/engine.test.ts` enforces this by scanning the source.
10. **One composition, evolving.** Inheritance is the default and only
    `interrupt` clears. A film is not a sequence of pictures that replace each
    other — that is the failure four rebuilds kept producing.

## The prioritisation function

> **Would I actually watch this?**

Then: does it feel authored? Does it feel like the writing became cinema rather
than being decorated? Could two essays produce genuinely different films in one
visual language, and two seeds different films without looking like noise?

A green test suite cannot answer any of these. The development loop is
**BUILD → DEPLOY → LOOK → CRITIQUE → CHANGE → DEPLOY**.

## What's built

`packages/studio` — its own Worker, own D1 (`canopticon-studio`), own R2. The
Lab is served by the same Worker as static assets (`wrangler.toml`'s
`[assets] directory = "./lab"`), so editing `lab/*` and merging publishes it.

**Worker** — `film/schema.ts` (the record, and the verbatim check in
`parseFilm`) · `film/segment.ts` (the author's own structure) · `editor/`
(prompt, model call, verifier, rules editor) · `narrate/` (tts kept whole, asr,
spans, store) · `timeline/` (the Needleman–Wunsch word aligner, spine, estimate)
· `cut/` (beats × spine → FilmCut).

**Browser** — `lab/comp/compose.js` (the compositor: one live composition,
behaviours as operators, placement solved against an occupancy map) ·
`lab/paint/frame.js` (monochrome; degradation at threshold time) ·
`lab/export/` (encode, voice) · `lab/fonts/` (four OFL families, self-hosted).

**Zero D1 migration was needed** — `ir_versions.ir_json` is an opaque blob.

## Known gaps, stated plainly

- **The legibility pass is partial.** The occlusion budget and knockout are
  designed but not built, so dense beats currently overlap and can bury the key
  phrase. This is the next thing.
- **Only ten behaviours exist** of the ~26 in the vocabulary. Montage, TEAR,
  SMEAR, STUTTER, DRIFT and the rest are unbuilt.
- **The material pass is grain + threshold only.** Halftone, registration
  error, ink bleed and wear-driven text mutation are designed, not built.
- **Audio and deterministic rendering are mutually exclusive.** The browser
  export muxes voice but is paced to real time to do it; there is no
  frame-accurate audio path. Writing a muxer was tried once and shipped corrupt
  files. Do not try again without a reason.
- **Export costs real time** — a 60-second film takes about 60 seconds.
- **Narration needs the deployed Worker.** `env.AI` does not exist in a sandbox,
  so local iteration is silent and estimated-timing. **The narrated film is
  judged after deploy, always.**
- **`POST /v1/editorial/probe` has not been run against production.** Run it
  before trusting a single film — the deleted `extract-reading.ts` records a
  route that never once succeeded and wore the costume of polite failure for
  weeks.

## What's next

1. The legibility pass with a real occlusion budget and knockout.
2. The rest of the behaviour vocabulary, and motif memory with wear.
3. The material pass — halftone, registration, bleed, wear-driven mutation.
4. Then only the critique loop: watch films, change numbers, deploy.

Later, and gated on evidence, not appetite: generated imagery as *world
material* (segment → depth → layers), and any 3D/WebGL decision. Neither is
scoped and neither is needed to find out whether the typographic engine works.
---

# COMPARTMENTALIZED — maintained, not grown

These are separate systems that predate the Studio pivot. They are kept and
they keep working. **Do not grow them, do not couple them to Studio, and do
not treat their docs as design authority for anything.** Each has its own
Worker, its own database, and its own deploy.

### `packages/api` — **the Record** (canopticon.com)

A forensic intelligence publication: a typed graph (7 node kinds, 6 edge
families) grown from uploaded research documents, rendered as a citable public
wiki with signed interpretive readings on top. Real, working, and full of real
content — 50+ research documents, subject pages, investigations, a library.

Its own D1, migrations in `supabase/migrations/`, deployed by
`deploy-api.yml`. Treat it as a **record-keeping / CMS system**: fix bugs,
keep it live, don't extend the model.

Its own internal rules, still true of it: the operator approves and never
authors; upload is authorization; verification is mechanical (every published
quote is a literal substring of a real stored source, verified by an
independent different-family judge); an attributed assertion is never silently
a neutral fact.

Historical docs for the Record live in `docs/` (`canonical-spec-v2.6.md`,
`canopticon-renovation.md`, `LINEAGE.md`, `docs/archive/`). **They describe
the Record only.** They are not Studio design input.

### `packages/video` — render surface + reaction tool (video.canopticon.com)

Two unrelated things sharing a Worker. `routes/from-reading.ts` drafts an
already-signed Record analysis into a video script through a human-approval
rail. `src/react/*` is a standalone personal reaction-video tool (record on
camera against an external clip). Neither is Studio; Studio does not build on
either.

### `packages/blindspot` — Instruments (blindspot.canopticon.com)

A standing home for standalone software side-projects, each judged on its own
merits. The Blind Spot (an inequality-measurement instrument) is the first.

---

# Stack

Shared across every Worker in the monorepo; nothing else is shared.

- **Runtime**: Cloudflare Workers + **Hono**, TypeScript.
- **Storage**: **D1** (SQLite) · **R2** · **Vectorize** (Record only).
- **AI**: **Workers AI**, and nothing else. Narration was reviewed against
  MiniMax and ElevenLabs and Workers AI kept: a third-party voice provider
  would be an external API key, an external outage surface, and the only
  part of the pipeline able to fail for reasons off-platform — inside a
  system whose whole premise is a reproducible artifact. `@cf/deepgram/aura-1`
  answers in ~500ms and is billed inside Workers AI. (`packages/video` DOES
  call MiniMax directly, for voice CLONING, with its own key. That is the
  compartmentalized system and is not a precedent for Studio.) The Record
  routes by role
  (`packages/api/src/llm/router.ts`). Studio uses it only at authoring time
  (segmentation, TTS) and freezes the output.
- **Rendering**: server-rendered HTML by string concatenation. No JSX, no
  React, no client framework, no frontend build step. Studio's Lab is plain
  canvas + vanilla JS for the same reason.
- **Migrations**: plain numbered SQL, applied on deploy via
  `wrangler d1 migrations apply`. Each Worker has its own directory —
  `supabase/migrations/` (Record), `migrations-video/`, `migrations-studio/`.
- **Host**: Cloudflare, auto-deploy on merge to `main` per-package.

# Dev environment — IMPORTANT

- The operator works in Claude Code on the web, NOT a local IDE.
- **All testing/deployment is LIVE on Cloudflare.** No local dev server, no
  local D1. Merge to `main` → deploys automatically.
- Do NOT suggest `npm run dev`. Verify with:
  ```
  pnpm -r typecheck
  pnpm exec biome check .        # CI runs this WITHOUT --write
  pnpm -r test
  ```
- The **Lab is ES modules**, so it needs an HTTP origin — `file://` is blocked
  by CORS. `packages/studio/scripts/look.mjs` serves `lab/` and renders a
  FilmCut headless, which is the fastest way to see frames without deploying.
  It is silent and estimated-timing; the narrated film is judged after deploy.
- To inspect the live Record, trigger `.github/workflows/canopticon-admin-probe.yml`
  (workflow_dispatch with a `path`); it calls canopticon.com through Cloudflare
  Access and commits the response to `ops/probe/response.json`. It is hardcoded
  to canopticon.com and cannot reach the other Workers.
- Branch convention: `claude/<name>`. Never push to `main` directly; PR + CI +
  squash-merge.

# Env / bindings

```
Studio:  DB (D1 canopticon-studio) · FILES (R2) · AI
Record:  DB (D1 canopticon) · FILES (R2) · EMBEDDINGS (Vectorize) · AI
Secrets: ANTHROPIC_API_KEY (optional) · CRON_SECRET
         CF_ACCESS_CLIENT_ID · CF_ACCESS_CLIENT_SECRET (admin probe)
         SESSION_SECRET (Record operator session cookie)
```
