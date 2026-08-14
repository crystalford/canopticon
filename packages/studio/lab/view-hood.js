/* CANOPTICON — under the hood.
 *
 * Five groups, opened deliberately, and nobody has to come here to finish a
 * film. Questions rather than parameters: named stops, no decimals, and each
 * one says what it is for.
 */
const HOOD_TABS = [["direct", "Direct"], ["structure", "Structure"], ["visual", "Visual"], ["motion", "Motion"], ["continuity", "Continuity"]];
const MATERIALS = [["documentary", "paper"], ["technical", "ink"], ["pixel", "screen"], ["surreal", "particles"], ["kinetic", "light"]];
const MODES = [["cut", "Cut"], ["bridge", "Bridge"], ["oneshot", "One shot"], ["montage", "Montage"]];
const MODE_BLURB = {
  cut: "Every moment is its own shot. The film changes by cutting.",
  bridge: "Moments touch, and carry something across the join.",
  oneshot: "Continuous visual transformation. No cuts — the film must travel through intermediate states.",
  montage: "Moments collide, held apart. The collision is the argument.",
};
const Q = {
  abstraction: { q: "What is this becoming?", stops: [["grounded", 0.15], ["analytical", 0.45], ["abstract", 0.8]] },
  visualDensity: { q: "How much at once?", stops: [["sparse", 0.2], ["full", 0.55], ["dense", 0.88]] },
  motionEnergy: { q: "How should it move?", stops: [["hold", 0.12], ["drift", 0.45], ["surge", 0.85]] },
  humanPresence: { q: "Is anybody there?", stops: [["absent", 0.12], ["implied", 0.45], ["present", 0.85]] },
  experimentalism: { q: "How should it see?", stops: [["observe", 0.12], ["interpret", 0.45], ["transform", 0.85]] },
  typographicWeight: { q: "How loud is the type?", stops: [["quiet", 0.2], ["spoken", 0.5], ["shouted", 0.85]] },
};

function openHood() {
  const el = document.createElement("div");
  el.id = "hood";
  el.innerHTML = `<div class="hoodhead"><span class="col"><span class="eyebrow">Deeper</span><h3>Under the hood</h3></span><button class="b q sm" id="hoodclose">Close</button></div>
  <div class="hoodtabs">${HOOD_TABS.map(([id, l]) => `<button data-ht="${id}" class="${APP.hoodTab === id ? "on" : ""}">${l}</button>`).join("")}</div>
  <div class="hoodbody" id="hoodbody"></div>`;
  document.body.appendChild(el);
  el.querySelector("#hoodclose").onclick = () => {
    APP.hood = false;
    render();
  };
  el.querySelectorAll("[data-ht]").forEach((b) => (b.onclick = () => {
    APP.hoodTab = b.dataset.ht;
    render();
  }));
  paintHood();
}

function qq(param, now, scope) {
  const d = Q[param];
  let near = 0,
    bd = 9;
  d.stops.forEach(([, v], i) => {
    const x = Math.abs(v - now);
    if (x < bd) ((bd = x), (near = i));
  });
  return `<div class="qq" data-qq="${param}" data-scope="${scope}"><h4>${d.q}</h4>
  <div class="stops">${d.stops.map(([n, v], i) => `<button data-v="${v}" class="${i === near ? "near" : ""}">${n}</button>`).join("")}</div></div>`;
}

function paintHood() {
  const host = document.getElementById("hoodbody");
  if (!host) return;
  const f = window.FILM,
    s = selScene(),
    c = compFor(s.id);
  const st = c.state;
  host.innerHTML = ({
    direct: () => {
      const words = c.nodes.map((n) => CHAIN_WORDS[n.prim]).filter(Boolean);
      return `<div class="grp"><span class="key">This moment</span>
        <p class="note" style="color:var(--ink2);font-family:var(--serif);font-size:16px;line-height:1.5">${esc(s.text)}</p>
        <div class="fact" style="margin-top:14px"><span>reading</span><i>${stateVerb(c)}</i></div>
        <div class="fact"><span>built as</span><i>${c.tier.toLowerCase()}</i></div>
        <div class="fact"><span>holds for</span><i>${s.dur.toFixed(1)}s</i></div>
        <div class="fact"><span>costs</span><i>${c.cost} ms/frame</i></div>
        <p class="note" style="margin-top:12px">${words.length ? esc(words[0][0].toUpperCase() + words[0].slice(1) + (words.length > 1 ? ", " + words.slice(1, 3).join(", ") : "")) + "." : ""}</p>
        <div class="chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px">${c.nodes.map((n) => `<span class="chip">${n.prim}</span>`).join("")}</div>
      </div>
      <div class="grp"><span class="key">Say it in one word</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${VERBS.map((v) => `<button class="b sm" data-verb="${v.id}" title="${esc(v.heard)}" style="justify-content:flex-start">${v.label}</button>`).join("")}</div>
      </div>
      ${(f.bends || {})[s.id] ? `<div class="grp"><span class="key">You directed this</span>
        ${Object.entries(f.bends[s.id]).map(([k, v]) => `<div class="fact"><span>${paramName(k)}</span><i>${v > 0 ? "+" : ""}${v.toFixed(2)}</i></div>`).join("")}
        <button class="b sm" data-release style="margin-top:12px">Hand it back</button></div>` : ""}`;
    },
    structure: () => `<div class="grp"><span class="key">The argument</span>
        ${f.acts.map((a, i) => {
          const own = liveScenes().filter((x) => x.act === a.actId);
          return `<div class="fact"><span>${["One", "Two", "Three", "Four"][i] || i + 1} · ${esc(a.title)}</span><i>${own.length} · ${fmt(own.reduce((x, y) => x + y.dur, 0))}</i></div>`;
        }).join("")}
        <div class="fact"><span>whole film</span><i>${liveScenes().length} · ${fmt(f.runtime)}</i></div>
      </div>
      <div class="grp"><span class="key">This moment</span>
        <button class="b sm wide" data-cut style="margin-bottom:6px">${(f.cutScenes || []).includes(s.id) ? "Put it back in" : "Take it out of the film"}</button>
        <button class="b sm wide" data-edit>Rewrite the sentence</button>
        <p class="note" style="margin-top:10px">Removing a sentence removes its moment and re-times the film. Nothing is re-voiced.</p>
      </div>
      ${(f.cutScenes || []).length ? `<div class="grp"><span class="key">Taken out · ${f.cutScenes.length}</span>
        ${f.cutScenes.map((id) => {
          const x = f.scenes.find((y) => y.id === id);
          return x ? `<div class="fact"><span>${esc(x.label)}</span><i>out</i></div>` : "";
        }).join("")}</div>` : ""}`,
    visual: () => `<div class="grp"><span class="key">The whole film</span>
        <div class="qq"><h4>What is the world made of?</h4>
          <div class="stops">${MATERIALS.map(([id, n]) => `<button data-mat="${id}" class="${(f.visualLanguage || "documentary") === id ? "on" : ""}">${n}</button>`).join("")}</div></div>
        ${qq("experimentalism", f.identity.experimentalism ?? 0.3, "film")}
        ${qq("typographicWeight", f.identity.typographicWeight ?? 0.5, "film")}
        <div class="qq"><h4>What is the light like?</h4>
          <div class="stops">${(window.LOOKS || []).map((l) => `<button data-look="${l.id}" class="${Math.abs((f.colour || {}).key - l.colour.key) < 0.03 && Math.abs((f.colour || {}).temperature - l.colour.temperature) < 0.06 ? "on" : ""}">${l.name.toLowerCase()}</button>`).join("")}</div></div>
      </div>
      <div class="grp"><span class="key">This moment</span>
        ${qq("abstraction", c.abstraction, "sentence")}
        ${qq("visualDensity", st.visualDensity ?? 0, "sentence")}
        ${qq("humanPresence", st.humanPresence ?? 0, "sentence")}
      </div>`,
    motion: () => `<div class="grp"><span class="key">This moment</span>${qq("motionEnergy", st.motionEnergy ?? 0, "sentence")}</div>
      <div class="grp"><span class="key">The whole film</span>
        ${sliderHTML("cutRhythm", "Cutting", f.identity.cutRhythm ?? 0.4, "slow", "rapid")}
        ${sliderHTML("restraint", "Restraint", f.identity.restraint ?? 0.42, "maximal", "spare")}
        <p class="note">Restraint caps how many operations a moment is allowed to use. Spare films refuse the sixth idea.</p>
      </div>
      <div class="grp"><span class="key">Never let it</span>
        ${f.invariants.map((i) => `<div class="fact"><span>${paramName(i.param)}</span><i>${i.min != null ? "≥ " + i.min.toFixed(2) : "≤ " + i.max.toFixed(2)}</i></div>`).join("")}
        ${(st._held || []).length ? `<p class="note" style="margin-top:10px;color:var(--clay)">Holding here: ${esc(st._held.join(", "))}.</p>` : ""}
      </div>`,
    continuity: () => `<div class="grp"><span class="key">How the film connects</span>
        <div class="qq"><div class="stops" style="flex-direction:column;gap:14px;align-items:flex-start">
          ${MODES.map(([id, l]) => `<button data-mode="${id}" class="${f.continuity === id ? "on" : ""}" style="text-align:left">
            <span style="font-family:var(--serif);font-size:18px;display:block">${l}</span>
            <span style="font-size:12px;color:var(--dim);display:block;margin-top:2px;max-width:40ch;line-height:1.45">${MODE_BLURB[id]}</span></button>`).join("")}
        </div></div>
        <p class="note">One shot is not a different renderer. It is a constraint: the film may not solve a transition by cutting, so it has to travel through the states in between.</p>
        <p class="note" style="margin-top:10px;color:var(--clay)">Not yet sent to the compiler — map these to <span class="id">film-mode.ts</span> before shipping.</p>
      </div>`,
  })[APP.hoodTab]();
  bindHood(host, s, c);
}

function bindHood(host, s, c) {
  const f = window.FILM;
  host.querySelectorAll("[data-qq]").forEach((row) => {
    const param = row.dataset.qq,
      scope = row.dataset.scope;
    row.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => {
      const target = +b.dataset.v;
      if (scope === "film") {
        mark("the film's " + paramName(param));
        f.identity[param] = target;
        if (param === "experimentalism" && window.STUDIO && !window.STUDIO.demo) queueSave();
        changed();
        return toast("The film " + b.textContent + "s");
      }
      const now = param === "abstraction" ? c.abstraction : c.state[param] ?? 0;
      mark("“" + b.textContent + "” on one moment");
      bendScene(s, { [param]: +(target - now).toFixed(3) }, 0);
      changed();
    }));
  });
  host.querySelectorAll("[data-verb]").forEach((b) => (b.onclick = () => {
    const v = VERBS.find((x) => x.id === b.dataset.verb);
    mark("“" + v.label + "” on one moment");
    bendScene(s, v.d || {}, v.dur || 0);
    changed();
    toast(v.label + " — " + v.heard);
  }));
  host.querySelectorAll("[data-mat]").forEach((b) => (b.onclick = () => {
    mark("what the world is made of");
    f.visualLanguage = b.dataset.mat;
    if (window.STUDIO && !window.STUDIO.demo && window.STUDIO.projectId) setVisualLanguage(b.dataset.mat).catch((e) => toast("Compiler: " + e.message));
    changed();
  }));
  host.querySelectorAll("[data-look]").forEach((b) => (b.onclick = () => {
    const l = window.LOOKS.find((x) => x.id === b.dataset.look);
    mark("the light");
    f.colour = { ...l.colour };
    if (window.applyFilmPalette) applyFilmPalette();
    if (window.STUDIO && !window.STUDIO.demo && window.STUDIO.projectId) setColour(f.colour).catch(() => {});
    changed();
  }));
  host.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
    mark("the continuity");
    f.continuity = b.dataset.mode;
    changed();
    toast(MODE_BLURB[b.dataset.mode]);
  }));
  const rel = host.querySelector("[data-release]");
  if (rel) rel.onclick = () => {
    mark("directing one moment");
    delete f.bends[s.id];
    changed();
  };
  const cutb = host.querySelector("[data-cut]");
  if (cutb) cutb.onclick = () => cutSentence(s.id);
  const ed = host.querySelector("[data-edit]");
  if (ed) ed.onclick = () => {
    APP.hood = false;
    render();
    startEdit(s.id);
  };
  bindSliders(host, (id, v) => {
    f.identity[id] = +v.toFixed(2);
    changed();
  });
}

const CHAIN_WORDS = {
  document_surface: "a document surface", document_layout: "laid out as a page", camera_move: "a slow camera move over it",
  annotation: "marked up in the margin", text_stagger: "type arriving a word at a time", text_layout: "the words set as type",
  glyph_to_points: "the letters broken into points", particle_seek: "particles finding those letters",
  particle_flow: "particles carried on the field", particle_trail: "trails left behind them", noise_field: "a field of noise",
  flow_field: "a flow drawn through it", timeline_linear: "a line of time", variable_axis: "the type's weight shifting",
  blend: "layered over what came before", nest: "one image held inside another", shader_surface: "a shaded surface",
};

Object.assign(window, { openHood, paintHood, MATERIALS, MODES, MODE_BLURB, CHAIN_WORDS });
