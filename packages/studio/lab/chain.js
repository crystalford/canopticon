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

/** Instantiate a chain once. Instances hold per-primitive state (particle
 *  positions, creature bodies), so they must persist across frames — a
 *  chain rebuilt every frame would reset all motion to its first step. */
function buildChain(chain, w, h) {
  const errors = validate(chain);
  if (errors.length) return { errors, run: null };

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
    return { id: node.id, inst: def.make(params), buf, ctx: buf.getContext("2d") };
  });

  return {
    errors: [],
    run(t) {
      // The payload, not just a canvas. GEOMETRY is a point set and a
      // picture OF points is not the same thing: re-sampling a drawn point
      // cloud loses which point is which, so a morph between two of them
      // has nothing to interpolate. A stage that emits GEOMETRY attaches
      // it here; a stage that consumes GEOMETRY reads it instead of
      // guessing from pixels. That is the type system being real at
      // runtime rather than only at plan time.
      let payload = null;
      for (const stage of stages) {
        stage.ctx.clearRect(0, 0, w, h);
        const out = stage.inst.frame(stage.ctx, w, h, t, payload);
        payload = {
          canvas: stage.buf,
          // A primitive may hand back typed data alongside its pixels.
          geometry: out && out.geometry ? out.geometry : null,
          field: out && out.field ? out.field : null,
        };
      }
      return stages[stages.length - 1].buf;
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
    }));
    return { shot, chain: buildChain(seeded, w, h) };
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
});
