/* CANOPTICON — Narrative + Editorial views. */
const F2 = window.FILM;

/* ══ NARRATIVE ══════════════════════════════════════════ */
function viewNarrative(root) {
  const sel = APP.sel;
  const marks = F2.scenes
    .map((s) => ({ s, ...s.src }))
    .filter((m) => m.startChar >= 0)
    .sort((a, b) => a.startChar - b.startChar);
  let out = "",
    cur = 0;
  for (const m of marks) {
    out += esc(F2.essay.slice(cur, m.startChar));
    out += `<mark class="seg ${m.s.id === sel ? "on" : ""}" data-scene="${m.s.id}"><sup>${String(m.s.n).padStart(2, "0")}</sup>${esc(F2.essay.slice(m.startChar, m.endChar))}</mark>`;
    cur = m.endChar;
  }
  out += esc(F2.essay.slice(cur));
  root.innerHTML = `<div class="shell" style="grid-template-columns:minmax(0,1fr) 320px">
   <div class="col mcol" style="background:var(--bg)">
     <div class="vhead"><h2>Narrative</h2><span class="k">Single source of truth · ${F2.essay.length} chars · 16 scenes bound</span></div>
     <div class="col" style="flex:1"><div class="essay">${out.replace(/\n\n/g, "</p><p>")}</div></div>
   </div>
   <div class="col rcol"><div class="pad">
     <div class="sec"><span class="k">Segmentation proposal</span>
       <div class="meta" style="margin-bottom:14px">${M({ "proposed by": "llm:segment-1", "frozen artifact": "sha 4f1c…a20", "ratified by operator": "16 / 16" })}</div>
       ${F2.scenes
         .map(
           (s) => `<div class="segrow ${s.id === sel ? "on" : ""}" data-scene="${s.id}">
         <b>${String(s.n).padStart(2, "0")}</b>
         <div><em>${s.label}</em><u>${s.fn.toUpperCase()} · ${s.dur.toFixed(1)}s · [${s.src.startChar}–${s.src.endChar}]</u></div>
         <span class="chip ${s.fn === "turn" ? "em" : s.fn === "evidence" ? "cool" : ""}">${s.fn.slice(0, 4).toUpperCase()}</span></div>`,
         )
         .join("")}
     </div>
     <div class="sec secline"><span class="k">Narration assets</span>
       <div class="meta">${M({ voice: "workers-ai tts-1", takes: "16 frozen", alignment: "sentence-level", "regenerated this session": "0", spend: "$0.00" })}</div></div>
   </div></div></div>`;
  root.querySelectorAll("[data-scene]").forEach(
    (e) =>
      (e.onclick = () => {
        APP.sel = e.dataset.scene;
        render();
      }),
  );
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/* ══ EDITORIAL ══════════════════════════════════════════ */
const ARCP = [
  "abstraction",
  "archivalWeight",
  "dataWeight",
  "visualDensity",
  "humanPresence",
  "motionEnergy",
];
function viewEditorial(root) {
  root.innerHTML = `<div class="shell" style="grid-template-columns:238px minmax(0,1fr) 286px">
    <div class="col lcol"><div class="pad" id="lpane"></div></div>
    <div class="col mcol">
      <div class="vhead"><h2>Film Arc</h2><span class="k" id="arcnote">Drag a control point</span></div>
      <div class="arcwrap"><div class="acts">${F2.acts.map((a, i) => `<div style="flex:${(a.span[1] - a.span[0]) * 100}"><b>${["ACT I", "ACT II", "ACT III"][i]}</b><em>${a.title.toUpperCase()} · ${fmt(a.span[0] * F2.runtime)}–${fmt(a.span[1] * F2.runtime)}</em></div>`).join("")}</div>
        <div class="lanes" id="lanes"></div></div>
      <div class="strip" id="strip"></div>
    </div>
    <div class="col rcol"><div class="pad" id="rpane"></div></div></div>`;
  drawLeft();
  drawLanes();
  drawStrip();
  drawRight();
}

function drawLeft() {
  const p = document.getElementById("lpane");
  if (!p) return;
  const id = F2.identity;
  p.innerHTML = `<div class="sec"><h1 class="filmtitle">${F2.title}</h1><div class="meta" style="line-height:1.7">${F2.projectId.toUpperCase()} · 3 ACTS · 16 SCENES</div>
   <p class="logline">${F2.logline}</p></div>
   <div class="sec secline"><span class="k">Visual identity</span>
    ${sliderHTML("typographicWeight", "TYPOGRAPHY", id.typographicWeight, "QUIET", "LOUD")}
    ${sliderHTML("experimentalism", "EXPERIMENTALISM", id.experimentalism, "RESTRAINED", "EXPERIMENTAL")}
    ${sliderHTML("restraint", "RESTRAINT", id.restraint, "MAXIMAL", "SPARE")}
    ${sliderHTML("cutRhythm", "CUT RHYTHM", id.cutRhythm, "SLOW", "RAPID")}
   </div>
   <div class="sec secline"><span class="k">Invariants — ${F2.invariants.length} held</span>
    <div class="meta">${F2.invariants.map((i) => `<div class="mrow"><span>${i.param}</span><i>${i.min != null ? "MIN " + i.min.toFixed(2) : "MAX " + i.max.toFixed(2)}</i></div>`).join("")}</div></div>
   <div class="sec secline"><span class="k">Overrides</span>
    ${F2.overrides.map((o) => `<div class="ovr"><b>PIN · ${o.sceneId.toUpperCase()}</b><em>${o.note}</em><button class="rel" data-rel="${o.sceneId}">RELEASE PIN</button></div>`).join("") || '<div class="empty">NONE</div>'}</div>`;
  bindSliders(p, null, (k, v) => {
    F2.identity[k] = v;
    markDirty();
    drawLeft();
    drawStrip();
    drawRight();
  });
  p.querySelectorAll("[data-rel]").forEach(
    (b) =>
      (b.onclick = () => {
        F2.overrides = F2.overrides.filter((o) => o.sceneId !== b.dataset.rel);
        markDirty();
        drawLeft();
        drawStrip();
        drawRight();
      }),
  );
}

const PADP = 10;
function laneY(v) {
  return (1 - v) * (100 - PADP * 2) + PADP;
}
function paintLane(lane) {
  const pid = lane.dataset.lane,
    sel = pid === APP.arcSel,
    c = sel ? "#d8624a" : "#7b858d";
  const cps = F2.controlPoints,
    pts = cps.map((cp) => [cp.at * 1000, laneY(cp.v[pid])]);
  let d = "M" + pts[0][0] + "," + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const acts = F2.acts
    .slice(1)
    .map(
      (x) =>
        `<line x1="${x.span[0] * 1000}" y1="0" x2="${x.span[0] * 1000}" y2="100" stroke="#262a2e" vector-effect="non-scaling-stroke"/>`,
    )
    .join("");
  lane.querySelector("svg").innerHTML =
    `${acts}<path d="${d} L1000,100 L0,100 Z" fill="${c}" opacity=".06"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${sel ? 2 : 1.2}" vector-effect="non-scaling-stroke" opacity="${sel ? 1 : 0.85}"/>`;
  lane.querySelector(".cps").innerHTML = pts
    .map(
      (p) =>
        `<i style="left:${p[0] / 10}%;top:${p[1]}%;background:${sel ? c : "#0d0f11"};border-color:${c}"></i>`,
    )
    .join("");
  lane.classList.toggle("sel", sel);
  lane.querySelector(".val").textContent = cps[cps.length - 1].v[pid].toFixed(2);
}
function drawLanes() {
  const el = document.getElementById("lanes");
  if (!el) return;
  if (!el.dataset.built) {
    el.dataset.built = 1;
    el.innerHTML = ARCP.map((pid) => {
      const meta = F2.params.find((p) => p.id === pid);
      return `<div class="lane" data-lane="${pid}"><div class="ln">${meta.name}</div><div class="track"><svg viewBox="0 0 1000 100" preserveAspectRatio="none"></svg><div class="cps"></div></div><div class="val"></div></div>`;
    }).join("");
    el.querySelectorAll(".lane").forEach((lane) => {
      const tr = lane.querySelector(".track"),
        pid = lane.dataset.lane;
      tr.onpointerdown = (e) => {
        const r = tr.getBoundingClientRect();
        let i = 0,
          best = 9;
        F2.controlPoints.forEach((cp, j) => {
          const dd = Math.abs(cp.at - (e.clientX - r.left) / r.width);
          if (dd < best) {
            best = dd;
            i = j;
          }
        });
        APP.arcSel = pid;
        tr.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const rr = tr.getBoundingClientRect();
          const v = clamp(
            1 - (((ev.clientY - rr.top) / rr.height) * 100 - PADP) / (100 - PADP * 2),
            0,
            1,
          );
          F2.controlPoints[i].v[pid] = Math.round(v * 100) / 100;
          markDirty();
          drawLanes();
          drawStrip();
          drawRight();
          const note = document.getElementById("arcnote");
          if (note)
            note.textContent =
              pid +
              " @ " +
              (F2.controlPoints[i].at * 100).toFixed(0) +
              "% \u2192 " +
              F2.controlPoints[i].v[pid].toFixed(2);
        };
        move(e);
        tr.onpointermove = (ev) => {
          if (ev.buttons) move(ev);
        };
        tr.onpointerup = () => {
          tr.onpointermove = null;
        };
      };
    });
  }
  el.querySelectorAll(".lane").forEach(paintLane);
}
function drawStrip() {
  const el = document.getElementById("strip");
  if (!el) return;
  const run = dryRun();
  window.__run = run;
  el.innerHTML = `<div style="display:flex;align-items:baseline;gap:12px"><span class="k">Scene strip</span>
   <span class="k" style="margin-left:auto">${run.miss ? run.miss + " primitives dirty of " + run.total : "all " + run.total + " primitives cached"}</span></div>
   <div class="scenes">${run.comps
     .map((c) => {
       const cls = c.pin ? "pin" : c.misses ? "miss" : "hit";
       return `<div class="scn ${cls} ${c.scene.id === APP.sel ? "on" : ""}" data-scene="${c.scene.id}" title="${c.scene.label.replace(/"/g, "&quot;")} — ${c.tier}" >
      <s class="bar"></s><b>${String(c.scene.n).padStart(2, "0")}<i>${c.scene.dur.toFixed(1)}s</i></b><em>${c.scene.label}</em><u>${c.pin ? "PINNED" : c.tier}</u></div>`;
     })
     .join("")}</div>
   <div class="legend"><span><s style="background:#2f353a"></s>CACHE HIT</span><span><s style="background:#d8624a"></s>RECOMPUTE</span><span><s style="background:#6f9ec4"></s>PINNED — HELD</span></div>`;
  el.querySelectorAll("[data-scene]").forEach(
    (e) =>
      (e.onclick = () => {
        APP.sel = e.dataset.scene;
        drawStrip();
        drawRight();
      }),
  );
}

function drawRight() {
  const el = document.getElementById("rpane");
  if (!el) return;
  const run = window.__run || dryRun(),
    sel = run.comps.find((c) => c.scene.id === APP.sel) || run.comps[0];
  const motifState = {};
  run.comps.forEach((c) =>
    c.motifs.forEach((m) => {
      motifState[m.id] = m;
    }),
  );
  const tensions = run.comps.filter((c) => c.pin && c.state.abstraction > 0.4);
  el.innerHTML = `
  <div class="sec"><span class="k">Scene ${String(sel.scene.n).padStart(2, "0")} — composition</span>
    <p class="narr">${esc(sel.scene.text)}</p>
    <div class="meta" style="margin:10px 0 12px">${M({ "abstraction rung": sel.tier, "resolved abstraction": sel.abstraction.toFixed(2), determinism: sel.det, cost: sel.cost + " ms/frame" })}</div>
    <div class="chain">${sel.nodes.map((n) => `<div class="cn ${n.cached ? "" : "dirty"}"><b>${n.prim}</b><u>${n.hash}</u></div>`).join('<s class="arw">→</s>')}</div>
    ${sel.ruleHits.map((r) => `<div class="ruleHit">RULE ${r.id.toUpperCase()} — ${r.msg}</div>`).join("")}
    ${sel.notes.map((n) => `<div class="ruleHit soft">${n}</div>`).join("")}
  </div>
  <div class="sec secline"><span class="k">Visual memory</span>
    ${F2.motifs
      .map((m) => {
        const st = motifState[m.id];
        const i = st ? st.si : -1;
        return `<div class="motif ${i >= 0 ? "act" : ""}"><div class="mh">${m.concept}<em>${i >= 0 ? "STATE " + (i + 1) + "/" + m.states.length : "UNUSED"}</em></div>
      <div class="mb">${m.chain}</div>
      <div class="mstate">${m.states.map((s, j) => `<span class="${j === i ? "now" : j < i ? "past" : ""}">${s.toUpperCase()}</span>`).join("<s>→</s>")}</div></div>`;
      })
      .join("")}
  </div>
  <div class="sec secline"><span class="k">Directorial rules — ${F2.rules.length} active</span>
    ${F2.rules.map((r) => `<div class="rule ${r.severity}"><s></s>${r.text}</div>`).join("")}</div>
  <div class="sec secline"><span class="k">Compile</span>
    <button class="btn ${run.miss ? "em" : "pri"} wide" id="cbtn" ${run.miss ? "" : "disabled"}>${run.miss ? "RECOMPILE — " + run.miss + " PRIMITIVES" : "NOTHING TO REBUILD"}</button>
    <div class="meta">${M({ "est. rebuild": ((400 + run.miss * 310) / 1000).toFixed(1) + "s", cached: run.hit + " / " + run.total, "tts regeneration": "NONE", spend: "$0.00", "tension reported": tensions.length ? tensions.length + " · " + tensions[0].scene.id.toUpperCase() : "NONE" })}</div>
  </div>`;
  const b = document.getElementById("cbtn");
  if (b)
    b.onclick = () => {
      commit(run);
      APP.dirty = false;
      renderBar();
      drawStrip();
      drawRight();
    };
}
Object.assign(window, { viewNarrative, viewEditorial, esc });
