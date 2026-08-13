# What Canopticon means by a visual interpretation

> Written at a stopping point, not as a plan. Everything below is either
> live in `packages/studio/src/compile/` and covered by tests, or named
> explicitly as unbuilt. Nothing here is aspirational unless it says so.
>
> The reason to write it now: the architecture the project started with
> was a **procedural video compiler** — script in, primitives out. What the
> last several days of measurement actually produced is closer to a
> **narrative-to-visual compiler whose output happens to be video**. Those
> are different systems with different failure modes, and the older
> documents describe the first one.

---

## 0. The principle that keeps being rediscovered

**A semantic capability is not complete until it can reach pixels.**

```
detection  ≠  representation
planning   ≠  construction
construction ≠ composition
composition ≠ rendering
```

Every layer boundary in this system has, at least once, silently absorbed
the layer above it and looked correct doing so. Not hypothetically — this
is the list, and each one was found by measuring rather than by reading:

| What existed | What it failed to reach | How it was found |
|---|---|---|
| Operator parameters | The primitives they were set on — `plate_scene` was given `depth`/`haze` and has neither; ~10 more the same | Auditing every param against the registry |
| Construction fitness | The director's state — `fit(beat)` took no `Style`, so intent could not move what was *built* | Running the five-candidate test and getting four |
| A direction's bias | Nine of the state's dials — only `energy`/`density` were reachable, so five directions built identical bodies | Diffing construction params across directions |
| A detected setting | The picture — `city` and `streets` were read and outranked, every time, by design | Semantic accounting, 5/8 |
| A scene plan | The chain — planes were planned and the scene still composed as typography | Compiling the paragraph and looking at the chain |
| A proposition | Any decision — it was a role summary, not a claim, and changed nothing | Reading it and noticing it named an inventory |
| `refersBack` | The unnoticed scene — it requires an anaphor, and "nobody noticed" has none | Building the anomaly and finding it absent |
| `namesOnlyAbstractions` | Every caller — exported, documented, called by nothing | Grepping for its usages |
| `sonify`'s `AUDIO` output | Any audio — its `frame()` contains no Web Audio call; it draws a picture of sonification | Reading the function body |

**The discipline this implies**: a new semantic layer is tested across the
whole path or it is not tested. "The compiler now understands X" is not a
claim about the compiler until a pixel differs.

### 0.1 One authoritative translation point

The corollary, and it is a hard rule (CLAUDE.md standing rule 9). A
semantic quantity gets **exactly one** function that turns it into
parameters. `plane.weight` has `applyPlane` in `scene-plan.ts` and nothing
else; every consumer goes inside it.

Without that, the same number quietly means four things:

```
weight → scale        here
weight → opacity      somewhere else
weight → count        somewhere else
weight → camera       somewhere else
```

and there is no longer any answer to "what does weight mean". The rule
also keeps the interesting door open. The semantic layer's job is to say
*this plane has visual importance 0.30* — never *make it smaller*. How
importance MANIFESTS is a question for the visual grammar, and one grammar
answering "smaller, dimmer, further away" while another answers
"fragmented, partly occluded, visible only intermittently" is two
different films from one identical 0.30. That is only possible while the
translation lives in one place. It is not built; the place for it is.

### 0.2 What the discipline is starting to make possible

The unnoticed-anomaly bug is the first instance of something the palette
architecture could never have produced: **the compiler catching its own
picture contradicting its own script.** "At first nobody noticed" was
DETECTED, INTERPRETED and PLANNED correctly, and the renderer drew the
anomaly at 0.85 of the frame — the largest thing on screen. Plumbing the
weight through is what made the disagreement expressible at all.

Generalised, that is **visual consistency checking**, and it is not fact
checking. It asks only whether the visual argument agrees with the script:

| The script says | The frame would have to answer for |
|---|---|
| "Nobody noticed." | An anomaly at 0.85 weight |
| "Only one person remained." | Fourteen agents visible |
| "The city was empty." | A crowded environment |
| "They slowly became synchronized." | Synchronisation already maximal in frame one |

Not built, and deliberately not designed here. Recorded because it is the
first thing on this list that is specific to Canopticon rather than
generic to compilers.

---

## 1. What is a semantic reading?

Everything the system can say about a sentence **without interpreting it**.
Three kinds, and the distinction between them is the oldest rule here:

- **Figures** (`figures.ts`) — quantities and routes, lifted by regex,
  verified as literal substrings. `$282,345.84` is in the sentence or it
  is not. No model, no ratification.
- **Subjects** (`subject.ts`) — what the sentence NAMES, from a curated
  lexicon matched as whole words, each hit carrying its verbatim text and
  character offset. Also checkable.
- **Relations** (`relation.ts`) — who acts on whom, read from the grammar
  *between* two named things: word order, `by` for passive, epistemic
  verbs for stance, `made`/`because` for causal direction. The action is
  taken verbatim; there is no verb list.

A **ratified reading** (`extract-reading.ts`) is the fourth kind and the
only one that involves a model: a proposal about what a sentence *means*,
frozen and approved by a human. It outranks everything above it and is
absent on most scenes.

**The lexicon is a mechanism, not a theory of meaning.** It is a word list
because a word list is checkable, which is the only reason it may skip the
ratification gate. It is not a claim to understand metaphor.

## 2. What is a visual proposition?

**One sentence naming what a viewer would construct from the arrangement
of the frame, without the narration.** Lives on the scene plan
(`scene-plan.ts`), built from the ROLES rather than from the sentence.

The distinction that makes it worth having: *"Insects occupies city, and
the place continues around it"* is an **inventory** — it lists what is
present. *"Something is happening that does not belong here, and the
ordinary world has not registered it"* is a **claim** — it states a
relationship a viewer could infer.

It is deliberately not shown in the film and not required to be shown to
the director. Its job is to make "does this composition say anything
without the voiceover" answerable.

**Its own test**: the proposition must not repeat the concept. A scene
about metacognition whose proposition says "metacognition" is illustrating
a noun. Asserted for the counterpoint case — the proposition must not
contain the word `insects`.

## 3. What is a semantic role?

**What an element is DOING in the frame**, not what it is. Five today:

| Role | Function | Named by the sentence? |
|---|---|---|
| `SETTING` | Where this happens | Yes — a place noun |
| `SUBJECT` | What it is about | Yes, or carried from memory |
| `METAPHOR` | What the subject is being seen AS | Yes — via a simile |
| `COUNTERPOINT` | What it happens AGAINST | **No — the proposition requires it** |
| `EDITORIAL` | The words, when the film puts them up | No |

`COUNTERPOINT` is the load-bearing one. It carries `from: null` because
nothing named it. It exists because "nobody noticed" needs an ordinary
world for the anomaly to go unregistered against, and that is the only
proof that a proposition does work rather than describing work.

**Unbuilt, deliberately**: `CONTEXT`, `SECOND-STORY`, `TRACE`,
`RED-HERRING` — from the Aldershot framework, correct, and not yet needed
to prove the boundary.

## 4. What is a scene plan?

**The set of roles a shot contains, before anything decides which one
wins.** A plane is a semantic role with a depth, a weight, and the noun it
came from.

The ordering is semantic, not arbitrary: a `SETTING` sits behind its
`SUBJECT` because that is what a setting *is*. The weight is the dial a
director moves to get "environment dominant" versus "subject dominant"
**without changing what the scene contains** — five compositions of one
scene graph, which is the same distinction candidates draw one level up.

Deliberately conservative: a sentence naming one thing gets one plane and
compiles exactly as before. Paying for a composite to layer one thing over
nothing is how a render gets slow for no picture.

**The stack is how it reaches the screen** (`stack.ts`). Every plane
behind the subject becomes a real construction — the same builder the
subject gets — and they nest, far to near, on compositors' second inputs.
The rule is one line: *a compositor's ground is the layer behind it, its
upstream is the layer in front.* Read outward it is a depth order; read
inward it is a paint order.

```
main chain     [ subject program … , layer_over ]
                                        ground ↓
background     [ counterpoint program … , layer_over ]
                                              ground ↓
deepest        [ setting program … ]
```

Two consequences worth stating. A film's SETTING is carried between scenes
the way its subject already was, because a setting outlives the sentence
that named it — "at first nobody noticed" is still in the city. And a
stack the frame budget cannot pay for drops its DEEPEST layer and reports
how many, rather than trimming quietly.

## 5. What is a construction?

**A way of building a meaningful thing, parameterised from the prose.**
Eight today (`body`, `fixture`, `paper`, `quantity`, `route`, `network`,
`space`, `type`). `creature_chain` does not take a creature; it takes
segments, legPairs, gait, count, wander — a centipede is one point in that
space and a synchronised crowd is another.

Two properties matter more than the list:

- **Dislocation** — a construction can be reached AGAINST THE GRAIN of the
  noun. People as a network, the city as the organism. Three constructions
  refuse and say why; `quantity` refuses without real figures, which is
  the figure firewall applied to directorial appetite.
- **Operators are orthogonal.** Applied to anything constructed, chosen
  from the director's state, never from the subject.

## 6. What is a visual grammar?

**A set of appetites, captured from a film that already looks right.**
Per-operator biases plus a representation rung. It names no primitive.

Not a preset — a preset applied to a different sentence paints the wrong
picture of a different thing. The same grammar over a different essay
builds different things in a recognisable way, which is what a house style
actually is.

**Hard boundary, stated once**: Studio's chrome and a film's grammar never
inherit from each other. The interface is the instrument; the film is the
artwork. The orange in the console is brand, and it must never leak into
the picture unless a director chooses orange.

## 7. What is a director's intervention?

Four mechanisms, in a fixed precedence, each able to lean on the one
before it and never to overwrite it:

1. **A pin** — freezes a chain. Precedence 1, survives everything.
2. **A verb** (`verbs.ts`) — six closed nudges on a `constrain` override.
   Survives restyle and recompile, because the engine keeps composing.
3. **An intent** (`intent.ts`) — prose. Read by a register lexicon,
   returns what it HEARD, and bends both construction score and the whole
   creative state. Deterministic, unratified, because whether the word
   "absurd" appears is not a matter of interpretation.
4. **The curve** — the film's own creative state over time.

Everything is a **bias, not a value**. A direction never sets abstraction
to 0.8; it says "further from the literal than this film already is". So
the same words over a restrained film and an experimental one land
differently, and the curve the director authored is never overwritten.

## 8. What may flow between layers

Downward only, and each layer may only *bias* the next:

```
figures / subjects / relations   (checkable — no model, no gate)
        ↓
ratified reading                 (a model proposed, a human approved)
        ↓
scene plan + proposition         (roles; may add what nothing named)
        ↓
style, bent by intent + relation (a disposition, never a value)
        ↓
constructions + operators        (what is built, what is done to it)
        ↓
composition (planes → grounds)   (refused when the type contract fails)
        ↓
hash → cache → render
```

Nothing flows back up. A construction cannot edit a reading; a render
cannot change a figure. The one exception is `grammar.ts`, which reads a
*compiled film* and writes appetites — and it is explicitly a capture
step, run by an operator, not a feedback loop.

## 9. Where ambiguity may remain

- **A sentence with no ratified reading** falls back to the film's curve.
  Most scenes are this, and it is correct.
- **Several candidates**, carried on the report rather than resolved. The
  engine proposes; the human ratifies.
- **A direction the register lexicon cannot read** leaves the curve in
  charge and says so — `"nothing read"` is a real answer.
- **Tension between a pin and a restyle** is *reported*, never resolved
  unilaterally.

## 10. Where the system deliberately refuses to invent

This list is the project's actual spine, and every entry is enforced in
code:

- **No figure is ever invented.** `quantity` refuses to build a chart from
  a sentence that printed no numbers, whatever the director's mood. An
  axis implies a measurement.
- **No reading is guessed.** `extract-reading.ts` declines rather than
  guesses; the hedge floor overrules the model.
- **No relation is invented from a simile.** "Like insects" is not the
  city doing something to the insects.
- **No noun inside a prepositional phrase is promoted to subject.** It is
  the setting, and reading it as the topic hands the shot to the room.
- **No ground that cannot satisfy its compositor.** `groundSatisfies`
  refuses a painted plate to a field compositor rather than compositing
  nothing and looking like it worked.
- **No `Math.random()`.** Every stochastic choice is seeded from scene
  index or content.
- **No model at render time.** AI output is a frozen, hashed input
  artifact.
- **No claim of L3 determinism.** L1 always, L2 in a pinned environment,
  L2-GPU for shaders. Stated honestly rather than aspirationally.
- **Nothing depictable named?** The report says so rather than presenting
  an arbitrary answer as a reading.

---

## What this is not, yet

- **Level 3 population.** "Nobody noticed" produces an anomaly, an
  ordinary world and the city behind both — three real layers with their
  own weights. But each layer is still one construction, so the ordinary
  world is a populated plate rather than pedestrians facing away, traffic
  continuing, storefronts. The proposition can put something in the frame
  that no noun asked for, and can now stack it; it cannot populate any one
  layer richly.
- **One construction per role.** `COUNTERPOINT → space` is a fixed mapping
  today, which is the old one-winner problem at a higher level, waiting.
  The plan should state what must be expressed and let candidates differ
  in how — it does not.
- **One second input per chain.** The main chain has one ground slot, so a
  scene whose generic ground is a FIELD (`field_displace` over
  `gravity_field` — the flagship text-dissolution case) cannot also show
  its setting. The stack sits inside the existing guard rather than
  replacing it, which preserves the field case honestly and leaves the
  either/or in place.
- **Metaphor, narrative function, entity identity across a film.** Read
  nowhere. And they are not more lexicon.
- **Transformation across representations.** Named as the missing fourth
  program type; unbuilt.
- **Sparse vs dense as a director's dial.** A Hopper reading of "nobody
  noticed" is an almost empty street; a Bruegel reading is eighty
  micro-events. Both are correct, the difference is directorial, and there
  is no control for it.

The last one is the most interesting gap, because it is the point where
"what must be present for the proposition to hold" and "how richly should
the world be populated" become two different questions — and the system
currently only has an answer to the first.
