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
    /* THE BRIDGE, AS A LIVE PARAMETER.
     *
     * A one shot needs a value to CHANGE over a scene without the chain
     * being rebuilt, and the only mechanism that existed was `buildSequence`,
     * which gives every shot its own instance — a deliberate hard reset,
     * correct for a cut and fatal for a film that is forbidden to cut. A
     * one shot bridged through shots is a slideshow with the label filed
     * off.
     *
     * What makes this possible is that primitives close over the params
     * OBJECT and read `p.x` inside `frame`, not into a local at make time
     * (`place` in prims-h.js is the one that matters and it does). So the
     * object is live: writing to it between frames is a continuous change
     * with no rebuild, no reseed and no lost particle state.
     *
     * Not every primitive can be tweened — one that reads a param once in
     * its make prologue will ignore this silently. The compiler only ever
     * tweens `place` and the typographic sources, all of which are
     * verified. Widening that set means checking the primitive first, not
     * assuming.
     *
     * `tweenAtMs` is WHEN it starts, and it is what makes a word land on
     * the moment it is spoken rather than at the top of the scene. Before
     * it, a bridge could only run from t=0 — fine for a scene arriving,
     * useless for a phrase whose measured word is four seconds in. Held at
     * the start value until then, so nothing moves early. */
    const tween = node.tween && Object.keys(node.tween).length ? node.tween : null;
    return {
      id: node.id,
      inst: def.make(params),
      params,
      tween,
      tweenSec: Math.max(0, node.tweenMs ?? 0) / 1000,
      tweenAtSec: Math.max(0, node.tweenAtMs ?? 0) / 1000,
      buf,
      ctx: buf.getContext("2d"),
      ground: ground && !ground.errors.length ? ground : null,
    };
  });

  /** Move a stage's live params along the bridge. Eased, clamped, and on
   *  the chain's own clock — not the warped one, because a bridge is a
   *  fact about the film's time and motion craft re-times the shot. */
  const smooth = (u) => u * u * (3 - 2 * u);
  function tweenStage(stage, t) {
    const local = t - stage.tweenAtSec;
    if (local < 0) {
      // Not yet. Pinned to the start value rather than left wherever the
      // last frame put it — a word that drifts before its cue is worse
      // than one that appears late.
      for (const k in stage.tween) {
        const pair = stage.tween[k];
        if (Array.isArray(pair) && pair.length === 2) stage.params[k] = pair[0];
      }
      return;
    }
    const u = stage.tweenSec > 0 ? Math.min(1, Math.max(0, local / stage.tweenSec)) : 1;
    const e = smooth(u);
    for (const k in stage.tween) {
      const pair = stage.tween[k];
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      stage.params[k] = pair[0] + (pair[1] - pair[0]) * e;
    }
  }

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

  /* A SCENE MAY DRAW NOTHING, AND IT MUST NOT DO IT BY CRASHING.
   *
   * `validate([])` returns no errors — the forEach body never runs — so an
   * empty chain passed every guard and then died on the last line of
   * `run`: `draw[draw.length - 1].buf` with `draw` empty. Not a black
   * frame; an uncaught TypeError, thrown per frame, out of `drawFrame`,
   * with `render.js` on its SUCCESS branch because there were no errors to
   * report.
   *
   * So the compiler could not express "nothing happens here" at all:
   * something visual was valid and nothing visual was broken. That is the
   * floor beneath every other floor, and it is why this is the first
   * change and not a null-guard bolted on later.
   *
   * A held frame is the film's own ground and nothing else. No marker, no
   * label — an exported film must not annotate itself, and the instrument
   * is where an operator finds out that this moment was held on purpose.
   *
   * `empty` is the flag that keeps this honest. An empty chain arriving by
   * ACCIDENT would otherwise render as clean ground and be
   * indistinguishable from an intended hold — the invisible blank. The
   * caller checks it against the scene's own declaration. */
  let blank = null;
  const blankBuffer = () => {
    if (!blank) {
      blank = document.createElement("canvas");
      blank.width = w;
      blank.height = h;
    }
    const c = blank.getContext("2d");
    c.clearRect(0, 0, w, h);
    bg(c, w, h);
    return blank;
  };

  // What the chain last emitted, typed. A ground is consumed by its
  // compositor as a PAYLOAD, not a picture — `field_displace` reads the
  // field's numbers — so the branch has to be able to hand back what it
  // produced, not only what it drew.
  let emitted = { canvas: null, geometry: null, field: null, data: null };

  return {
    errors: [],
    /** True when this chain paints nothing. Read by the renderer, which
     *  must tell an intended hold from a chain that went missing. */
    empty: draw.length === 0,
    lastPayload: () => emitted,
    /* GIVE THE MEMORY BACK.
     *
     * Every stage owns a full-size canvas and every compositor's ground
     * owns a whole chain of its own, so one scene at 1076×760 is tens of
     * megabytes and a scene built from a five-element scene graph is
     * several times that again. Nothing could release any of it: the
     * canvases live on `stages`, which this object never exposed.
     *
     * Dropping the reference is NOT enough, and that detail is the whole
     * bug. Canvas backing store is not in the JS heap — which is exactly
     * why the tab crashed at scene 21 of 39 while `performance.memory`
     * read a healthy 64MB right up to the moment it died. Setting the
     * dimensions to zero is what actually frees it. */
    dispose() {
      for (const s of stages) {
        if (s.ground?.dispose) s.ground.dispose();
        if (s.buf) {
          s.buf.width = 0;
          s.buf.height = 0;
        }
      }
      stages.length = 0;
      if (blank) {
        blank.width = 0;
        blank.height = 0;
        blank = null;
      }
      emitted = { canvas: null, geometry: null, field: null, data: null };
    },
    run(t) {
      if (draw.length === 0) {
        emitted = { canvas: null, geometry: null, field: null, data: null };
        return blankBuffer();
      }
      // The payload, not just a canvas. GEOMETRY is a point set and a
      // picture OF points is not the same thing: re-sampling a drawn point
      // cloud loses which point is which, so a morph between two of them
      // has nothing to interpolate. A stage that emits GEOMETRY attaches
      // it here; a stage that consumes GEOMETRY reads it instead of
      // guessing from pixels. That is the type system being real at
      // runtime rather than only at plan time.
      const tt = painters.length > 0 ? warpTime(t) : t;
      // Before anything draws, and on every stage rather than only the
      // painters — a shaper carrying a bridge is legal and would otherwise
      // be silently frozen at its start value.
      for (const s of stages) if (s.tween) tweenStage(s, t);
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
          // PATHS TRAVEL. The payload was assembled field by field and
          // `paths` was never one of them, so every vector a primitive
          // emitted was dropped at the very next stage and the renderer
          // only ever saw the point-sample fallback. Materiality, line
          // weight and resolution independence were all unreachable for
          // exactly this reason — the geometry was real and could not
          // get anywhere.
          paths: out && out.paths ? out.paths : null,
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
      : {
          errors: [],
          shots: 1,
          empty: single.empty,
          dispose: () => single.dispose?.(),
          run: (ms) => single.run(ms / 1000),
        };
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
      /* A BRIDGE BELONGS TO THE SCENE, NOT TO EVERY SHOT.
       *
       * Each shot runs on its own local clock, so leaving the tween on
       * all of them would replay the arrival at every cut — the thing
       * would slide in from its old position four times. It runs on the
       * first shot and every later shot is pinned at the value the bridge
       * arrived at. A cut scene is not a one shot anyway; this only
       * matters for HYBRID, where both happen in the same film. */
      ...(node.tween && i > 0
        ? {
            tween: null,
            params: Object.fromEntries(
              Object.entries({ ...(node.params || {}), ...(shot.params || {}) }).concat(
                Object.entries(node.tween).map(([k, v]) => [k, Array.isArray(v) ? v[1] : v]),
              ),
            ),
          }
        : {}),
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
    // A cut scene is empty only if every shot of it is.
    empty: built.every((b) => b.chain.empty),
    /** A shot is a whole chain, so a scene cut into four shots holds four
     *  times the canvases of a scene that was not. Releasing one of these
     *  and not the others would be most of a fix. */
    dispose() {
      for (const b of built) b.chain.dispose?.();
      built.length = 0;
    },
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
