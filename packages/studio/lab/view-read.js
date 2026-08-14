/* CANOPTICON — THE FILM, AND THE ARGUMENT BESIDE IT.
 *
 * A spread, not a stack. The page scrolls as a document; the film sticks
 * beside it with its state and its controls. Where you are in the writing is
 * where the film is.
 *
 * The previous attempt stacked film-above-argument inside one viewport and
 * the writing ended up with eighty pixels — the one thing this product
 * claims is the interface got the least room on screen.
 */
const FILM_CHAINS = new Map();
const VERB_BY_FN = { hook: "OPEN", establish: "GROUND", evidence: "ACCUMULATE", turn: "BREAK", resolve: "SETTLE" };
function stateVerb(c) {
  if (c.tier === "DISSOLVED") return "DISSOLVE";
  if (c.tier === "DECOMPOSED") return c.scene.fn === "turn" ? "BREAK" : "DECOMPOSE";
  return VERB_BY_FN[c.scene.fn] || "HOLD";
}
const HINTS = ["More abstract", "Too literal", "Let it breathe", "Like memory", "Bring a person in", "Pull back to the system"];
const MODE_WORD = { cut: "cut", bridge: "bridged", oneshot: "one continuous shot", montage: "montage" };
const SCOPE_WORD = { sentence: "this moment", section: "this section", film: "the whole film" };
const liveScenes = () => window.FILM.scenes.filter((s) => !(window.FILM.cutScenes || []).includes(s.id));
const runOf = () => window.__lastRun || dryRun();
const compFor = (id) => runOf().comps.find((c) => c.scene.id === id) || runOf().comps[0];

function viewRead(root) {
  const f = window.FILM;
  root.innerHTML = `<div class="spread" id="spread"><div class="spreadin">
    <div class="stageside"><div class="stagein">
      <div class="filmbox" id="fbox"><canvas id="fcv"></canvas>
        <div class="fmark" id="fmark"></div>
        <div class="fplay"><button id="pp">${PLAY.on ? "PAUSE" : "PLAY"}</button></div>
      </div>
      <!-- THE TRANSPORT BELONGS TO THE FILM.
           This column is sticky and it stacked film → state card →
           trajectory → transport, so on any normal viewport the only way
           to move through your own film was to scroll past its state and
           click the abstraction line. A scrub control that is not beside
           the picture is not a scrub control. -->
      <div class="scrub" id="scrub">
        <button class="scrubplay" id="pp3" aria-label="Play or pause">${PLAY.on ? "❚❚" : "▶"}</button>
        <div class="scrubbar" id="scrubbar" role="slider" aria-label="Seek"
             aria-valuemin="0" aria-valuemax="${Math.round(f.runtime)}" tabindex="0">
          <div class="scrubfill" id="scrubfill"></div>
          <div class="scrubticks" id="scrubticks"></div>
          <div class="scrubhead" id="scrubhead"></div>
        </div>
        <span class="num" id="tc2">${fmt(PLAY.t)}</span>
      </div>
      <div class="block statecard" id="statecard"></div>
      <div class="block traject" id="traject"><div class="tlab"><span class="key">How abstract it gets</span><span class="tnote">across the whole film</span></div><canvas id="tcv"></canvas></div>
      <div class="tmeta">
        <button class="b q sm" id="pp2">${PLAY.on ? "Pause" : "Play"}</button>
        <span class="num" id="tc">${fmt(PLAY.t)}</span><span class="of">of ${fmt(f.runtime)}</span>
        <span class="mode-word" id="tmode">${MODE_WORD[f.continuity]}</span>
      </div>
      <div class="block direct">
        <div class="dhead"><span class="key">Direct</span><button class="scope" id="scope">${SCOPE_WORD[APP.scope]}</button></div>
        <label class="said"><input id="say" placeholder="Say what should change" value="${esc(APP.said)}"></label>
        <div class="hints">${HINTS.map((h) => `<button data-hint="${esc(h)}">${esc(h)}</button>`).join("")}</div>
        <div id="heardhost"></div>
        <div class="dacts"><button class="b sm" id="explore">Explore readings</button><button class="b sm" id="editbtn">Rewrite this</button><button class="b q sm" id="cutbtn"></button></div>
      </div>
      <!-- SOUND, WHICH USED TO REPORT RATHER THAN ACT.
           Three buttons that set a field and repainted a label, under a
           line that said "nothing is spent until you render" — and
           renderFilm never records anything, it only reads narration
           that already exists. So the product told you the voice would
           arrive at render, it never would, and following the instruction
           produced a permanently silent film. "My voice" is gone for the
           same reason it went from Create: there is no recording path. -->
      <div class="block sound"><div class="dhead"><span class="key">Sound</span><span class="tnote" id="sndstate"></span></div>
        <div class="segs" data-voice>${["Synthesised", "None"].map((o) => `<button data-v="${o}" class="${(f.voice || "None") === o ? "on" : ""}">${o}</button>`).join("")}</div>
        <div class="sndbar" id="sndbar" hidden><div class="sndfill" id="sndfill"></div></div>
        <div class="dacts"><button class="b sm" id="recvoice">Record the voice</button></div>
      </div>
    </div></div>
    <div class="argside"><div class="argwrap" id="argwrap">${argumentHTML()}</div>
      <p class="argend">End of the argument. ${liveScenes().length} moments · ${fmt(f.runtime)}</p>
    </div>
  </div></div>`;
  bindArgument(root);
  bindDirect(root);
  sizeFilm();
  runFilm();
  runTrajectory();
  paintState();
  if (APP.alts) showAlternatives();
  if (APP.heard) paintHeard();
  bringCurrentIntoView(true);
}

/* ── the argument ──────────────────────────────────────────────────── */
function argumentHTML() {
  const f = window.FILM,
    cut = f.cutScenes || [];
  const marks = f.scenes.filter((s) => s.src && s.src.startChar >= 0).map((s) => ({ s, ...s.src })).sort((a, b) => a.startChar - b.startChar);
  const text = f.essay || f.scenes.map((s) => s.text).join(" ");
  const byAct = new Map();
  let at = 0;
  for (const m of marks) {
    if (m.startChar < at) continue;
    const pre = text.slice(at, m.startChar);
    at = m.endChar;
    if (!byAct.has(m.s.act)) byAct.set(m.s.act, []);
    byAct.get(m.s.act).push({ s: m.s, pre, body: text.slice(m.startChar, m.endChar) });
  }
  const tail = text.slice(at);
  const unbound = f.scenes.filter((s) => !s.src || s.src.startChar < 0);
  let out = "";
  f.acts.forEach((a, ai) => {
    const segs = byAct.get(a.actId);
    if (!segs) return;
    const own = liveScenes().filter((x) => x.act === a.actId);
    out += `<div class="acthead"><span class="anum">${["One", "Two", "Three", "Four", "Five"][ai] || ai + 1}</span>
      <h2>${esc(a.title)}</h2><span class="ameta">${own.length} moments · ${fmt(own.reduce((x, y) => x + y.dur, 0))}</span></div><p>`;
    for (const g of segs) {
      out += esc(g.pre).replace(/\n\n+/g, "</p><p>");
      out += `<span class="sn ${g.s.id === APP.sel ? "on" : ""}${cut.includes(g.s.id) ? " cut" : ""}" data-sn="${g.s.id}">${esc(g.body)}</span>`;
    }
    out += "</p>";
  });
  if (tail.trim()) out += `<p>${esc(tail).replace(/\n\n+/g, "</p><p>")}</p>`;
  if (unbound.length)
    out += `<div class="acthead"><span class="anum">Also</span><h2>Not located in the source</h2></div><p>` +
      unbound.map((s) => `<span class="sn ${s.id === APP.sel ? "on" : ""}" data-sn="${s.id}">${esc(s.text)}</span> `).join("") + "</p>";
  return out;
}

function bindArgument(root) {
  root.querySelectorAll("[data-sn]").forEach((el) => {
    el.onclick = () => setCurrent(el.dataset.sn, true);
    el.ondblclick = () => startEdit(el.dataset.sn);
  });
  const sc = root.querySelector("#spread");
  let raf = 0;
  sc.onscroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!PLAY.on) readingPosition(sc);
    });
  };
}

/** The reading line sits a third of the way down the page. */
const readingLine = (sc) => {
  const r = sc.getBoundingClientRect();
  return r.top + Math.max(60, Math.min(r.height * 0.3, 220));
};

function readingPosition(sc) {
  const line = readingLine(sc);
  let best = null,
    bd = 1e9;
  sc.querySelectorAll("[data-sn]").forEach((el) => {
    const d = Math.abs(el.getBoundingClientRect().top - line);
    if (d < bd) ((bd = d), (best = el));
  });
  if (best && best.dataset.sn !== APP.sel) setCurrent(best.dataset.sn, false);
}

/** Move the current moment without rebuilding the page. */
function setCurrent(id, seek) {
  APP.sel = id;
  APP.alts = null;
  const s = window.FILM.scenes.find((x) => x.id === id);
  if (!s) return;
  if (seek) PLAY.t = s.t0 + 0.01;
  document.querySelectorAll("[data-sn]").forEach((el) => el.classList.toggle("on", el.dataset.sn === id));
  const alts = document.querySelector(".alts2");
  if (alts) alts.remove();
  paintState();
  if (window.paintHood) paintHood();
}

/* WHAT THE FILM IS DOING, said in words.
 *
 * This card used to read "abstraction ▮▮▯▯ · density ▮▮▮▯ · motion ▮▮▯▯" — four
 * meters of the compiler's own state, which tells a director the machine's
 * numbers and not their film. The numbers are not gone; they are under the
 * hood, where a number is what you came for. Here the film says which movement
 * it is in, what that means, and what it is carrying through. */
const MOVES = [
  ["OPEN", "The film is stating its terms. Things are still what they are."],
  ["ACCUMULATE", "The ideas are beginning to gather. The field grows denser as the argument builds."],
  ["BREAK", "The material stops behaving. What was described is now being taken apart."],
  ["DISSOLVE", "Structure gives way. The film is closer to memory than to record."],
  ["EMERGE", "Out of the dispersal, one thing resolves. The film says what it means."],
];
function movementOf(c, s) {
  const a = c.abstraction;
  if ((s.pos ?? 0) < 0.16 && a < 0.36) return 0;
  if (a < 0.4) return 1;
  if (a < 0.6) return 2;
  if (a < 0.78) return 3;
  return 4;
}
function paintState() {
  const host = document.getElementById("statecard");
  if (!host) return;
  const s = selScene(),
    c = compFor(s.id),
    f = window.FILM;
  const st = c.state;
  const bent = (f.bends || {})[s.id];
  const mi = movementOf(c, s);
  const [mname, mwhat] = MOVES[mi];
  const carried = (s.entities || []).map((e) => {
    const m = (f.motifs || []).find((x) => x.id === e);
    return m ? m.concept.toLowerCase() : e;
  });
  host.innerHTML = `
  <div class="sctop"><b class="verb">${mname}</b><span class="slabel">${esc(s.label)}</span>
    ${bent ? '<span class="chip sage">directed</span>' : ""}${(f.cutScenes || []).includes(s.id) ? '<span class="chip clay">out</span>' : ""}</div>
  <p class="scwhat">${mwhat}</p>
  <div class="moves">${MOVES.map(([n], i) => `<span class="${i === mi ? "on" : i < mi ? "past" : ""}">${n}</span>`).join("")}</div>
  <p class="scwhy">${carried.length ? `Carrying through <b>${carried.join("</b>, <b>")}</b>. ` : ""}Held ${s.dur.toFixed(1)}s${(st._held || []).length ? ", where an invariant is holding it" : ""}.</p>`;
}

function bringCurrentIntoView(instant) {
  const sc = document.getElementById("spread"),
    el = sc && sc.querySelector("[data-sn].on");
  if (!sc || !el) return;
  const offset = readingLine(sc) - sc.getBoundingClientRect().top;
  const target = Math.max(0, el.offsetTop - offset);
  if (instant) sc.scrollTop = target;
  else if (Math.abs(sc.scrollTop - target) > 30) sc.scrollTop += (target - sc.scrollTop) * 0.16;
}

/* ── EDIT ──────────────────────────────────────────────────────────── */
function startEdit(id) {
  const el = document.querySelector(`[data-sn="${id}"]`);
  const s = window.FILM.scenes.find((x) => x.id === id);
  if (!el || !s) return;
  APP.editing = id;
  const box = document.createElement("textarea");
  box.className = "editing";
  box.value = s.text;
  box.rows = 3;
  el.replaceWith(box);
  box.focus();
  const finish = (keep) => {
    APP.editing = null;
    if (keep && box.value.trim() && box.value.trim() !== s.text) {
      mark("rewriting a sentence");
      s.text = box.value.trim();
      s.dur = Math.max(1.4, (s.text.split(/\s+/).length / 150) * 60);
      s.src = null;
      retime();
      changed();
      return toast("Rewritten — the film re-cut around it");
    }
    render();
  };
  box.onkeydown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) finish(true);
    if (e.key === "Escape") finish(false);
  };
  box.onblur = () => finish(true);
}
function cutSentence(id) {
  const f = window.FILM;
  mark("removing a sentence");
  f.cutScenes = f.cutScenes || [];
  f.cutScenes.includes(id) ? (f.cutScenes = f.cutScenes.filter((x) => x !== id)) : f.cutScenes.push(id);
  retime();
  changed();
}

/* ── the film ──────────────────────────────────────────────────────── */
function sizeFilm() {
  const box = document.getElementById("fbox");
  if (!box) return;
  const cv = document.getElementById("fcv");
  /* The film is capped by the WINDOW, not only by its column. Stacked on a
   * narrow window a full-width 16:9 frame is the entire viewport, which is
   * how the last version managed to show a film and nothing else. */
  const col = box.parentElement.clientWidth;
  const stacked = window.innerWidth <= 860;
  const maxH = window.innerHeight * (stacked ? 0.34 : 0.6);
  const w = Math.round(Math.max(240, Math.min(col, (maxH * 16) / 9)));
  const h = Math.round((w * 9) / 16);
  box.style.width = w + "px";
  box.style.height = h + "px";
  cv.width = w;
  cv.height = h;
  const tc = document.getElementById("tcv");
  if (tc) {
    tc.width = w * 2;
    tc.height = 76;
    tc.style.width = "100%";
  }
}

function filmRunner(c, cv) {
  const key = c.scene.id + "@" + cv.width + "#" + c.nodes.map((n) => n.hash).join(",");
  if (FILM_CHAINS.has(key)) return FILM_CHAINS.get(key);
  const chain = c.nodes.map((n) => ({ id: n.prim, params: n.params, seed: n.params.seed, ...(n.b ? { b: n.b } : {}) }));
  const shots = (c.shots || []).map((sh) => ({ startMs: sh.startMs - c.scene.t0 * 1000, endMs: sh.endMs - c.scene.t0 * 1000, params: sh.params || {} }));
  const dur = Math.max(0.1, c.scene.t1 - c.scene.t0);
  const b = shots.length > 1 ? buildSequence(chain, shots, cv.width, cv.height) : buildChain(chain, cv.width, cv.height, dur);
  const w = { b, single: shots.length <= 1 };
  if (FILM_CHAINS.size > 50) FILM_CHAINS.clear();
  FILM_CHAINS.set(key, w);
  return w;
}

function runFilm() {
  const cv = document.getElementById("fcv");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const f = window.FILM;
  const comps = runOf().comps.filter((c) => !(f.cutScenes || []).includes(c.scene.id));
  const at = (t) => comps.find((c) => t >= c.scene.t0 && t < c.scene.t1) || comps[comps.length - 1];
  window.addEventListener("resize", sizeFilm);
  let cur = "";
  const tick = () => {
    if (window.applyFilmPalette) applyFilmPalette();
    const now = performance.now();
    const dt = PLAY.last ? (now - PLAY.last) / 1000 : 0;
    PLAY.last = now;
    if (PLAY.on) PLAY.t = (PLAY.t + dt) % f.runtime;
    const c = at(PLAY.t);
    if (!c) return;
    if (c.scene.id !== cur) {
      cur = c.scene.id;
      const m = document.getElementById("fmark");
      if (m) m.innerHTML = `<span>${stateVerb(c)}</span><span>${esc(c.scene.label)}</span>`;
      if (PLAY.on) setCurrent(c.scene.id, false);
    }
    if (PLAY.on) bringCurrentIntoView(false);
    const { b, single } = filmRunner(c, cv);
    ctx.fillStyle = "#0a0c0d";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (b.errors && b.errors.length) {
      ctx.fillStyle = "#cf8b6a";
      ctx.font = '500 12px "JetBrains Mono",monospace';
      b.errors.slice(0, 4).forEach((e, i) => ctx.fillText(e, 18, 32 + i * 18));
    } else {
      const ms = (PLAY.t - c.scene.t0) * 1000;
      ctx.drawImage(single ? b.run(ms / 1000) : b.run(ms), 0, 0);
    }
    const tc = document.getElementById("tc");
    if (tc) tc.textContent = fmt(PLAY.t);
    paintScrub();
  };
  tick();
  loop(tick);
  const toggle = () => {
    PLAY.on = !PLAY.on;
    document.querySelectorAll("#pp").forEach((b) => (b.textContent = PLAY.on ? "PAUSE" : "PLAY"));
    document.querySelectorAll("#pp2").forEach((b) => (b.textContent = PLAY.on ? "Pause" : "Play"));
    const p3 = document.getElementById("pp3");
    if (p3) p3.textContent = PLAY.on ? "\u275a\u275a" : "\u25b6";
  };
  document.querySelectorAll("#pp,#pp2,#pp3").forEach((b) => (b.onclick = toggle));
  bindScrub();
}

/* ── THE SCRUBBER ──────────────────────────────────────────────────────
 *
 * A second VIEW onto the film's clock, never a second clock: `PLAY.t` stays
 * the single source, `runFilm`'s tick paints this, and dragging writes back
 * to the same place a click on the trajectory does. Two transports that
 * each kept their own time is the shape of bug this codebase has already
 * paid for twice.
 *
 * The act boundaries are drawn on it because a film is not a featureless
 * duration — knowing you are at the start of Act II is most of what a
 * position means. */
/** How many moments actually have a voice, from the plan the compiler
 *  returned — never from a local flag, because a local flag is how a film
 *  came to claim a voice it had never bought. */
function narratedCount() {
  const plan = window.STUDIO && window.STUDIO.plan;
  if (!plan || !window.narrationStatus) return 0;
  return narrationStatus(plan).narrated || 0;
}

function paintScrub() {
  const f = window.FILM;
  const fill = document.getElementById("scrubfill");
  if (!fill) return;
  const pct = Math.max(0, Math.min(1, PLAY.t / f.runtime)) * 100;
  fill.style.width = pct + "%";
  const head = document.getElementById("scrubhead");
  if (head) head.style.left = pct + "%";
  const tc2 = document.getElementById("tc2");
  if (tc2) tc2.textContent = fmt(PLAY.t);
}

function scrubTicks() {
  const f = window.FILM;
  const host = document.getElementById("scrubticks");
  if (!host || !f.acts) return;
  // One mark per act boundary, at the act's first live scene.
  const live = liveScenes();
  const marks = f.acts
    .map((a) => live.find((s) => s.actId === a.id))
    .filter(Boolean)
    .map((s) => (s.t0 / f.runtime) * 100);
  host.innerHTML = marks.map((p) => `<i style="left:${p}%"></i>`).join("");
}

function bindScrub() {
  const bar = document.getElementById("scrubbar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  scrubTicks();
  const seek = (clientX) => {
    const r = bar.getBoundingClientRect();
    const t = Math.max(0, Math.min(0.999, (clientX - r.left) / r.width)) * window.FILM.runtime;
    PLAY.t = t;
    paintScrub();
    // The argument follows the picture — the two are one document.
    const c = runOf().comps.find((x) => t >= x.scene.t0 && t < x.scene.t1);
    if (c) setCurrent(c.scene.id, true);
  };
  bar.onpointerdown = (e) => {
    bar.setPointerCapture(e.pointerId);
    seek(e.clientX);
    bar.onpointermove = (m) => seek(m.clientX);
  };
  bar.onpointerup = (e) => {
    bar.onpointermove = null;
    try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  // Keyboard, because a slider that only takes a mouse is not a control.
  bar.onkeydown = (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") PLAY.t = Math.max(0, PLAY.t - step);
    else if (e.key === "ArrowRight") PLAY.t = Math.min(window.FILM.runtime - 0.01, PLAY.t + step);
    else return;
    e.preventDefault();
    paintScrub();
  };
}

/* ── EXPLORE ───────────────────────────────────────────────────────── */
/* The same four rungs, in a clause that reads inside a sentence. */
const TIER_SHORT = {
  GROUNDED: "photographed, the thing still a thing in a room",
  ANNOTATED: "marked up, with a hand pointing at it",
  DECOMPOSED: "taken apart, the words becoming the material",
  DISSOLVED: "dissolved, no document left — only field and motion",
};
const TIER_BLURB = {
  GROUNDED: "Photographed. The thing stays a thing in a room.",
  ANNOTATED: "Marked up. The document, with a hand pointing at it.",
  DECOMPOSED: "Taken apart. The words become their own material.",
  DISSOLVED: "Dissolved. No document left — only field and motion.",
};
function showAlternatives() {
  const s = window.FILM.scenes.find((x) => x.id === APP.alts);
  const anchor = document.querySelector(`[data-sn="${APP.alts}"]`);
  if (!s || !anchor) return;
  const c = compFor(s.id);
  const others = LADDER.filter((l) => l.tier !== c.tier).slice(0, 3);
  const host = document.createElement("div");
  host.className = "alts2";
  host.innerHTML = `<span class="key" style="display:block;margin-bottom:10px">Three other readings of “${esc(s.label)}”</span>
  <div class="altrow">${others.map((l, i) => `<button class="alt2" data-take="${l.tier}">
    <span class="frame"><canvas></canvas></span>
    <span class="cap"><b>${"ABC"[i]} · ${l.tier[0] + l.tier.slice(1).toLowerCase()}</b><i>${esc(TIER_BLURB[l.tier])}</i></span></button>`).join("")}</div>`;
  anchor.closest("p").after(host);
  host.querySelectorAll(".alt2").forEach((el, i) => {
    const l = others[i];
    const cv = el.querySelector("canvas");
    const r = el.querySelector(".frame").getBoundingClientRect();
    cv.width = Math.max(120, Math.round(r.width));
    cv.height = Math.round((cv.width * 9) / 16);
    const ctx = cv.getContext("2d");
    const base = { ...(c.nodes[0] ? c.nodes[0].params : { seed: 1000 }) };
    const txt = (s.label || "").toUpperCase().slice(0, 26);
    const chain = l.base.map((p, j) => ({ id: p, params: { ...base, seed: (base.seed || 1000) + j, text: txt, heading: txt }, seed: (base.seed || 1000) + j }));
    const built = buildChain(chain, cv.width, cv.height, 5);
    loop((t) => {
      ctx.fillStyle = "#0a0c0d";
      ctx.fillRect(0, 0, cv.width, cv.height);
      if (!built.errors.length) ctx.drawImage(built.run(t % 5), 0, 0);
    });
    el.onclick = () => {
      mark("choosing a reading");
      window.FILM.overrides = window.FILM.overrides.filter((o) => !(o.sceneId === s.id && o.type === "rung"));
      window.FILM.overrides.push({ sceneId: s.id, type: "rung", tier: l.tier });
      APP.alts = null;
      changed();
      /* MIRRORED TO THE COMPILER, not just to this page.
       *
       * Taking a rung was local-only — the film changed in front of you
       * and the Worker never heard about it, so it survived until you
       * reloaded and no further. `directScene` is the route that already
       * exists for exactly this and was called from nowhere. Failure is
       * reported rather than swallowed: a choice that did not persist must
       * not look identical to one that did. */
      const pid = window.STUDIO && !window.STUDIO.demo && window.STUDIO.projectId;
      if (pid) {
        directScene(pid, s.id, l.base, `rung: ${l.tier.toLowerCase()}`).catch((e) =>
          toast("Kept here, but the compiler did not take it — " + e.message),
        );
      }
      toast("Taken — " + l.tier.toLowerCase());
    };
  });
}

/* ── DIRECT ────────────────────────────────────────────────────────── */
function bindDirect(root) {
  const say = root.querySelector("#say");
  say.oninput = () => (APP.said = say.value);
  say.onkeydown = (e) => {
    if (e.key === "Enter") hear(say.value);
  };
  root.querySelectorAll("[data-hint]").forEach((b) => (b.onclick = () => {
    say.value = b.dataset.hint;
    APP.said = say.value;
    hear(say.value);
  }));
  root.querySelector("#explore").onclick = () => {
    APP.alts = APP.sel;
    render();
  };
  root.querySelector("#editbtn").onclick = () => startEdit(APP.sel);
  const cb = root.querySelector("#cutbtn");
  const paintCut = () => {
    const out = (window.FILM.cutScenes || []).includes(APP.sel);
    cb.textContent = out ? "Put it back" : "Leave it out";
    cb.classList.toggle("on", out);
  };
  paintCut();
  cb.onclick = () => { cutSentence(APP.sel); };
  /* The voice chosen at Create has to be visible SOMEWHERE afterwards, or it
   * is a question the product asked and then forgot the answer to. */
  const snd = root.querySelector("#sndstate");
  const rec = root.querySelector("#recvoice");
  const paintSnd = () => {
    const f = window.FILM;
    const total = liveScenes().length;
    const n = narratedCount();
    const silent = (f.voice || "None") === "None";
    /* WHAT IS TRUE, rather than what is reassuring. Recording spends model
     * calls NOW; rendering never buys a voice. */
    snd.textContent = silent
      ? "silent \u2014 the words are burned into the frames"
      : n >= total && total > 0
        ? `narrated \u2014 all ${total} moments`
        : n
          ? `${n} of ${total} moments recorded`
          : "not recorded yet \u2014 recording speaks each moment once and stores it";
    if (rec) {
      rec.hidden = silent;
      rec.textContent = n >= total && total > 0 ? "Re-record the voice" : "Record the voice";
    }
  };
  paintSnd();
  root.querySelectorAll("[data-voice] [data-v]").forEach((b) => (b.onclick = () => {
    mark("choosing a voice");
    window.FILM.voice = b.dataset.v;
    root.querySelectorAll("[data-voice] [data-v]").forEach((x) => x.classList.toggle("on", x === b));
    paintSnd();
  }));
  if (rec) {
    rec.onclick = async () => {
      const id = window.STUDIO && window.STUDIO.projectId;
      if (!id) {
        toast("The example film has no compiler behind it \u2014 open a stored film to record a voice");
        return;
      }
      const bar = root.querySelector("#sndbar");
      const fill = root.querySelector("#sndfill");
      const total = liveScenes().length || 1;
      if (bar) bar.hidden = false;
      rec.disabled = true;
      // ONE runner, shared with Create. Narration spends money; two
      // implementations of it is the last thing this codebase needs.
      await narrateNow(id, (p) => {
        if (fill) fill.style.width = Math.round((p.done / total) * 100) + "%";
        if (snd) snd.textContent = `recording \u2014 ${p.done} of ${total}`;
      });
      rec.disabled = false;
      if (bar) bar.hidden = true;
      paintSnd();
    };
  }
  root.querySelector("#scope").onclick = () => {
    const order = ["sentence", "section", "film"];
    APP.scope = order[(order.indexOf(APP.scope) + 1) % 3];
    root.querySelector("#scope").textContent = SCOPE_WORD[APP.scope];
    if (APP.heard) hear(APP.said);
  };
}

function hear(text) {
  const t = (text || "").trim();
  APP.said = t;
  if (!t) {
    APP.heard = null;
    return paintHeard();
  }
  const hits = readIntent(t);
  if (!hits.length) {
    APP.heard = { dead: true };
    return paintHeard();
  }
  const d = {};
  let dur = 0;
  for (const v of hits) {
    for (const k in v.d || {}) d[k] = (d[k] || 0) + v.d[k];
    dur += v.dur || 0;
  }
  APP.heard = { said: hits.map((v) => v.heard).join(" "), d, dur };
  paintHeard();
}

function paintHeard() {
  const host = document.getElementById("heardhost");
  if (!host) return;
  const h = APP.heard;
  if (!h) return void (host.innerHTML = "");
  if (h.dead) {
    host.innerHTML = `<div class="heard2 dead"><span class="key">Not understood</span><p>Name what should change — more abstract, quieter, more human, longer — or use one of the suggestions above.</p></div>`;
    return;
  }
  const s = selScene(),
    c = compFor(s.id);
  host.innerHTML = `<div class="heard2"><span class="key">Heard · ${SCOPE_WORD[APP.scope]}</span>
    <p>${esc(h.said)}</p>
    <div class="rows">${Object.entries(h.d).map(([k, v]) => {
      const now = k === "abstraction" ? c.abstraction : c.state[k] ?? 0;
      return `<span>${paramName(k)} <i>${now.toFixed(2)} → ${clamp(now + v, 0, 1).toFixed(2)}</i></span>`;
    }).join("")}${h.dur ? `<span>duration <i>${s.dur.toFixed(1)}s → ${(s.dur + h.dur).toFixed(1)}s</i></span>` : ""}</div>
    <div class="act"><button class="b pri sm" id="ap">Apply</button><button class="b sm" id="cn">Cancel</button></div></div>`;
  document.getElementById("ap").onclick = () => {
    const scenes = APP.scope === "film" ? liveScenes() : APP.scope === "section" ? liveScenes().filter((x) => x.act === s.act) : [s];
    mark("a direction on " + SCOPE_WORD[APP.scope]);
    scenes.forEach((x) => bendScene(x, h.d, APP.scope === "sentence" ? h.dur : 0));
    APP.heard = null;
    APP.said = "";
    changed();
    toast("Applied to " + (scenes.length > 1 ? scenes.length + " moments" : "this moment"));
  };
  document.getElementById("cn").onclick = () => {
    APP.heard = null;
    paintHeard();
  };
}

function bendScene(s, d, dur) {
  const f = window.FILM;
  f.bends = f.bends || {};
  const b = (f.bends[s.id] = { ...(f.bends[s.id] || {}) });
  for (const k in d) b[k] = clamp((b[k] || 0) + d[k], -0.6, 0.6);
  if (dur) s.dur = Math.max(1.2, s.dur + dur);
  retime();
  if (window.STUDIO && !window.STUDIO.demo && window.STUDIO.projectId)
    directVerb(window.STUDIO.projectId, s.id, Object.keys(d)[0]).catch((e) => toast("Compiler: " + e.message));
}
const paramName = (id) => {
  const p = (window.PARAMS || []).find((x) => x.id === id);
  return p ? p.name.toLowerCase() : id;
};

Object.assign(window, { viewRead, TIER_SHORT, readingLine, argumentHTML, setCurrent, paintState, stateVerb, bendScene, paramName, compFor, runOf, liveScenes, cutSentence, sizeFilm, startEdit, hear, TIER_BLURB, MODE_WORD, SCOPE_WORD, FILM_CHAINS, bringCurrentIntoView });
