/* THE MIND — a structure that accumulates for the whole film and never clears.
 *
 * THE QUESTION THIS ANSWERS, which is the best framing anyone has put on this
 * work: not "what graphic represents this sentence" but
 *
 *     WHAT HAPPENS TO A MIND WHEN THIS SENTENCE ENTERS IT?
 *
 * And the constraint that makes it a medium rather than a metaphor: THE OLD
 * INFORMATION DOES NOT DISAPPEAR. It stays in the system. A node that stops
 * being talked about does not die, it goes latent — dim, still placed, still
 * pulling on its neighbours, available to be reactivated an essay later. The
 * screen develops a memory, and what the audience watches is thought
 * accumulating rather than an animation playing.
 *
 * EVERYTHING THIS ENGINE HAS DONE UNTIL NOW DOES THE OPPOSITE. Every beat
 * re-sampled the composition; units aged, died and were replaced; nothing
 * survived more than three beats. So nothing could ever BECOME meaningful,
 * because nothing was there beforehand to change — and a mark that has no
 * history cannot be recognised, recalled, contradicted or reframed. All of the
 * variety machinery in this codebase was compensating for that absence.
 *
 * THE OPERATIONS. Each is a real relation between arriving information and
 * what is already held, not an effect:
 *
 *   ARRIVE       a node enters, and the structure makes room for it
 *   ASSOCIATE    a new node links to a distant one it shares vocabulary with
 *   ACTIVATE     an old node lights up because the writing returned to it
 *   RECOGNISE    a latent node that has been present all along becomes bright
 *                and gains mass — it was always there and now it means
 *   DESTABILISE  edges break and positions scatter: a structure contradicted
 *   LOCK         two previously unconnected clusters snap together — insight
 *   COLLAPSE     several nodes merge into one — abstraction
 *   CLUSTER      scattered nodes organise themselves — categorisation
 *   DECAY        activation fades and the node stays — forgetting, not erasure
 *   OVERLOAD     more arrives than the layout can resolve; it jitters
 *   REFRAME      the same structure re-projected — nothing added, everything
 *                read differently
 *
 * DETERMINISM. The relaxation is iterative and stateful, which would break the
 * rule that frame 900 drawn directly equals frame 900 reached by playing. So
 * the simulation runs at BUILD time and every beat stores a SNAPSHOT; the
 * renderer interpolates between snapshots and never simulates. Same pattern as
 * the rest of the engine — built once, resolved analytically.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function makeMind() {
  return { nodes: [], edges: [], n: 0, overload: 0, phase: "SPARSE", cycles: 0 };
}

/** THE PHASES — the mind changing KIND, not size.
 *
 *  Measured on a real twenty-minute film, the first version of this saturated:
 *  41 nodes at minute one, 58 by minute five, and 57 at minute twenty. Only
 *  edges kept growing — a hairball — and OVERLOAD fired on 1,110 beats, so the
 *  structure was permanently maxed from early on and sat there for fifteen
 *  minutes. Accumulation alone is one trajectory and it ends in five.
 *
 *  A mind does not only fill. It fills, becomes unable to hold what it has,
 *  and then REORGANISES — throws away the weak connections, keeps the strong
 *  ones, and comes out sparse and ordered again with a different shape. Then
 *  it fills again, differently, because it is starting from what survived.
 *
 *  That cycle is what sustains a long duration, and it is the same principle
 *  minimalist process music runs on: not more material, but a perceptible
 *  process whose stages a viewer can feel. Each pass through the cycle starts
 *  from a different structure, so it can run for an hour without repeating,
 *  and each phase LOOKS categorically different from the others rather than
 *  denser than the last.
 */
export const PHASES = ["SPARSE", "ACCUMULATING", "SATURATED", "CRYSTALLISING", "CRYSTALLINE"];

function advancePhase(mind, rng) {
  const n = mind.nodes.length;
  const density = mind.edges.length / Math.max(1, n);

  switch (mind.phase) {
    case "SPARSE":
      if (n > 8) mind.phase = "ACCUMULATING";
      break;
    case "ACCUMULATING":
      // Saturation is a RATIO, not a count — a structure is overloaded when it
      // has more relationships than it can hold apart, whatever its size.
      if (density > 3.4 || n > 34) mind.phase = "SATURATED";
      break;
    case "SATURATED":
      // It cannot hold this. The next thing that happens is a reorganisation.
      mind.phase = "CRYSTALLISING";
      break;
    case "CRYSTALLISING": {
      // PRUNE. Weak edges go; strong ones survive. What is left is the shape
      // the accumulation was actually making, which was invisible underneath
      // everything else.
      mind.edges = mind.edges.filter((e) => e.w > 0.75);
      // Nodes that were never connected to anything strong go latent to the
      // point of near-invisibility, but they are NOT deleted — the film must
      // be able to recognise them again an essay later.
      const kept = new Set(mind.edges.flatMap((e) => [e.a, e.b]));
      for (const x of mind.nodes) {
        if (!kept.has(x.id) && x.mass < 1.4) x.act = Math.min(x.act, 0.06);
      }
      // And the survivors move apart, because there is suddenly room.
      for (const x of mind.nodes) {
        x.vx += (x.x - 0.5) * 0.05 + (rng() - 0.5) * 0.02;
        x.vy += (x.y - 0.5) * 0.05 + (rng() - 0.5) * 0.02;
      }
      mind.phase = "CRYSTALLINE";
      mind.cycles += 1;
      break;
    }
    case "CRYSTALLINE":
      // Clear, ordered, and open to more. The cycle begins again from what
      // survived, which is why the second pass is never the first.
      if (density > 1.6) mind.phase = "ACCUMULATING";
      break;
    default:
      break;
  }
}

/** Admit a passage into the mind, and report what happened.
 *
 *  The operation is not chosen from a menu — it FOLLOWS from the relation
 *  between what arrived and what was already held. That is the difference
 *  between depicting cognition and performing it.
 */
export function admit(mind, reading, beat, rng) {
  const terms = (reading?.terms ?? []).slice(0, 6);
  const ops = [];
  const now = beat.startMs;

  // ── ACTIVATE / RECOGNISE ────────────────────────────────────────────
  // A term the mind already holds does not create a second node. It wakes the
  // one that is there — which is the whole point, and what a fresh sample per
  // beat can never do.
  for (const t of terms) {
    const held = mind.nodes.find((x) => x.term === t);
    if (!held) continue;
    const wasLatent = held.act < 0.2;
    held.act = 1;
    held.mass = Math.min(3.2, held.mass + 0.35);
    held.lastAt = now;
    held.hits += 1;
    // A node that has sat dim for a long time and suddenly matters is not the
    // same event as one that never left. The first is RECOGNITION.
    ops.push(wasLatent && now - held.lastSeen > 12000 ? "RECOGNISE" : "ACTIVATE");
    held.lastSeen = now;
  }

  // ── ARRIVE ──────────────────────────────────────────────────────────
  const fresh = terms.filter((t) => !mind.nodes.some((x) => x.term === t));
  for (const t of fresh) {
    // A new node enters near whatever it is most related to, not at random —
    // an idea arrives attached to what it reminds you of.
    const kin = mind.nodes
      .map((x) => ({ x, s: shared(t, x.term) }))
      .sort((a, b) => b.s - a.s)[0];
    const base = kin && kin.s > 0 ? kin.x : null;
    mind.nodes.push({
      id: mind.n++,
      term: t,
      x: base ? base.x + (rng() - 0.5) * 0.22 : 0.5 + (rng() - 0.5) * 0.5,
      y: base ? base.y + (rng() - 0.5) * 0.22 : 0.5 + (rng() - 0.5) * 0.45,
      vx: 0,
      vy: 0,
      mass: 0.6 + rng() * 0.5,
      act: 1,
      born: now,
      lastAt: now,
      lastSeen: now,
      hits: 1,
    });
    ops.push("ARRIVE");
  }

  // ── ASSOCIATE ───────────────────────────────────────────────────────
  // Everything arriving in one passage is connected by having arrived
  // together. That is genuinely how association works and it costs nothing.
  const active = mind.nodes.filter((x) => x.lastAt === now);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      link(mind, active[i], active[j], 0.55);
      ops.push("ASSOCIATE");
    }
  }

  // ── LOCK — insight ──────────────────────────────────────────────────
  // A return that connects two things which were never connected before is
  // the shape of a realisation, and it is checkable: the writing came back to
  // an old passage while also saying something new.
  if (reading?.returnsTo != null && active.length > 0) {
    const old = mind.nodes
      .filter((x) => x.lastAt !== now && x.act > 0.05)
      .sort((a, b) => b.mass - a.mass)[0];
    if (old) {
      link(mind, old, active[0], 1);
      old.act = Math.max(old.act, 0.85);
      ops.push("LOCK");
    }
  }

  // ── DESTABILISE — contradiction ─────────────────────────────────────
  if (reading?.kind === "NEGATION" && mind.edges.length > 2) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n && mind.edges.length > 0; i++) {
      mind.edges.splice(Math.floor(rng() * mind.edges.length), 1);
    }
    for (const x of mind.nodes) {
      x.vx += (rng() - 0.5) * 0.06;
      x.vy += (rng() - 0.5) * 0.06;
    }
    ops.push("DESTABILISE");
  }

  // ── COLLAPSE — abstraction ──────────────────────────────────────────
  // Several concrete things becoming one general one. The merged node keeps
  // the others' mass, because an abstraction is heavier than its instances.
  if (mind.nodes.length > 14 && rng() < 0.22) {
    const pool = mind.nodes.filter((x) => x.act < 0.3).slice(0, 3);
    if (pool.length >= 2) {
      const [keep, ...gone] = pool;
      for (const g of gone) {
        keep.mass += g.mass * 0.6;
        for (const e of mind.edges) {
          if (e.a === g.id) e.a = keep.id;
          if (e.b === g.id) e.b = keep.id;
        }
        mind.nodes.splice(mind.nodes.indexOf(g), 1);
      }
      keep.abstracted = true;
      ops.push("COLLAPSE");
    }
  }

  // ── DECAY — forgetting, which is not erasure ────────────────────────
  for (const x of mind.nodes) {
    if (x.lastAt === now) continue;
    // Exponential in real time, so a node fades over about half a minute and
    // then SITS THERE, dim, indefinitely. It is still placed, still pulling on
    // its neighbours, still available to be recognised an essay later.
    x.act = Math.max(0.04, x.act * Math.exp(-(now - x.lastAt) / 26000) * 0.985);
  }

  // ── OVERLOAD, AND THE PHASE IT LEADS TO ─────────────────────────────
  // Overload used to be a permanent condition — it fired on 1,110 beats of a
  // twenty-minute film, which means it described nothing. It is a STAGE now,
  // and the stage after it is a reorganisation.
  mind.overload = clamp01(mind.edges.length / Math.max(1, mind.nodes.length) / 4);
  const was = mind.phase;
  advancePhase(mind, rng);
  if (mind.phase !== was) ops.push(mind.phase);

  return [...new Set(ops)];
}

function shared(a, b) {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  let k = 0;
  while (k < n && a[k] === b[k]) k++;
  return k >= 3 ? k / n : 0;
}

function link(mind, a, b, w) {
  if (!a || !b || a.id === b.id) return;
  const e = mind.edges.find(
    (x) => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id),
  );
  if (e) e.w = Math.min(1.6, e.w + w * 0.4);
  else mind.edges.push({ a: a.id, b: b.id, w });
}

/** RELAX — the structure reorganising itself around what just arrived.
 *
 *  Force-directed: linked nodes pull together, everything pushes apart, and
 *  the whole is drawn weakly toward the centre so it does not wander off the
 *  frame. Under OVERLOAD the repulsion cannot resolve and the layout jitters,
 *  which is what a system holding more than it can organise looks like — an
 *  emergent property rather than an effect.
 */
export function relax(mind, steps) {
  const byId = new Map(mind.nodes.map((n) => [n.id, n]));
  for (let s = 0; s < steps; s++) {
    for (const e of mind.edges) {
      const a = byId.get(e.a);
      const b = byId.get(e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-4;
      const rest = 0.16 + (1 - Math.min(1, e.w)) * 0.2;
      const f = (d - rest) * 0.06 * e.w;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    for (let i = 0; i < mind.nodes.length; i++) {
      const a = mind.nodes[i];
      for (let j = i + 1; j < mind.nodes.length; j++) {
        const b = mind.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 1e-4;
        if (d2 > 0.25) continue;
        const f = (0.0016 * (a.mass + b.mass)) / d2;
        const d = Math.sqrt(d2);
        a.vx -= (dx / d) * f;
        a.vy -= (dy / d) * f;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      }
      a.vx += (0.5 - a.x) * 0.004;
      a.vy += (0.5 - a.y) * 0.004;
      // Overload keeps energy in the system so it never settles.
      const damp = 0.86 - mind.overload * 0.12;
      a.vx *= damp;
      a.vy *= damp;
      a.x += a.vx;
      a.y += a.vy;
    }
  }
}

/** A snapshot the renderer can interpolate. Positions only — the simulation
 *  never runs at render time, so a frame drawn directly is the frame. */
export function snapshot(mind) {
  return {
    nodes: mind.nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      mass: n.mass,
      act: n.act,
      term: n.term,
      abstracted: !!n.abstracted,
    })),
    edges: mind.edges.map((e) => ({ ...e })),
    overload: mind.overload,
    phase: mind.phase,
    cycles: mind.cycles,
  };
}
