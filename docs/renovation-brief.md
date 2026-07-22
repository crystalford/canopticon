# Canopticon — Renovation Brief (for a Fable crystallization pass)

> **What this is.** A single steering document to hand to a strong creative/strategic
> model (Fable) so it can crystallize — not re-invent — what canopticon is, and hand
> back a renovation that ends a six-month loop. It carries the honest state, the
> operator's own vision, and a sharply-scoped ask. Everything the model needs is here;
> it should not have to go spelunking. Written by an Opus pass so Fable's tokens go to
> the hard thinking, not to rediscovering context.

---

## 0. The one thing to understand before anything else

Canopticon does not have a vision problem in the ordinary sense. It has a **thirty-part
spec** and has been **rebuilt eight times in six months** (see the lineage). The
recurring project note, dating from the very first dead iteration, is: *"SIMPLICITY
above all; previous 4+ iterations failed due to over-engineering."* It is still true.

The machine is **real and mostly works** — and it has **never once been used to publish
a real thing anyone read.** On 2026-06-11 a gap audit produced a ranked, file-pathed,
effort-estimated action list (items 1–10 shippable with no infra). Three days later, the
operator started building a *video engine* instead. Then an *instrument* (a side tool).
The core has been frozen at that June snapshot ever since.

**The loop to break:** re-architect → new build outruns the last one → never ship → feel
lost → re-architect. A ninth "total renovation" done the same way (re-spec, rebuild)
lands right back here in a month.

**So the renovation Fable must produce is production-forcing, not architecture-forcing.**
It must reduce surface area, give the thing a *vision of use* and an *app/brand identity*,
and route everything toward shipping one real output — treating the existing machine as
good-enough scaffolding to USE and improve in contact with real work, not perfect in the
abstract. **Do not produce spec v3.0. Do not propose a rewrite. Do not add a fourth
format or arm.**

---

## 1. The operator, in his own words (the vision — do not invent, crystallize)

- Canopticon is his **flagship product / online identity for content creation.** The
  peak output is **video essays.** "This is the product, essentially downstream of the
  intricate living wiki / investigation / infrastructure we've done so far (but I suspect
  can be improved)."
- It's a **general engine.** Canadian politics, yes — but not limited to it. A channel
  for whatever he's into. "Hard-hitting investigative journalism kind of thing, but not
  limited to that."
- It's **a mood, a vibe, a structure: dark, mysterious, but cool and relevant.** The
  brand is as much a feeling as a function.
- The **three layers** (his framing, and his doubt):
  1. **Bedrock** — hardcore information / the living wiki. The scaffolding for **SEO / GEO**
     — durable, machine-citable ground truth. *"I still don't know if we've succeeded in
     doing this."*
  2. **Editorial** — investigations, synthesized articles/essays. Has personality; the
     content-creation register.
  3. **Peak** — **video** (synthesis).
  - His live doubt: *"perhaps that was the problem — like seeing it as a chain."*
- Instruments / "The Blind Spot" = **backburner side tools.** Explicitly parked. Ignore.
- On the renovation: *"I think we are already close but we are still just going to be
  iterating and it needs a total renovation."* And: *"I'm not asking it to invent my
  vision"* — crystallize it.
- The forcing sentence, in his words: **"I have to actually start using it to produce, or
  this might just be going in circles and never getting anywhere."**

---

## 2. Proposed center (Fable: pressure-test this; operator: confirm or correct)

> This is a *proposed* north star, synthesized from the operator's own words. It is the
> single decision that drives every keep/cut. State agreement or propose a sharper center.

**Canopticon is a personal investigative-media brand with a distinct dark/forensic vibe.
The product is the video essay. The written essay and the living graph/wiki are the same
investigation rendered at shallower depths — the credibility-and-discovery substrate that
makes the videos trustworthy and findable (GEO). It is not three products in a chain; it
is one investigation, rendered at three depths. Brand-first, output-first: the substrate
serves the video, it does not gate it.**

The "chain" instinct is what turned "make video essays" into "spend six months on
extraction infrastructure." The operator's own spec already says as much — v2.6's thesis
is literally *"a rendering system, not a generation system: the graph is the truth,
everything else is a re-arrangement of the same facts."* The renovation is, in part,
finally *believing* that.

---

## 3. What canopticon is today (honest built state)

- **One-line product (current spec):** operator drops research → system extracts a typed
  graph of facts → grows citable pages + signed investigations → operator approves →
  every published thing is available in every "face" (thread, script, card, video) as
  selection, not generation. Prime directive: **the operator approves, never authors.**
- **Three arms** (only #1 matters for this renovation):
  1. **The publication** — `canopticon.com`. The core. Where the graph, pages, and
     readings live.
  2. **Video engine** — `video.canopticon.com`. A daily forensic-video render pipeline.
     Code-complete-ish, unmerged, cron disabled. (Ambitious; arguably part of the
     over-build.)
  3. **Instruments** — standalone measurement tools (e.g. The Blind Spot). **Parked.**
- **Stack:** Cloudflare Workers + Hono, server-rendered HTML by string concatenation (no
  React, no client JS to read), D1 (SQLite), R2 (docs/snapshots), Vectorize (embeddings),
  Workers AI via a per-role router (roles → models, Anthropic optional). Deploys on merge
  to `main`. Solo operator, works in Claude Code on the web — **no local dev; all testing
  is live on Cloudflare.**
- **Live production is frozen at 2026-06-11.** The whole v2.6 core rebuild is built,
  green (189 tests), and **never deployed** — it sits unmerged on a branch.

---

## 4. The current machine — what's real vs what's hollow (fresh 4-part assessment)

**Real and working (do not rebuild these):**
- The **trust gauntlet is genuine and fail-closed**: verbatim-substring check (a published
  quote must be a literal substring of a stored source) → firewall (an unattributed
  assertion is never silently a fact) → **independent judge** in a separate model family →
  hard re-gate. This is the soul of the product and it *works*.
- **Text/markdown/HTML/URL extraction** into the typed graph: works, durable, resumable,
  no paid-API dependency.
- **Entity/event page growth** from the graph: deterministic, idempotent, well-deduped.
- **Public rendering**: unified subject page (neutral wiki mode + signed reading mode),
  schema.org JSON-LD, stable anchors, 13 arrangement renderers, faces. **Deploys clean.**
- Last live health probe: healthy 200.

**Real defects (targeted fixes, not a rewrite):**
- **PDF/image ingest is broken** — the Workers-AI adapter drops the binary and the model
  fabricates text. For a *forensic document* system, a landmine.
- **Edit-then-sign publishes unverified prose** while claiming it re-checks. The one place
  the operator becomes an author, unguarded — directly against the prime directive.
- **Failures are silent everywhere** (`catch {}` across every stage). "Failures are killed
  *visibly*" is only true for judge/firewall kills, not pipeline faults.
- **Theme surfacing under-verified** — the "3+ docs *contradicting* an account" rule is
  delegated to LLM goodwill, not enforced structurally; fails silently.
- `/sources` is a placeholder still linked in nav; theme-evidence block is dead code
  (one-line SQL fix); upload doesn't auto-extract (manual step).

**Takeaway for Fable:** this is not a greenfield and not a ruin. It's a genuinely good
machine with a handful of integrity holes and a lot of unused surface area. The renovation
is *sharpening and shipping*, not building.

---

## 5. The surface area to judge (the over-build, concretely)

The spec defines, and the code largely implements: 7 node-kinds, 6 edge-families, contested
assertions, **12 arrangement types each with its own URL** (timeline, network, stats,
claim-table, comparison, definition, FAQ, …), **7 investigation "intents,"** faces
(thread/card/carousel/script/chapter), a Studio production pipeline, live inquiry threads,
a proposer, a surfacing engine (deterministic L1 + frontier L2), three product arms, a
video render pipeline, and an instruments framework. **All before one video essay has been
published.**

Fable's job includes a **ruthless keep / freeze / cut** pass over this list against the
proposed center.

---

## 6. What Fable must hand back (the crystallization deliverables)

Produce a tight renovation document with these sections. Prose a human founder can act on,
not a spec. No new grand architecture.

1. **What canopticon is, in one paragraph** a stranger immediately gets — identity, not
   feature list. Then a one-sentence version.
2. **The brand/app identity, made concrete.** The vibe (dark, mysterious, forensic, cool,
   relevant) turned into something buildable: what it *feels* like to land on canopticon
   and what it *feels* like to operate it. The "app" the operator says it's missing.
   Name/tone/visual direction, the reader's first 10 seconds, the operator's home screen.
3. **Keep / Freeze / Cut.** A ruthless verdict on §5's surface area against the center.
   For each: keep (serves the video-essay-with-receipts loop), freeze (real but not now),
   cut (delete or ignore). Bias hard toward freeze/cut. Justify the keeps.
4. **The operator's daily practice** — the vision of *use*. Concretely: what does he do
   with this on a Tuesday, start to finish, to move an investigation toward a published
   video essay? This is the thing the 30-part spec never described.
5. **The reader's experience** — who lands on canopticon, what they get that they can't get
   elsewhere, why they come back. Ground the SEO/GEO "bedrock" purpose in an actual person.
6. **The first-production path** — the concrete route to **ONE real video essay, end to
   end**, on a topic the operator cares about, in the next 1–2 weeks, using the machine
   that already exists. What's the minimum that must be true; what gets used; what gets
   ignored. This is the deliverable that matters most.

---

## 7. Hard constraints on Fable's answer

- **Production-forcing, not architecture-forcing.** Every recommendation routes toward
  shipping the first video essay, not toward a cleaner system.
- **Use the machine that exists.** Treat §4's working parts as good-enough scaffolding.
  Fixes are targeted (the integrity holes), never "rewrite."
- **Reduce surface area.** The renovation should end with *less* to maintain, not more. If
  a recommendation adds a new format, arm, layer, or abstraction, it's probably wrong.
- **Respect the operator's realities:** solo; Cloudflare-only; Workers AI models (Anthropic
  optional); no local dev, everything live; works in Claude Code on the web; limited time
  and a finite Fable budget.
- **Honor the non-negotiables:** the operator approves/never authors; verification is
  mechanical not vouched; the firewall; simplicity above all.
- **Do NOT** produce spec v3.0, propose a rewrite, add a fourth arm/format, or defer
  production behind more infrastructure. The answer to "development hell for months" is not
  a bigger plan — it's a smaller, shippable one.

---

## 8. Source material (already synthesized above; pointers if deeper detail is needed)

- `CLAUDE.md` — current built architecture + the rules that survived every rebuild.
- `docs/LINEAGE.md` — the eight eras; *why* the current shape exists.
- `docs/canonical-spec-v2.6.md` — the 30-part current vision spec (the over-specification).
- `docs/audit-2026-06-11.md` — the June gap audit with the abandoned ranked action list.
- The four-part fresh assessment (§4) — extraction, page-growing, readings+approve, and
  public-render/deploy.

*The operator's standing instruction: he is close, he is not asking Fable to invent his
vision — he is asking it to crystallize what's here into something he can finally use to
produce, and to have the nerve to cut what's in the way.*
