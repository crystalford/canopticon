# CANOPTICON STUDIO — the film engine

**The single design authority for Studio.** Everything in `docs/studio/archive/`
describes a deleted engine and binds nothing.

## What the product is

An automatic editorial film generator for essays. You paste an essay, choose a
voice and three dials, and get a film.

One visual language, internally `TYPOGRAPHIC_EDITORIAL`: **monochrome
generative editorial collage**. Experimental documentary, kinetic typography,
punk/zine cut-and-paste, photocopy, newspaper, propaganda, title sequence.

It is **not** an auto-generated After Effects template. The goal is typography
behaving as a living visual material inside an editorial composition — text as
the raw material of the film, not text animated over a background.

## Why the previous engine was deleted

Four attempts failed the same way: richer primitives, a resurrected grammar
dispatch, a persistent World Engine, a Visual Strategist. Each improved the
machinery answering *"what object represents this concept?"* and each produced
the same visual DNA. The World Engine prototype is the clearest evidence —
identity, accumulation, transformation, recall and camera all worked exactly as
designed, and the film was a coloured polygon scaling into a mosaic. The
architecture worked. The image was the problem.

The vocabulary was structurally embedded, so every layer built on top inherited
it. Hence a clean slate rather than a fifth abstraction.

## The three layers

**EDITOR** — understands the writing. Thesis, sections, beats, emphasis,
escalation, callbacks, which phrases deserve the screen. Answers *"what should
the audience experience here?"* and never *"use a rectangle."* One LLM call at
authoring time, verified and frozen; a deterministic rules editor is a
first-class fallback, not a stub.

**COMPOSITOR** — one composition, alive for the whole film, that behaviours
MUTATE. Inheritance is the default; only `interrupt` clears. Placement is
solved against an occupancy map, never chosen from presets. Runs in the browser
because every decision in it needs `ctx.measureText`.

**RENDERER** — dumb and reliable. Knows nothing about meaning. Degradation
happens at threshold time, not as an overlay, because that is mechanically what
a photocopier does.

## Rules

1. **AI output is an input artifact, never a function.** The editorial reading
   and the narration are generated once, verified, hashed, frozen. Nothing calls
   a model at render time.
2. **A promoted phrase is the essay's own text.** Verified as a literal
   substring at its own offset before the record is stored. A model that
   paraphrases here is writing ad copy onto somebody's essay.
3. **No `Math.random()`.** Every seed is derived on the Worker and travels to
   the browser as a number. The browser never hashes a string into a seed —
   two copies of that step drifting apart changes every frame silently.
4. **Narration is the authoritative clock.** The visual edit answers to
   measured audio. The no-narration branch produces the identical `WordSpine`
   shape, so nothing downstream asks whether a film has a voice.
5. **Determinism is claimed honestly.** Same essay + seed + settings = the same
   film. Where a measurement was not possible, the spine says so.
6. **Degrade, flag, continue.** One span that will not synthesise must not
   silence the film, and must not be invisible either.
7. **Readability is protected.** Illegibility is an explicit editorial decision
   (`legibility: "denied"`), never an accident of a downstream effect.
8. **The creative primitive is a BEHAVIOR, not an object.** There is no
   `primitiveId`, `constructionId` or noun→picture mapping anywhere in the
   production path, and a test enforces it.

## The shape

```
ESSAY → EDITOR (frozen) → SPANS → TTS → ASR → WORD ALIGNMENT → SPINE
      → CUT (beats + intent + seeds)  ── FilmCut ──▶  COMPOSITOR → RENDERER → FILM
        └─ Worker: what and when ─┘                └─ browser: what it looks like ─┘
```

The Worker never decides a position, size, face or colour. The browser never
decides what a beat means.

## Where things are

| | |
|---|---|
| `src/film/schema.ts` | the record, and `parseFilm`'s verbatim check |
| `src/editor/` | prompt, model call, verifier, rules editor |
| `src/narrate/` | tts (kept whole), asr, spans, store |
| `src/timeline/` | words (the aligner), spine, estimate |
| `src/cut/` | beats × spine → FilmCut |
| `lab/comp/compose.js` | the compositor |
| `lab/paint/frame.js` | the renderer |
| `lab/fonts/` | four OFL families, self-hosted |

## Known limits, stated plainly

- **Audio and deterministic rendering are mutually exclusive.** The browser
  export muxes real voice but is forced to real-time pacing to do it. There is
  no frame-accurate audio path, and writing a muxer was tried once and shipped
  corrupt files.
- **Export costs real time.** A 60-second film takes about 60 seconds. At ten
  minutes this needs a different approach.
- **Narration needs the deployed Worker.** `env.AI` does not exist in a
  sandbox, so local iteration is silent and estimated-timing. The narrated film
  is judged after deploy, always.
- **The legibility pass is partial.** Occlusion budget and knockout are
  designed but not built; dense beats currently overlap.
- **`lab/` is neither linted nor typechecked** (`biome.json`, `tsconfig.json`).
  Keep files small and single-purpose.

## How it is judged

Not by the test suite. Merge → ~3 minutes → studio.canopticon.com. Then:

1. Paste a real essay, voice on, dials at 0.5. Watch it. Export it. Watch the
   export — that is the artifact.
2. **The seed test.** Regenerate at three seeds. Three genuinely different films
   in one visual language, or the compositor is a gallery.
3. **Continuity.** One state evolving, or pictures replacing each other?
4. **Readability.** Every key phrase, every time, without pausing.
5. **The chaos test.** Chaos 0 is a clean grid; chaos 1 is the *same
   composition*, wrecked. A different composition means chaos is behaving as
   randomness and is wrong.
