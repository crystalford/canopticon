/* CANOPTICON — Preview, Compile, Lab. */
// Follows the CURRENT film. A plain capture of window.FILM meant that
// loading a project updated the title bar and left every view rendering
// the built-in example underneath it.
const F3 = new Proxy({}, { get: (_t, k) => (window.FILM ? window.FILM[k] : undefined) });

/* ══ PREVIEW ════════════════════════════════════════════ */
const PLAY = { t: 0, on: false, last: 0 };
function viewPreview(root) {
  root.innerHTML = `<div class="shell" style="grid-template-columns:minmax(0,1fr) 300px">
   <div class="col mcol">
     <div class="vhead"><h2>Preview</h2><span class="k" id="pvstate"></span></div>
     <div class="stage"><canvas id="film"></canvas><div class="vo" id="vo"></div>
       <div class="hud" id="hud"></div></div>
     <div class="transport">
       <button class="btn" id="pp">${PLAY.on ? "PAUSE" : "PLAY"}</button>
       <div class="tl" id="tl"><div class="tlfill"></div><div class="tlhead"></div></div>
       <span class="mono tc" id="tc">0:00</span>
     </div>
   </div>
   <div class="col rcol"><div class="pad" id="pvright"></div></div></div>`;
  const cv = document.getElementById("film"),
    ctx = cv.getContext("2d");
  const runners = {};
  const run = dryRun();
  function sceneAt(t) {
    return (
      run.comps.find((c) => t >= c.scene.t0 && t < c.scene.t1) || run.comps[run.comps.length - 1]
    );
  }
  function runnerFor(c) {
    const key = c.scene.id + c.nodes.map((n) => n.hash).join("");
    if (runners[key]) return runners[key];
    const kw = c.scene.label
      .replace(/[^A-Za-z0-9 -]/g, "")
      .toUpperCase()
      .slice(0, 22);
    const p = { seed: 1000 + c.scene.n * 17 };
    let r;
    if (c.tier === "GROUNDED")
      r = PRIMS.document_surface.make(
        Object.assign(p, {
          age: 0.3 + c.state.archivalWeight * 0.6,
          columns: c.state.visualDensity > 0.6 ? 2 : 1,
          redaction: 0.15,
        }),
      );
    else if (c.tier === "ANNOTATED")
      r = PRIMS.timeline_linear.make(
        Object.assign(p, {
          marks: 0.25 + c.state.dataWeight * 0.75,
          fragment: c.abstraction * 0.5,
          orientation: 0,
        }),
      );
    else if (c.tier === "DECOMPOSED")
      r = PRIMS.particle_seek.make(
        Object.assign(p, {
          text: kw,
          damping: 0.9 - c.state.motionEnergy * 0.12,
          force: 0.02 + c.state.motionEnergy * 0.08,
          scatter: 1,
        }),
      );
    else
      r = PRIMS.particle_flow.make(
        Object.assign(p, {
          count: 0.15 + c.state.visualDensity * 0.75,
          speed: 0.15 + c.state.motionEnergy * 0.7,
          turbulence: c.abstraction,
          trail: 0.03 + (1 - c.state.visualDensity) * 0.12,
        }),
      );
    runners[key] = r;
    return r;
  }
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    cv.width = r.width;
    cv.height = r.height;
  }
  resize();
  addEventListener("resize", resize);
  let cur = "";
  loop(() => {
    const now = performance.now();
    const dt = PLAY.last ? (now - PLAY.last) / 1000 : 0;
    PLAY.last = now;
    if (PLAY.on) {
      PLAY.t = (PLAY.t + dt) % F3.runtime;
    }
    const c = sceneAt(PLAY.t);
    if (c.scene.id !== cur) {
      cur = c.scene.id;
      document.getElementById("vo").innerHTML = `<span>${esc(c.scene.text)}</span>`;
      document.getElementById("hud").innerHTML =
        `<div><b>SC ${String(c.scene.n).padStart(2, "0")}</b> ${c.scene.fn.toUpperCase()} · ${c.tier}${c.pin ? " · PINNED" : ""}</div>
        <div>${c.nodes.map((n) => n.prim).join(" → ")}</div>
        <div>abstraction ${c.abstraction.toFixed(2)} · density ${c.state.visualDensity.toFixed(2)} · energy ${c.state.motionEnergy.toFixed(2)} · human ${c.state.humanPresence.toFixed(2)}</div>`;
      document.getElementById("pvstate").textContent =
        c.det + " DETERMINISM · SEED " + (1000 + c.scene.n * 17);
      drawPvRight(c);
    }
    runnerFor(c).frame(ctx, cv.width, cv.height, PLAY.t);
    const p = (PLAY.t / F3.runtime) * 100;
    const f = document.querySelector(".tlfill"),
      hd = document.querySelector(".tlhead");
    if (f) {
      f.style.width = p + "%";
      hd.style.left = p + "%";
      document.getElementById("tc").textContent = fmt(PLAY.t);
    }
  });
  document.getElementById("pp").onclick = (e) => {
    PLAY.on = !PLAY.on;
    e.target.textContent = PLAY.on ? "PAUSE" : "PLAY";
  };
  const tl = document.getElementById("tl");
  tl.innerHTML += run.comps
    .map(
      (c) =>
        `<i class="mk ${c.pin ? "pin" : c.misses ? "miss" : ""}" style="left:${(c.scene.t0 / F3.runtime) * 100}%"></i>`,
    )
    .join("");
  tl.onpointerdown = (e) => {
    const r = tl.getBoundingClientRect();
    PLAY.t = clamp((e.clientX - r.left) / r.width, 0, 0.999) * F3.runtime;
  };
  drawPvRight(sceneAt(PLAY.t));
}
function drawPvRight(c) {
  const el = document.getElementById("pvright");
  if (!el) return;
  el.innerHTML = `<div class="sec"><span class="k">Scene ${String(c.scene.n).padStart(2, "0")} · ${c.scene.label}</span>
   <div class="statusrow">${["draft", "ready", "approved", "flagged"].map((s) => `<button class="chip ${s === "approved" ? "ok" : ""}">${s.toUpperCase()}</button>`).join("")}</div></div>
   <div class="sec secline"><span class="k">Timestamped notes</span>
    <div class="note"><b>02:41</b><em>The fragmentation reads as an error rather than an argument. Pull motion energy down here, or hold the flat timeline one beat longer.</em></div>
    <div class="note"><b>03:58</b><em>Good. The word arriving out of scatter is the whole thesis in four seconds.</em></div>
    <div class="addnote">+ NOTE AT ${fmt(PLAY.t)}</div></div>
   <div class="sec secline"><span class="k">Resolved state at playhead</span>
    <div class="meta">${["abstraction", "archivalWeight", "dataWeight", "visualDensity", "humanPresence", "motionEnergy"].map((k) => `<div class="mrow"><span>${k}</span><i>${c.state[k].toFixed(2)}</i></div>`).join("")}</div>
    ${c.state._held.length ? `<div class="ruleHit soft">INVARIANT · ${c.state._held.join(" · ")}</div>` : ""}
   </div>`;
}

/* ══ COMPILE ════════════════════════════════════════════ */
function viewCompile(root) {
  const run = dryRun();
  const totalCost = run.comps.reduce((a, c) => a + c.cost, 0);
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
     <div class="meta">${M({ cached: run.hit + " / " + run.total, "scenes touched": run.comps.filter((c) => c.misses).length + " / " + F3.scenes.length, "est. wall time": ((400 + run.miss * 310) / 1000).toFixed(1) + "s", "frame budget": totalCost + " ms", "tts calls": "0", spend: "$0.00" })}</div></div>
    <div class="sec secline"><span class="k">Determinism</span>
     <div class="meta">${M({ "semantic L1": "GUARANTEED", "pixel L2": "PINNED ENV", "gpu chains": run.comps.filter((c) => c.det !== "L2").length + " · L2-GPU", "byte-identical": "NOT CLAIMED" })}</div></div>
    <div class="sec secline"><span class="k">Build history</span>
     ${CACHE.history.map((h) => `<div class="hrow"><b>${h.at.toTimeString().slice(0, 8)}</b><em>${h.miss} recomputed of ${h.total}</em><u>${h.ms.toFixed(1)}s</u></div>`).join("") || '<div class="empty">NONE</div>'}</div>
    <div class="sec secline"><span class="k">Reported tensions</span>
     ${F3.overrides.map((o) => `<div class="ruleHit">PIN ${o.sceneId.toUpperCase()} held against a rising abstraction curve. Not resolved — reported.</div>`).join("") || '<div class="empty">NONE</div>'}</div>
   </div></div></div>`;
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
  root.innerHTML = `<div class="shell" style="grid-template-columns:238px minmax(0,1fr) 268px">
   <div class="col lcol"><div class="pad">
     <div class="sec"><input class="search" id="labq" placeholder="FILTER PALETTE" value="${(APP.labQuery || "").replace(/"/g, "&quot;")}">
      <div class="k" style="margin:10px 0 14px">${shown} of ${Object.keys(PRIMS).length} primitives · ${famKeys.length} families</div>
      ${famKeys
        .map((f) => {
          const ps = fams[f].filter(match);
          if (!ps.length) return "";
          return (
            `<div class="famh">${f}</div>` +
            ps
              .map(
                (x) =>
                  `<button class="pbtn ${x.id === id ? "on" : ""}" data-prim="${x.id}">${x.id}${x.phase ? '<s class="ph">P1</s>' : ""}<u>${x.io}</u></button>`,
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
