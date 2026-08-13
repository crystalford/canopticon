/* CANOPTICON — the chain executor.
 *
 * Until now every primitive drew into the same canvas independently, so a
 * "chain" was a list the compiler validated but nothing ever ran. This
 * executes one: each node renders into its own buffer, and the next node
 * receives that buffer as input.
 *
 *   node[0] → bufferA → node[1] → bufferB → node[2] → out
 *
 * Primitives opt in. A primitive that declares inputs and reads the fifth
 * argument consumes upstream pixels; every existing primitive ignores it
 * and behaves exactly as before, which is what makes this additive rather
 * than a migration of all 115.
 *
 * The executor refuses to run a chain that doesn't typecheck, using the
 * same rule the compiler's planner uses. A chain is not a suggestion.
 */

function typeOf(id, side) {
  const spec = window.PRIMS[id];
  if (!spec) return [];
  const [lhs, rhs] = spec.io.split("→").map((s) => s.trim());
  const raw = side === "in" ? lhs : rhs;
  if (raw === "—") return [];
  return raw
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Same rule as the compiler's canChain: a consumer with no declared
 *  inputs is a source and composes with anything. */
function linkOk(from, to) {
  const needs = typeOf(to, "in");
  if (needs.length === 0) return true;
  // A COMPOSITOR TAKES PIXELS — its first input is the previous stage's
  // canvas, which every primitive produces. Same single stated exception
  // the compiler's own canChain makes, and it has to be made in both or
  // the Preview and the Worker would disagree about whether a chain is
  // legal, which is how they came to disagree about 57 of 88 scenes.
  if (takesTwo(to)) return true;
  const gives = typeOf(from, "out");
  return needs.some((t) => gives.includes(t));
}

function validate(chain) {
  const errors = [];
  chain.forEach((node, i) => {
    if (!window.PRIMS[node.id]) {
      errors.push(`${node.id} is not in the palette`);
      return;
    }
    // A BRANCH IS A CHAIN. It gets the same walk — a ground built out of
    // primitives that do not compose is as broken as a subject built that
    // way, and a compositor drawing a broken branch would just show the
    // subject and look like it worked.
    if (node.b && node.b.length) {
      for (const e of validate(node.b)) errors.push(`ground: ${e}`);
      const needs = secondInputOf(node.id);
      if (needs.length) {
        const tail = node.b[node.b.length - 1];
        const gives = tail ? typeOf(tail.id, "out") : [];
        if (!needs.some((tp) => gives.includes(tp))) {
          errors.push(
            `${node.id} needs a ${needs.join("|")} on its second input but its ground ends in ` +
              `${tail ? tail.id : "nothing"}, which emits ${gives.join("|") || "nothing"}`,
          );
        }
      }
    }
    if (i === 0) return;
    const prev = chain[i - 1].id;
    if (!linkOk(prev, node.id)) {
      errors.push(
        `${node.id} consumes ${typeOf(node.id, "in").join("|") || "nothing"} but ${prev} emits ${typeOf(prev, "out").join("|") || "nothing"}`,
      );
    }
  });
  return errors;
}

/** What a two-input primitive wants on its SECOND input, if anything.
 *
 *  Read off the live instance rather than declared in the io string,
 *  because the io string has one arrow and a second input is not a second
 *  arrow — the same precedent motion craft set by exposing `warp`.
 *
 *  A compositor whose second input is IMAGE is unconstrained on purpose:
 *  pixels are what every primitive produces, so any branch is legal and
 *  saying otherwise would be theatre. FIELD is a real constraint and is
 *  checked. */
function secondInputOf(id) {
  const spec = window.PRIMS[id];
  if (!spec) return [];
  const probe = SECOND_INPUT.get(id);
  if (probe !== undefined) return probe;
  let two = null;
  try {
    const params = { seed: 1 };
    for (const k in spec.params) {
      const s = spec.params[k];
      params[k] = s.s !== undefined ? s.s : s.v;
    }
    two = spec.make(params).two || null;
  } catch {
    two = null;
  }
  const out = two && two !== "IMAGE" ? [two] : [];
  SECOND_INPUT.set(id, out);
  return out;
}
const SECOND_INPUT = new Map();

/** Does this primitive take a second input at all? */
function takesTwo(id) {
  const spec = window.PRIMS[id];
  if (!spec) return false;
  if (TAKES_TWO.has(id)) return TAKES_TWO.get(id);
  let yes = false;
  try {
    const params = { seed: 1 };
    for (const k in spec.params) {
      const s = spec.params[k];
      params[k] = s.s !== undefined ? s.s : s.v;
    }
    yes = Boolean(spec.make(params).two);
  } catch {
    yes = false;
  }
  TAKES_TWO.set(id, yes);
  return yes;
}
const TAKES_TWO = new Map();

/** Instantiate a chain once. Instances hold per-primitive state (particle
 *  positions, creature bodies), so they must persist across frames — a
 *  chain rebuilt every frame would reset all motion to its first step. */
function buildChain(chain, w, h, duration) {
  const errors = validate(chain);
  if (errors.length) return { errors, run: null };
  const dur = duration > 0 ? duration : 3;

  const stages = chain.map((node) => {
    const def = window.PRIMS[node.id];
    const params = { seed: node.seed ?? 1337 };
    for (const k in def.params) {
      const s = def.params[k];
      params[k] = s.s !== undefined ? s.s : s.v;
    }
    Object.assign(params, node.params || {});
    const buf = document.createElement("canvas");
    buf.width = w;
    buf.height = h;
    // THE GROUND, built as its own chain. It is instantiated once and kept,
    // exactly like the main chain is, because a branch rebuilt per frame
    // would reset its own motion to step one every frame — the same bug
    // the main chain was carefully written to avoid.
    const ground =
      node.b && node.b.length && takesTwo(node.id) ? buildChain(node.b, w, h, dur) : null;
    return {
      id: node.id,
      inst: def.make(params),
      buf,
      ctx: buf.getContext("2d"),
      ground: ground && !ground.errors.length ? ground : null,
    };
  });

  // MOTION CRAFT RE-TIMES; IT DOES NOT DRAW.
  //
  // The six motion-craft primitives declare ANIMATION → ANIMATION, and run
  // as ordinary stages they painted an easing-curve diagram over the shot —
  // which every visual language's tail did, invisibly, to every chain that
  // reached them. An ease cannot be applied to a frame that has already
  // been rendered. It has to be applied to the clock.
  //
  // So a stage exposing `warp` is pulled out of the draw order and folded
  // into the time the remaining stages run on. If a chain is ONLY motion
  // craft, they render as their own diagrams, which is what an operator
  // inspecting the primitive by itself actually wants to see.
  const shapers = stages.filter((s) => typeof s.inst.warp === "function");
  const painters = stages.filter((s) => typeof s.inst.warp !== "function");
  const draw = painters.length > 0 ? painters : stages;
  const warpTime = (t) => shapers.reduce((acc, s) => s.inst.warp(acc, dur), t);

  // What the chain last emitted, typed. A ground is consumed by its
  // compositor as a PAYLOAD, not a picture — `field_displace` reads the
  // field's numbers — so the branch has to be able to hand back what it
  // produced, not only what it drew.
  let emitted = { canvas: null, geometry: null, field: null, data: null };

  return {
    errors: [],
    lastPayload: () => emitted,
    run(t) {
      // The payload, not just a canvas. GEOMETRY is a point set and a
      // picture OF points is not the same thing: re-sampling a drawn point
      // cloud loses which point is which, so a morph between two of them
      // has nothing to interpolate. A stage that emits GEOMETRY attaches
      // it here; a stage that consumes GEOMETRY reads it instead of
      // guessing from pixels. That is the type system being real at
      // runtime rather than only at plan time.
      const tt = painters.length > 0 ? warpTime(t) : t;
      let payload = null;
      for (const stage of draw) {
        stage.ctx.clearRect(0, 0, w, h);
        // A compositor's SECOND input: its ground, rendered at the same
        // instant on the same clock. Run first, so the composite is given
        // a finished layer rather than one that is a frame behind.
        let branch = null;
        if (stage.ground) {
          const canvas = stage.ground.run(tt);
          branch = { ...stage.ground.lastPayload(), canvas };
        }
        const out = stage.inst.frame(stage.ctx, w, h, tt, payload, branch, dur);
        payload = {
          canvas: stage.buf,
          // A primitive may hand back typed data alongside its pixels.
          geometry: out && out.geometry ? out.geometry : null,
          field: out && out.field ? out.field : null,
          // DATA travels too. Without this line the twenty-four
          // DATA-consuming primitives received nothing from `data_series`
          // and silently fell back to their own synthetic arrays — the
          // chain typechecked, ran, and charted numbers that were not in
          // the essay.
          data: out && out.data ? out.data : null,
        };
      }
      emitted = payload || emitted;
      return draw[draw.length - 1].buf;
    },
    stages,
  };
}

/** Render a scene as a SEQUENCE OF SHOTS rather than one continuous take.
 *
 *  The solver already decides where the cuts fall; this is what makes them
 *  visible. Each shot gets its OWN chain instance, which is the whole
 *  difference between a cut and a dissolve: at a cut, state resets. A
 *  particle system carried across the boundary would drift through it and
 *  the edit would read as a wobble rather than an edit.
 *
 *  Each shot is seeded from its index so the same cut always yields the
 *  same frame, and so consecutive shots are not identical.
 */
function buildSequence(chain, shots, w, h) {
  if (!shots || shots.length === 0) {
    const single = buildChain(chain, w, h);
    return single.errors.length
      ? { errors: single.errors, run: null }
      : { errors: [], shots: 1, run: (ms) => single.run(ms / 1000) };
  }

  const built = shots.map((shot, i) => {
    const seeded = chain.map((node, j) => ({
      ...node,
      // Vary the seed per shot so a cut lands somewhere new, but keep it
      // derived — a random seed would break determinism.
      seed: (node.seed ?? 1337) + i * 101 + j,
      // WHAT VARIES ACROSS THE CUT. Without this a six-shot scene is one
      // continuous image with a stutter in it: the solver decided where to
      // cut, the shot planner decided what should change, and the executor
      // was applying only the first of the two. The overrides were resolved
      // upstream against what each primitive actually declares (see
      // compile/film.ts), so anything arriving here is a parameter the
      // primitive really has.
      params: { ...(node.params || {}), ...(shot.params || {}) },
      // The ground travels with its compositor across a cut. It gets its
      // own fresh instance per shot for the same reason the subject does:
      // at a cut, state resets.
      ...(node.b ? { b: node.b } : {}),
    }));
    // The shot's own length, so a motion-craft ease spans the shot rather
    // than an arbitrary second.
    return {
      shot,
      chain: buildChain(seeded, w, h, (shot.endMs - shot.startMs) / 1000),
    };
  });

  const bad = built.find((b) => b.chain.errors.length);
  if (bad) return { errors: bad.chain.errors, run: null };

  return {
    errors: [],
    shots: built.length,
    /** `ms` is time on the FILM's clock. The shot whose window contains it
     *  renders, at its own local time — so a cut restarts the shot rather
     *  than joining it mid-motion. */
    run(ms) {
      let active = built[built.length - 1];
      for (const b of built) {
        if (ms >= b.shot.startMs && ms < b.shot.endMs) {
          active = b;
          break;
        }
      }
      return active.chain.run((ms - active.shot.startMs) / 1000);
    },
    at(ms) {
      for (let i = 0; i < built.length; i++) {
        const b = built[i];
        if (ms >= b.shot.startMs && ms < b.shot.endMs) return i;
      }
      return built.length - 1;
    },
  };
}

Object.assign(window, {
  buildChain,
  buildSequence,
  validateChain: validate,
  chainLinkOk: linkOk,
  chainTakesTwo: takesTwo,
  chainSecondInput: secondInputOf,
});
