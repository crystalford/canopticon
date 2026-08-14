/* CANOPTICON — resolver, composition engine, cache.
 *
 * THIS FILE USED TO BE A SECOND COMPILER. It reimplemented the abstraction
 * ladder, the creative-state resolver, the precedence order and the cost
 * table in the browser, and the Worker implemented them again in
 * TypeScript. Two engines that could disagree, and did — the two chain
 * validators disagreed about 57 of 88 scenes of a real film before anyone
 * noticed, because nothing ever ran both against the same input.
 *
 * Now: when a real project is loaded, `compose` READS what the Worker
 * decided rather than deciding again. The local implementation is kept for
 * the built-in example only, which is honest — the example has no Worker
 * behind it — and it is the only thing in the Lab still allowed to
 * compose.
 *
 * Deterministic either way. No Math.random.
 */

// Follows the CURRENT film. `const F = window.FILM` captured whichever film
// existed at script-load, so loading a project changed the views and left
// the engine composing the demo.
const F = new Proxy(
  {},
  {
    get: (_t, k) => (window.FILM ? window.FILM[k] : undefined),
  },
);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ── creative state resolution ─────────────────────────── */
function resolveAt(pos) {
  const cp = F.controlPoints,
    out = {};
  let i = 0;
  while (i < cp.length - 2 && cp[i + 1].at < pos) i++;
  const a = cp[i],
    b = cp[i + 1],
    span = b.at - a.at;
  const t = smooth(clamp(span ? (pos - a.at) / span : 0, 0, 1));
  for (const k in a.v) out[k] = a.v[k] + (b.v[k] - a.v[k]) * t;
  Object.assign(out, F.identity);
  const held = [];
  for (const inv of F.invariants) {
    const v = out[inv.param];
    if (inv.min != null && v < inv.min) {
      out[inv.param] = inv.min;
      held.push(inv.param + " floored " + inv.min.toFixed(2));
    }
    if (inv.max != null && v > inv.max) {
      out[inv.param] = inv.max;
      held.push(inv.param + " capped " + inv.max.toFixed(2));
    }
  }
  out._held = held;
  return out;
}

/* ── composition engine ────────────────────────────────── */
const LADDER = [
  { max: 0.3, tier: "GROUNDED", base: ["document_surface", "document_layout", "camera_move"] },
  { max: 0.52, tier: "ANNOTATED", base: ["document_surface", "annotation", "text_stagger"] },
  { max: 0.7, tier: "DECOMPOSED", base: ["text_layout", "glyph_to_points", "particle_seek"] },
  {
    max: 1.01,
    tier: "DISSOLVED",
    base: ["noise_field", "flow_field", "particle_flow", "particle_trail"],
  },
];
const MOTIF_CHAIN = {
  time: ["timeline_linear", "text_stagger"],
  institution: ["document_surface", "camera_move"],
  uncertainty: ["glyph_to_points", "particle_flow"],
};

function compose(scene) {
  // A real project: the Worker already composed this scene, with the real
  // precedence order, the real registry and the real cost model. Adapt it
  // to the shape the views read rather than recomputing an approximation
  // of it here.
  const real = window.STUDIO && window.STUDIO.composed.get(scene.id);
  if (real) return adoptComposed(scene, real);
  return composeLocally(scene);
}

/** Map a compiled scene onto the prototype's view model. Nothing is
 *  invented: every field is carried across, and where the plan does not
 *  provide one it is left empty rather than guessed. */
function adoptComposed(scene, real) {
  const nodes = real.chain.map((n, i) => ({
    prim: n.id,
    params: n.params,
    hash: hash(n.id + JSON.stringify(n.params) + n.seed),
    cost: COST[n.id] || 4,
    // The engine's own words for why this primitive is in the chain.
    why: (real.reasons[i] || "").replace(/^[a-z_0-9]+ — /, ""),
    // The SECOND INPUT, carried through untouched. Dropping it here would
    // have the Preview render a compositor with nothing on its B side —
    // which draws the subject and looks exactly like it worked.
    b: n.b,
    // THE BRIDGE. A one shot's elements travel into the scene over the
    // measured silence at its head; the executor lerps these onto the live
    // params without rebuilding, so nothing resets mid-move.
    tween: n.tween,
    tweenMs: n.tweenMs,
  }));
  return {
    scene,
    state: resolveAt(scene.pos),
    abstraction: resolveAt(scene.pos).abstraction ?? 0,
    tier: real.tier,
    nodes,
    motifs: [],
    ruleHits: [],
    notes: [],
    pin: null,
    cost: real.costMsPerFrame,
    det: real.determinism,
    shots: real.shots || [],
    real: true,
  };
}

function composeLocally(scene) {
  const st = resolveAt(scene.pos),
    notes = [],
    ruleHits = [];
  /* A DIRECTOR'S BEND, HONOURED.
   *
   * `directVerb` on the Worker does this for a stored film. The example has
   * no Worker behind it, so without the same three lines a verb pressed on
   * the example changes nothing — and the causal loop the interface
   * promises would be a demonstration of itself. */
  const bend = (F.bends || {})[scene.id];
  if (bend) for (const k in bend) if (typeof st[k] === "number") st[k] = clamp(st[k] + bend[k], 0, 1);
  let abstraction = st.abstraction;
  // rule precedence: hard rules first
  if (scene.act === "act_1" && abstraction > 0.3) {
    abstraction = 0.3;
    ruleHits.push({ id: "r1", msg: "abstraction clamped to 0.30 in Act I" });
  }
  if (scene.fn === "evidence" && abstraction > 0.6) {
    abstraction = 0.6;
    ruleHits.push({ id: "r4", msg: "evidence scene held at 0.60" });
  }
  const pin = F.overrides.find((o) => o.sceneId === scene.id && o.type === "pin");

  /* THE DIRECTOR OUTRANKS THE LADDER. Taking a rung is not a pin: the
   * engine keeps composing the scene, it is simply told which vocabulary to
   * compose it from — so the choice survives a restyle of the film. */
  const forced = (F.overrides || []).find((o) => o.sceneId === scene.id && o.type === "rung");
  const rung =
    (forced && LADDER.find((l) => l.tier === forced.tier)) || LADDER.find((l) => abstraction < l.max);
  let chain = rung.base.slice();
  if (forced) notes.push("rung chosen by the director — " + forced.tier.toLowerCase());
  // motif continuity outranks anti-repetition
  const motifs = [];
  for (const e of scene.entities) {
    const m = F.motifs.find((x) => x.id === e);
    if (!m) continue;
    const si = clamp(Math.floor(abstraction * m.states.length), 0, m.states.length - 1);
    motifs.push({ id: m.id, concept: m.concept, state: m.states[si], si });
    for (const p of MOTIF_CHAIN[e]) if (!chain.includes(p)) chain.push(p);
  }
  // density adds compositing depth; restraint caps chain length
  if (st.visualDensity > 0.55 && !chain.includes("blend")) chain.push("blend");
  if (st.visualDensity > 0.75 && !chain.includes("nest")) chain.push("nest");
  if (st.typographicWeight > 0.55 && !chain.includes("variable_axis")) chain.push("variable_axis");
  // THE SAME VALIDITY SWEEP THE WORKER DOES.
  //
  // Motif and density primitives are appended AFTER the base chain, and
  // an append that does not typecheck rode through unchecked — so the
  // built-in example composed twelve of its sixteen scenes into
  // `document_surface → document_layout → camera_move → timeline_linear`,
  // where timeline_linear consumes DATA and camera_move emits ANIMATION.
  // The executor refused all twelve and drew the refusal on the frame.
  //
  // Nobody saw it, because nothing in this instrument showed more than one
  // frame at a time. The OVERVIEW view found it on its first run, which is
  // the entire argument for having one.
  //
  // Offending appends are dropped rather than the chain rejected: the base
  // is what the scene is about, and a motif that cannot legally attach
  // should lose.
  if (typeof validateChain === "function") {
    let guard = chain.length;
    while (guard-- > 0) {
      const errs = validateChain(chain.map((id) => ({ id })));
      if (!errs.length) break;
      const at = chain.findIndex((id, i) => i > 0 && !chainLinkOk(chain[i - 1], id));
      if (at < 0) break;
      notes.push("dropped " + chain[at] + " — " + errs[0]);
      chain.splice(at, 1);
    }
  }
  const ceiling = Math.round(4 + (1 - st.restraint) * 2 + st.experimentalism * 4);
  if (chain.length > ceiling) {
    notes.push("restraint ceiling " + ceiling + " — " + (chain.length - ceiling) + " dropped");
    chain = chain.slice(0, ceiling);
  }
  if (pin) {
    chain = ["document_surface", "document_layout", "annotation"];
    notes.push("pinned — composition bypassed");
  }

  const nodes = chain.map((p, i) => {
    const params = {
      seed: 1000 + scene.n * 17 + i,
      density: +st.visualDensity.toFixed(3),
      energy: +st.motionEnergy.toFixed(3),
      abstraction: +abstraction.toFixed(3),
      human: +st.humanPresence.toFixed(3),
    };
    if (pin) Object.assign(params, { density: 0.35, energy: 0.1, abstraction: 0.15 });
    // THE SCENE'S OWN WORDS, in the local composer too.
    //
    // The Worker sets these through `textParamsFor`; the built-in example
    // never did, so thirteen of its sixteen shots rendered
    // `variable_axis`'s default — one word, on a loop, over sixteen
    // different sentences. Exactly the defect reported against the real
    // pipeline, still living in the demo after the real one was fixed.
    //
    // Belt and braces, same as the compiler: the primitive must actually
    // DECLARE the parameter, so a renamed one shows up as type that stops
    // changing rather than a silently ignored write.
    const declared = (window.PRIMS && window.PRIMS[p] && window.PRIMS[p].params) || {};
    for (const key of ["text", "caption", "label", "heading", "from", "to"]) {
      if (declared[key] === undefined) continue;
      params[key] = (scene.label || scene.text || "").toUpperCase().slice(0, 26) || params[key];
    }
    return { prim: p, params, hash: hash(p + JSON.stringify(params)), cost: COST[p] || 4 };
  });
  const cost = nodes.reduce((a, n) => a + n.cost, 0);
  const det = nodes.some((n) => n.prim === "shader_surface") ? "L2-GPU" : "L2";
  return {
    scene,
    state: st,
    abstraction,
    tier: rung.tier,
    nodes,
    motifs,
    ruleHits,
    notes,
    pin,
    cost,
    det,
  };
}
const COST = {
  noise_field: 6,
  flow_field: 7,
  particle_flow: 14,
  particle_seek: 12,
  particle_trail: 9,
  glyph_to_points: 5,
  text_layout: 2,
  text_stagger: 2,
  document_surface: 3,
  document_layout: 3,
  annotation: 2,
  camera_move: 1,
  timeline_linear: 4,
  blend: 2,
  nest: 5,
  variable_axis: 1,
  shader_surface: 11,
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ── compile / cache ───────────────────────────────────── */
const CACHE = { snapshot: null, history: [] };
function composeAll() {
  return F.scenes.map(compose);
}
function dryRun() {
  const comps = composeAll(),
    prev = CACHE.snapshot;
  let hit = 0,
    miss = 0;
  const perScene = comps.map((c) => {
    const before = prev && prev[c.scene.id];
    let h = 0,
      m = 0,
      reasons = [];
    c.nodes.forEach((n) => {
      const was = before && before.find((x) => x.prim === n.prim);
      if (was && was.hash === n.hash) {
        n.cached = true;
        h++;
      } else {
        n.cached = false;
        m++;
        if (was) reasons.push(n.prim + " params changed");
        else reasons.push(n.prim + " new in chain");
      }
    });
    if (before)
      before.forEach((x) => {
        if (!c.nodes.find((n) => n.prim === x.prim)) reasons.push(x.prim + " removed");
      });
    hit += h;
    miss += m;
    return { ...c, hits: h, misses: m, reasons, status: !prev ? "new" : m ? "recompute" : "hit" };
  });
  return { comps: perScene, hit, miss, total: hit + miss, fresh: !prev };
}
function commit(run) {
  const snap = {};
  run.comps.forEach(
    (c) => (snap[c.scene.id] = c.nodes.map((n) => ({ prim: n.prim, hash: n.hash }))),
  );
  CACHE.snapshot = snap;
  CACHE.history.unshift({
    at: new Date(),
    miss: run.miss,
    total: run.total,
    ms: (400 + run.miss * 310 + (run.fresh ? 1800 : 0)) / 1000,
  });
  CACHE.history = CACHE.history.slice(0, 6);
}
Object.assign(window, {
  resolveAt,
  compose,
  composeLocally,
  composeAll,
  dryRun,
  commit,
  CACHE,
  hash,
  clamp,
  LADDER,
});
