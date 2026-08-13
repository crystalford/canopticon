/* CANOPTICON — the bridge. One design, one compiler.
 *
 * The Lab had a SECOND compiler in it. `engine.js` reimplemented the
 * abstraction ladder, the creative-state resolver, the precedence order and
 * the cost table in the browser, against an essay compiled into `state.js`.
 * The Worker had the real one. Two engines and two designs, which is
 * exactly what the thing looked like: patchwork.
 *
 * This is the seam that removes one of each. The five views stay — they are
 * the design, and they were right — but what they render now comes from the
 * Worker: real acts, real scenes bound to real prose by character offset,
 * real chains chosen by the real composition engine, real cache numbers.
 *
 *   GET /v1/project/:id        the IR      — what the film IS
 *   GET /v1/project/:id/film   the plan    — what it compiles to
 *
 * The adapter below maps those onto the shape the views already read. That
 * is deliberate and it is the whole trick: no view was redesigned to show
 * real data, because the design was never the problem.
 *
 * THE DEMO SURVIVES AS A DEMO. With no project selected the built-in
 * example still loads, so the instrument is never an empty room and the
 * palette can be explored with nothing stored. It is labelled as an
 * example wherever it shows.
 */

const API = "/v1";

/** Everything the views and the engine need, in one place, so there is
 *  never a moment where half the app is looking at a different film. */
window.STUDIO = {
  projectId: null,
  /** The real compile plan — scene windows, chains, shots. */
  plan: null,
  /** Real per-scene composition, keyed by sceneId. `engine.js` reads this
   *  instead of recomputing what the Worker already decided. */
  composed: new Map(),
  /** The real cache report from the last compile. */
  cache: null,
  /** True while the built-in example is on screen. */
  demo: true,
};

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

const listProjects = () => api("/projects").then((b) => b.projects);
const ingestEssay = (essay) =>
  api("/project/ingest", { method: "POST", body: JSON.stringify({ essay }) });
const readProject = (id, limit) =>
  api(`/project/${id}/read`, { method: "POST", body: JSON.stringify({ limit: limit || 12 }) });
const deleteProject = (id) => api(`/project/${id}`, { method: "DELETE" });

/** Build the view model from the IR and the compiled plan.
 *
 *  Every field here is carried across, not invented. Where the prototype's
 *  shape wanted something the IR expresses differently — act spans as
 *  fractions rather than scene ranges, control points as a flat position
 *  rather than an act binding — it is DERIVED, and the derivation is the
 *  only arithmetic in this file. */
function toFilm(ir, plan) {
  const total = Math.max(1, plan.durationMs);

  const scenes = plan.scenes.map((s, i) => {
    const irScene = ir.scenes.find((x) => x.sceneId === s.sceneId) || {};
    return {
      id: s.sceneId,
      act: s.actId,
      fn: irScene.narrativeFunction || "evidence",
      label: s.label || s.sceneId,
      text: s.text,
      dur: (s.endMs - s.startMs) / 1000,
      entities: irScene.entities || [],
      n: i + 1,
      // The scene's real span of the essay. The Narrative view underlines
      // the prose with these, so a wrong offset is visible immediately —
      // which is the point of binding to the essay rather than copying it.
      src: irScene.sourceRange || { startChar: 0, endChar: 0 },
      t0: s.startMs / 1000,
      t1: s.endMs / 1000,
      pos: (s.startMs + s.endMs) / 2 / total,
      // Carried through for the views that can now show more than the
      // prototype could: the cut, the figures, and why this chain.
      shots: s.shots || [],
      figures: irScene.figures || [],
      route: irScene.route || [],
      reading: irScene.reading || null,
      tier: s.tier,
      chain: s.chain.map((n) => n.id),
      reasons: s.reasons || [],
    };
  });

  // Act spans as fractions of runtime, from where their scenes actually
  // fall. The prototype hardcoded these.
  const acts = ir.acts.map((a) => {
    const own = scenes.filter((s) => s.act === a.actId);
    const t0 = own.length ? Math.min(...own.map((s) => s.t0)) : 0;
    const t1 = own.length ? Math.max(...own.map((s) => s.t1)) : 0;
    return { actId: a.actId, title: a.title, span: [t0 / (total / 1000), t1 / (total / 1000)] };
  });

  // Control points, resolved to positions. An act-bound point is the
  // authoring model precisely because it survives re-timing; the curve view
  // needs a number, so it is resolved here rather than authored as one.
  const actPos = new Map(acts.map((a) => [a.actId, a.span]));
  const controlPoints = (ir.creativeState.controlPoints || []).map((cp) => {
    let at = 0;
    if (cp.at.actId) {
      const span = actPos.get(cp.at.actId) || [0, 1];
      at = cp.at.position === "end" ? span[1] : span[0];
    } else if (cp.at.sceneId) {
      at = scenes.find((s) => s.id === cp.at.sceneId)?.pos ?? 0;
    } else {
      at = cp.at.position ?? 0;
    }
    return { at, v: { ...cp.values } };
  });
  controlPoints.sort((a, b) => a.at - b.at);
  // The resolver interpolates between neighbours and needs both ends.
  if (controlPoints.length && controlPoints[0].at > 0) {
    controlPoints.unshift({ at: 0, v: { ...controlPoints[0].v } });
  }
  if (controlPoints.length && controlPoints[controlPoints.length - 1].at < 1) {
    controlPoints.push({ at: 1, v: { ...controlPoints[controlPoints.length - 1].v } });
  }

  return {
    projectId: ir.projectId,
    title: ir.title,
    irVersion: ir.irVersion,
    logline: ir.logline || "",
    essay: ir.essay,
    acts,
    scenes,
    runtime: total / 1000,
    // The creative vocabulary — shared with the example rather than
    // redefined, so the Editorial view's lanes exist for a real film too.
    params: window.PARAMS,
    identity: ir.creativeState.identity || {},
    controlPoints,
    invariants: ir.creativeState.invariants || [],
    motifs: (ir.motifs || []).map((m) => ({
      id: m.motifId,
      concept: m.concept,
      chain: m.chain.join(" + "),
      established: m.establishedAt || "",
      states: m.states,
      rule: m.developmentRule,
    })),
    rules: (ir.rules || []).map((r) => ({
      id: r.ruleId,
      severity: r.severity,
      text: r.statement,
      scope: r.scope,
      kind: r.kind,
    })),
    overrides: (ir.overrides || []).map((o) => ({
      sceneId: o.sceneId,
      type: o.type,
      note: o.note || "",
    })),
  };
}

/** Load a project and make it THE film. Compiles on the way — the plan
 *  route runs the real pipeline — so what lands is never a stale render of
 *  an edited IR. */
async function loadProject(projectId) {
  const [detail, plan] = await Promise.all([
    api(`/project/${projectId}`),
    api(`/project/${projectId}/film`),
  ]);
  if (!detail.ir) throw new Error("this project has no stored IR yet");

  window.FILM = toFilm(detail.ir, plan);
  window.STUDIO.projectId = projectId;
  window.STUDIO.plan = plan;
  window.STUDIO.demo = false;
  window.STUDIO.composed = new Map(plan.scenes.map((s) => [s.sceneId, s]));
  window.STUDIO.cache = null;
  try {
    localStorage.setItem("canopticon.project", projectId);
  } catch {
    // Private browsing. The picker still works, it just will not remember.
  }
  return window.FILM;
}

/** Back to the built-in example. Not a failure state — the instrument
 *  should open on something rather than on an empty room. */
function loadDemo() {
  window.FILM = window.DEMO_FILM;
  window.STUDIO.projectId = null;
  window.STUDIO.plan = null;
  window.STUDIO.demo = true;
  window.STUDIO.composed = new Map();
  window.STUDIO.cache = null;
  try {
    localStorage.removeItem("canopticon.project");
  } catch {
    /* ignore */
  }
  return window.FILM;
}

async function compileProject(projectId) {
  const report = await api(`/project/${projectId}/compile`, { method: "POST" });
  window.STUDIO.cache = report.cache;
  return report;
}

Object.assign(window, {
  listProjects,
  ingestEssay,
  readProject,
  deleteProject,
  loadProject,
  loadDemo,
  compileProject,
  lastProjectId: () => {
    try {
      return localStorage.getItem("canopticon.project");
    } catch {
      return null;
    }
  },
});
