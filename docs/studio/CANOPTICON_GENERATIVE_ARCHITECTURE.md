# The generative architecture, now that the payload problem is solved

> A proposal, not a report. It eliminates two layers, merges two more, and
> adds one concept. Written after building the thing it proposes and
> rendering eight films with it.

---

## The answer, first

**Visual Language was not the right abstraction.** It was the right
*instinct* — that meaning needs a mediating layer before graph generation —
attached to the wrong noun. A language, as built, answered *"what does this
sentence look like"*, which is the same question constructions answered and
the same question the synthesizer answered. Three layers, one question,
three sets of recipes.

The missing concept is **temporal**:

> A film is not a sequence of compositions. It is a sequence of DECISIONS,
> and the decisions happen in time.

So: **Visual Language becomes Compositional Strategy**, and a strategy is a
sequence of MOVES rather than a chain of primitives.

---

## What survives, what goes, what changes

| Concept | Verdict |
|---|---|
| **PRIMITIVE** | **Survives.** A capability. The vocabulary. |
| **PAYLOAD** | **Survives, now real.** Information travelling between nodes. 129/129 honest. |
| **GRAPH** | **Survives.** The visual program. Typed, nested, cache-addressable. |
| **SEMANTIC MODEL** | **Survives.** What the prose checkably says. Untouched by all of this. |
| **DIRECTOR STATE** | **Survives, narrowed.** The *continuous* dimensions — abstraction, density, population, attention, restraint. Not a parallel authoring system; the dials a strategy is executed under. |
| **VISUAL LANGUAGE** | **Becomes COMPOSITIONAL STRATEGY.** Same slot, different question: not *what does it look like* but *what happens, in what order*. |
| **COMPOSITION STRATEGY** | **Is that.** The two were never separate — having both was the redundancy. |
| **GRAPH SYNTHESIS** | **Demoted to a discovery tool.** It proved the substrate and found one genuine transformation nobody wrote. It does not author. It belongs in the Lab, not the pipeline. |
| **CONSTRUCTIONS / OPERATORS** | **Deleted.** Already off the path; six of seven languages never touched them. |

**Net: seven concepts become five.**

```
SEMANTIC MODEL      what the prose checkably says
      ↓
STRATEGY            a sequence of MOVES, read off the sentence
      ↓  (× DIRECTOR STATE — the continuous dials)
GRAPH               one per move, typed, real payloads
      ↓
RENDER
```

---

## What a strategy actually is

Two parts, and the split is the whole design.

**An ARC** — which moves, in what order, *for this beat*. Read off the
sentence: a printed count earns a REPEAT, a relation earns a COLLIDE, a
beat late in the passage ends on FRAGMENT rather than RESOLVE. So the same
strategy cuts differently for different prose, which is precisely the
property recipes never had.

**A REALISATION** — what each move is, *in this material*.

The move vocabulary is **shared across every strategy**:

```
INTRODUCE  state it plainly
SCALE      make it monumental
REPEAT     multiply it — count off the prose, never chosen
FRAGMENT   take it apart into what it is made of
FIELD      let it stop being an object and become texture
COLLIDE    two things at once (needs a relation)
INVERT     figure and ground swap
RESOLVE    let it settle into something you can look at
```

That sharing is not tidiness. It is what makes **SYNTHESIS** mean something
other than "cut between seven films": the same decision — REPEAT — happens
in words, then in geometry, then in a world. The meaning is the constant;
the medium is what changes underneath it. Neither strategy needs to know
the other exists.

**Each move becomes its own shot with its own window.** A beat is cut
rather than held. Thirteen shots in thirteen seconds instead of three
four-second stares. That is where rhythm comes from, and rhythm is most of
what *"want to watch the next thirty seconds"* actually means.

Durations are not uniform — an INTRODUCE needs to be legible, a FRAGMENT is
over before you've parsed it — and everything shortens as the passage
advances, which is where the sense of building comes from.

---

## What this predicts, and what actually happened

Eight films, one paragraph, same words, same seed.

**Confirmed.** The strategies are genuinely different *as films*, not just
as pictures. TYPOGRAPHIC states WITHOUT at full frame then drops to CAMERA
tiny in the corner. GEOMETRIC moves rosette → boolean intersection → node
field. MATERIAL is a memorandum, photocopied, then struck through.
ILLUSTRATIVE is a street with lamps. DIAGRAMMATIC assembles a graph and
closes it into a radial figure.

**The contract earned its keep immediately.** Two strategies rendered
*type errors burned into the frame* — `scanline consumes IMAGE but
text_layout emits GEOMETRY`. Before the payload pass those chains would
have silently "worked" by passing a canvas and looked like a stylistic
choice. Now they fail loudly and I fixed them. That is the invariant paying
for itself within an hour of existing.

**One fix is worth recording as a design principle.** SIGNAL needed a
GEOMETRY → IMAGE bridge and the only one available is destructive. For
that strategy the destruction *is* the point — a degraded transmission —
so it was kept deliberately. The same bridge in GEOMETRIC would be a bug.
**A transformation is not good or bad in itself; it is good or bad for a
strategy.** That is an argument for strategies existing at all.

---

## Where the Director sits

The Director chooses a **strategy**, not a language and never a primitive.

```
"Make this feel like a propaganda film"
        ↓
strategy   TYPOGRAPHIC → SIGNAL
arc        SCALE · REPEAT · REPEAT · INVERT · FRAGMENT
dials      density high · attention unstable · cut rapid
```

```
"An old photograph that slowly becomes a diagram"
        ↓
strategy   MATERIAL → DIAGRAMMATIC   (a synthesis, not a blend)
arc        INTRODUCE · SCALE · FRAGMENT · FIELD · RESOLVE
```

The strategy is the discrete choice; the director state is the continuous
one. Neither is a primitive and neither is a chain.

---

## The two tracks, kept separate on purpose

**TRACK A — graphic / editorial cinema.** Typographic, geometric,
diagrammatic, signal, material, computational. Cut grammar and abstract
motion. **This works now**, and typography is not the consolation prize —
it is currently the strongest thing in the system.

**TRACK B — illustrative cinema.** Places, bodies, objects, light, camera,
transformation. This still needs cinematography, which does not exist
anywhere in the model.

**TRACK C — synthesis.** Already structurally possible because the move
vocabulary is shared. A word can become a building because REPEAT means the
same thing to both.

Track A must not wait on Track B. That was the whole point of the split and
it is now enforced by the architecture rather than by intention.

---

## What is still missing, honestly

- **Cinematography has no home.** Camera, light, depth, colour temperature
  are not primitives, not strategies, not dials. This is the largest
  single gap and the proposal above does not solve it. It probably wants
  to be a property of the GRAPH — a shot has a camera the way it has a
  duration — rather than another layer.
- **ANIMATION may be the next ARTIFACT.** Once a chain emits ANIMATION only
  motion craft accepts it, which is why synthesized tails all look alike.
  It is worth asking whether it is a payload at all or just a label for
  "this primitive moves".
- **A real ENTITY contract** — a body a renderer draws *from* — is what
  makes physical transformation possible, and is still classified C.
- **Strategies are still hand-written**, and that is fine. They are eight
  authored positions, not a search space. The synthesizer is the thing that
  searches, and it belongs beside this rather than under it.
