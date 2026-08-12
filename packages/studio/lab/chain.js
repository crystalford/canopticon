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
      let input = null;
      for (const stage of stages) {
        stage.ctx.clearRect(0, 0, w, h);
        stage.inst.frame(stage.ctx, w, h, t, input);
        input = stage.buf;
      }
      return stages[stages.length - 1].buf;
    },
    stages,
  };
}

Object.assign(window, { buildChain, validateChain: validate, chainLinkOk: linkOk });
