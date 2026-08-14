/* CANOPTICON — ENGINEER. Backstage, and unmistakably so.
 *
 * Everything the compiler owns lives here and nowhere else: what was
 * recomputed and why, what the film is made of, and the 135 primitives it
 * is made of them from. Three tabs, not four destinations behind a hub.
 */
const ETABS = [
  ["compile", "Compile"],
  ["shots", "Shots"],
  ["palette", "Palette"],
];
const LABP = { params: {}, seed: 1337 };

function viewBuild(root) {
  root.innerHTML = `<div class="page"><div class="wrap">
    <div class="head"><span class="col"><span class="eyebrow">Backstage</span><h1>Backstage</h1><p class="sub">How the machine made it. Nothing here is required to direct a film — a director should be able to finish one without ever opening this room.</p></span></div>
    <div class="etabs">${ETABS.map(([id, l]) => `<button data-etab="${id}" class="${APP.eng === id ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="ebody"></div>
  </div></div>`;
  root.querySelectorAll("[data-etab]").forEach((b) => (b.onclick = () => {
    APP.eng = b.dataset.etab;
    go("build");
  }));
  ({ compile: engCompile, shots: engShots, palette: engPalette })[APP.eng](root.querySelector("#ebody"));
}

function engCompile(host) {
  const run = window.__lastRun || dryRun();
  const hist = (window.CACHE && CACHE.history) || [];
  host.innerHTML = `
  <div class="stat"><b>${run.miss}</b><span>primitives recomputed of ${run.total}. No voice was regenerated.</span></div>
  <div class="stats">
    <span class="stat"><b>${run.total - run.miss} / ${run.total}</b><span>cache hits</span></span>
    <span class="stat"><b>${run.comps.filter((c) => c.misses).length}</b><span>scenes touched</span></span>
    <span class="stat"><b>${((400 + run.miss * 310) / 1000).toFixed(1)}s</b><span>estimated wall time</span></span>
    <span class="stat"><b>${Math.max(...run.comps.map((c) => c.cost))} ms</b><span>peak frame cost</span></span>
    <span class="stat"></span>
  </div>
  <table class="t"><thead><tr><th>Scene</th><th>Function</th><th>Rung</th><th>Chain</th><th>Cache</th><th>Reason</th><th>Cost</th></tr></thead><tbody>
  ${run.comps.map((c) => `<tr><td class="n">${String(c.scene.n).padStart(2, "0")}</td>
    <td>${esc(c.scene.label)}<br><span class="lab">${c.scene.fn}</span></td>
    <td class="n">${c.tier.toLowerCase()}</td>
    <td><span class="id">${c.nodes.map((n) => n.prim).join(" → ")}</span></td>
    <td class="n">${c.hits}/${c.hits + c.misses}</td>
    <td class="lab">${c.reasons.length ? esc(c.reasons[0]) : "—"}</td>
    <td class="n">${c.cost} ms</td></tr>`).join("")}
  </tbody></table>
  ${hist.length ? `<span class="key" style="display:block;margin:28px 0 12px">Build history</span>
   <table class="t"><tbody>${hist.map((h) => `<tr><td class="n">${h.at.toTimeString().slice(0, 8)}</td><td>${h.miss} recomputed of ${h.total}</td><td class="n">${h.ms == null ? "\u2014" : h.ms.toFixed(1) + "s"}</td></tr>`).join("")}</tbody></table>` : ""}`;
}

function engShots(host) {
  const run = window.__lastRun || dryRun();
  const counts = new Map();
  run.comps.forEach((c) => {
    const k = c.nodes.slice(0, 2).map((n) => n.prim).join(" → ");
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted.length ? sorted[0][1] : 1;
  // A run is what it looks like when nobody made a decision.
  const runs = [];
  let start = 0;
  for (let i = 1; i <= run.comps.length; i++) {
    const same = i < run.comps.length && run.comps[i].nodes.slice(0, 2).map((n) => n.prim).join() === run.comps[start].nodes.slice(0, 2).map((n) => n.prim).join();
    if (!same) {
      if (i - start >= 3) runs.push({ from: run.comps[start].scene.n, to: run.comps[i - 1].scene.n, k: run.comps[start].nodes.slice(0, 2).map((n) => n.prim).join(" → "), n: i - start });
      start = i;
    }
  }
  host.innerHTML = `
  <div class="stat"><b>${run.comps.length}</b><span>shots, built from ${sorted.length} kinds of opening.</span></div>
  <span class="key" style="display:block;margin:26px 0 12px">What this film is made of</span>
  <div style="display:flex;flex-direction:column;gap:7px;max-width:760px">
  ${sorted.map(([k, n]) => `<div style="display:grid;grid-template-columns:220px minmax(0,1fr) 28px;gap:12px;align-items:center">
    <span class="id">${k}</span><span style="height:8px;background:#3b4349;width:${(n / max) * 100}%"></span><span class="n" style="font-size:11.5px;color:var(--dim)">${n}</span></div>`).join("")}
  </div>
  ${runs.length ? `<span class="key" style="display:block;margin:28px 0 12px">Repeated stretches</span>
   ${runs.map((r) => `<p class="note" style="margin-bottom:10px;max-width:70ch"><b style="color:var(--ink2)">Shots ${String(r.from).padStart(2, "0")}–${String(r.to).padStart(2, "0")}</b> — ${r.n} in a row built as <span class="id">${r.k}</span>. A grammar is a decision; a run is what it looks like when nobody made one. Take one of its alternatives in Direct, or move the curve under this stretch.</p>`).join("")}`
    : `<p class="note" style="margin-top:22px">No stretch of three or more shots shares an opening. The film is not repeating itself.</p>`}`;
}

function engPalette(host) {
  const ids = Object.keys(window.PRIMS || {});
  const fams = new Map();
  ids.forEach((id) => {
    const f = PRIMS[id].family || "other";
    if (!fams.has(f)) fams.set(f, []);
    fams.get(f).push(id);
  });
  const cur = PRIMS[APP.labPrim] || PRIMS[ids[0]];
  const pdefs = Object.entries(cur.params || {});
  host.innerHTML = `<div class="labgrid">
    <div>
      <div class="labstage"><canvas id="labcv"></canvas></div>
      <p class="note" style="margin-top:12px;max-width:66ch">${esc(cur.note || "")}</p>
      <div class="chips" style="margin-top:12px"><span class="chip">${cur.family || "—"}</span><span class="chip plain">${(cur.io && cur.io.takes) || "nothing"} → ${(cur.io && cur.io.emits) || "—"}</span><span class="chip plain">phase ${cur.phase ?? "—"}</span></div>
      <span class="key" style="display:block;margin:26px 0 10px">All ${ids.length} primitives</span>
      ${[...fams.entries()].map(([f, list]) => `<span class="lab" style="display:block;margin:16px 0 7px">${f} · ${list.length}</span>
        <div class="plist">${list.map((id) => `<button class="pcell ${id === APP.labPrim ? "on" : ""}" data-prim="${id}"><span class="id">${id}</span><span>${(PRIMS[id].io && PRIMS[id].io.emits) || ""}</span></button>`).join("")}</div>`).join("")}
    </div>
    <div>
      <span class="key" style="display:block;margin-bottom:12px">Parameters</span>
      ${pdefs.length ? pdefs.map(([k, d]) => (d.s !== undefined
        ? `<div class="blk"><span class="lab" style="display:block;margin-bottom:5px">${k}</span><input id="p_${k}" value="${esc(LABP.params[k] ?? d.s)}" style="width:100%;border:1px solid var(--line2);border-radius:3px;padding:7px 9px;font-size:12.5px"></div>`
        : sliderHTML(k, k, ((LABP.params[k] ?? d.v) - (d.lo ?? 0)) / ((d.hi ?? 1) - (d.lo ?? 0) || 1), String(d.lo ?? 0), String(d.hi ?? 1), String(LABP.params[k] ?? d.v)))).join("")
        : `<p class="note">This primitive takes no parameters.</p>`}
      <div class="blk"><span class="lab" style="display:block;margin-bottom:5px">seed</span><div style="display:flex;gap:8px;align-items:center"><span class="num" style="font-size:15px">${LABP.seed}</span><button class="b sm" id="reseed">Reseed</button></div></div>
    </div></div>`;

  host.querySelectorAll("[data-prim]").forEach((b) => (b.onclick = () => {
    APP.labPrim = b.dataset.prim;
    LABP.params = {};
    go("build");
  }));
  const rs = host.querySelector("#reseed");
  if (rs)
    rs.onclick = () => {
      LABP.seed = 1000 + ((LABP.seed * 7919) % 9000);
      go("build");
    };
  pdefs.forEach(([k, d]) => {
    if (d.s === undefined) return;
    const el = host.querySelector("#p_" + k);
    if (el) el.onchange = () => {
      LABP.params[k] = el.value;
      go("build");
    };
  });
  bindSliders(host, (k, frac) => {
    const d = cur.params[k],
      lo = d.lo ?? 0,
      hi = d.hi ?? 1;
    let v = lo + frac * (hi - lo);
    if (d.int) v = Math.round(v);
    LABP.params[k] = +v.toFixed(3);
    go("build");
  });
  runLabPrim();
}

function runLabPrim() {
  const cv = document.getElementById("labcv");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const r = cv.parentElement.getBoundingClientRect();
  cv.width = Math.max(200, Math.round(r.width));
  cv.height = Math.max(112, Math.round(r.height));
  const def = PRIMS[APP.labPrim];
  const params = { seed: LABP.seed };
  for (const [k, d] of Object.entries(def.params || {})) params[k] = LABP.params[k] ?? (d.s !== undefined ? d.s : d.v);
  const built = buildChain([{ id: APP.labPrim, params, seed: LABP.seed }], cv.width, cv.height, 6);
  loop((t) => {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (built.errors && built.errors.length) {
      ctx.fillStyle = "#e0664b";
      ctx.font = '500 12px "JetBrains Mono",monospace';
      ctx.fillText(built.errors[0], 16, 30);
      return;
    }
    ctx.drawImage(built.run(t % 6), 0, 0);
  });
}

Object.assign(window, { viewBuild, engCompile, engShots, engPalette });
