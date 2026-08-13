/* CANOPTICON — Preview, Compile, Lab. */
// Follows the CURRENT film. A plain capture of window.FILM meant that
// loading a project updated the title bar and left every view rendering
// the built-in example underneath it.
const F3 = new Proxy({}, { get: (_t, k) => (window.FILM ? window.FILM[k] : undefined) });

/* ══ PREVIEW ════════════════════════════════════════════ */
const PLAY = { t: 0, on: false, last: 0 };
function viewPreview(root) {
  root.innerHTML = `<div class="shell" style="grid-template-columns:minmax(0,1fr) 320px">
   <div class="col mcol">
     <div class="vhead"><h2>Preview</h2><span class="k" id="pvstate"></span></div>
     <div class="stage"><canvas id="film"></canvas><div class="vo" id="vo"></div>
       <div class="hud" id="hud"></div></div>
     <div class="transport">
       <button class="btn" id="pp">${PLAY.on ? "PAUSE" : "PLAY"}</button>
       <div class="tl" id="tl"><div class="tlfill"></div><div class="tlhead"></div></div>
       <span class="mono tc" id="tc">0:00</span>
       <button class="btn primary" id="pvrender">RENDER…</button>
     </div>
   </div>
   <div class="col rcol"><div class="pad" id="pvright"></div></div></div>`;

  const cv = document.getElementById("film");
  const ctx = cv.getContext("2d");
  const run = dryRun();

  function sceneAt(t) {
    return (
      run.comps.find((c) => t >= c.scene.t0 && t < c.scene.t1) || run.comps[run.comps.length - 1]
    );
  }

  /* THE REAL CHAIN, NOT A STAND-IN.
   *
   * This view used to pick ONE primitive by tier — document_surface for
   * GROUNDED, particle_seek for DECOMPOSED — and draw that. So the
   * compiler planned a five-primitive chain and the Preview showed a
   * hand-written approximation of it, which meant the one surface whose
   * whole job is to answer "does this look right" was answering about
   * something else.
   *
   * Now it instantiates the chain the compiler actually planned, with its
   * parameters and its seeds, cut into the shots the solver decided. The
   * executor refuses a chain that does not typecheck and the refusal is
   * drawn on the frame rather than swallowed. */
  const built = new Map();
  function runnerFor(c) {
    const key = c.scene.id + "@" + cv.width + "x" + cv.height;
    if (built.has(key)) return built.get(key);
    const chain = c.nodes.map((n) => ({
      id: n.prim,
      params: n.params,
      seed: n.params.seed,
      // A compositor's ground travels with it. Without this the Preview
      // builds the node with no second input, draws the subject alone, and
      // gives no sign that a layer is missing.
      ...(n.b ? { b: n.b } : {}),
    }));
    const shots = (c.shots || []).map((sh) => ({
      startMs: sh.startMs - c.scene.t0 * 1000,
      endMs: sh.endMs - c.scene.t0 * 1000,
      params: sh.params || {},
    }));
    const dur = Math.max(0.1, c.scene.t1 - c.scene.t0);
    const b =
      shots.length > 1
        ? buildSequence(chain, shots, cv.width, cv.height)
        : buildChain(chain, cv.width, cv.height, dur);
    const wrapped = { b, single: shots.length <= 1 };
    built.set(key, wrapped);
    return wrapped;
  }

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    cv.width = Math.max(160, Math.round(r.width));
    cv.height = Math.max(90, Math.round(r.height));
    built.clear();
  }
  resize();
  addEventListener("resize", resize);

  let cur = "";
  loop(() => {
    const now = performance.now();
    const dt = PLAY.last ? (now - PLAY.last) / 1000 : 0;
    PLAY.last = now;
    if (PLAY.on) PLAY.t = (PLAY.t + dt) % F3.runtime;

    const c = sceneAt(PLAY.t);
    if (c.scene.id !== cur) {
      cur = c.scene.id;
      document.getElementById("vo").innerHTML = `<span>${esc(c.scene.text)}</span>`;
      document.getElementById("hud").innerHTML =
        `<div><b>SC ${String(c.scene.n).padStart(2, "0")}</b> ${c.scene.fn.toUpperCase()} · ${c.tier}${c.pin ? " · PINNED" : ""}${(c.shots || []).length > 1 ? " · " + c.shots.length + " SHOTS" : ""}</div>
        <div>${c.nodes
          .map((n) =>
            n.b && n.b.length
              ? `${n.prim} ⊕ (${n.b.map((g) => g.id).join(" → ")})`
              : n.prim,
          )
          .join(" → ")}</div>
        <div>abstraction ${c.abstraction.toFixed(2)} · density ${(c.state.visualDensity ?? 0).toFixed(2)} · energy ${(c.state.motionEnergy ?? 0).toFixed(2)} · human ${(c.state.humanPresence ?? 0).toFixed(2)}</div>`;
      document.getElementById("pvstate").textContent =
        c.det + " DETERMINISM · " + c.nodes.length + " PRIMITIVES · SEED " + (c.nodes[0]?.params.seed ?? 0);
      drawPvRight(c);
    }

    const { b, single } = runnerFor(c);
    const localMs = (PLAY.t - c.scene.t0) * 1000;
    if (b.errors && b.errors.length) {
      // Degrade, flag, continue — on the frame, where it cannot be missed.
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#d8624a";
      ctx.font = '500 12px "JetBrains Mono",monospace';
      b.errors.slice(0, 5).forEach((e, i) => ctx.fillText(e, 20, 40 + i * 18));
    } else {
      const buf = single ? b.run(localMs / 1000) : b.run(localMs);
      // Cleared for the same reason the render clears: a buffer with
      // transparency in it would otherwise show the previous frame through
      // its own holes.
      ctx.fillStyle = "#0d0f11";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(buf, 0, 0);
    }

    const p = (PLAY.t / F3.runtime) * 100;
    const f = document.querySelector(".tlfill");
    const hd = document.querySelector(".tlhead");
    if (f) {
      f.style.width = p + "%";
      hd.style.left = p + "%";
      document.getElementById("tc").textContent = fmt(PLAY.t);
    }
  });

  /* THE VOICE.
   *
   * Play starts the frozen narration from the playhead; pause and seek
   * stop it. It is scheduled on the Web Audio clock rather than started
   * with setTimeout, because the whole reason timing is anchor-based is
   * that the picture is cut to the speech — so the picture's clock and the
   * speech's clock have to be the same clock.
   *
   * Nothing is generated here. The audio is fetched from storage by the
   * hash the compiler froze; a film with no narration simply plays silent
   * and the transport says so. */
  document.getElementById("pp").onclick = async (e) => {
    PLAY.on = !PLAY.on;
    e.target.textContent = PLAY.on ? "PAUSE" : "PLAY";
    const plan = window.STUDIO.plan;
    if (!plan || narrationStatus(plan).narrated === 0) return;
    if (!PLAY.on) {
      stopNarration();
      return;
    }
    await loadNarration(plan);
    await playNarration(plan, PLAY.t * 1000);
  };
  document.getElementById("pvrender").onclick = openRender;

  const tl = document.getElementById("tl");
  tl.innerHTML += run.comps
    .map(
      (c) =>
        `<i class="mk ${c.pin ? "pin" : c.misses ? "miss" : ""}" style="left:${(c.scene.t0 / F3.runtime) * 100}%"></i>`,
    )
    .join("");
  tl.onpointerdown = async (e) => {
    const r = tl.getBoundingClientRect();
    PLAY.t = clamp((e.clientX - r.left) / r.width, 0, 0.999) * F3.runtime;
    // A seek re-cues the voice rather than leaving the old line running
    // over the new picture.
    stopNarration();
    if (PLAY.on && window.STUDIO.plan) await playNarration(window.STUDIO.plan, PLAY.t * 1000);
  };
  drawPvRight(sceneAt(PLAY.t));
}

/* ── RENDER ───────────────────────────────────────────────────────────
 *
 * A film is something you set up and then render. Adjusting a knob and
 * watching it redraw live is how a toy behaves, and it also forces every
 * frame to fit in 16ms, which is what was keeping the chains thin.
 *
 * The panel below is the whole difference: choose a size and a frame rate,
 * press RENDER, watch a progress bar, get a file. The render itself is
 * driven BY FRAME INDEX (see render.js), so frame 900 at 30fps is exactly
 * t = 30.0s whatever the machine was doing — which is what makes the L2
 * determinism claim true at the one moment it matters.
 */
function openRender() {
  if (document.getElementById("rend")) return;
  const el = document.createElement("div");
  el.id = "rend";
  const secs = Math.round(F3.runtime);
  const vo = narrationStatus(window.STUDIO.plan || {});
  el.innerHTML = `<div class="rend-box">
    <div class="rend-head">RENDER · ${esc(F3.title)}</div>
    <div class="rend-meta mono">${F3.scenes.length} scenes · ${fmt(F3.runtime)} · plan compiled, nothing regenerated</div>
    <div class="rend-meta mono">${
      vo.narrated === 0
        ? "SILENT — no narration recorded. Record it in FILMS; the export carries the voice once it exists."
        : `VOICE · ${vo.narrated} of ${vo.total} scenes narrated${
            vo.silent ? `, ${vo.silent} silent` : ""
          } · ${vo.measured} timed off the audio`
    }</div>
    <div class="rend-opts">
      <label>SIZE
        <select id="r-size">
          <option value="1280x720">1280 × 720</option>
          <option value="1920x1080">1920 × 1080</option>
          <option value="1080x1080">1080 × 1080 · square</option>
          <option value="1080x1920">1080 × 1920 · vertical</option>
          <option value="854x480">854 × 480 · draft</option>
        </select></label>
      <label>FRAME RATE
        <select id="r-fps">
          <option value="30">30 fps</option>
          <option value="24">24 fps · film</option>
          <option value="60">60 fps</option>
        </select></label>
      <label class="rend-check"><input type="checkbox" id="r-cap" checked> BURN THE SENTENCE INTO THE FRAME</label>
    </div>
    <div class="rend-bar"><i id="r-fill"></i></div>
    <div class="rend-status mono" id="r-status">${secs} seconds of film · every frame drawn at its exact index, none dropped · takes about as long as the film runs</div>
    <div class="rend-actions">
      <button class="btn primary" id="r-go">RENDER</button>
      <button class="btn" id="r-cancel">CLOSE</button>
    </div>
  </div>`;
  document.body.appendChild(el);

  const close = () => {
    RENDER.cancel = true;
    el.remove();
  };
  document.getElementById("r-cancel").onclick = close;
  el.onclick = (e) => {
    if (e.target === el && !RENDER.running) close();
  };

  document.getElementById("r-go").onclick = async () => {
    if (RENDER.running) {
      RENDER.cancel = true;
      return;
    }
    const [w, h] = document.getElementById("r-size").value.split("x").map(Number);
    const fps = Number(document.getElementById("r-fps").value);
    const captions = document.getElementById("r-cap").checked;
    const go = document.getElementById("r-go");
    const fill = document.getElementById("r-fill");
    const status = document.getElementById("r-status");
    go.textContent = "STOP";

    const plan = window.STUDIO.plan || planFromFilm();
    const started = performance.now();
    try {
      const out = await renderFilm(plan, {
        width: w,
        height: h,
        fps,
        captions,
        onProgress: (p) => {
          fill.style.width = `${Math.round((p.pct || 0) * 100)}%`;
          const elapsed = (performance.now() - started) / 1000;
          // Time REMAINING, from measured rate. A percentage alone does not
          // tell you whether to wait or go and do something else.
          const left = p.pct > 0.02 ? (elapsed / p.pct) * (1 - p.pct) : null;
          status.textContent =
            `${p.stage} · frame ${p.frame} of ${p.frames}` +
            (left ? ` · about ${Math.ceil(left)}s left` : "");
        },
      });
      const mb = (out.blob.size / 1e6).toFixed(1);
      status.textContent = `${mb}MB · ${out.frames} frames · ${
        out.frameExact ? "frame-exact" : "recorded in real time, NOT frame-exact"
      } · ${Math.round((performance.now() - started) / 1000)}s`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out.blob);
      a.download = `${(F3.title || "film").replace(/[^\w-]+/g, "-").slice(0, 60)}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    } catch (err) {
      status.textContent = err.message;
    } finally {
      go.textContent = "RENDER";
    }
  };
}

/** The built-in example has no compiled plan behind it, so one is derived
 *  from what the local engine composed. Stated rather than hidden: the
 *  example renders too, it just does not come from the Worker. */
function planFromFilm() {
  const run = dryRun();
  return {
    title: F3.title,
    durationMs: F3.runtime * 1000,
    scenes: run.comps.map((c) => ({
      sceneId: c.scene.id,
      text: c.scene.text,
      startMs: c.scene.t0 * 1000,
      endMs: c.scene.t1 * 1000,
      chain: c.nodes.map((n) => ({
        id: n.prim,
        params: n.params,
        seed: n.params.seed,
        ...(n.b ? { b: n.b } : {}),
      })),
      shots: c.shots || [],
    })),
  };
}

/** The visual idea as a sentence rather than an identifier.
 *
 *  "fixture · quantise + scanline" is what the compiler calls it. A
 *  director should read "A fixture, built from the sentence — quantised,
 *  then scanned." Same information, and only one of the two is something a
 *  person can disagree with. */
const CONSTRUCTION_WORDS = {
  body: "A body, constructed from what the sentence names",
  fixture: "A fixture, built from the noun itself",
  paper: "A document, photographed",
  quantity: "The figures, charted",
  route: "The route, drawn as travel",
  network: "The named parties, laid out by attraction",
  space: "A space rather than a word",
  type: "The sentence, set",
};
/** Operators as past participles. "then quantise, then scanline" is a list
 *  of identifiers with a conjunction between them; "then quantised, then
 *  scanned" is a sentence. This panel is the one surface written for a
 *  person rather than for the compiler, so it should read like one. */
const OPERATOR_WORDS = {
  quantise: "quantised",
  pixelate: "resolved down",
  dither: "dithered",
  scanline: "scanned",
  halftone: "halftoned",
  threshold: "reduced to light and dark",
  sort: "sorted along its own rows",
  split: "pulled apart into channels",
  fragment: "taken apart into its own points",
  trace: "transcribed as characters",
  grade: "graded",
  soften: "softened",
};
function ideaSentence(idea) {
  const head = CONSTRUCTION_WORDS[idea.construction] || idea.construction;
  if (!idea.operators.length) return `${head}.`;
  const words = idea.operators.map((o) => OPERATOR_WORDS[o] || o);
  return `${head} — then ${words.join(", then ")}.`;
}

function drawPvRight(c) {
  const el = document.getElementById("pvright");
  if (!el) return;
  const s = c.scene;
  const reading = s.reading;
  const status = s.status || (reading ? "ready_for_review" : "draft");

  // RATIFICATION, FOR REAL. These used to be four decorative chips with
  // "approved" always lit. Only a scene carrying a proposed reading has
  // anything to ratify, and only this action can approve one.
  const ratifyBlock = window.STUDIO.demo
    ? `<div class="mono pv-note">Built-in example — nothing to ratify.</div>`
    : reading
      ? `<div class="statusrow">
           <button class="chip ${status === "approved" ? "ok" : ""}" data-ratify="approve">APPROVE</button>
           <button class="chip" data-ratify="reject">REJECT</button>
           <span class="mono pv-note">${status === "approved" ? "ratified" : "proposed, awaiting you"}</span>
         </div>
         <div class="mono pv-reading">${esc(reading.subjects.map((x) => x.label + " · " + x.kind).join("  |  "))}<br>
           ${esc(reading.visualOpportunity)}${reading.contested ? " · <b>reports a claim, not a fact</b>" : ""}</div>`
      : `<div class="mono pv-note">No reading. The film's own abstraction curve is carrying this
         scene${(s.figures || []).length ? ", and its figures reached the data family from the prose alone" : ""}.</div>`;

  const figures = (s.figures || []).length
    ? `<div class="sec secline"><span class="k">Figures — verbatim</span>
        <div class="meta">${s.figures.map((f) => `<div class="mrow"><span>${esc(f.text)}</span><i>${f.kind}</i></div>`).join("")}</div>
        ${(s.route || []).length ? `<div class="mono pv-note">route · ${esc(s.route.join(" → "))}</div>` : ""}</div>`
    : "";

  // Why this chain, in the engine's own words. Replaces two invented
  // review notes that were hardcoded into the page.
  const why = (s.reasons || []).length
    ? `<div class="sec secline"><span class="k">Why this chain</span>
        <div class="meta pv-why">${s.reasons.map((r) => `<div>${esc(r)}</div>`).join("")}</div></div>`
    : "";

  /* THE VISUAL IDEA — first, and in the director's language.
   *
   * "The system shows you what it thinks the visual idea is. You're not
   * expected to understand a primitive chain."
   *
   * So the chain moves BELOW the idea and behind a disclosure. What a
   * person reads first is what the shot is: a thing that was built, and
   * what was done to it. The implementation is still one click away —
   * this system's whole discipline is that its working can be audited —
   * but it is no longer the headline.
   *
   * The alternatives are the other half. The engine constructed several
   * programs for this sentence and used the best-scoring one; these are
   * the rest, and choosing one pins it. Same rail a reading goes through:
   * the system proposes, the human ratifies. */
  const idea = s.idea
    ? `<div class="sec"><span class="k">Visual idea</span>
        <div class="idea">
          <div class="idea-what">${esc(ideaSentence(s.idea))}</div>
          <div class="mono idea-why">${esc(s.idea.why)}</div>
        </div>
        ${
          (s.alternatives || []).length
            ? `<div class="k alt-k">Or this sentence could be</div>
               <div class="alts">${s.alternatives
                 .map(
                   (a, i) => `<button class="alt" data-alt="${i}">
                     <b>${esc(a.construction)}</b>
                     <span class="mono">${esc(a.operators.join(" + ") || "no operations")}</span>
                     <i class="mono">${esc(a.chain.join(" → "))}</i>
                   </button>`,
                 )
                 .join("")}</div>
               <div class="mono pv-note" id="alt-msg">Choosing one pins the scene. The engine
                 stops composing it and reports it as pinned; releasing hands it back.</div>`
            : ""
        }
        ${s.pinned ? `<button class="chip" data-release="1">RELEASE TO THE ENGINE</button>` : ""}
       </div>`
    : `<div class="sec"><span class="k">Visual idea</span>
        <div class="mono pv-note">${
          s.pinned
            ? "Pinned by you — composition bypassed."
            : "Planned from a ratified reading rather than constructed."
        }</div>
        ${s.pinned ? `<button class="chip" data-release="1">RELEASE TO THE ENGINE</button>` : ""}</div>`;

  el.innerHTML = `<div class="sec"><span class="k">Scene ${String(s.n).padStart(2, "0")} · ${esc(s.label)}</span>
   ${ratifyBlock}</div>
   ${idea}
   ${figures}
   ${why}
   <div class="sec secline"><span class="k">Resolved state at playhead</span>
    <div class="meta">${["abstraction", "archivalWeight", "dataWeight", "visualDensity", "humanPresence", "motionEnergy"].map((k) => `<div class="mrow"><span>${k}</span><i>${(c.state[k] ?? 0).toFixed(2)}</i></div>`).join("")}</div>
    ${(c.state._held || []).length ? `<div class="ruleHit soft">INVARIANT · ${c.state._held.join(" · ")}</div>` : ""}
   </div>`;

  for (const b of el.querySelectorAll("[data-alt]")) {
    b.onclick = async () => {
      const alt = (s.alternatives || [])[Number(b.dataset.alt)];
      if (!alt || !window.STUDIO.projectId) return;
      const msg = document.getElementById("alt-msg");
      if (msg) msg.textContent = "directing…";
      try {
        await directScene(window.STUDIO.projectId, s.id, alt.chain, alt.id);
        await loadProject(window.STUDIO.projectId);
        window.__lastRun = dryRun();
        commit(window.__lastRun);
        render();
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    };
  }
  const release = el.querySelector("[data-release]");
  if (release) {
    release.onclick = async () => {
      if (!window.STUDIO.projectId) return;
      await releaseScene(window.STUDIO.projectId, s.id);
      await loadProject(window.STUDIO.projectId);
      window.__lastRun = dryRun();
      commit(window.__lastRun);
      render();
    };
  }

  for (const b of el.querySelectorAll("[data-ratify]")) {
    b.onclick = async () => {
      const id = window.STUDIO.projectId;
      if (!id) return;
      b.textContent = "…";
      try {
        const approve = b.dataset.ratify === "approve" ? [s.id] : [];
        const reject = b.dataset.ratify === "reject" ? [s.id] : [];
        await ratifyScenes(id, approve, reject);
        await loadProject(id);
        window.__lastRun = dryRun();
        render();
      } catch (err) {
        b.textContent = err.message.slice(0, 24);
      }
    };
  }
}

/* ══ COMPILE ════════════════════════════════════════════ */
function viewCompile(root) {
  const run = dryRun();
  // PEAK, not sum. Summing per-frame costs across every scene produces a
  // number in the thousands and calls it a frame budget — but scenes do not
  // render simultaneously, so the only figure that decides whether a film
  // plays in real time is its most expensive single scene.
  const peakCost = run.comps.reduce((a, c) => Math.max(a, c.cost), 0);
  const overRealtime = run.comps.filter((c) => c.cost > 16).length;
  root.innerHTML = `<div class="shell" style="grid-template-columns:minmax(0,1fr) 300px">
   <div class="col mcol">
    <div class="vhead"><h2>Compile</h2><span class="k">Deliberately boring. Every recomputation has a stated reason.</span></div>
    <div class="col" style="flex:1;padding:0 22px 40px">
     <table class="audit"><thead><tr><th>SCENE</th><th>FN</th><th>RUNG</th><th>PRIMITIVES</th><th>CACHE</th><th>REASON</th><th>COST</th><th>DET</th></tr></thead>
     <tbody>${run.comps
       .map(
         (c) => `<tr class="${c.misses ? "miss" : ""}">
       <td><b>${String(c.scene.n).padStart(2, "0")}</b> ${c.scene.label}</td>
       <td class="mut">${c.scene.fn.toUpperCase()}</td>
       <td>${c.pin ? '<span class="chip cool">PINNED</span>' : c.tier}</td>
       <td class="mono sm">${c.nodes.map((n) => `<span class="${n.cached ? "" : "d"}">${n.prim}</span>`).join(" · ")}</td>
       <td class="mono">${c.hits}/${c.nodes.length}</td>
       <td class="mut sm">${c.reasons.length ? c.reasons.join("; ") : c.ruleHits[0] ? "rule " + c.ruleHits[0].id + " — " + c.ruleHits[0].msg : "—"}</td>
       <td class="mono">${c.cost}ms</td><td class="mono ${c.det !== "L2" ? "warnt" : ""}">${c.det}</td></tr>`,
       )
       .join("")}</tbody></table>
    </div></div>
   <div class="col rcol"><div class="pad">
    <div class="sec"><span class="k">This build</span>
     <div class="big">${run.miss}<em>primitives recomputed</em></div>
     <div class="meta">${M({ cached: run.hit + " / " + run.total, "scenes touched": run.comps.filter((c) => c.misses).length + " / " + F3.scenes.length, "est. wall time": ((400 + run.miss * 310) / 1000).toFixed(1) + "s", "peak frame": peakCost + " ms" + (peakCost > 16 ? " · over real time" : " · real time"), "scenes over 16ms": overRealtime + " / " + run.comps.length, "tts calls": "0", spend: "$0.00" })}</div></div>
    <div class="sec secline"><span class="k">Determinism</span>
     <div class="meta">${M({ "semantic L1": "GUARANTEED", "pixel L2": "PINNED ENV", "gpu chains": run.comps.filter((c) => c.det !== "L2").length + " · L2-GPU", "byte-identical": "NOT CLAIMED" })}</div></div>
    <div class="sec secline"><span class="k">Build history</span>
     ${CACHE.history.map((h) => `<div class="hrow"><b>${h.at.toTimeString().slice(0, 8)}</b><em>${h.miss} recomputed of ${h.total}</em><u>${h.ms.toFixed(1)}s</u></div>`).join("") || '<div class="empty">NONE</div>'}</div>
    <div class="sec secline"><span class="k">Reported tensions</span>
     ${tensions()}</div>
    <div class="sec secline"><span class="k">Chain honesty</span>
     ${chainHonesty()}</div>
   </div></div></div>`;
}

/** WHAT THE COMPILER ACTUALLY SAID.
 *
 *  This panel used to write its own sentence for every override — "held
 *  against a rising abstraction curve" — whether or not the curve was
 *  rising and whether or not anything was in tension. The compiler already
 *  reports tensions, in its own words, and the whole reason it reports
 *  rather than resolves is so a human reads the actual sentence. */
function tensions() {
  const w = (window.STUDIO.plan && window.STUDIO.plan.warnings) || [];
  if (window.STUDIO.demo) {
    return F3.overrides.length
      ? F3.overrides
          .map((o) => `<div class="ruleHit">PIN ${o.sceneId.toUpperCase()} — example only.</div>`)
          .join("")
      : '<div class="empty">NONE</div>';
  }
  return w.length
    ? w.map((x) => `<div class="ruleHit">${esc(x)}</div>`).join("")
    : '<div class="empty">NONE — no invariant bit, no rule was overruled, no pin is in tension</div>';
}

/** How much of this film's chaining is real.
 *
 *  A five-primitive chain that renders as its last element looks five times
 *  richer than a chain of one. Stating the proportion is what stops the
 *  Compile view — the view whose whole claim is that it is deliberately
 *  boring and fully auditable — from being the most flattering surface in
 *  the app. */
function chainHonesty() {
  const scenes = F3.scenes || [];
  let links = 0;
  let real = 0;
  const over = [];
  for (const s of scenes) {
    const chain = s.chain || [];
    for (let i = 1; i < chain.length; i++) {
      links++;
      const spec = PRIMS[chain[i]];
      const io = spec ? spec.io.split("→")[0].trim() : "—";
      // A stage with no declared input overwrites what came before it.
      if (io === "—") over.push(chain[i - 1] + " → " + chain[i]);
      else real++;
    }
  }
  if (!links) return '<div class="empty">SINGLE-PRIMITIVE SCENES</div>';
  const pct = Math.round((real / links) * 100);
  const counts = new Map();
  for (const o of over) counts.set(o, (counts.get(o) ?? 0) + 1);
  const worst = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<div class="meta">${M({
    "links that carry something": pct + "%",
    "painted over": over.length + " of " + links,
  })}</div>${worst.map(([l, n]) => `<div class="mono pv-note">${esc(l)} · ×${n}</div>`).join("")}`;
}

/* ══ LAB ════════════════════════════════════════════════ */
function viewLab(root) {
  const id = APP.labPrim,
    P = PRIMS[id];
  APP.labParams = APP.labParams || {};
  const st =
    APP.labParams[id] ||
    (APP.labParams[id] = Object.fromEntries(
      Object.entries(P.params).map(([k, v]) => [k, v.s !== undefined ? v.s : v.v]),
    ));
  st.seed = st.seed || 1337;
  const fams = {};
  Object.values(PRIMS).forEach((x) => (fams[x.family] = fams[x.family] || []).push(x));
  const famKeys = Object.keys(fams).sort();
  const q = (APP.labQuery || "").toLowerCase();
  const match = (x) =>
    !q || x.id.includes(q) || x.family.toLowerCase().includes(q) || x.io.toLowerCase().includes(q);
  const shown = Object.values(PRIMS).filter(match).length;

  /* WHICH OF THESE THE FILM ACTUALLY USES.
   *
   * "123 of 123 primitives" told you nothing except that a lot exists. A
   * real 88-scene film reaches 24 of them and touches 10 of 20 families;
   * the other 99 have never appeared in anything. Presenting all 123 as
   * equals is what made the palette feel like a menu of effects rather
   * than a vocabulary — and it hid the fact that most of it is unproven.
   *
   * So each one is marked with what it is doing in THIS film: in the
   * current chain, used somewhere in the film, or never used. That is the
   * evidence a palette gets pruned on. */
  const inFilm = new Map();
  for (const sc of window.FILM.scenes || []) {
    for (const cid of sc.chain || []) inFilm.set(cid, (inFilm.get(cid) ?? 0) + 1);
  }
  const here = new Set((window.FILM.scenes || []).find((x) => x.id === APP.sel)?.chain || []);
  const badge = (x) => {
    if (here.has(x.id)) return '<s class="ph on">THIS SCENE</s>';
    const n = inFilm.get(x.id);
    if (n) return `<s class="ph">×${n}</s>`;
    return '<s class="ph off">UNUSED</s>';
  };
  root.innerHTML = `<div class="shell" style="grid-template-columns:238px minmax(0,1fr) 268px">
   <div class="col lcol"><div class="pad">
     <div class="sec"><input class="search" id="labq" placeholder="FILTER PALETTE" value="${(APP.labQuery || "").replace(/"/g, "&quot;")}">
      <div class="k" style="margin:10px 0 6px">${shown} of ${Object.keys(PRIMS).length} shown</div>
      <div class="labuse mono">${inFilm.size} used by this film · ${Object.keys(PRIMS).length - inFilm.size} never used by anything yet</div>
      ${famKeys
        .map((f) => {
          const ps = fams[f].filter(match);
          if (!ps.length) return "";
          return (
            `<div class="famh">${f}</div>` +
            ps
              .map(
                (x) =>
                  `<button class="pbtn ${x.id === id ? "on" : ""} ${inFilm.has(x.id) ? "used" : ""}" data-prim="${x.id}">${x.id}${badge(x)}<u>${x.io}</u></button>`,
              )
              .join("")
          );
        })
        .join("")}
     </div></div></div>
   <div class="col mcol">
     <div class="vhead"><h2>${id}</h2><span class="k" id="perf">measuring…</span></div>
     <div class="labstage"><canvas id="labc"></canvas></div>
     <div class="labnote"><p>${P.note}</p>
      <div class="meta" style="margin-top:10px;max-width:420px">${M({ family: P.family, signature: P.io, determinism: P.family[0] === "K" ? "L2-GPU · same GPU only" : "L2 · seeded", phase: P.phase ? "PHASE 1 — interface defined" : "PHASE 0 — build now" })}</div></div>
   </div>
   <div class="col rcol"><div class="pad" id="labr"></div></div></div>`;
  root.querySelectorAll("[data-prim]").forEach(
    (b) =>
      (b.onclick = () => {
        APP.labPrim = b.dataset.prim;
        stopLoops();
        viewLab(root);
      }),
  );
  const qi = document.getElementById("labq");
  if (qi)
    qi.oninput = () => {
      APP.labQuery = qi.value;
      const sel = qi.selectionStart;
      stopLoops();
      viewLab(root);
      const q2 = document.getElementById("labq");
      if (q2) {
        q2.focus();
        q2.setSelectionRange(sel, sel);
      }
    };
  const cv = document.getElementById("labc"),
    ctx = cv.getContext("2d");
  function size() {
    const r = cv.parentElement.getBoundingClientRect();
    cv.width = r.width;
    cv.height = r.height;
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  size();
  addEventListener("resize", size);
  let inst = P.make(st),
    avg = 0,
    n = 0;
  APP.labReset = () => {
    inst = P.make(st);
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, cv.width, cv.height);
    avg = 0;
    n = 0;
  };
  loop((t) => {
    const a = performance.now();
    inst.frame(ctx, cv.width, cv.height, t);
    const d = performance.now() - a;
    avg = avg * 0.94 + d * 0.06;
    n++;
    if (n % 12 === 0) {
      const el = document.getElementById("perf");
      if (el)
        el.textContent =
          "MEASURED " +
          avg.toFixed(1) +
          " ms/frame · " +
          (avg > 16 ? "OVER" : "WITHIN") +
          " 16ms BUDGET";
    }
  });
  drawLabRight(P, st, root);
}
function drawLabRight(P, st, root) {
  const el = document.getElementById("labr");
  el.innerHTML = `<div class="sec"><span class="k">Parameters</span>
   ${Object.entries(P.params)
     .map(([k, d]) =>
       d.s !== undefined
         ? `<div class="tin"><span class="k">${k}</span><input data-txt="${k}" value="${st[k]}"></div>`
         : sliderHTML(
             k,
             k.toUpperCase(),
             (st[k] - d.lo) / (d.hi - d.lo),
             String(d.lo),
             String(d.hi),
             d.int ? String(Math.round(st[k])) : st[k].toFixed(2),
           ),
     )
     .join("")}
   <div class="tin"><span class="k">seed</span><input data-txt="seed" value="${st.seed}"></div>
   <button class="btn wide" style="margin-top:10px" id="reseed">RESEED &amp; RESTART</button></div>
   <div class="sec secline"><span class="k">Saved recipes</span>
    <div class="rec"><b>text_dissolution</b><em>text_layout → glyph_to_points → particle_seek → particle_flow → particle_trail</em></div>
    <div class="rec"><b>evidence_reveal</b><em>document_surface → document_layout → camera_move → annotation → redaction</em></div>
    <div class="rec"><b>erosion</b><em>metaphor · particle decay from a solid form</em></div>
    <div class="rec"><b>accumulation</b><em>metaphor · particle_seek building a mass over time</em></div>
    <button class="btn wide" style="margin-top:12px">SAVE CURRENT AS RECIPE</button></div>`;
  bindSliders(el, null, (k, v) => {
    const d = P.params[k];
    st[k] = d.int ? Math.round(d.lo + v * (d.hi - d.lo)) : d.lo + v * (d.hi - d.lo);
    drawLabRight(P, st, root);
  });
  el.querySelectorAll("[data-txt]").forEach(
    (i) =>
      (i.oninput = () => {
        st[i.dataset.txt] = i.dataset.txt === "seed" ? +i.value || 1 : i.value;
      }),
  );
  const rs = document.getElementById("reseed");
  if (rs)
    rs.onclick = () => {
      st.seed = (st.seed * 7919 + 13) % 99991;
      APP.labReset();
      drawLabRight(P, st, root);
    };
}
Object.assign(window, { viewPreview, viewCompile, viewLab });
