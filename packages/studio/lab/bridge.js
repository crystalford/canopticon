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
/** The human act. Nothing else in the system can mark a reading approved,
 *  and rejecting one strips it so the scene falls back to the film's own
 *  curve rather than keeping an interpretation nobody stands behind. */
const ratifyScenes = (id, approve, reject) =>
  api(`/project/${id}/ratify`, {
    method: "POST",
    body: JSON.stringify({ approve: approve || [], reject: reject || [] }),
  });

/** NARRATE — the one operator action that spends TTS.
 *
 *  Bounded per call, like reading is, and for the same reason: an 88-scene
 *  film is 176 model calls and a request has a wall clock. It always takes
 *  the next un-narrated scenes, so calling it repeatedly finishes the film
 *  and `remaining` says how far there is left to go. */
const narrateProject = (id, opts) =>
  api(`/project/${id}/narrate`, {
    method: "POST",
    body: JSON.stringify(opts || {}),
  });

/** ASK PRODUCTION WHAT THE VOICE ACTUALLY IS.
 *
 *  Stores nothing, changes nothing, and reports every TTS and ASR
 *  candidate: what each returned, how many bytes, and the structural shape
 *  of anything unusable. The one question that cannot be answered from a
 *  local Worker, asked from the instrument rather than from a workflow
 *  file. */
const probeVoice = () => api("/tts/probe", { method: "POST", body: JSON.stringify({}) });

/** Build the view model from the IR and the compiled plan.
 *
 *  Every field here is carried across, not invented. Where the prototype's
 *  shape wanted something the IR expresses differently — act spans as
 *  fractions rather than scene ranges, control points as a flat position
 *  rather than an act binding — it is DERIVED, and the derivation is the
 *  only arithmetic in this file. */
function toFilm(ir, plan, storedVersion) {
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
      status: irScene.status || "draft",
      tier: s.tier,
      chain: s.chain.map((n) => n.id),
      reasons: s.reasons || [],
      // The frozen narration, when this scene has been recorded. Undefined
      // rather than null when it has not — a scene that plays silence and
      // a scene with no narration should not look the same to a view that
      // is trying to tell the operator which is which.
      vo: s.vo,
      // WHAT THIS SHOT IS, and what else it could have been. The first
      // thing a director reads about a scene should be the idea rather
      // than the five nodes that implement it.
      idea: s.idea || null,
      alternatives: s.alternatives || [],
      pinned: (ir.overrides || []).some((o) => o.sceneId === s.sceneId && o.type === "pin"),
      // What this scene has been DIRECTED to do, in the words the verb
      // used, so the panel can say it rather than showing a delta.
      directed:
        (ir.overrides || []).find((o) => o.sceneId === s.sceneId && o.type === "constrain")?.note ||
        null,
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
    // `raw` is the ORIGINAL descriptor. An act-bound point is the preferred
    // authoring form because it survives re-timing, so an edit must send
    // back the binding it was given rather than the position that binding
    // happened to resolve to — otherwise the first drag silently converts
    // the whole curve to fixed positions.
    return { at, v: { ...cp.values }, raw: cp.at };
  });
  controlPoints.sort((a, b) => a.at - b.at);
  // The resolver interpolates between neighbours and needs both ends. These
  // are SYNTHETIC — they carry no authored binding and are never saved.
  if (controlPoints.length && controlPoints[0].at > 0) {
    controlPoints.unshift({ at: 0, v: { ...controlPoints[0].v }, synthetic: true });
  }
  if (controlPoints.length && controlPoints[controlPoints.length - 1].at < 1) {
    controlPoints.push({
      at: 1,
      v: { ...controlPoints[controlPoints.length - 1].v },
      synthetic: true,
    });
  }

  return {
    projectId: ir.projectId,
    title: ir.title,
    // The STORED version, not the schema version. The bar read "IR v0.1.0"
    // forever — that is the IR format's number, and it never changes, so
    // the one place a director could see that their edit had produced a new
    // version of the film showed a constant.
    irVersion: storedVersion != null ? String(storedVersion) : ir.irVersion,
    schemaVersion: ir.irVersion,
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

  window.FILM = toFilm(detail.ir, plan, detail.irVersion);
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

/** Save the creative state and recompile. The whole cheap loop, in one
 *  call: no TTS, no model, and a cache diff that says what the edit
 *  actually cost. Returns the diff so the UI can report it rather than
 *  claiming success. */
async function saveCreativeState() {
  const id = window.STUDIO.projectId;
  if (!id) return null;
  const f = window.FILM;
  const controlPoints = f.controlPoints
    .filter((cp) => !cp.synthetic)
    .map((cp) => ({
      // A point the director dragged sideways loses its act binding — it is
      // now at a position, and saying so is more honest than pretending it
      // is still pinned to a landmark it no longer sits on.
      at: cp.movedAt ? { position: Math.min(1, Math.max(0, cp.at)) } : cp.raw,
      values: { ...cp.v },
    }));
  const r = await api(`/project/${id}/creative-state`, {
    method: "POST",
    body: JSON.stringify({
      identity: { ...f.identity },
      controlPoints,
      invariants: f.invariants,
    }),
  });
  window.STUDIO.cache = r.cache;
  return r;
}

/** DIRECT — choose one of the interpretations the engine proposed.
 *
 *  Writes a pin, which precedence 1 already honours. The engine stops
 *  composing that scene and reports it as pinned; `releaseScene` hands it
 *  back. A director's choice was always meant to outrank the engine — the
 *  precedence order was built for it and had no way to be reached. */
const directScene = (projectId, sceneId, chain, note) =>
  api(`/project/${projectId}/direct`, {
    method: "POST",
    body: JSON.stringify({ sceneId, chain, note }),
  });

/** A DIRECTOR'S VERB. Bends this scene's state and lets the engine keep
 *  composing — so the instruction survives a restyle, which a pin does
 *  not. Pressing the same verb twice compounds it. */
const directVerb = (projectId, sceneId, verb) =>
  api(`/project/${projectId}/direct`, {
    method: "POST",
    body: JSON.stringify({ sceneId, verb }),
  });

const releaseScene = (projectId, sceneId) =>
  api(`/project/${projectId}/direct`, {
    method: "POST",
    body: JSON.stringify({ sceneId, release: true }),
  });

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
  ratifyScenes,
  narrateProject,
  probeVoice,
  directScene,
  directVerb,
  releaseScene,
  saveCreativeState,
  compileProject,
  lastProjectId: () => {
    try {
      return localStorage.getItem("canopticon.project");
    } catch {
      return null;
    }
  },
});
